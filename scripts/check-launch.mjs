// Runs before every Vercel build. Production builds fail until the
// launch requirements that depend on configuration are in place.
const env = process.env.VERCEL_ENV ?? "development";
const problems = [];
const warnings = [];

const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

if (!url) problems.push("NEXT_PUBLIC_SITE_URL is not set (your custom domain, e.g. https://patungan.my.id)");
else if (!/^https:\/\//.test(url)) problems.push("NEXT_PUBLIC_SITE_URL must start with https://");
else if (/\.vercel\.app/.test(url)) problems.push("NEXT_PUBLIC_SITE_URL is still a vercel.app address. Connect a custom domain first.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("NEXT_PUBLIC_CONTACT_EMAIL is missing or invalid (shown on the Privacy and Terms pages)");
for (const key of ["DATABASE_URL", "AUTH_SECRET"]) {
  if (!process.env[key]) problems.push(`${key} is not set`);
}
if (Boolean(process.env.AUTH_GOOGLE_ID) !== Boolean(process.env.AUTH_GOOGLE_SECRET)) {
  problems.push("Set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither");
}
if (!process.env.GEMINI_API_KEY) warnings.push("GEMINI_API_KEY is not set: Smart scan is off, the free in-browser scanner is used.");
if (!process.env.BLOB_READ_WRITE_TOKEN) warnings.push("BLOB_READ_WRITE_TOKEN is not set: receipt photos will not be saved.");

for (const w of warnings) console.warn(`[launch check] warning: ${w}`);
if (problems.length) {
  const msg = problems.map((p) => `  - ${p}`).join("\n");
  if (env === "production" && process.env.SKIP_LAUNCH_CHECK !== "1") {
    console.error(`[launch check] Production build stopped:\n${msg}`);
    process.exit(1);
  }
  console.warn(`[launch check] Not ready for production yet:\n${msg}`);
} else {
  console.log("[launch check] OK");
}
