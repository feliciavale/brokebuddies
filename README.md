# Patungan

Split a restaurant bill by what each person ordered. Tax and service are shared in proportion to each order, and everyone sees how to pay back the person who paid: bank account number or QRIS with the amount filled in.

Built with Next.js 16, Prisma 7 + Prisma Postgres, Auth.js (Google sign-in), Vercel Blob and Tailwind CSS 4. Runs on free tiers. The custom domain is the only thing you pay for.

---

## 1. Features

**Groups**
- Create, rename and delete groups (delete asks for confirmation and removes all bills and photos).
- Invite people with a link. Signing in from the link brings them straight back to join.
- Add people who have no account as guests, with optional bank details and QRIS.
- "This is me" lets someone who joins later take over their guest spot.
- Per-group balances and "who pays whom" suggestions with the fewest transfers.
- Payment history with undo.

**Bills**
- Split by item (receipt), equally, by exact amounts, by percent or by shares.
- Receipt photo: compressed in the browser to roughly 200 KB, then stored on Vercel Blob. Deleting a bill or group deletes its photo.
- Receipt scanning: fills in items, quantities, tax, service and discount using Tesseract.js in the browser. No server and no API key. Everything stays editable, and the app warns when the items do not match the total printed on the receipt.
- Typing items by hand always works, with or without a photo.
- "Who had this?" dropdown per item. Two or more people split that item evenly.
- Tax (PB1), service and discount are shared in proportion to each person's subtotal. Quick 10% / 11% and 5% / 10% buttons.
- Live "Each person pays" preview before saving. Edit and delete bills.
- All money is whole Rupiah (IDR by default). Every split adds up exactly to the total.

**Paying back**
- Result page shows who paid, their bank and account number with a copy button, and their QRIS.
- The QRIS has each person's amount filled in. A checkbox switches to the plain code for payment apps that reject it.
- "I have paid" / "Mark as paid" records a payment against the bill and the group balance.

**Account**
- Google sign-in. Profile with display name and optional bank, account number, holder name and QRIS (upload a screenshot; only the QR text is stored).
- Delete account: removes your account and payment details. Shared bills stay under your name as a guest so other members' balances remain correct. Groups where nobody else has an account are deleted.

**Site**
- Light and dark mode (follows the device, with a toggle).
- Favicon, Apple touch icon, Privacy Policy, Terms & Conditions, robots.txt and sitemap.xml.
- No analytics, no tracking cookies, no "made with" badge.

## 2. Design rules followed

- Palette: Oatmilk Linen `#F0E7C8` and Espresso Crust `#4D1A00` are the main colours (oat page with espresso text in light mode, espresso page with oat text in dark mode). Brunch Tomato `#B22000` is used only for destructive actions, errors and "owes" badges. Toasted Tan `#D89D5D` is used for highlights, focus rings and "is owed" badges. Every text and background pair meets WCAG AA contrast.
- Buttons use a small 6 px corner radius, never pill shapes. No gradients, no emoji (icons are Lucide line icons), no em dashes, no scroll or cursor animations, no counters, no stock or AI images, no invented reviews or numbers. The landing page example is labelled "Example result" and its arithmetic is correct.
- Font: Instrument Sans, self-hosted from npm, so there is no request to Google Fonts.

## 3. Step-by-step: from zip to launch

### Step 1. Run it locally

```bash
npm install
cp .env.example .env
```

Fill in `.env` (see steps 2 and 3 for where each value comes from), then:

```bash
npx prisma migrate dev --name init   # creates the tables and the prisma/migrations folder
npm run dev                          # http://localhost:3000
```

Commit the generated `prisma/migrations` folder. Vercel uses it on every deploy.

### Step 2. Database (free)

1. Go to console.prisma.io, create a project and a Prisma Postgres database.
2. Copy the direct `postgres://...` connection string into `DATABASE_URL`.

### Step 3. Google sign-in (free)

1. console.cloud.google.com > APIs & Services > OAuth consent screen: set the app name, your support email, and the links to `/privacy` and `/terms` on your domain.
2. Credentials > Create credentials > OAuth client ID > Web application.
3. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-DOMAIN/api/auth/callback/google`
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Run `npx auth secret` for `AUTH_SECRET`.

### Step 4. Deploy to Vercel (free Hobby plan)

1. Push the project to a GitHub repository under your personal account.
2. In Vercel, import the repository.
3. Storage > Create > Blob, then connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. Settings > Environment Variables: add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_OPERATOR_NAME`.
5. Deploy. Vercel runs `npm run vercel-build`, which runs the launch check, applies migrations and builds.

