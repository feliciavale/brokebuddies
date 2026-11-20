/** Initials in a square tile, used instead of emoji or photos. */
export function Monogram({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const dims = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-md bg-tan font-bold text-espresso ${dims}`}
    >
      {initials}
    </span>
  );
}
