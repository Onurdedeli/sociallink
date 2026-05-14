import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { campaigns, trackingCodes, users } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { statsForCampaigns, statsForInfluencer } from "@/lib/analytics";
import { dailyForCampaigns, dailyForInfluencer } from "@/lib/timeseries";
import { fmtMoney, fmtNum, fmtPct, epcCents, fmtBotRate } from "@/lib/format";
import { ClicksChart, RevenueChart } from "@/components/time-series-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.role === "brand") {
    const myCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.brandId, user.id))
      .orderBy(desc(campaigns.createdAt))
      ;
    const stats = await statsForCampaigns(myCampaigns.map((c) => c.id));
    const daily = await dailyForCampaigns(myCampaigns.map((c) => c.id));
    const totals = Object.values(stats).reduce(
      (acc, s) => ({
        clicks: acc.clicks + s.clicks,
        botClicks: acc.botClicks + s.botClicks,
        conversions: acc.conversions + s.conversions,
        revenue: acc.revenue + s.revenueCents,
        commission: acc.commission + s.commissionCents,
      }),
      { clicks: 0, botClicks: 0, conversions: 0, revenue: 0, commission: 0 }
    );
    const humanClicks = totals.clicks - totals.botClicks;

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Brand dashboard</h1>
          <Link href="/campaigns/new" className="btn-primary">New campaign</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <KPI label="Campaigns" value={fmtNum(myCampaigns.length)} />
          <KPI
            label="Clicks (human)"
            value={fmtNum(humanClicks)}
            sub={`${fmtNum(totals.botClicks)} bots · ${fmtBotRate(totals.botClicks, totals.clicks)}`}
          />
          <KPI label="Conversions" value={fmtNum(totals.conversions)} />
          <KPI label="Revenue tracked" value={fmtMoney(totals.revenue)} />
          <KPI label="EPC paid" value={fmtMoney(epcCents(totals.commission, totals.clicks))} />
          <KPI label="Bot rate" value={fmtBotRate(totals.botClicks, totals.clicks)} />
        </div>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Clicks (last 30 days)</h2>
              <span className="text-xs text-slate-500">Human + Bot stacked, conversions overlay</span>
            </div>
            <ClicksChart data={daily} />
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Revenue &amp; commission (last 30 days)</h2>
              <span className="text-xs text-slate-500">Tracked via webhook + pixel</span>
            </div>
            <RevenueChart data={daily} />
          </div>
        </section>

        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th><th>Status</th><th>Payout</th><th>Influencers</th>
                <th>Clicks</th><th>Bot %</th><th>Conv.</th><th>Revenue</th><th>Commission</th><th>EPC</th><th></th>
              </tr>
            </thead>
            <tbody>
              {myCampaigns.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-500 py-8">No campaigns yet — create your first.</td></tr>
              )}
              {myCampaigns.map((c) => {
                const s = stats[c.id];
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.title}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-xs text-slate-600">
                      {c.cpcCents > 0 && <div>CPC {fmtMoney(c.cpcCents)}</div>}
                      {c.cpmCents > 0 && <div>CPM {fmtMoney(c.cpmCents)}</div>}
                      {c.commissionBps > 0 && <div>Comm. {fmtPct(c.commissionBps)}</div>}
                    </td>
                    <td>{fmtNum(s.uniqueInfluencers)}</td>
                    <td>
                      {fmtNum(s.clicks)}
                      {s.botClicks > 0 && (
                        <span className="text-xs text-slate-500"> · {fmtNum(s.clicks - s.botClicks)} human</span>
                      )}
                    </td>
                    <td className={s.botClicks / Math.max(1, s.clicks) > 0.2 ? "text-rose-600" : "text-slate-500"}>
                      {fmtBotRate(s.botClicks, s.clicks)}
                    </td>
                    <td>{fmtNum(s.conversions)}</td>
                    <td>{fmtMoney(s.revenueCents)}</td>
                    <td>{fmtMoney(s.commissionCents)}</td>
                    <td>{fmtMoney(epcCents(s.commissionCents, s.clicks))}</td>
                    <td><Link href={`/campaigns/${c.id}`} className="text-brand-600 hover:underline">Open →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Influencer dashboard
  const s = await statsForInfluencer(user.id);
  const daily = await dailyForInfluencer(user.id);

  const campaignIds = Array.from(new Set(s.codes.map((c) => c.campaignId)));
  const myCampaigns = campaignIds.length
    ? await db.select().from(campaigns).where(inArray(campaigns.id, campaignIds))
    : [];
  const brandIds = Array.from(new Set(myCampaigns.map((c) => c.brandId)));
  const brandRows = brandIds.length
    ? await db.select().from(users).where(inArray(users.id, brandIds))
    : [];
  const campaignMap = new Map(myCampaigns.map((c) => [c.id, c]));
  const brandMap = new Map(brandRows.map((b) => [b.id, b]));
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Creator dashboard</h1>
        <Link href="/campaigns" className="btn-primary">Browse campaigns</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <KPI label="Tracking codes" value={fmtNum(s.codes.length)} />
        <KPI
          label="Clicks (human)"
          value={fmtNum(s.totalClicks - s.totalBotClicks)}
          sub={`${fmtNum(s.totalBotClicks)} bots · ${fmtBotRate(s.totalBotClicks, s.totalClicks)}`}
        />
        <KPI label="Conversions" value={fmtNum(s.totalConversions)} />
        <KPI label="Earnings" value={fmtMoney(s.totalCommission)} />
        <KPI label="EPC" value={fmtMoney(epcCents(s.totalCommission, s.totalClicks))} />
        <KPI label="Bot rate" value={fmtBotRate(s.totalBotClicks, s.totalClicks)} />
      </div>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Clicks (last 30 days)</h2>
            <span className="text-xs text-slate-500">Human + Bot stacked, conversions overlay</span>
          </div>
          <ClicksChart data={daily} />
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Earnings (last 30 days)</h2>
            <span className="text-xs text-slate-500">Commission per day</span>
          </div>
          <RevenueChart data={daily} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">By platform</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Platform</th><th>Clicks</th><th>Bot %</th><th>Conv.</th><th>CR</th><th>Earnings</th><th>EPC</th></tr></thead>
            <tbody>
              {Object.keys(s.byPlatform).length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6">No traffic yet.</td></tr>
              )}
              {Object.entries(s.byPlatform).map(([p, d]) => (
                <tr key={p}>
                  <td className="capitalize font-medium">{p}</td>
                  <td>
                    {fmtNum(d.clicks)}
                    {d.botClicks > 0 && (
                      <span className="text-xs text-slate-500"> · {fmtNum(d.clicks - d.botClicks)} human</span>
                    )}
                  </td>
                  <td className={d.botClicks / Math.max(1, d.clicks) > 0.2 ? "text-rose-600" : "text-slate-500"}>
                    {fmtBotRate(d.botClicks, d.clicks)}
                  </td>
                  <td>{fmtNum(d.conversions)}</td>
                  <td className="text-slate-500">{d.clicks > 0 ? ((d.conversions / d.clicks) * 100).toFixed(1) + "%" : "—"}</td>
                  <td>{fmtMoney(d.commission)}</td>
                  <td>{fmtMoney(epcCents(d.commission, d.clicks))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">My tracking links</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Brand</th><th>Platform</th><th>Code</th><th>Link</th></tr></thead>
            <tbody>
              {s.codes.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-500 py-6">
                  <Link href="/campaigns" className="text-brand-600 underline">Browse open campaigns →</Link>
                </td></tr>
              )}
              {s.codes.map((tc) => {
                const c = campaignMap.get(tc.campaignId);
                const b = c ? brandMap.get(c.brandId) : null;
                const url = `${appUrl}/r/${tc.code}?p=${tc.platform}`;
                return (
                  <tr key={tc.code}>
                    <td><Link href={`/campaigns/${tc.campaignId}`} className="font-medium hover:underline">{c?.title || "—"}</Link></td>
                    <td>{b?.companyName || b?.name || "—"}</td>
                    <td className="capitalize">{tc.platform}</td>
                    <td><code className="text-xs">{tc.code}</code></td>
                    <td><code className="text-xs break-all">{url}</code></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="kpi mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active" ? "badge-green" :
    status === "paused" ? "badge-amber" :
    status === "ended" ? "badge-gray" : "badge-gray";
  return <span className={cls}>{status}</span>;
}
