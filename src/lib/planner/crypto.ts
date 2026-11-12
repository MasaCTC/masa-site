import "server-only";
import { decryptString, encryptString, loadKey } from "./crypto-core";

// Key: PLANNER_ENCRYPTION_KEY, base64 of 32 random bytes, the same value in
// every environment (the DB is shared). Read per call so a missing key fails
// closed at use, not at import/build time. Never log inputs or outputs.

/** Encrypts the Canvas feed URL. Throws if the key is missing or invalid. */
export function encryptFeed(url: string): string {
  return encryptString(url, loadKey(process.env.PLANNER_ENCRYPTION_KEY));
}

/** Decrypts a stored feed. Throws on a bad key, tampering or bad payload. */
export function decryptFeed(enc: string): string {
  return decryptString(enc, loadKey(process.env.PLANNER_ENCRYPTION_KEY));
}
