import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { campaigns, clicks, conversions, trackingCodes, users, PLATFORMS } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { fmtMoney, fmtNum, fmtPct, fmtDate, epcCents } from "@/lib/format";
import { joinCampaignAction, setStatusAction } from "./actions";
import { CopyButton } from "@/components/copy-button";

type SourceFilter = "all" | "webhook" | "pixel";

export const dynamic = "force-dynamic";

export default async function CampaignDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const { source: sourceParam } = await searchParams;
  const source: SourceFilter =
    sourceParam === "pixel" || sourceParam === "webhook" ? sourceParam : "all";

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const c = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1).then((r) => r[0] ?? null);
  if (!c) notFound();

  const brand = await db.select().from(users).where(eq(users.id, c.brandId)).limit(1).then((r) => r[0] ?? null);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const isOwner = user.role === "brand" && user.id === c.brandId;

  const myCode = user.role === "influencer"
    ? await db
        .select()
        .from(trackingCodes)
        .where(and(eq(trackingCodes.campaignId, c.id), eq(trackingCodes.influencerId, user.id)))
        .limit(1).then((r) => r[0] ?? null)
    : null;

  // Aggregate stats over all codes
  const codes = await db.select().from(trackingCodes).where(eq(trackingCodes.campaignId, c.id));
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
        
    : [];
  const convWhere = codeIds.length
    ? source === "all"
      ? inArray(conversions.code, codeIds)
      : and(inArray(conversions.code, codeIds), eq(conversions.source, source))
    : undefined;
  const convAgg = codeIds.length
    ? await db
        .select({
          code: conversions.code,
          platform: conversions.platform,
          n: sql<number>`count(*)`,
          rev: sql<number>`coalesce(sum(${conversions.amountCents}),0)`,
          com: sql<number>`coalesce(sum(${conversions.commissionCents}),0)`,
        })
        .from(conversions)
        .where(convWhere)
        .groupBy(conversions.code, conversions.platform)
    : [];

  // Source counts for the toggle UI labels
  const sourceCounts = codeIds.length
    ? await db
        .select({
          source: conversions.source,
          n: sql<number>`count(*)`,
        })
        .from(conversions)
        .where(inArray(conversions.code, codeIds))
        .groupBy(conversions.source)
    : [];
  const countBySource = Object.fromEntries(sourceCounts.map((r) => [r.source, Number(r.n)]));
  const totalConvAll = (countBySource.webhook ?? 0) + (countBySource.pixel ?? 0);

  const totals = {
    clicks: clickAgg.reduce((a, r) => a + Number(r.n), 0),
    conversions: convAgg.reduce((a, r) => a + Number(r.n), 0),
    revenue: convAgg.reduce((a, r) => a + Number(r.rev), 0),
    commission: convAgg.reduce((a, r) => a + Number(r.com), 0),
  };

  const platformClicks: Record<string, number> = {};
  for (const r of clickAgg) {
    const p = r.platform || "other";
    platformClicks[p] = (platformClicks[p] || 0) + Number(r.n);
  }
  const platformConversions: Record<string, { conv: number; rev: number; com: number }> = {};
  const tcByCode = new Map(codes.map((tc) => [tc.code, tc]));
  for (const r of convAgg) {
    const p = r.platform || tcByCode.get(r.code)?.platform || "other";
    platformConversions[p] ||= { conv: 0, rev: 0, com: 0 };
    platformConversions[p].conv += Number(r.n);
    platformConversions[p].rev += Number(r.rev);
    platformConversions[p].com += Number(r.com);
  }
  const platformKeys = Array.from(new Set([...Object.keys(platformClicks), ...Object.keys(platformConversions)]));

  const influencerIds = Array.from(new Set(codes.map((tc) => tc.influencerId)));
  const influencers = influencerIds.length
    ? await db.select().from(users).where(inArray(users.id, influencerIds))
    : [];
  const infMap = new Map(influencers.map((i) => [i.id, i]));

  // per-code stats for the owner table
  const perCodeClicks: Record<string, number> = {};
  for (const r of clickAgg) perCodeClicks[r.code] = (perCodeClicks[r.code] || 0) + Number(r.n);
  const perCodeConv: Record<string, { n: number; rev: number; com: number }> = {};
  for (const r of convAgg) {
    perCodeConv[r.code] ||= { n: 0, rev: 0, com: 0 };
    perCodeConv[r.code].n += Number(r.n);
    perCodeConv[r.code].rev += Number(r.rev);
    perCodeConv[r.code].com += Number(r.com);
  }

  const recentClicks = codeIds.length
    ? await db
        .select()
        .from(clicks)
        .where(inArray(clicks.code, codeIds))
        .orderBy(desc(clicks.createdAt))
        .limit(20)
        
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KPI label="Tracking codes" value={fmtNum(codes.length)} />
        <KPI label="Clicks" value={fmtNum(totals.clicks)} />
        <KPI label="Conversions" value={fmtNum(totals.conversions)} />
        <KPI label="Revenue" value={fmtMoney(totals.revenue)} />
        <KPI label="EPC" value={fmtMoney(epcCents(totals.commission, totals.clicks))} />
      </div>

      {/* Source filter */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Conversion source:</span>
        <SourceTab active={source === "all"} href={`/campaigns/${c.id}`} label={`All (${fmtNum(totalConvAll)})`} />
        <SourceTab active={source === "pixel"} href={`/campaigns/${c.id}?source=pixel`} label={`Pixel (${fmtNum(countBySource.pixel ?? 0)})`} />
        <SourceTab active={source === "webhook"} href={`/campaigns/${c.id}?source=webhook`} label={`Webhook (${fmtNum(countBySource.webhook ?? 0)})`} />
        {source !== "all" && (
          <span className="text-xs text-slate-500 ml-2">
            Showing conversions from <strong>{source}</strong> only. Clicks are unfiltered.
          </span>
        )}
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
        <h2 className="text-lg font-semibold mb-2">By platform</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Platform</th><th>Clicks</th><th>Conv.</th><th>CR</th><th>Revenue</th><th>Commission</th><th>EPC</th></tr></thead>
            <tbody>
              {platformKeys.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6">No traffic yet.</td></tr>
              )}
              {platformKeys
                .sort((a, b) => (platformClicks[b] || 0) - (platformClicks[a] || 0))
                .map((p) => {
                  const cl = platformClicks[p] || 0;
                  const cv = platformConversions[p] || { conv: 0, rev: 0, com: 0 };
                  return (
                    <tr key={p}>
                      <td className="capitalize font-medium">{p}</td>
                      <td>{fmtNum(cl)}</td>
                      <td>{fmtNum(cv.conv)}</td>
                      <td className="text-slate-500">{cl > 0 ? ((cv.conv / cl) * 100).toFixed(1) + "%" : "—"}</td>
                      <td>{fmtMoney(cv.rev)}</td>
                      <td>{fmtMoney(cv.com)}</td>
                      <td>{fmtMoney(epcCents(cv.com, cl))}</td>
                    </tr>
                  );
                })}
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
                <th>Clicks</th><th>Conv.</th><th>Revenue</th><th>Commission</th><th>EPC</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-6">No creators have joined yet.</td></tr>
              )}
              {codes.map((tc) => {
                const inf = infMap.get(tc.influencerId);
                const cv = perCodeConv[tc.code] || { n: 0, rev: 0, com: 0 };
                const cl = perCodeClicks[tc.code] || 0;
                const canSee = isOwner || (user.role === "influencer" && tc.influencerId === user.id);
                const name = canSee ? (inf?.name || "creator") : "(hidden)";
                return (
                  <tr key={tc.code}>
                    <td className="font-medium">{name}</td>
                    <td className="capitalize">{tc.platform}</td>
                    <td><code className="text-xs">{tc.code}</code></td>
                    <td>{fmtNum(cl)}</td>
                    <td>{fmtNum(cv.n)}</td>
                    <td>{fmtMoney(cv.rev)}</td>
                    <td>{fmtMoney(cv.com)}</td>
                    <td>{fmtMoney(epcCents(cv.com, cl))}</td>
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

      {/* Pixel snippet for owner — easiest integration path */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold mb-2">JavaScript pixel (easy)</h2>
          <div className="card text-sm space-y-3">
            <p>
              Drop this snippet on <strong>every page</strong> of your site (so we
              can capture the <code>?sl=</code> parameter the visitor lands with),
              and on your <strong>thank-you / order-confirmation page</strong> set
              the order details to fire a conversion automatically.
            </p>
            <div>
              <div className="label">Sitewide (capture attribution)</div>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs">
{`<script src="${appUrl}/pixel.js"
  data-token="${c.pixelToken}"
  async defer></script>`}
              </pre>
            </div>
            <div>
              <div className="label">Thank-you page (fire conversion)</div>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs">
{`<script src="${appUrl}/pixel.js"
  data-token="${c.pixelToken}"
  data-amount-cents="{{ ORDER_TOTAL_CENTS }}"
  data-order-id="{{ ORDER_ID }}"
  async defer></script>`}
              </pre>
            </div>
            <p className="text-slate-600">
              The pixel attributes the sale to the platform the click came from
              (Instagram, TikTok, etc.) automatically. 30-day attribution window.
              Same <code>orderId</code> is deduped.
            </p>
          </div>
        </section>
      )}

      {/* Server-side webhook (advanced, HMAC) */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Server-side webhook (advanced)</h2>
          <div className="card text-sm space-y-3">
            <p>
              Prefer server-to-server? POST a JSON payload from your store after a
              successful order, HMAC-SHA256-signed with this campaign&apos;s
              secret. More secure than the pixel.
            </p>
            <div>
              <div className="label">Webhook secret (keep private)</div>
              <div className="flex items-center gap-2">
                <code className="block flex-1 text-xs bg-slate-100 rounded px-3 py-2 break-all">
                  {c.webhookSecret}
                </code>
                <CopyButton text={c.webhookSecret} />
              </div>
            </div>
            <div>
              <div className="label">Example (Node)</div>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs">
{`const crypto = require('node:crypto');
const secret = '${c.webhookSecret}';
const body = JSON.stringify({
  code: '<sl-from-?sl-query-param>',
  orderId: 'ORDER_123',
  amountCents: 12900,
});
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

await fetch('${appUrl}/api/track/conversion', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-sociallink-signature': signature,
  },
  body,
});`}
              </pre>
            </div>
            <p className="text-slate-600">
              Commission ({fmtPct(c.commissionBps)}) is computed automatically and
              attributed to the right creator.
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

function SourceTab({ active, href, label }: { active: boolean; href: string; label: string }) {
  const cls = active
    ? "inline-flex items-center rounded-md px-3 py-1 text-xs font-medium bg-brand-600 text-white"
    : "inline-flex items-center rounded-md px-3 py-1 text-xs font-medium bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50";
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
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
