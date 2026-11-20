import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="muted">This page does not exist, or you are not a member of the group it belongs to.</p>
      <Link href="/groups" className="btn-primary">
        Go to your groups
      </Link>
    </div>
  );
}
