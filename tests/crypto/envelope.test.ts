import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/envelope";
import { randomBytes } from "node:crypto";

const kek = randomBytes(32);

describe("envelope encryption", () => {
  it("round-trips a secret value", () => {
    const payload = encryptSecret("s3cr3t-value", kek);
    expect(decryptSecret(payload, kek)).toBe("s3cr3t-value");
  });

  it("produces different ciphertext for the same input (random DEK/IV)", () => {
    const a = encryptSecret("same", kek);
    const b = encryptSecret("same", kek);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it("fails to decrypt with the wrong KEK", () => {
    const payload = encryptSecret("value", kek);
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow();
  });

  it("fails to decrypt tampered ciphertext (GCM auth)", () => {
    const payload = encryptSecret("value", kek);
    const tampered = { ...payload, ciphertext: Buffer.from("00".repeat(8), "hex").toString("base64") };
    expect(() => decryptSecret(tampered, kek)).toThrow();
  });
});
