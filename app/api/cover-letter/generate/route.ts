import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, handleApiError, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { generateCoverLetter } from "@/lib/services/cover-letter.service";
import { aiStudioSchema } from "@/lib/validations/ai";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const payload = aiStudioSchema.parse(body);

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    const baseResume = payload.baseResumeId
      ? await prisma.baseResume.findFirst({
          where: { id: payload.baseResumeId, userId: user.id },
        })
      : null;

    const coverLetter = generateCoverLetter({
      candidateName: user.name ?? "Candidate",
      role: payload.role,
      company: payload.company,
      jobDescription: payload.jobDescription,
      profileSummary: profile?.summary ?? null,
      keySkills: (baseResume?.parsedText ?? "")
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    });

    return ok({ coverLetter });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest("Invalid payload", error.flatten());
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Unable to generate cover letter.");
  }
}
