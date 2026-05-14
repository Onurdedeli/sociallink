import { db } from "@/db";
import { clicks, conversions, trackingCodes } from "@/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

export type DailyPoint = {
  /** ISO date (YYYY-MM-DD) in UTC */
  date: string;
  humanClicks: number;
  botClicks: number;
  conversions: number;
  revenueCents: number;
  commissionCents: number;
};

const DAY = 24 * 3600 * 1000;

function buildDateBuckets(days: number): Map<string, DailyPoint> {
  const map = new Map<string, DailyPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    const iso = d.toISOString().slice(0, 10);
    map.set(iso, {
      date: iso,
      humanClicks: 0,
      botClicks: 0,
      conversions: 0,
      revenueCents: 0,
      commissionCents: 0,
    });
  }
  return map;
}

async function codesForCampaigns(campaignIds: string[]) {
  if (campaignIds.length === 0) return [];
  const rows = await db
    .select({ code: trackingCodes.code })
    .from(trackingCodes)
    .where(inArray(trackingCodes.campaignId, campaignIds));
  return rows.map((r) => r.code);
}

async function codesForInfluencer(influencerId: string) {
  const rows = await db
    .select({ code: trackingCodes.code })
    .from(trackingCodes)
    .where(eq(trackingCodes.influencerId, influencerId));
  return rows.map((r) => r.code);
}

async function dailySeries(
  codes: string[],
  days: number
): Promise<DailyPoint[]> {
  const map = buildDateBuckets(days);
  if (codes.length === 0) return Array.from(map.values());

  const since = new Date(Date.now() - days * DAY);

  const clickRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${clicks.createdAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
      humans: sql<number>`sum(case when ${clicks.isBot} then 0 else 1 end)`,
      bots: sql<number>`sum(case when ${clicks.isBot} then 1 else 0 end)`,
    })
    .from(clicks)
    .where(and(inArray(clicks.code, codes), gte(clicks.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${clicks.createdAt})`);

  for (const r of clickRows) {
    const p = map.get(r.day);
    if (!p) continue;
    p.humanClicks = Number(r.humans);
    p.botClicks = Number(r.bots);
  }

  const convRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${conversions.createdAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
      n: sql<number>`count(*)`,
      rev: sql<number>`coalesce(sum(${conversions.amountCents}),0)`,
      com: sql<number>`coalesce(sum(${conversions.commissionCents}),0)`,
    })
    .from(conversions)
    .where(and(inArray(conversions.code, codes), gte(conversions.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${conversions.createdAt})`);

  for (const r of convRows) {
    const p = map.get(r.day);
    if (!p) continue;
    p.conversions = Number(r.n);
    p.revenueCents = Number(r.rev);
    p.commissionCents = Number(r.com);
  }

  return Array.from(map.values());
}

export async function dailyForCampaigns(campaignIds: string[], days = 30) {
  const codes = await codesForCampaigns(campaignIds);
  return dailySeries(codes, days);
}

export async function dailyForCampaign(campaignId: string, days = 30) {
  return dailyForCampaigns([campaignId], days);
}

export async function dailyForInfluencer(influencerId: string, days = 30) {
  const codes = await codesForInfluencer(influencerId);
  return dailySeries(codes, days);
}
