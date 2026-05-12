"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { campaigns, trackingCodes, PLATFORMS, Platform } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export async function joinCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "influencer") redirect("/dashboard");

  const campaignId = String(formData.get("campaignId") || "");
  const platformInput = String(formData.get("platform") || "other").toLowerCase();
  const platform: Platform = (PLATFORMS as readonly string[]).includes(platformInput)
    ? (platformInput as Platform)
    : "other";

  const camp = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then((r) => r[0] ?? null);
  if (!camp || camp.status !== "active") redirect("/campaigns");

  const existing = await db
    .select()
    .from(trackingCodes)
    .where(and(eq(trackingCodes.campaignId, campaignId), eq(trackingCodes.influencerId, user.id)))
    .limit(1).then((r) => r[0] ?? null);

  if (existing) {
    if (existing.platform !== platform) {
      await db
        .update(trackingCodes)
        .set({ platform })
        .where(eq(trackingCodes.code, existing.code));
    }
  } else {
    await db.insert(trackingCodes).values({
      code: nanoid(8),
      campaignId,
      influencerId: user.id,
      platform,
      status: "approved",
    });
  }

  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}`);
}

export async function setStatusAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = String(formData.get("campaignId") || "");
  const status = String(formData.get("status") || "active") as "active" | "paused" | "ended" | "draft";

  const camp = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then((r) => r[0] ?? null);
  if (!camp || camp.brandId !== user.id) redirect("/dashboard");

  await db.update(campaigns).set({ status }).where(eq(campaigns.id, campaignId));
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}`);
}
