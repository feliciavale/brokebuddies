import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/instrument-sans";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo";
import { getUser } from "@/lib/access";
import { signOutAction } from "@/app/actions";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: split bills by what each person ordered`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: "website", siteName: site.name, url: site.url, description: site.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0e7c8" },
    { media: "(prefers-color-scheme: dark)", color: "#4d1a00" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  const year = new Date().getFullYear();
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <header className="border-b border-line bg-bg">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
              <Link href={user ? "/groups" : "/"} className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <LogoMark />
                {site.name}
              </Link>
              <nav className="flex items-center gap-2">
                <ThemeToggle />
                {user && (
                  <>
                    <Link href="/profile" className="btn btn-sm">
                      Profile
                    </Link>
                    <form action={signOutAction}>
                      <button className="btn btn-sm" type="submit">
                        Sign out
                      </button>
                    </form>
                  </>
                )}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                &copy; {year} {site.operator}
              </p>
              <nav className="flex gap-4">
                <Link href="/privacy" className="link">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="link">
                  Terms &amp; Conditions
                </Link>
                {site.contactEmail && (
                  <a href={`mailto:${site.contactEmail}`} className="link">
                    Contact
                  </a>
                )}
              </nav>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
