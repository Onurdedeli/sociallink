import Link from "next/link";
import { db } from "@/db";
import { cpmRates } from "@/db/schema";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rates = await db.select().from(cpmRates);

  return (
    <div className="space-y-16">
      <section className="text-center pt-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Track every click. Pay for real results.
        </h1>
        <p className="mt-4 mx-auto max-w-2xl text-slate-600">
          Sociallink connects brands and creators across Instagram, TikTok,
          YouTube, Twitter, Telegram, WhatsApp and Facebook. Generate trackable
          codes, measure clicks &amp; sales in real time, and pay based on
          performance.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/sign-up?role=brand" className="btn-primary">
            I&apos;m a Brand
          </Link>
          <Link href="/sign-up?role=influencer" className="btn-secondary">
            I&apos;m a Creator
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Demo: <code>brand@demo.io</code> / <code>creator@demo.io</code> ·
          password <code>demo1234</code>
        </p>
      </section>

      <section className="grid sm:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold">For Brands</h3>
          <p className="mt-2 text-sm text-slate-600">
            Create campaigns, set CPC / CPM / commission rates, generate unique
            tracking codes for every creator. Conversion webhook closes the
            loop from click to sale.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold">For Creators</h3>
          <p className="mt-2 text-sm text-slate-600">
            Browse open campaigns, claim your tracking code, share to any
            channel. See clicks, conversions and earnings per platform.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold">Open CPM rates</h3>
          <p className="mt-2 text-sm text-slate-600">
            Public CPM &amp; CPC reference rates by platform and audience tier.
            Available as a free <Link href="/api/cpm" className="underline">JSON API</Link>.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">
          Reference CPM by Platform (per 1,000 impressions)
        </h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Tier</th>
                <th>CPM</th>
                <th>CPC</th>
                <th>Region</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="capitalize font-medium">{r.platform}</td>
                  <td className="capitalize">{r.audienceTier}</td>
                  <td>{fmtMoney(r.cpmCents)}</td>
                  <td>{fmtMoney(r.cpcCents)}</td>
                  <td className="text-slate-500">{r.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
