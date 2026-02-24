const VERIFICATION_TOKEN_BYTES = 32;
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

const encoder = new TextEncoder();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateVerificationToken() {
  const bytes = new Uint8Array(VERIFICATION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function getVerificationExpiryDate() {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array) {
  const base64 =
    typeof btoa === "function"
      ? btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
