"use server";

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { campaigns, PAYOUT_MODELS, type PayoutModel } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brand") redirect("/dashboard");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "");
  const targetUrl = String(formData.get("targetUrl") || "").trim();
  const budgetCents = Number(formData.get("budgetCents") || 0);

  const modelInput = String(formData.get("payoutModel") || "cpa_percent");
  const payoutModel: PayoutModel = (PAYOUT_MODELS as readonly string[]).includes(modelInput)
    ? (modelInput as PayoutModel)
    : "cpa_percent";

  const cpcCents = payoutModel === "cpc" ? Number(formData.get("cpcCents") || 0) : 0;
  const cpmCents = payoutModel === "cpm" ? Number(formData.get("cpmCents") || 0) : 0;
  const cpaCents = payoutModel === "cpa_fixed" ? Number(formData.get("cpaCents") || 0) : 0;
  const commissionBps =
    payoutModel === "cpa_percent" ? Number(formData.get("commissionBps") || 0) : 0;

  if (!title || !targetUrl) redirect("/campaigns/new");

  const id = nanoid(12);
  const webhookSecret = nanoid(40);
  const pixelToken = nanoid(20);
  await db.insert(campaigns).values({
    id,
    brandId: user.id,
    title,
    description,
    targetUrl,
    payoutModel,
    cpcCents,
    cpmCents,
    cpaCents,
    commissionBps,
    budgetCents,
    webhookSecret,
    pixelToken,
    status: "active",
  });

  redirect(`/campaigns/${id}`);
}
