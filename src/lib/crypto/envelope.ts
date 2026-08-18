import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedDek: string;
  dekIv: string;
  dekAuthTag: string;
}

const ALG = "aes-256-gcm";

function encryptGcm(key: Buffer, plaintext: Buffer, aad?: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  if (aad) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext: ct, authTag: cipher.getAuthTag() };
}

function decryptGcm(key: Buffer, iv: Buffer, ciphertext: Buffer, authTag: Buffer, aad?: Buffer) {
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecret(plaintext: string, kek: Buffer, secretId: string, version: number): EncryptedSecret {
  const dek = randomBytes(32);
  const valueAad = Buffer.from(`${secretId}:${version}`);
  const dekAad = Buffer.from("kek-wrap");
  const value = encryptGcm(dek, Buffer.from(plaintext, "utf8"), valueAad);
  const wrapped = encryptGcm(kek, dek, dekAad);
  return {
    ciphertext: value.ciphertext.toString("base64"),
    iv: value.iv.toString("base64"),
    authTag: value.authTag.toString("base64"),
    wrappedDek: wrapped.ciphertext.toString("base64"),
    dekIv: wrapped.iv.toString("base64"),
    dekAuthTag: wrapped.authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret, kek: Buffer, secretId: string, version: number): string {
  const dekAad = Buffer.from("kek-wrap");
  const valueAad = Buffer.from(`${secretId}:${version}`);
  const dek = decryptGcm(
    kek,
    Buffer.from(payload.dekIv, "base64"),
    Buffer.from(payload.wrappedDek, "base64"),
    Buffer.from(payload.dekAuthTag, "base64"),
    dekAad,
  );
  const plaintext = decryptGcm(
    dek,
    Buffer.from(payload.iv, "base64"),
    Buffer.from(payload.ciphertext, "base64"),
    Buffer.from(payload.authTag, "base64"),
    valueAad,
  );
  return plaintext.toString("utf8");
}
