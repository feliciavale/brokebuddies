import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/access";
import { ExpenseForm } from "@/components/expense-form";
import { smartScanEnabled } from "@/lib/ai-receipt";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Add a bill" };

export default async function NewExpensePage({ params }: PageProps<"/groups/[groupId]/expenses/new">) {
  const { groupId } = await params;
  const { me } = await requireMember(groupId);
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink href={`/groups/${groupId}`}>Back to group</BackLink>
        <h1 className="text-3xl font-bold tracking-tight">Add a bill</h1>
      </div>
      <ExpenseForm groupId={groupId} members={members} meId={me.id} smartScan={smartScanEnabled} />
    </div>
  );
}
