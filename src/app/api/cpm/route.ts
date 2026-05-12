import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cpmRates, PLATFORMS, Platform } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const platformParam = (url.searchParams.get("platform") || "").toLowerCase();
  const tier = url.searchParams.get("tier")?.toLowerCase();
  const region = url.searchParams.get("region")?.toLowerCase();

  const filters = [];
  if ((PLATFORMS as readonly string[]).includes(platformParam)) {
    filters.push(eq(cpmRates.platform, platformParam as Platform));
  }
  if (tier && ["nano", "micro", "mid", "macro", "mega"].includes(tier)) {
    filters.push(eq(cpmRates.audienceTier, tier as "nano" | "micro" | "mid" | "macro" | "mega"));
  }
  if (region) filters.push(eq(cpmRates.region, region));

  const rows = await db
    .select()
    .from(cpmRates)
    .where(filters.length ? and(...filters) : undefined)
    ;

  return NextResponse.json(
    {
      currency: "USD",
      unit: "cents",
      count: rows.length,
      rates: rows.map((r) => ({
        platform: r.platform,
        region: r.region,
        tier: r.audienceTier,
        cpmCents: r.cpmCents,
        cpcCents: r.cpcCents,
        cpmUsd: (r.cpmCents / 100).toFixed(2),
        cpcUsd: (r.cpcCents / 100).toFixed(2),
        source: r.source,
        updatedAt: r.updatedAt,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
