import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env, isProduction, sessionSecret } from "@/lib/env";

/** AES-256-GCM envelope: `v1.<iv>.<tag>.<ciphertext>` (base64url). Keys never leave the server. */
function key(): Buffer {
  const raw = env().TOKEN_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
    return buf;
  }
  if (isProduction()) throw new Error("TOKEN_ENCRYPTION_KEY is required in production");
  return scryptSync(sessionSecret(), "abandonment-dev-token-key", 32);
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptJson<T>(envelope: string): T {
  const [v, iv, tag, data] = envelope.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised token envelope");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const out = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}
