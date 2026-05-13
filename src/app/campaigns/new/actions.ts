"use server";

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brand") redirect("/dashboard");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "");
  const targetUrl = String(formData.get("targetUrl") || "").trim();
  const cpcCents = Number(formData.get("cpcCents") || 0);
  const cpmCents = Number(formData.get("cpmCents") || 0);
  const commissionBps = Number(formData.get("commissionBps") || 0);
  const budgetCents = Number(formData.get("budgetCents") || 0);

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
    cpcCents,
    cpmCents,
    commissionBps,
    budgetCents,
    webhookSecret,
    pixelToken,
    status: "active",
  });

  redirect(`/campaigns/${id}`);
}
