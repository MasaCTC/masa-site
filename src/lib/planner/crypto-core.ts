// AES-256-GCM for secrets at rest (the Canvas feed URL). Pure module: no
// server-only, no "@/" imports, so node:test can load it. App code uses the
// server-only wrapper in ./crypto.ts. Error messages never include key
// material or plaintext.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
// Binds ciphertexts to this use, so a value can't be replayed elsewhere.
const AAD = Buffer.from("masa-site/planner/v1");
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decodes PLANNER_ENCRYPTION_KEY (base64 of 32 bytes). Throws if unusable. */
export function loadKey(raw: string | undefined): Buffer {
  const s = raw?.trim();
  if (!s) throw new Error("PLANNER_ENCRYPTION_KEY is not set");
  if (!B64.test(s)) throw new Error("PLANNER_ENCRYPTION_KEY is not base64");
  const key = Buffer.from(s, "base64");
  if (key.length !== 32) {
    throw new Error("PLANNER_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

/** "v1:" + base64(iv | tag | ciphertext), fresh random IV each call. */
export function encryptString(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VERSION + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Throws on wrong key, tampering or a malformed payload. */
export function decryptString(payload: string, key: Buffer): string {
  if (!payload.startsWith(VERSION)) throw new Error("unknown ciphertext version");
  const raw = Buffer.from(payload.slice(VERSION.length), "base64");
  if (raw.length < IV_BYTES + TAG_BYTES + 1) throw new Error("ciphertext too short");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = raw.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("decryption failed");
  }
}
