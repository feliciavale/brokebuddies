import { formatIDR } from "@/lib/money";

/** "You owe Rp 10.000" / "You're owed Rp 10.000" / "Settled" */
export function BalanceBadge({ amount, subject = "you" }: { amount: number; subject?: "you" | string }) {
  if (amount === 0) return <span className="badge-neutral">Settled</span>;
  const you = subject === "you";
  if (amount > 0) {
    return <span className="badge-owed">{you ? "You're owed" : "Is owed"} {formatIDR(amount)}</span>;
  }
  return <span className="badge-owe">{you ? "You owe" : "Owes"} {formatIDR(-amount)}</span>;
}
