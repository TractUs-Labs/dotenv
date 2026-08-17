import { describe, it, expect, beforeEach } from "vitest";
import { loadKek, clearKekCache } from "@/lib/crypto/kek";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

beforeEach(() => { clearKekCache(); });

describe("loadKek", () => {
  it("loads a valid 32-byte base64 key", () => {
    const dir = mkdtempSync(join(tmpdir(), "kek-"));
    const path = join(dir, "kek.b64");
    writeFileSync(path, randomBytes(32).toString("base64"));
    expect(loadKek(path)).toHaveLength(32);
  });

  it("rejects a key of the wrong length", () => {
    const dir = mkdtempSync(join(tmpdir(), "kek-"));
    const path = join(dir, "kek.b64");
    writeFileSync(path, randomBytes(16).toString("base64"));
    expect(() => loadKek(path)).toThrow(/32 bytes/);
  });
});
