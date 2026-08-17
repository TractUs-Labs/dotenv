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

function encryptGcm(key: Buffer, plaintext: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext: ct, authTag: cipher.getAuthTag() };
}

function decryptGcm(key: Buffer, iv: Buffer, ciphertext: Buffer, authTag: Buffer) {
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecret(plaintext: string, kek: Buffer): EncryptedSecret {
  const dek = randomBytes(32);
  const value = encryptGcm(dek, Buffer.from(plaintext, "utf8"));
  const wrapped = encryptGcm(kek, dek);
  return {
    ciphertext: value.ciphertext.toString("base64"),
    iv: value.iv.toString("base64"),
    authTag: value.authTag.toString("base64"),
    wrappedDek: wrapped.ciphertext.toString("base64"),
    dekIv: wrapped.iv.toString("base64"),
    dekAuthTag: wrapped.authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret, kek: Buffer): string {
  const dek = decryptGcm(
    kek,
    Buffer.from(payload.dekIv, "base64"),
    Buffer.from(payload.wrappedDek, "base64"),
    Buffer.from(payload.dekAuthTag, "base64"),
  );
  const plaintext = decryptGcm(
    dek,
    Buffer.from(payload.iv, "base64"),
    Buffer.from(payload.ciphertext, "base64"),
    Buffer.from(payload.authTag, "base64"),
  );
  return plaintext.toString("utf8");
}
