import crypto from "crypto";

import { env } from "@/lib/env";

const algorithm = "aes-256-gcm";
const ivLength = 16;

const key = crypto.createHash("sha256").update(env.AI_ENCRYPTION_KEY).digest();

export type EncryptedValue = {
  encrypted: string;
  iv: string;
  authTag: string;
};

export function encryptValue(plainText: string): EncryptedValue {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted: encryptedBuffer.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptValue(value: EncryptedValue): string {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(value.encrypted, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function packEncryptedValue(value: EncryptedValue): string {
  return `${value.iv}:${value.authTag}:${value.encrypted}`;
}

export function unpackEncryptedValue(payload: string): EncryptedValue {
  const [iv, authTag, encrypted] = payload.split(":");

  if (!iv || !authTag || !encrypted) {
    throw new Error("Invalid encrypted payload.");
  }

  return { iv, authTag, encrypted };
}
