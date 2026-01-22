import crypto from "crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export function generateRef(prefix) {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${prefix}-${year}-${rand}`;
}
