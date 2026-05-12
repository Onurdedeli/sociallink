import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "Sociallink — Influencer Tracking Platform",
  description:
    "Connect brands and creators. Track clicks, sales and CPM across Instagram, TikTok, YouTube, Twitter, Telegram, WhatsApp and Facebook.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700"></span>
              <span>Sociallink</span>
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <Link href="/cpm" className="btn-ghost">CPM Rates</Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
                  <span className="hidden sm:inline text-slate-500 px-2">
                    {user.name} · <span className="badge-gray">{user.role}</span>
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="btn-ghost">Sign in</Link>
                  <Link href="/sign-up" className="btn-primary">Get started</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500">
          © {new Date().getFullYear()} Sociallink — open analytics for creator
          marketing.
        </footer>
      </body>
    </html>
  );
}
