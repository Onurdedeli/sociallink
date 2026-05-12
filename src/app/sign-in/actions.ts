"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signSession } from "@/lib/auth";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/sign-in?error=1");

  const u = await db.select().from(users).where(eq(users.email, email)).get();
  if (!u) redirect("/sign-in?error=1");
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) redirect("/sign-in?error=1");

  await signSession(u.id);
  redirect("/dashboard");
}
