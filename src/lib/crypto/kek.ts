import { readFileSync } from "node:fs";

let cached: Buffer | null = null;

export function loadKek(filePath: string): Buffer {
  if (cached) return cached;
  const raw = readFileSync(filePath, "utf8").trim();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`KEK must be 32 bytes, got ${key.length} bytes`);
  }
  cached = key;
  return cached;
}

export function clearKekCache(): void {
  cached = null;
}
