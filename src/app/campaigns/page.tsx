import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { campaigns, users, trackingCodes } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { describePayout } from "@/lib/payout";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const list = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "active"))
    .orderBy(desc(campaigns.createdAt))
    ;

  const brandIds = Array.from(new Set(list.map((c) => c.brandId)));
  const brands = brandIds.length
    ? await db.select().from(users).where(inArray(users.id, brandIds))
    : [];
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  // Tracking codes claimed by this influencer
  const myCodes = user.role === "influencer"
    ? await db.select().from(trackingCodes).where(eq(trackingCodes.influencerId, user.id))
    : [];
  const claimed = new Set(myCodes.map((tc) => tc.campaignId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Open campaigns</h1>
        {user.role === "brand" && <Link href="/campaigns/new" className="btn-primary">New campaign</Link>}
      </div>

      {list.length === 0 ? (
        <div className="card text-center text-slate-500">No active campaigns right now.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => {
            const b = brandMap.get(c.brandId);
            return (
              <div key={c.id} className="card flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.title}</h3>
                  <span className="badge-green">active</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{b?.companyName || b?.name}</div>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3">{c.description || "—"}</p>
                <div className="mt-3">
                  <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                    {describePayout(c)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/campaigns/${c.id}`} className="btn-secondary flex-1 text-center">
                    {user.role === "influencer" && claimed.has(c.id) ? "View my link" :
                     user.role === "influencer" ? "Join" : "Open"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
