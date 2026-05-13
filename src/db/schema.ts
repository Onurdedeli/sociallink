import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";

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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  companyName: text("company_name"),
  website: text("website"),
  channels: jsonb("channels").$type<
    { platform: Platform; handle: string; followers: number }[]
  >(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  targetUrl: text("target_url").notNull(),
  cpcCents: integer("cpc_cents").notNull().default(0),
  cpmCents: integer("cpm_cents").notNull().default(0),
  commissionBps: integer("commission_bps").notNull().default(0),
  budgetCents: integer("budget_cents").notNull().default(0),
  webhookSecret: text("webhook_secret")
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')`),
  pixelToken: text("pixel_token")
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  status: text("status", { enum: ["draft", "active", "paused", "ended"] })
    .notNull()
    .default("active"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trackingCodes = pgTable(
  "tracking_codes",
  {
    code: text("code").primaryKey(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byCampaign: index("idx_tc_campaign").on(t.campaignId),
    byInfluencer: index("idx_tc_influencer").on(t.influencerId),
  })
);

export const clicks = pgTable(
  "clicks",
  {
    id: text("id").primaryKey(),
    code: text("code")
      .notNull()
      .references(() => trackingCodes.code, { onDelete: "cascade" }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    platform: text("platform", { enum: PLATFORMS }),
    country: text("country"),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byCode: index("idx_clicks_code").on(t.code),
    byCreated: index("idx_clicks_created").on(t.createdAt),
  })
);

export const conversions = pgTable(
  "conversions",
  {
    id: text("id").primaryKey(),
    code: text("code")
      .notNull()
      .references(() => trackingCodes.code, { onDelete: "cascade" }),
    orderId: text("order_id"),
    amountCents: integer("amount_cents").notNull().default(0),
    commissionCents: integer("commission_cents").notNull().default(0),
    platform: text("platform", { enum: PLATFORMS }),
    source: text("source", { enum: ["webhook", "pixel"] })
      .notNull()
      .default("webhook"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byCode: index("idx_conv_code").on(t.code),
  })
);

export const cpmRates = pgTable("cpm_rates", {
  id: text("id").primaryKey(),
  platform: text("platform", { enum: PLATFORMS }).notNull(),
  region: text("region").notNull().default("global"),
  audienceTier: text("audience_tier", {
    enum: ["nano", "micro", "mid", "macro", "mega"],
  }).notNull(),
  cpmCents: integer("cpm_cents").notNull(),
  cpcCents: integer("cpc_cents").notNull().default(0),
  source: text("source"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type TrackingCode = typeof trackingCodes.$inferSelect;
export type Click = typeof clicks.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
export type CpmRate = typeof cpmRates.$inferSelect;
