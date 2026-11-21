/** Placeholder shown instantly while a page loads its data. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-24 rounded bg-line" />
      <div className="h-9 w-2/3 rounded bg-line" />
      <div className="h-28 rounded-lg bg-surface" />
      <div className="h-20 rounded-lg bg-surface" />
      <div className="h-20 rounded-lg bg-surface" />
    </div>
  );
}