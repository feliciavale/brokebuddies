import { site } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 text-[15px] leading-7">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="muted">Last updated {site.legalUpdated}</p>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
      <h2 className="pt-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine() {
  return site.contactEmail ? (
    <a href={`mailto:${site.contactEmail}`} className="link font-semibold">
      {site.contactEmail}
    </a>
  ) : (
    <span className="font-semibold">the contact email shown in the site footer</span>
  );
}
