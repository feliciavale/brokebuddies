import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/access";
import { ExpenseForm } from "@/components/expense-form";
import { BackLink } from "@/components/back-link";

export default async function EditExpensePage({ params }: PageProps<"/groups/[groupId]/expenses/[expenseId]/edit">) {
  const { groupId, expenseId } = await params;
  const { me } = await requireMember(groupId);
  const [members, expense] = await Promise.all([
    prisma.groupMember.findMany({ where: { groupId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: {
        items: { orderBy: { position: "asc" }, include: { assignees: true } },
        shares: true,
      },
    }),
  ]);
  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink href={`/groups/${groupId}/expenses/${expenseId}`}>Back to bill</BackLink>
        <h1 className="text-3xl font-bold tracking-tight">Edit bill</h1>
      </div>
      <ExpenseForm
        groupId={groupId}
        members={members}
        meId={me.id}
        initial={{
          expenseId,
          description: expense.description,
          date: expense.date.toISOString().slice(0, 10),
          paidById: expense.paidById,
          splitType: expense.splitType,
          total: expense.total,
          receiptUrl: expense.receiptUrl,
          note: expense.note ?? "",
          items: expense.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            assignees: i.assignees.map((a) => a.memberId),
          })),
          tax: expense.tax,
          service: expense.service,
          discount: expense.discount,
          participants: expense.shares.map((s) => ({ memberId: s.memberId, value: s.input ?? 0 })),
        }}
      />
    </div>
  );
}
