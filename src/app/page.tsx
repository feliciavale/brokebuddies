import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { SignInForm } from "@/components/sign-in-form";
import { formatIDR } from "@/lib/money";

const steps = [
  {
    title: "Add the receipt",
    body: "Take a photo and scan it to fill in the items, or type them in yourself. You can fix anything the scan gets wrong.",
  },
  {
    title: "Pick who had what",
    body: "Choose the people for each item. If two or more people shared a dish, its price is split evenly between them.",
  },
  {
    title: "Tax and service included",
    body: "PB1 and service charge are divided in proportion to what each person ordered, so nobody pays tax on someone else's food.",
  },
  {
    title: "Pay back the person who paid",
    body: "Everyone sees the payer's bank and account number, or scans their QRIS with the amount already filled in.",
  },
];

// A worked example so visitors can see exactly what the result looks like.
const example = [
  { name: "Andi", items: "Nasi goreng, half a pizza", amount: 75900 },
  { name: "Bela", items: "Es teh, half a pizza", amount: 47150 },
];

export default async function Home() {
  if (await getUser()) redirect("/groups");

  return (
    <div className="space-y-14 py-4">
      <section className="grid gap-10 sm:grid-cols-[1.1fr_1fr] sm:items-center">
        <div className="space-y-5">
          <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            Split the bill by what each person ordered.
          </h1>
          <p className="text-lg text-muted">
            Add the receipt, pick who had each item, and everyone gets their exact share in Rupiah with tax and
            service included.
          </p>
          <SignInForm />
          <p className="text-sm text-muted">
            Free to use. By continuing you agree to the{" "}
            <Link href="/terms" className="link">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="link">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <figure className="rounded-lg bg-strong p-5 text-strong-fg">
          <figcaption className="mb-4 text-xs font-semibold tracking-wide text-strong-accent uppercase">
            Example result
          </figcaption>
          <dl className="space-y-3">
            {example.map((p) => (
              <div key={p.name} className="flex items-start justify-between gap-4 border-b border-strong-fg/20 pb-3">
                <div>
                  <dt className="font-semibold">{p.name}</dt>
                  <dd className="text-sm text-strong-fg/75">{p.items}</dd>
                </div>
                <dd className="font-semibold tabular-nums">{formatIDR(p.amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-strong-fg/75">
            Includes 10% tax and 5% service, shared by order size. Andi paid {formatIDR(123050)}, so Bela pays Andi{" "}
            {formatIDR(47150)}.
          </p>
        </figure>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="card">
              <p className="mb-2 text-sm font-semibold text-muted tabular-nums">Step {i + 1}</p>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="muted mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
