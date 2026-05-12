import { db } from "./index";
import { cpmRates, users } from "./schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

async function main() {
  // Reference CPM rates (illustrative public data, USD cents per 1000 imp.)
  const rates: {
    platform: typeof cpmRates.$inferInsert.platform;
    audienceTier: typeof cpmRates.$inferInsert.audienceTier;
    cpmCents: number;
    cpcCents: number;
    source: string;
  }[] = [
    { platform: "instagram", audienceTier: "nano", cpmCents: 800, cpcCents: 35, source: "industry-avg" },
    { platform: "instagram", audienceTier: "micro", cpmCents: 1200, cpcCents: 50, source: "industry-avg" },
    { platform: "instagram", audienceTier: "mid", cpmCents: 1800, cpcCents: 70, source: "industry-avg" },
    { platform: "instagram", audienceTier: "macro", cpmCents: 2500, cpcCents: 95, source: "industry-avg" },
    { platform: "instagram", audienceTier: "mega", cpmCents: 4000, cpcCents: 140, source: "industry-avg" },

    { platform: "tiktok", audienceTier: "nano", cpmCents: 500, cpcCents: 20, source: "industry-avg" },
    { platform: "tiktok", audienceTier: "micro", cpmCents: 900, cpcCents: 35, source: "industry-avg" },
    { platform: "tiktok", audienceTier: "mid", cpmCents: 1400, cpcCents: 55, source: "industry-avg" },
    { platform: "tiktok", audienceTier: "macro", cpmCents: 2000, cpcCents: 80, source: "industry-avg" },
    { platform: "tiktok", audienceTier: "mega", cpmCents: 3200, cpcCents: 120, source: "industry-avg" },

    { platform: "youtube", audienceTier: "nano", cpmCents: 1500, cpcCents: 60, source: "industry-avg" },
    { platform: "youtube", audienceTier: "micro", cpmCents: 2200, cpcCents: 85, source: "industry-avg" },
    { platform: "youtube", audienceTier: "mid", cpmCents: 3000, cpcCents: 110, source: "industry-avg" },
    { platform: "youtube", audienceTier: "macro", cpmCents: 4500, cpcCents: 160, source: "industry-avg" },
    { platform: "youtube", audienceTier: "mega", cpmCents: 7000, cpcCents: 220, source: "industry-avg" },

    { platform: "twitter", audienceTier: "nano", cpmCents: 600, cpcCents: 25, source: "industry-avg" },
    { platform: "twitter", audienceTier: "micro", cpmCents: 1000, cpcCents: 40, source: "industry-avg" },
    { platform: "twitter", audienceTier: "mid", cpmCents: 1500, cpcCents: 60, source: "industry-avg" },
    { platform: "twitter", audienceTier: "macro", cpmCents: 2200, cpcCents: 85, source: "industry-avg" },
    { platform: "twitter", audienceTier: "mega", cpmCents: 3500, cpcCents: 130, source: "industry-avg" },

    { platform: "telegram", audienceTier: "nano", cpmCents: 300, cpcCents: 15, source: "industry-avg" },
    { platform: "telegram", audienceTier: "micro", cpmCents: 500, cpcCents: 25, source: "industry-avg" },
    { platform: "telegram", audienceTier: "mid", cpmCents: 900, cpcCents: 40, source: "industry-avg" },
    { platform: "telegram", audienceTier: "macro", cpmCents: 1400, cpcCents: 60, source: "industry-avg" },
    { platform: "telegram", audienceTier: "mega", cpmCents: 2200, cpcCents: 90, source: "industry-avg" },

    { platform: "whatsapp", audienceTier: "nano", cpmCents: 250, cpcCents: 12, source: "estimate" },
    { platform: "whatsapp", audienceTier: "micro", cpmCents: 450, cpcCents: 22, source: "estimate" },
    { platform: "whatsapp", audienceTier: "mid", cpmCents: 800, cpcCents: 38, source: "estimate" },
    { platform: "whatsapp", audienceTier: "macro", cpmCents: 1200, cpcCents: 55, source: "estimate" },

    { platform: "facebook", audienceTier: "nano", cpmCents: 500, cpcCents: 22, source: "industry-avg" },
    { platform: "facebook", audienceTier: "micro", cpmCents: 800, cpcCents: 32, source: "industry-avg" },
    { platform: "facebook", audienceTier: "mid", cpmCents: 1200, cpcCents: 48, source: "industry-avg" },
    { platform: "facebook", audienceTier: "macro", cpmCents: 1800, cpcCents: 70, source: "industry-avg" },
    { platform: "facebook", audienceTier: "mega", cpmCents: 2800, cpcCents: 105, source: "industry-avg" },
  ];

  // upsert via delete+insert
  await db.delete(cpmRates);
  for (const r of rates) {
    await db.insert(cpmRates).values({ id: nanoid(12), region: "global", ...r });
  }

  // Demo accounts if none exist
  const existing = await db.select().from(users).limit(1);
  if (existing.length === 0) {
    const pw = await bcrypt.hash("demo1234", 10);
    await db.insert(users).values([
      {
        id: nanoid(12),
        email: "brand@demo.io",
        passwordHash: pw,
        name: "Demo Brand",
        role: "brand",
        companyName: "Acme Co",
        website: "https://acme.example",
      },
      {
        id: nanoid(12),
        email: "creator@demo.io",
        passwordHash: pw,
        name: "Demo Creator",
        role: "influencer",
        channels: [
          { platform: "instagram", handle: "@demo", followers: 45000 },
          { platform: "tiktok", handle: "@demo", followers: 80000 },
        ],
      },
    ]);
    console.log("Demo users created: brand@demo.io / creator@demo.io (password: demo1234)");
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
