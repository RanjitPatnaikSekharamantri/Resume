import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, handleApiError, notFound, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createCoverLetterSchema, createResumeVersionSchema } from "@/lib/validations/application";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/applications/[id]/documents">,
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const application = await prisma.application.findFirst({
      where: { id, userId: user.id },
      include: {
        resumeVersions: { orderBy: { createdAt: "desc" } },
        coverLetterVersions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!application) {
      return notFound("Application not found.");
    }

    return ok({
      resumes: application.resumeVersions,
      coverLetters: application.coverLetterVersions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to load documents.");
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/applications/[id]/documents">,
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const payload = await request.json();

    const application = await prisma.application.findFirst({
      where: { id, userId: user.id },
      select: { id: true, jobTitle: true, company: true },
    });

    if (!application) {
      return ok(null, { status: 404 });
    }

    if (payload.type === "resume") {
      const parsed = createResumeVersionSchema.parse(payload);
      const latest = await prisma.resumeVersion.findFirst({
        where: { applicationId: application.id },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;

      const resume = await prisma.resumeVersion.create({
        data: {
          userId: user.id,
          applicationId: application.id,
          baseResumeId: parsed.baseResumeId,
          fileName: parsed.fileName ?? `${application.company}-${application.jobTitle}-resume-v${version}.txt`,
          mimeType: parsed.mimeType ?? "text/plain",
          storagePath: parsed.storagePath,
          content: parsed.content,
          version,
          jobTitle: application.jobTitle,
          company: application.company,
        },
      });

      return ok({ resume }, { status: 201 });
    }

    if (payload.type === "cover_letter") {
      const parsed = createCoverLetterSchema.parse(payload);
      const latest = await prisma.coverLetterVersion.findFirst({
        where: { applicationId: application.id },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;

      const cover = await prisma.coverLetterVersion.create({
        data: {
          userId: user.id,
          applicationId: application.id,
          content: parsed.content,
          storagePath: parsed.storagePath,
          version,
          jobTitle: application.jobTitle,
          company: application.company,
        },
      });

      return ok({ coverLetter: cover }, { status: 201 });
    }

    return badRequest("Unknown document type.");
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest("Invalid payload.", error.flatten());
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to save document.");
  }
}
