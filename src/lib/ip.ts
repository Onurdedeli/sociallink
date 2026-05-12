import crypto from "node:crypto";

export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET || "salt";
  return crypto.createHash("sha256").update(ip + "|" + salt).digest("hex").slice(0, 24);
}

export function readClientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || null;
}