### Step 5. Connect the custom domain

1. Buy a domain from any registrar. This is the only paid step. Indonesian options such as `.my.id`, `.id` or `.web.id` are sold by local registrars; check their price and registration requirements.
2. Vercel > Project > Settings > Domains > Add your domain, then add the DNS records Vercel shows at your registrar.
3. In the same screen, set the `*.vercel.app` address to redirect to your domain, so everyone signs in on one address.
4. Set `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and redeploy.

### Step 6. Launch checklist

| Requirement | Where it is handled |
|---|---|
| Custom domain connected | Step 5. The production build stops if `NEXT_PUBLIC_SITE_URL` is missing or still a `vercel.app` address. |
| Site favicon | `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png` |
| No "made with AI" tag | No badge, generator tag or AI credit anywhere in the site. Vercel's toolbar can appear on preview deployments; you can turn it off under Project Settings > General. |
| Privacy Policy | `/privacy`, linked in the footer and next to the sign-in button |
| Terms & Conditions | `/terms`, linked in the footer and next to the sign-in button |
| Contact email on legal pages | The production build stops if `NEXT_PUBLIC_CONTACT_EMAIL` is missing |

Run `npm run check:launch` at any time to see what is still missing.

Before launch, also:
- Sign in on the real domain, create a group, add a bill with a receipt photo and check the photo appears.
- Scan a filled-in QRIS with GoPay, DANA, OVO and your bank app to confirm they accept the amount.
- Read the Privacy Policy and Terms and adjust them to your situation. They describe exactly what this app does, but they are not legal advice.

## 4. Technical usage

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Prisma Postgres connection string |
| `AUTH_SECRET` | yes | Encrypts Auth.js cookies |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | yes | Google OAuth client |
| `NEXT_PUBLIC_SITE_URL` | yes in production | Canonical URL, metadata, sitemap, legal pages |
| `NEXT_PUBLIC_CONTACT_EMAIL` | yes in production | Footer and legal pages |
| `NEXT_PUBLIC_OPERATOR_NAME` | no | Operator name in footer and legal pages (defaults to "Patungan") |
| `BLOB_READ_WRITE_TOKEN` | recommended | Receipt photo storage. Without it, bills save without photos |
| `AUTH_TRUST_HOST` | local only | Lets Auth.js run on localhost |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests: splitting, rounding, balances, QRIS, receipt parser |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create or apply a migration |
| `npm run db:studio` | Browse the database |
| `npm run check:launch` | Launch requirement check |

### How the money maths works

- Amounts are stored as integers (whole Rupiah). Nothing is stored as a float.
- `allocate(total, weights)` splits an amount by weight using the largest-remainder method, so the parts always add up exactly to the total.
- By item: each item is split evenly between the people who had it. Then tax + service - discount is allocated in proportion to each person's subtotal.
- Balances: the payer is credited the bill total, each person is debited their share, and recorded payments move money back. Suggestions pair the largest debtor with the largest creditor until everyone is at zero.

### How QRIS works here

A personal QRIS is an EMVCo payload. The app reads it from the uploaded image (jsQR), checks its CRC, and stores the text. To fill in an amount it sets the point-of-initiation tag to dynamic (`01` = `12`), adds tag `54` with the amount, sorts the tags and recalculates the CRC16 (tag `63`).

### Security

- Every page and server action checks that you are a member of the group you are reading or changing.
- All writes are validated with Zod on the server.
- The browser session only receives your id, name, email and picture. Payment details are rendered on the server, only for members of the same group.
- Receipt uploads require sign-in, accept images only and are limited to 2 MB.

### Project layout

```
prisma/schema.prisma                 data model
scripts/check-launch.mjs             launch requirement check (runs before Vercel builds)
src/app/actions.ts                   all server actions (writes)
src/app/page.tsx                     landing page
src/app/privacy, src/app/terms       legal pages
src/app/groups/...                   groups, bills, result page
src/app/profile                      profile and delete account
src/app/api/receipts/route.ts        receipt photo upload
src/components/expense-form.tsx      bill form: photo, scan, items, who-had-what
src/lib/split.ts                     money maths (pure, tested)
src/lib/qris.ts                      QRIS parse, validate, add amount
src/lib/receipt-parser.ts            OCR text to items, tax, service, discount
src/lib/ocr.ts                       in-browser Tesseract.js
src/lib/site.ts                      site name, URL, contact, legal date
src/app/globals.css                  palette and design tokens
```
