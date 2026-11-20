import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { createGroup } from "@/app/actions";
import { netBalances } from "@/lib/split";
import { Monogram } from "@/components/monogram";
import { BalanceBadge } from "@/components/balance-badge";

export const metadata = { title: "Your groups" };

export default async function GroupsPage() {
  const user = await requireUser();
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      group: {
        include: {
          members: { select: { id: true } },
          expenses: { select: { paidById: true, total: true, shares: { select: { memberId: true, amount: true } } } },
          settlements: { select: { fromId: true, toId: true, amount: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your groups</h1> 
        <p className="muted mt-1">Create a group for each trip, utilities or regular dinner.</p>
      </div>

      <form action={createGroup} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="name">
            New group name
          </label>
          <input id="name" name="name" className="input" placeholder="Dinner" required maxLength={60} />
        </div>
        <button className="btn-primary" type="submit">
          Create group
        </button>
      </form>

      {memberships.length === 0 ? (
        <p className="muted">
          You are not in any groups yet. Create one above, or open an invite link a friend sent you.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {memberships.map(({ id: myId, group }) => {
            const bal =
              netBalances(
                group.members.map((m) => m.id),
                group.expenses,
                group.settlements,
              )[myId] ?? 0;
            return (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-bg">
                  <Monogram name={group.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{group.name}</p>
                    <p className="muted">
                      {group.members.length} {group.members.length === 1 ? "member" : "members"} ·{" "}
                      {group.expenses.length} {group.expenses.length === 1 ? "bill" : "bills"}
                    </p>
                    <div className="mt-2 sm:hidden">
                      <BalanceBadge amount={bal} />
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <BalanceBadge amount={bal} />
                  </div>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
