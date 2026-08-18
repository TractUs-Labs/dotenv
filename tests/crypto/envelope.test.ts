import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto/envelope";
import { randomBytes } from "node:crypto";

const kek = randomBytes(32);
const secretId = "00000000-0000-0000-0000-000000000001";
const version = 1;

describe("envelope encryption", () => {
  it("round-trips a secret value", () => {
    const payload = encryptSecret("s3cr3t-value", kek, secretId, version);
    expect(decryptSecret(payload, kek, secretId, version)).toBe("s3cr3t-value");
  });

  it("produces different ciphertext for the same input (random DEK/IV)", () => {
    const a = encryptSecret("same", kek, secretId, version);
    const b = encryptSecret("same", kek, secretId, version);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it("fails to decrypt with the wrong KEK", () => {
    const payload = encryptSecret("value", kek, secretId, version);
    expect(() => decryptSecret(payload, randomBytes(32), secretId, version)).toThrow();
  });

  it("fails to decrypt tampered ciphertext (GCM auth)", () => {
    const payload = encryptSecret("value", kek, secretId, version);
    const tampered = { ...payload, ciphertext: Buffer.from("00".repeat(8), "hex").toString("base64") };
    expect(() => decryptSecret(tampered, kek, secretId, version)).toThrow();
  });

  it("fails to decrypt with a different secretId (AAD mismatch)", () => {
    const payload = encryptSecret("value", kek, secretId, version);
    expect(() => decryptSecret(payload, kek, "00000000-0000-0000-0000-000000000002", version)).toThrow();
  });

  it("fails to decrypt with a different version (AAD mismatch)", () => {
    const payload = encryptSecret("value", kek, secretId, version);
    expect(() => decryptSecret(payload, kek, secretId, 2)).toThrow();
  });
});
