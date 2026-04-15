import { ApplicationStatus } from "@prisma/client";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { unauthorized } from "@/lib/http";
import { createApplication, getApplicationDetail } from "@/lib/services/application.service";
import { generateCoverLetter } from "@/lib/services/cover-letter.service";
import { prisma } from "@/lib/prisma";
import { tailorResumeText } from "@/lib/services/resume-engine.service";
import { aiStudioInputSchema } from "@/lib/validations/ai";
import { badRequest, handleApiError, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const payload = aiStudioInputSchema.parse(json);

    const [profile, baseResume] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id } }),
      payload.baseResumeId
        ? prisma.baseResume.findFirst({
            where: {
              id: payload.baseResumeId,
              userId: user.id,
            },
          })
        : Promise.resolve(null),
    ]);

    const baseResumeText = baseResume?.parsedText ?? "";
    const tailoredResumeText = tailorResumeText({
      resumeText: baseResumeText,
      jobDescription: payload.jobDescription,
      role: payload.role,
      company: payload.company,
      profileSummary: profile?.summary,
    });

    const coverLetter = generateCoverLetter({
      candidateName: user.name ?? "Candidate",
      role: payload.role,
      company: payload.company,
      jobDescription: payload.jobDescription,
      profileSummary: profile?.summary,
      resumeText: baseResumeText,
    });

    let savedApplication = null;
    if (payload.saveAsApplication) {
      const created = await createApplication(user.id, {
        jobTitle: payload.role,
        company: payload.company,
        jobDescription: payload.jobDescription,
        status: ApplicationStatus.SAVED,
      });

      await prisma.resumeVersion.create({
        data: {
          userId: user.id,
          applicationId: created.id,
          baseResumeId: baseResume?.id,
          jobTitle: payload.role,
          company: payload.company,
          version: 1,
          fileName: `${payload.role}-${payload.company}-tailored.txt`,
          mimeType: "text/plain",
          content: tailoredResumeText,
        },
      });

      await prisma.coverLetterVersion.create({
        data: {
          userId: user.id,
          applicationId: created.id,
          jobTitle: payload.role,
          company: payload.company,
          version: 1,
          content: coverLetter,
        },
      });

      savedApplication = await getApplicationDetail(user.id, created.id);
    }

    return ok({
      tailoredResume: tailoredResumeText,
      coverLetter,
      savedApplication,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid AI Studio payload.", error.flatten());
    }

    return handleApiError(error, "Failed to generate AI Studio output.");
  }
}
