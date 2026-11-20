import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/access";
import { splitItemized } from "@/lib/split";
import { formatIDR } from "@/lib/money";
import { formatDate } from "@/lib/site";
import { paymentInfo } from "@/lib/payment";
import { deleteExpense } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { QrisCode } from "@/components/qris-code";
import { SettleButton } from "@/components/settle-button";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";

export default async function ExpensePage({ params }: PageProps<"/groups/[groupId]/expenses/[expenseId]">) {
  const { groupId, expenseId } = await params;
  const { me } = await requireMember(groupId);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    include: {
      paidBy: { include: { user: true } },
      items: { orderBy: { position: "asc" }, include: { assignees: { include: { member: true } } } },
      shares: { include: { member: true } },
      settlements: true,
    },
  });
  if (!expense) notFound();

  const payer = expense.paidBy;
  const pay = paymentInfo(payer);

  const breakdown =
    expense.splitType === "ITEMIZED"
      ? splitItemized({
          items: expense.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            assignees: i.assignees.map((a) => a.memberId),
          })),
          tax: expense.tax,
          service: expense.service,
          discount: expense.discount,
        }).perMember
      : null;

  const paidSoFar = (memberId: string) =>
    expense.settlements
      .filter((s) => s.fromId === memberId && s.toId === payer.id)
      .reduce((a, s) => a + s.amount, 0);

  // you first, then the person who paid, then by amount
  const shares = [...expense.shares].sort((a, b) => {
    const rank = (id: string) => (id === me.id ? 0 : id === payer.id ? 1 : 2);
    return rank(a.memberId) - rank(b.memberId) || b.amount - a.amount;
  });
  const debtors = shares.filter((s) => s.memberId !== payer.id && s.amount > 0);
  const outstanding = debtors.reduce((a, s) => a + Math.max(0, s.amount - paidSoFar(s.memberId)), 0);
  const subtotal = expense.items.reduce((a, i) => a + i.price, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink href={`/groups/${groupId}`}>Back to group</BackLink>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{expense.description}</h1>
            <p className="muted mt-1">{formatDate(expense.date, "long")}</p>
          </div>
          <div className="text-right">
            <p className="label mb-0">Total</p>
            <p className="text-2xl font-bold tabular-nums">{formatIDR(expense.total)}</p>
          </div>
        </div>
      </div>

      {/* Who paid and how to pay them */}
      <section className="rounded-lg bg-strong p-5 text-strong-fg">
        <p className="text-xs font-semibold tracking-wide text-strong-accent uppercase">Pay back to</p>
        <p className="mt-1 text-2xl font-bold">
          {payer.name}
          {payer.id === me.id && <span className="font-normal text-strong-fg/75"> (you)</span>}
        </p>
        <p className="mt-1 text-sm text-strong-fg/80">
          {outstanding > 0 ? `${formatIDR(outstanding)} still to be paid back` : "Everyone has paid back."}
        </p>

        {pay.accountNumber ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-bg p-4 text-ink">
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase">{pay.bankName ?? "Bank account"}</p>
              <p className="font-mono text-xl tracking-wider">{pay.accountNumber}</p>
              {pay.accountHolder && <p className="text-sm">a.n. {pay.accountHolder}</p>}
            </div>
            <CopyButton text={pay.accountNumber} label="Copy account number" />
          </div>
        ) : null}

        {!pay.accountNumber && !pay.qrisPayload && (
          <p className="mt-4 rounded-md bg-bg p-3 text-sm text-ink">
            {payer.name} has not added a bank account or QRIS yet.{" "}
            {payer.id === me.id ? (
              <Link href="/profile" className="link font-semibold">
                Add yours in Profile.
              </Link>
            ) : payer.userId ? (
              "Ask them to add it in their profile."
            ) : (
              <Link href={`/groups/${groupId}`} className="link font-semibold">
                Add it on the group page.
              </Link>
            )}
          </p>
        )}
      </section>

      {/* Each person */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Each person&apos;s share</h2>
        {shares.map((s) => {
          const isPayer = s.memberId === payer.id;
          const paid = paidSoFar(s.memberId);
          const due = Math.max(0, s.amount - paid);
          const mine = s.memberId === me.id;
          const b = breakdown?.[s.memberId];
          return (
            <article key={s.id} className={`card space-y-4 ${mine ? "border-ink" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {s.member.name} {mine && <span className="font-normal text-muted">(you)</span>}
                  </p>
                  <div className="mt-1">
                    {isPayer ? (
                      <span className="badge-neutral">Paid the bill</span>
                    ) : due === 0 ? (
                      <span className="badge-owed">Paid back</span>
                    ) : paid > 0 ? (
                      <span className="badge-owe">{formatIDR(due)} left to pay</span>
                    ) : (
                      <span className="badge-owe">Not paid yet</span>
                    )}
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums">{formatIDR(s.amount)}</p>
              </div>

              {b && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">What {mine ? "you" : s.member.name} had</summary>
                  <ul className="mt-2 space-y-1">
                    {b.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{it.name}</span>
                        <span className="tabular-nums">{formatIDR(it.amount)}</span>
                      </li>
                    ))}
                    {b.extras !== 0 && (
                      <li className="flex justify-between gap-3 text-muted">
                        <span>Share of tax, service and discount</span>
                        <span className="tabular-nums">{formatIDR(b.extras)}</span>
                      </li>
                    )}
                  </ul>
                </details>
              )}

              {!isPayer && due > 0 && (
                <div className="flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-start sm:justify-between">
                  {pay.qrisPayload ? (
                    <details open={mine} className="text-sm">
                      <summary className="cursor-pointer font-semibold">
                        Pay {formatIDR(due)} to {payer.name} with QRIS
                      </summary>
                      <div className="mt-3">
                        <QrisCode payload={pay.qrisPayload} amount={due} />
                      </div>
                    </details>
                  ) : (
                    <p className="text-sm">
                      Transfer <b className="tabular-nums">{formatIDR(due)}</b> to {payer.name}.
                    </p>
                  )}
                  <SettleButton
                    groupId={groupId}
                    fromId={s.memberId}
                    toId={payer.id}
                    amount={due}
                    expenseId={expense.id}
                    label={mine ? "I have paid" : "Mark as paid"}
                  />
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Receipt summary */}
      {expense.splitType === "ITEMIZED" && (
        <section className="card space-y-3 text-sm">
          <h2 className="text-lg font-bold">Receipt</h2>
          <ul className="divide-y divide-line">
            {expense.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span>
                  {i.quantity > 1 && <span className="tabular-nums">{i.quantity} x </span>}
                  {i.name}
                  <span className="block text-xs text-muted">
                    {i.assignees.length > 1
                      ? `Shared by ${i.assignees.map((a) => a.member.name).join(", ")}`
                      : (i.assignees[0]?.member.name ?? "")}
                  </span>
                </span>
                <span className="tabular-nums">{formatIDR(i.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-line pt-3">
            <Line label="Subtotal" value={subtotal} />
            {expense.tax > 0 && <Line label="Tax" value={expense.tax} />}
            {expense.service > 0 && <Line label="Service charge" value={expense.service} />}
            {expense.discount > 0 && <Line label="Discount" value={-expense.discount} />}
            <Line label="Total" value={expense.total} bold />
          </dl>
        </section>
      )}

      {expense.receiptUrl && (
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Receipt photo</h2>
          <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expense.receiptUrl}
              alt={`Receipt for ${expense.description}`}
              className="max-h-96 w-full rounded-md object-contain"
            />
          </a>
        </section>
      )}

      {expense.note && (
        <section className="card">
          <h2 className="label">Note</h2>
          <p className="text-sm whitespace-pre-line">{expense.note}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/groups/${groupId}/expenses/${expenseId}/edit`} className="btn">
          <Pencil size={14} aria-hidden />
          Edit bill
        </Link>
        <form action={deleteExpense.bind(null, groupId, expenseId)}>
          <ConfirmButton message={`Delete "${expense.description}"? This cannot be undone.`}>Delete bill</ConfirmButton>
        </form>
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatIDR(value)}</dd>
    </div>
  );
}
