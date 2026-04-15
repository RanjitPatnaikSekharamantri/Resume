import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, handleApiError, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createCoverLetterSchema } from "@/lib/validations/application";

const payloadSchema = createCoverLetterSchema.omit({ type: true });

export async function GET() {
  try {
    const user = await requireUser();
    const coverLetters = await prisma.coverLetterVersion.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ coverLetters });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to load cover letters.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = payloadSchema.parse(await request.json());
    const applicationId = body.applicationId ?? null;

    const latest = await prisma.coverLetterVersion.findFirst({
      where: {
        userId: user.id,
        applicationId: applicationId ?? undefined,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const coverLetter = await prisma.coverLetterVersion.create({
      data: {
        userId: user.id,
        applicationId,
        jobTitle: body.jobTitle,
        company: body.company,
        content: body.content,
        storagePath: body.storagePath ?? null,
        version: (latest?.version ?? 0) + 1,
      },
    });

    if (applicationId) {
      await prisma.applicationActivity.create({
        data: {
          applicationId,
          type: "cover_letter_version_saved",
          message: `Saved cover letter v${coverLetter.version}.`,
        },
      });
    }

    return ok({ coverLetter }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest("Invalid payload", error.flatten());
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to save cover letter version.");
  }
}
