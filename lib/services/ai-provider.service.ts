import type { AIProviderType } from "@prisma/client";

import {
  decryptValue,
  encryptValue,
  packEncryptedValue,
  unpackEncryptedValue,
} from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import { keyHint } from "@/lib/utils";

export async function upsertAIProvider(
  userId: string,
  provider: AIProviderType,
  apiKey: string,
) {
  const encrypted = packEncryptedValue(encryptValue(apiKey));
  return prisma.aIProvider.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: {
      encryptedApiKey: encrypted,
      keyHint: keyHint(apiKey),
      isActive: true,
    },
    create: {
      userId,
      provider,
      encryptedApiKey: encrypted,
      keyHint: keyHint(apiKey),
      isActive: true,
    },
  });
}

export const upsertProvider = upsertAIProvider;

export async function listProviders(userId: string) {
  return prisma.aIProvider.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      keyHint: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { provider: "asc" },
  });
}

export async function removeProvider(userId: string, provider: AIProviderType) {
  return prisma.aIProvider.deleteMany({
    where: {
      userId,
      provider,
    },
  });
}

export async function getProviderApiKey(
  userId: string,
  provider: AIProviderType,
): Promise<string | null> {
  const row = await prisma.aIProvider.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!row || !row.isActive) {
    return null;
  }

  return decryptValue(unpackEncryptedValue(row.encryptedApiKey));
}
