import "server-only";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cache } from "react";

/** The signed-in user, or null (also null if the account was deleted). */
export const getUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
});

/** The signed-in user, or redirect to the landing page. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
}

/** The signed-in user's membership in a group, or 404 if they are not in it. */
export async function requireMember(groupId: string) {
  const user = await requireUser();
  const me = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!me) notFound();
  return { user, me };
}
