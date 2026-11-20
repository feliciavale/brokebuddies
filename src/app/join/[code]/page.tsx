import { notFound } from "next/navigation";
import { joinGroup } from "@/app/actions";
import { getUser } from "@/lib/access";
import { SignInForm } from "@/components/sign-in-form";
import { prisma } from "@/lib/prisma";
import { Monogram } from "@/components/monogram";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Join a group" };

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    select: { name: true, _count: { select: { members: true } } },
  });
  if (!group) notFound();
  const user = await getUser();
  const count = group._count.members;

  return (
    <div className="card mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-4">
        <Monogram name={group.name} />
        <div>
          <p className="muted">You have been invited to join</p>
          <h1 className="text-xl font-bold">{group.name}</h1>
          <p className="text-xs text-muted">
            {count} {count === 1 ? "member" : "members"}
          </p>
        </div>
      </div>
      {user ? (
        <form action={joinGroup.bind(null, code)}>
          <SubmitButton className="btn-primary w-full" pendingText="Joining...">
            Join group
          </SubmitButton>
        </form>
      ) : (
        <SignInForm next={`/join/${code}`} />
      )}
    </div>
  );
}
