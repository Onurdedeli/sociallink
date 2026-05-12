import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "telegram",
  "whatsapp",
  "facebook",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ROLES = ["brand", "influencer"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  // brand-only
  companyName: text("company_name"),
  website: text("website"),
  // influencer-only — JSON: [{platform, handle, followers}]
  channels: text("channels", { mode: "json" }).$type<
    { platform: Platform; handle: string; followers: number }[]
  >(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  targetUrl: text("target_url").notNull(),
  // payouts (any combination may be set)
  cpcCents: integer("cpc_cents").notNull().default(0), // pay per click
  cpmCents: integer("cpm_cents").notNull().default(0), // pay per 1000 impressions/clicks
  commissionBps: integer("commission_bps").notNull().default(0), // basis points (e.g. 1000 = 10%)
  budgetCents: integer("budget_cents").notNull().default(0),
  status: text("status", { enum: ["draft", "active", "paused", "ended"] })
    .notNull()
    .default("active"),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const trackingCodes = sqliteTable(
  "tracking_codes",
  {
    code: text("code").primaryKey(), // short slug used in /r/[code]
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    influencerId: text("influencer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull().default("other"),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("approved"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    byCampaign: index("idx_tc_campaign").on(t.campaignId),
    byInfluencer: index("idx_tc_influencer").on(t.influencerId),
  })
);

export const clicks = sqliteTable(
  "clicks",
  {
    id: text("id").primaryKey(),
    code: text("code")
      .notNull()
      .references(() => trackingCodes.code, { onDelete: "cascade" }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    platform: text("platform", { enum: PLATFORMS }), // overridden by ?p= query param
    country: text("country"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    byCode: index("idx_clicks_code").on(t.code),
    byCreated: index("idx_clicks_created").on(t.createdAt),
  })
);

export const conversions = sqliteTable(
  "conversions",
  {
    id: text("id").primaryKey(),
    code: text("code")
      .notNull()
      .references(() => trackingCodes.code, { onDelete: "cascade" }),
    orderId: text("order_id"),
    amountCents: integer("amount_cents").notNull().default(0),
    commissionCents: integer("commission_cents").notNull().default(0),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    byCode: index("idx_conv_code").on(t.code),
  })
);

// Public CPM/CPC reference rates for the open-data tool
export const cpmRates = sqliteTable("cpm_rates", {
  id: text("id").primaryKey(),
  platform: text("platform", { enum: PLATFORMS }).notNull(),
  region: text("region").notNull().default("global"),
  audienceTier: text("audience_tier", {
    enum: ["nano", "micro", "mid", "macro", "mega"],
  }).notNull(),
  cpmCents: integer("cpm_cents").notNull(), // for 1k impressions
  cpcCents: integer("cpc_cents").notNull().default(0),
  source: text("source"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type TrackingCode = typeof trackingCodes.$inferSelect;
export type Click = typeof clicks.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
export type CpmRate = typeof cpmRates.$inferSelect;
