import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is required");

const sql = neon(url);
export const db = drizzle({ client: sql, schema });
export { schema };
