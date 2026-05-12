"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signSession } from "@/lib/auth";

export async function signUpAction(formData: FormData) {
  const role = String(formData.get("role") || "brand") as "brand" | "influencer";
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const companyName = String(formData.get("companyName") || "").trim() || null;
  const website = String(formData.get("website") || "").trim() || null;

  if (!name || !email || password.length < 8) {
    redirect("/sign-up?error=" + encodeURIComponent("Please fill all required fields (password ≥ 8 chars)."));
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) redirect("/sign-up?error=" + encodeURIComponent("Email already registered."));

  const id = nanoid(12);
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    id,
    email,
    name,
    role,
    passwordHash,
    companyName,
    website,
    channels: role === "influencer" ? [] : null,
  });

  await signSession(id);
  redirect("/dashboard");
}
