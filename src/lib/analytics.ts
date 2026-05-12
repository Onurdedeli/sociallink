import { db } from "@/db";
import { campaigns, clicks, conversions, trackingCodes } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export type CampaignStats = {
  campaignId: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  commissionCents: number;
  uniqueInfluencers: number;
};

export async function statsForCampaigns(campaignIds: string[]): Promise<Record<string, CampaignStats>> {
  if (campaignIds.length === 0) return {};

  const tcRows = await db
    .select({ code: trackingCodes.code, campaignId: trackingCodes.campaignId, influencerId: trackingCodes.influencerId })
    .from(trackingCodes)
    .where(inArray(trackingCodes.campaignId, campaignIds))
    ;

  const codeToCampaign = new Map<string, string>();
  const campaignInfluencers = new Map<string, Set<string>>();
  for (const r of tcRows) {
    codeToCampaign.set(r.code, r.campaignId);
    if (!campaignInfluencers.has(r.campaignId)) campaignInfluencers.set(r.campaignId, new Set());
    campaignInfluencers.get(r.campaignId)!.add(r.influencerId);
  }

  const codes = tcRows.map((r) => r.code);
  const result: Record<string, CampaignStats> = {};
  for (const id of campaignIds) {
    result[id] = {
      campaignId: id,
      clicks: 0,
      conversions: 0,
      revenueCents: 0,
      commissionCents: 0,
      uniqueInfluencers: campaignInfluencers.get(id)?.size || 0,
    };
  }

  if (codes.length === 0) return result;

  const clickRows = await db
    .select({ code: clicks.code, n: sql<number>`count(*)` })
    .from(clicks)
    .where(inArray(clicks.code, codes))
    .groupBy(clicks.code)
    ;
  for (const r of clickRows) {
    const cid = codeToCampaign.get(r.code);
    if (cid) result[cid].clicks += Number(r.n);
  }

  const convRows = await db
    .select({
      code: conversions.code,
      n: sql<number>`count(*)`,
      rev: sql<number>`coalesce(sum(${conversions.amountCents}),0)`,
      com: sql<number>`coalesce(sum(${conversions.commissionCents}),0)`,
    })
    .from(conversions)
    .where(inArray(conversions.code, codes))
    .groupBy(conversions.code)
    ;
  for (const r of convRows) {
    const cid = codeToCampaign.get(r.code);
    if (!cid) continue;
    result[cid].conversions += Number(r.n);
    result[cid].revenueCents += Number(r.rev);
    result[cid].commissionCents += Number(r.com);
  }

  return result;
}

export async function statsForInfluencer(influencerId: string) {
  const tcRows = await db
    .select({ code: trackingCodes.code, campaignId: trackingCodes.campaignId, platform: trackingCodes.platform })
    .from(trackingCodes)
    .where(eq(trackingCodes.influencerId, influencerId))
    ;

  const codes = tcRows.map((r) => r.code);
  let totalClicks = 0;
  let totalConversions = 0;
  let totalRevenue = 0;
  let totalCommission = 0;
  const byPlatform: Record<string, { clicks: number; conversions: number; commission: number }> = {};

  if (codes.length === 0) {
    return { totalClicks, totalConversions, totalRevenue, totalCommission, byPlatform, codes: tcRows };
  }

  const clickRows = await db
    .select({ code: clicks.code, platform: clicks.platform, n: sql<number>`count(*)` })
    .from(clicks)
    .where(inArray(clicks.code, codes))
    .groupBy(clicks.code, clicks.platform)
    ;
  for (const r of clickRows) {
    totalClicks += Number(r.n);
    const p = r.platform || "other";
    byPlatform[p] ||= { clicks: 0, conversions: 0, commission: 0 };
    byPlatform[p].clicks += Number(r.n);
  }

  const convRows = await db
    .select({
      code: conversions.code,
      n: sql<number>`count(*)`,
      rev: sql<number>`coalesce(sum(${conversions.amountCents}),0)`,
      com: sql<number>`coalesce(sum(${conversions.commissionCents}),0)`,
    })
    .from(conversions)
    .where(inArray(conversions.code, codes))
    .groupBy(conversions.code)
    ;
  const tcByCode = new Map(tcRows.map((t) => [t.code, t]));
  for (const r of convRows) {
    totalConversions += Number(r.n);
    totalRevenue += Number(r.rev);
    totalCommission += Number(r.com);
    const platform = tcByCode.get(r.code)?.platform || "other";
    byPlatform[platform] ||= { clicks: 0, conversions: 0, commission: 0 };
    byPlatform[platform].conversions += Number(r.n);
    byPlatform[platform].commission += Number(r.com);
  }

  return { totalClicks, totalConversions, totalRevenue, totalCommission, byPlatform, codes: tcRows };
}
