import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { trackingCodes, campaigns, clicks, PLATFORMS, Platform } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashIp, readClientIp } from "@/lib/ip";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const tc = await db
    .select()
    .from(trackingCodes)
    .where(eq(trackingCodes.code, code))
    .get();
  if (!tc) return NextResponse.json({ error: "Unknown code" }, { status: 404 });

  const c = await db.select().from(campaigns).where(eq(campaigns.id, tc.campaignId)).get();
  if (!c || c.status !== "active") {
    return NextResponse.json({ error: "Campaign inactive" }, { status: 410 });
  }

  const url = new URL(req.url);
  const pParam = (url.searchParams.get("p") || "").toLowerCase();
  const platform: Platform = (PLATFORMS as readonly string[]).includes(pParam)
    ? (pParam as Platform)
    : tc.platform;

  await db.insert(clicks).values({
    id: nanoid(14),
    code: tc.code,
    ipHash: hashIp(readClientIp(req.headers)),
    userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
    referrer: req.headers.get("referer")?.slice(0, 500) || null,
    platform,
    country: req.headers.get("x-vercel-ip-country") || null,
  });

  // Append tracking code as a query param so the brand can echo it back via conversion webhook
  const target = new URL(c.targetUrl);
  target.searchParams.set("sl", tc.code);

  return NextResponse.redirect(target.toString(), { status: 302 });
}
