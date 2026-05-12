import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is required");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
