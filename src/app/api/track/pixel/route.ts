import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import {
  trackingCodes,
  campaigns,
  conversions,
  PLATFORMS,
  Platform,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { conversionLimit } from "@/lib/ratelimit";
import { readClientIp } from "@/lib/ip";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const Body = z.object({
  code: z.string().min(1),
  pixelToken: z.string().min(1),
  amountCents: z.number().int().nonnegative().default(0),
  orderId: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const ip = readClientIp(req.headers) || "anon";
  const limit = await conversionLimit.limit(ip);
  if (!limit.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: CORS });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS });
  }
  const { code, pixelToken, amountCents, orderId, platform } = parsed.data;

  const tc = await db
    .select()
    .from(trackingCodes)
    .where(eq(trackingCodes.code, code))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!tc) return NextResponse.json({ error: "Unknown code" }, { status: 404, headers: CORS });

  const c = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, tc.campaignId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!c) return NextResponse.json({ error: "Campaign missing" }, { status: 404, headers: CORS });
  if (c.pixelToken !== pixelToken) {
    return NextResponse.json({ error: "Invalid pixel token" }, { status: 401, headers: CORS });
  }

  // Idempotency: if same orderId already recorded for this code, return existing
  if (orderId) {
    const existing = await db
      .select()
      .from(conversions)
      .where(and(eq(conversions.code, code), eq(conversions.orderId, orderId)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (existing) {
      return NextResponse.json(
        { ok: true, id: existing.id, commissionCents: existing.commissionCents, deduped: true },
        { headers: CORS }
      );
    }
  }

  const normalizedPlatform = (PLATFORMS as readonly string[]).includes(
    (platform || "").toLowerCase()
  )
    ? ((platform || "").toLowerCase() as Platform)
    : tc.platform;
  const commissionCents = Math.floor((amountCents * c.commissionBps) / 10000);

  const id = nanoid(14);
  await db.insert(conversions).values({
    id,
    code,
    orderId: orderId || null,
    amountCents,
    commissionCents,
    platform: normalizedPlatform,
    source: "pixel",
  });

  return NextResponse.json({ ok: true, id, commissionCents }, { headers: CORS });
}
