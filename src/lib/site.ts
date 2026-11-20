/**
 * Site-wide settings. Set these in Vercel > Settings > Environment Variables.
 * The launch check (scripts/check-launch.mjs) refuses a production build
 * without them, so the legal pages always show a real contact.
 */
export const site = {
  name: "BrokeBuddies",
  description:
    "Split a restaurant bill by what each person ordered, with tax and service shared fairly, and pay back by bank transfer or QRIS.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  /** Shown in the footer and legal pages. Defaults to the site name. */
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || "BrokeBuddies",
  legalUpdated: "19 November 2026",
};

/** "19 Nov 2026" */
export function formatDate(d: Date, style: "short" | "long" = "short") {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: "numeric",
    ...(style === "long" ? { weekday: "long" as const } : {}),
    timeZone: "Asia/Jakarta",
  });
}
