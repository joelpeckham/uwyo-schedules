import { randomBytes } from "node:crypto";

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const SHARE_CODE_LENGTH = 10;

/** URL-safe short code for planner share links. */
export function generateShareCode(length = SHARE_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += BASE62[bytes[i]! % BASE62.length];
  }
  return code;
}

export function isValidShareCode(code: string): boolean {
  if (code.length < 6 || code.length > 32) return false;
  return /^[0-9A-Za-z]+$/.test(code);
}
