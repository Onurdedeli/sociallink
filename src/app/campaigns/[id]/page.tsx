import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { campaigns, clicks, conversions, trackingCodes, users, PLATFORMS } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { fmtMoney, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { joinCampaignAction, setStatusAction } from "./actions";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const c = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!c) notFound();

  const brand = await db.select().from(users).where(eq(users.id, c.brandId)).get();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const isOwner = user.role === "brand" && user.id === c.brandId;

  const myCode = user.role === "influencer"
    ? await db
        .select()
        .from(trackingCodes)
        .where(and(eq(trackingCodes.campaignId, c.id), eq(trackingCodes.influencerId, user.id)))
        .get()
    : null;

  // Aggregate stats over all codes
  const codes = await db.select().from(trackingCodes).where(eq(trackingCodes.campaignId, c.id)).all();
  const codeIds = codes.map((tc) => tc.code);
  const clickAgg = codeIds.length
    ? await db
        .select({
          code: clicks.code,
          platform: clicks.platform,
          n: sql<number>`count(*)`,
        })
        .from(clicks)
        .where(inArray(clicks.code, codeIds))
        .groupBy(clicks.code, clicks.platform)
        .all()
    : [];
  const convAgg = codeIds.length
    ? await db
        .select({
          code: conversions.code,
          n: sql<number>`count(*)`,
          rev: sql<number>`coalesce(sum(${conversions.amountCents}),0)`,
          com: sql<number>`coalesce(sum(${conversions.commissionCents}),0)`,
        })
        .from(conversions)
        .where(inArray(conversions.code, codeIds))
        .groupBy(conversions.code)
        .all()
    : [];

  const totals = {
    clicks: clickAgg.reduce((a, r) => a + Number(r.n), 0),
    conversions: convAgg.reduce((a, r) => a + Number(r.n), 0),
    revenue: convAgg.reduce((a, r) => a + Number(r.rev), 0),
    commission: convAgg.reduce((a, r) => a + Number(r.com), 0),
  };

  const platformBreakdown: Record<string, number> = {};
  for (const r of clickAgg) {
    const p = r.platform || "other";
    platformBreakdown[p] = (platformBreakdown[p] || 0) + Number(r.n);
  }

  const influencerIds = Array.from(new Set(codes.map((tc) => tc.influencerId)));
  const influencers = influencerIds.length
    ? await db.select().from(users).where(inArray(users.id, influencerIds)).all()
    : [];
  const infMap = new Map(influencers.map((i) => [i.id, i]));

  // per-code stats for the owner table
  const perCodeClicks: Record<string, number> = {};
  for (const r of clickAgg) perCodeClicks[r.code] = (perCodeClicks[r.code] || 0) + Number(r.n);
  const perCodeConv: Record<string, { n: number; rev: number; com: number }> = {};
  for (const r of convAgg) perCodeConv[r.code] = { n: Number(r.n), rev: Number(r.rev), com: Number(r.com) };

  const recentClicks = codeIds.length
    ? await db
        .select()
        .from(clicks)
        .where(inArray(clicks.code, codeIds))
        .orderBy(desc(clicks.createdAt))
        .limit(20)
        .all()
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-sm text-slate-500">
            by {brand?.companyName || brand?.name} ·
            {" "}<span className="badge-gray">{c.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {c.cpcCents > 0 && <span className="badge-gray">CPC {fmtMoney(c.cpcCents)}</span>}
          {c.cpmCents > 0 && <span className="badge-gray">CPM {fmtMoney(c.cpmCents)}</span>}
          {c.commissionBps > 0 && <span className="badge-gray">Commission {fmtPct(c.commissionBps)}</span>}
          {c.budgetCents > 0 && <span className="badge-gray">Budget {fmtMoney(c.budgetCents)}</span>}
        </div>
      </div>

      {c.description && <p className="text-slate-700">{c.description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Tracking codes" value={fmtNum(codes.length)} />
        <KPI label="Clicks" value={fmtNum(totals.clicks)} />
        <KPI label="Conversions" value={fmtNum(totals.conversions)} />
        <KPI label="Revenue" value={fmtMoney(totals.revenue)} />
      </div>

      {/* Influencer join / copy link */}
      {user.role === "influencer" && (
        <div className="card">
          <h2 className="font-semibold mb-3">Your tracking link</h2>
          {myCode ? (
            <CodePicker code={myCode.code} currentPlatform={myCode.platform} appUrl={appUrl} campaignId={c.id} />
          ) : (
            <form action={joinCampaignAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="campaignId" value={c.id} />
              <div>
                <label className="label">Primary platform</label>
                <select name="platform" className="select" defaultValue="instagram">
                  {PLATFORMS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <button className="btn-primary">Generate my tracking link</button>
            </form>
          )}
        </div>
      )}

      {/* Owner actions */}
      {isOwner && (
        <div className="card flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Owner actions:</span>
          {c.status !== "active" && (
            <form action={setStatusAction}><input type="hidden" name="campaignId" value={c.id} /><input type="hidden" name="status" value="active" /><button className="btn-secondary">Activate</button></form>
          )}
          {c.status === "active" && (
            <form action={setStatusAction}><input type="hidden" name="campaignId" value={c.id} /><input type="hidden" name="status" value="paused" /><button className="btn-secondary">Pause</button></form>
          )}
          <form action={setStatusAction}><input type="hidden" name="campaignId" value={c.id} /><input type="hidden" name="status" value="ended" /><button className="btn-ghost">End campaign</button></form>
          <span className="ml-auto text-xs text-slate-500">Created {fmtDate(c.createdAt)}</span>
        </div>
      )}

      {/* Platform breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Clicks by platform</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Platform</th><th>Clicks</th><th>Share</th></tr></thead>
            <tbody>
              {Object.keys(platformBreakdown).length === 0 && (
                <tr><td colSpan={3} className="text-center text-slate-500 py-6">No clicks yet.</td></tr>
              )}
              {Object.entries(platformBreakdown).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                <tr key={p}>
                  <td className="capitalize font-medium">{p}</td>
                  <td>{fmtNum(n)}</td>
                  <td className="text-slate-500">{totals.clicks ? ((n / totals.clicks) * 100).toFixed(1) : "0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Influencer breakdown (visible to owner and to the influencer for their own row) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Influencer performance</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Influencer</th><th>Platform</th><th>Code</th>
                <th>Clicks</th><th>Conv.</th><th>Revenue</th><th>Commission</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6">No creators have joined yet.</td></tr>
              )}
              {codes.map((tc) => {
                const inf = infMap.get(tc.influencerId);
                const cv = perCodeConv[tc.code] || { n: 0, rev: 0, com: 0 };
                const canSee = isOwner || (user.role === "influencer" && tc.influencerId === user.id);
                const name = canSee ? (inf?.name || "creator") : "(hidden)";
                return (
                  <tr key={tc.code}>
                    <td className="font-medium">{name}</td>
                    <td className="capitalize">{tc.platform}</td>
                    <td><code className="text-xs">{tc.code}</code></td>
                    <td>{fmtNum(perCodeClicks[tc.code] || 0)}</td>
                    <td>{fmtNum(cv.n)}</td>
                    <td>{fmtMoney(cv.rev)}</td>
                    <td>{fmtMoney(cv.com)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent clicks log (owner-only) */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Recent clicks</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Code</th><th>Platform</th><th>Country</th><th>Referrer</th></tr></thead>
              <tbody>
                {recentClicks.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">No clicks logged yet.</td></tr>
                )}
                {recentClicks.map((cl) => (
                  <tr key={cl.id}>
                    <td>{fmtDate(cl.createdAt)}</td>
                    <td><code className="text-xs">{cl.code}</code></td>
                    <td className="capitalize">{cl.platform || "—"}</td>
                    <td>{cl.country || "—"}</td>
                    <td className="text-slate-500 text-xs truncate max-w-[200px]">{cl.referrer || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Conversion webhook help for owner */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Conversion webhook</h2>
          <div className="card text-sm space-y-2">
            <p>POST a JSON payload from your store after a successful order:</p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs">
{`curl -X POST ${appUrl}/api/track/conversion \\
  -H 'content-type: application/json' \\
  -d '{
    "code": "<sl-code-from-?sl-query-param>",
    "orderId": "ORDER_123",
    "amountCents": 12900
  }'`}
            </pre>
            <p className="text-slate-600">
              We compute commission ({fmtPct(c.commissionBps)}) automatically and attribute it to the right creator.
            </p>
          </div>
        </section>
      )}

      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">← Back to dashboard</Link>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="kpi mt-1">{value}</div>
    </div>
  );
}

function CodePicker({ code, currentPlatform, appUrl, campaignId }: { code: string; currentPlatform: string; appUrl: string; campaignId: string }) {
  const link = `${appUrl}/r/${code}?p=${currentPlatform}`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Use this link on your <span className="capitalize font-medium">{currentPlatform}</span> channel. Append <code>?p=&lt;platform&gt;</code> to attribute clicks to a different channel.
      </p>
      <div className="flex items-center gap-2">
        <code className="block flex-1 text-xs bg-slate-100 rounded px-3 py-2 break-all">{link}</code>
        <CopyButton text={link} />
      </div>
      <form action={joinCampaignAction} className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div>
          <label className="label">Switch primary platform</label>
          <select name="platform" className="select" defaultValue={currentPlatform}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Update</button>
      </form>
    </div>
  );
}
