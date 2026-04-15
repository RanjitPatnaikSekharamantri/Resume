import { prisma } from "@/lib/prisma";
import type { ProfileUpdateInput } from "@/lib/validations/profile";

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
      equalOpportunity: payload.equalOpportunity ?? undefined,
      preferences: payload.preferences ?? undefined,
      summary: payload.summary,
    },
    update: {
      phone: payload.phone,
      location: payload.location,
      linkedin: payload.linkedin,
      links: payload.links ?? [],
      workAuthorization: payload.workAuthorization,
      equalOpportunity: payload.equalOpportunity ?? undefined,
      preferences: payload.preferences ?? undefined,
      summary: payload.summary,
    },
  });
}
