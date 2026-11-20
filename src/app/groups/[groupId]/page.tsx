import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/access";
import { netBalances, suggestTransfers } from "@/lib/split";
import { formatIDR } from "@/lib/money";
import { formatDate } from "@/lib/site";
import { hasPaymentInfo, paymentInfo } from "@/lib/payment";
import { deleteGroup, deleteSettlement } from "@/app/actions";
import { RenameGroupForm } from "@/components/rename-group-form";
import { InviteLink } from "@/components/invite-link";
import { SettleButton } from "@/components/settle-button";
import { BackLink } from "@/components/back-link";
import { BalanceBadge } from "@/components/balance-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { Members } from "./members";
import { ArrowRight, Plus, ReceiptText } from "lucide-react";

export default async function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  const { groupId } = await params;
  const { me } = await requireMember(groupId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { orderBy: { createdAt: "asc" }, include: { user: true } },
      expenses: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { shares: { select: { memberId: true, amount: true } } },
      },
      settlements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!group) notFound();

  const name = new Map(group.members.map((m) => [m.id, m.name]));
  const balances = netBalances(
    group.members.map((m) => m.id),
    group.expenses,
    group.settlements,
  );
  const transfers = suggestTransfers(balances);
  const iAmFresh =
    !group.expenses.some((e) => e.paidById === me.id || e.shares.some((s) => s.memberId === me.id)) &&
    !group.settlements.some((s) => s.fromId === me.id || s.toId === me.id);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink href="/groups">Your groups</BackLink>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <div className="mt-2">
              <BalanceBadge amount={balances[me.id] ?? 0} />
            </div>
          </div>
          <Link href={`/groups/${groupId}/expenses/new`} className="btn-primary">
            <Plus size={16} aria-hidden />
            Add a bill
          </Link>
        </div>
      </div>

      {/* Settle up */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Settle up</h2>
        {transfers.length === 0 ? (
          <p className="muted">Nobody owes anything in this group.</p>
        ) : (
          <ul className="divide-y divide-line">
            {transfers.map((t) => (
              <li key={t.fromId + t.toId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <b>{name.get(t.fromId)}</b>
                  <ArrowRight size={14} className="text-muted" aria-label="pays" />
                  <b>{name.get(t.toId)}</b>
                  <span className="font-semibold tabular-nums">{formatIDR(t.amount)}</span>
                </span>
                <SettleButton groupId={groupId} fromId={t.fromId} toId={t.toId} amount={t.amount} />
              </li>
            ))}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Everyone&apos;s balance</summary>
          <ul className="mt-3 space-y-2">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>{m.name}</span>
                <BalanceBadge amount={balances[m.id] ?? 0} subject={m.name} />
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* Bills */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Bills</h2>
        {group.expenses.length === 0 ? (
          <p className="card muted">No bills yet. Use &quot;Add a bill&quot; and start with the receipt.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {group.expenses.map((e) => {
              const mine = e.shares.find((s) => s.memberId === me.id)?.amount ?? 0;
              return (
                <li key={e.id}>
                  <Link
                    href={`/groups/${groupId}/expenses/${e.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-bg"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line text-muted">
                      <ReceiptText size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.description}</p>
                      <p className="text-xs text-muted">
                        {formatDate(e.date)} · {name.get(e.paidById)} paid {formatIDR(e.total)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted">Your share</p>
                      <p className="font-semibold tabular-nums">{formatIDR(mine)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Members */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Members</h2>
        <Members
          groupId={groupId}
          canClaim={iAmFresh}
          members={group.members.map((m) => ({
            id: m.id,
            name: m.name,
            isGuest: !m.userId,
            isMe: m.id === me.id,
            hasPayment: hasPaymentInfo(paymentInfo(m)),
            payment: {
              bankName: m.bankName ?? "",
              accountNumber: m.accountNumber ?? "",
              accountHolder: m.accountHolder ?? "",
              qrisPayload: m.qrisPayload ?? "",
            },
          }))}
        />
        <div>
          <p className="label">Invite link</p>
          <InviteLink path={`/join/${group.inviteCode}`} />
          <p className="mt-2 text-xs text-muted">Anyone with this link can join the group after signing in.</p>
        </div>
      </section>

      {/* Payment history */}
      {group.settlements.length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Payments recorded</h2>
          <ul className="divide-y divide-line text-sm">
            {group.settlements.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {name.get(s.fromId)} paid {name.get(s.toId)}{" "}
                  <span className="font-semibold tabular-nums">{formatIDR(s.amount)}</span>
                  <span className="block text-xs text-muted">{formatDate(s.createdAt)}</span>
                </span>
                <form action={deleteSettlement.bind(null, groupId, s.id)}>
                  <button className="link text-xs text-muted" type="submit">
                    Undo
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Settings */}
      <details className="card">
        <summary className="cursor-pointer font-bold">Group settings</summary>
        <RenameGroupForm groupId={groupId} name={group.name} />
        <form action={deleteGroup.bind(null, groupId)} className="mt-6 border-t border-line pt-4">
          <p className="muted mb-3">Deleting the group removes all of its bills, receipt photos and payments.</p>
          <ConfirmButton message={`Delete "${group.name}" and all of its bills? This cannot be undone.`}>
            Delete group
          </ConfirmButton>
        </form>
      </details>
    </div>
  );
}
