import { prisma } from "@/lib/prisma";
import type { ProfileUpdateInput } from "@/lib/validations/profile";
import type { Prisma } from "@prisma/client";

export async function getProfile(userId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.profile.findUnique({
      where: { userId },
    }),
  ]);

  return { user, profile };
}

export async function upsertProfile(userId: string, payload: ProfileUpdateInput) {
  const preferences = (payload.preferences ?? undefined) as
    | Prisma.InputJsonValue
    | undefined;
  const equalOpportunity = (payload.equalOpportunity ?? undefined) as
    | Prisma.InputJsonValue
    | undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: payload.name,
      email: payload.email.toLowerCase(),
    },
  });

  return prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      phone: payload.phone,
      location: payload.location,
      linkedin: payload.linkedin,
      links: payload.links ?? [],
      workAuthorization: payload.workAuthorization,
      equalOpportunity,
      preferences,
      summary: payload.summary,
    },
    update: {
      phone: payload.phone,
      location: payload.location,
      linkedin: payload.linkedin,
      links: payload.links ?? [],
      workAuthorization: payload.workAuthorization,
      equalOpportunity,
      preferences,
      summary: payload.summary,
    },
  });
}
