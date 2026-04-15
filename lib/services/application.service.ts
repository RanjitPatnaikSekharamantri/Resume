import { ApplicationStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  applicationQuerySchema,
  createApplicationSchema,
  updateApplicationSchema,
  type CreateApplicationInput,
  type ListApplicationsInput,
  type UpdateApplicationInput,
} from "@/lib/validations/application";

function normalizePostedDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listApplications(
  userId: string,
  query: ListApplicationsInput = {}
) {
  const filters = applicationQuerySchema.parse(query);
  const where: Prisma.ApplicationWhereInput = {
    userId,
    ...(filters.search
      ? {
          OR: [
            { jobTitle: { contains: filters.search, mode: "insensitive" } },
            { company: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  return prisma.application.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      resumeVersions: { select: { id: true } },
      coverLetterVersions: { select: { id: true } },
    },
  });
}

export async function createApplication(
  userId: string,
  payload: CreateApplicationInput
) {
  const data = createApplicationSchema.parse(payload);
  const created = await prisma.application.create({
    data: {
      userId,
      ...data,
      postedDate: normalizePostedDate(data.postedDate),
      matchScore: data.matchScore ?? null,
    },
  });

  await prisma.applicationActivity.create({
    data: {
      applicationId: created.id,
      type: "created",
      message: `Application created for ${created.jobTitle} at ${created.company}.`,
    },
  });
  return created;
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  payload: UpdateApplicationInput
) {
  const data = updateApplicationSchema.parse(payload);
  const current = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });
  if (!current) return null;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      ...data,
      postedDate:
        data.postedDate === undefined ? undefined : normalizePostedDate(data.postedDate),
    },
  });

  if (data.status && data.status !== current.status) {
    await prisma.applicationActivity.create({
      data: {
        applicationId,
        type: "status_changed",
        message: `Moved from ${current.status} to ${data.status}.`,
        metadata: { from: current.status, to: data.status },
      },
    });
  }

  return updated;
}

export async function deleteApplication(userId: string, applicationId: string) {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.application.delete({ where: { id: applicationId } });
  return true;
}

export async function getApplicationDetail(userId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      resumeVersions: { orderBy: { createdAt: "desc" } },
      coverLetterVersions: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createResumeVersion(params: {
  userId: string;
  applicationId?: string | null;
  baseResumeId?: string | null;
  jobTitle: string;
  company: string;
  fileName: string;
  mimeType: string;
  storagePath?: string | null;
  content?: string | null;
}) {
  const latest = await prisma.resumeVersion.findFirst({
    where: {
      userId: params.userId,
      applicationId: params.applicationId ?? undefined,
      jobTitle: params.jobTitle,
      company: params.company,
    },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const resumeVersion = await prisma.resumeVersion.create({
    data: {
      userId: params.userId,
      applicationId: params.applicationId ?? undefined,
      baseResumeId: params.baseResumeId ?? undefined,
      jobTitle: params.jobTitle,
      company: params.company,
      version: nextVersion,
      fileName: params.fileName,
      mimeType: params.mimeType,
      storagePath: params.storagePath ?? undefined,
      content: params.content ?? undefined,
    },
  });

  if (params.applicationId) {
    await prisma.applicationActivity.create({
      data: {
        applicationId: params.applicationId,
        type: "resume_version_created",
        message: `Resume version v${nextVersion} added.`,
        metadata: { resumeVersionId: resumeVersion.id },
      },
    });
  }
  return resumeVersion;
}

export async function createCoverLetterVersion(params: {
  userId: string;
  applicationId?: string | null;
  jobTitle: string;
  company: string;
  content: string;
  storagePath?: string | null;
}) {
  const latest = await prisma.coverLetterVersion.findFirst({
    where: {
      userId: params.userId,
      applicationId: params.applicationId ?? undefined,
      jobTitle: params.jobTitle,
      company: params.company,
    },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const coverLetter = await prisma.coverLetterVersion.create({
    data: {
      userId: params.userId,
      applicationId: params.applicationId ?? undefined,
      jobTitle: params.jobTitle,
      company: params.company,
      version: nextVersion,
      content: params.content,
      storagePath: params.storagePath ?? undefined,
    },
  });

  if (params.applicationId) {
    await prisma.applicationActivity.create({
      data: {
        applicationId: params.applicationId,
        type: "cover_letter_created",
        message: `Cover letter version v${nextVersion} added.`,
        metadata: { coverLetterId: coverLetter.id },
      },
    });
  }
  return coverLetter;
}

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  status: ApplicationStatus
) {
  return updateApplication(userId, applicationId, { status });
}
