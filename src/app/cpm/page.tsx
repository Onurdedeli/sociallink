import { db } from "@/db";
import { cpmRates } from "@/db/schema";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIER_ORDER = ["nano", "micro", "mid", "macro", "mega"] as const;

export default async function CpmPage() {
  const rates = await db.select().from(cpmRates);

  const byPlatform: Record<string, typeof rates> = {};
  for (const r of rates) {
    byPlatform[r.platform] ||= [];
    byPlatform[r.platform].push(r);
  }
  for (const k of Object.keys(byPlatform)) {
    byPlatform[k].sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.audienceTier as (typeof TIER_ORDER)[number]) -
        TIER_ORDER.indexOf(b.audienceTier as (typeof TIER_ORDER)[number])
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">CPM &amp; CPC reference rates</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Open reference data for what brands typically pay creators per
          platform and audience tier. Use the free JSON API:
        </p>
        <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 mt-2 text-xs overflow-x-auto">
{`GET /api/cpm                                 — all rates
GET /api/cpm?platform=tiktok                 — filter by platform
GET /api/cpm?platform=youtube&tier=mid       — combined filter`}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          Tiers: <b>nano</b> (&lt;10k) · <b>micro</b> (10–100k) · <b>mid</b> (100–500k) · <b>macro</b> (500k–1M) · <b>mega</b> (1M+)
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {Object.entries(byPlatform).map(([platform, list]) => (
          <div key={platform} className="card">
            <h3 className="font-semibold capitalize mb-3">{platform}</h3>
            <table className="table">
              <thead><tr><th>Tier</th><th>CPM</th><th>CPC</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="capitalize">{r.audienceTier}</td>
                    <td>{fmtMoney(r.cpmCents)}</td>
                    <td>{fmtMoney(r.cpcCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
