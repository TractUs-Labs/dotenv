import { readFileSync } from "node:fs";

export function loadKek(filePath: string): Buffer {
  const raw = readFileSync(filePath, "utf8").trim();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`KEK must be 32 bytes, got ${key.length} bytes`);
  }
  return key;
}
