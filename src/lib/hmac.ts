import crypto from "node:crypto";

export function hmacSign(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function hmacVerify(secret: string, body: string, signature: string) {
  const expected = hmacSign(secret, body);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
