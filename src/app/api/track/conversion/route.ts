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
import { eq } from "drizzle-orm";
import { hmacVerify } from "@/lib/hmac";
import { conversionLimit } from "@/lib/ratelimit";
import { readClientIp } from "@/lib/ip";

const Body = z.object({
  code: z.string().min(1),
  orderId: z.string().optional(),
  amountCents: z.number().int().nonnegative().default(0),
  platform: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const ip = readClientIp(req.headers) || "anon";
  const limit = await conversionLimit.limit(ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))),
        },
      }
    );
  }

  // We read the raw body once for HMAC verification, then JSON-parse it.
  const raw = await req.text();
  const signature = req.headers.get("x-sociallink-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-Sociallink-Signature header" },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { code, orderId, amountCents, platform, metadata } = parsed.data;

  const tc = await db
    .select()
    .from(trackingCodes)
    .where(eq(trackingCodes.code, code))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!tc) return NextResponse.json({ error: "Unknown code" }, { status: 404 });

  const c = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, tc.campaignId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!c) return NextResponse.json({ error: "Campaign missing" }, { status: 404 });

  if (!hmacVerify(c.webhookSecret, raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
    source: "webhook",
    metadata: metadata || null,
  });

  return NextResponse.json({ ok: true, id, commissionCents });
}
