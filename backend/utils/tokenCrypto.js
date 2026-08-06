const crypto = require("crypto");

/**
 * tokenCrypto.js — AES-256-GCM encrypt/decrypt for OAuth access/refresh
 * tokens obtained via a genuine server-to-server authorization-code exchange
 * (e.g. Google Calendar OAuth). This is a deliberate deviation from
 * InstagramSession's plaintext-storage precedent (see that model's file
 * header) — that precedent applies only to clinic-supplied long-lived
 * tokens, not tokens our backend itself receives via a redirect-based OAuth
 * exchange. See .claude/rules/oauth-token-storage.md.
 *
 * Key is derived from GOOGLE_TOKEN_ENCRYPTION_KEY via SHA-256 so any string
 * length in .env still yields a valid 32-byte AES-256 key. Fails loud
 * (throws) when the env var is missing — this module must never silently
 * fall back to storing plaintext.
 *
 * Payload format: `${ivHex}:${authTagHex}:${cipherHex}`.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set — refusing to encrypt/decrypt OAuth tokens.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypt a plaintext string (e.g. an OAuth access/refresh token) for storage. */
function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a payload produced by encrypt() back into the plaintext string. */
function decrypt(payload) {
  if (payload == null) return null;
  const key = getKey();
  const parts = String(payload).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token payload format.");
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
