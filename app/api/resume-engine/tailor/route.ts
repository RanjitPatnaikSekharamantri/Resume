import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, handleApiError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { tailorDocxBuffer, tailorResumeText } from "@/lib/services/resume-engine.service";

const schema = z.object({
  baseResumeId: z.string().min(1),
  jobDescription: z.string().min(80),
  role: z.string().min(2),
  company: z.string().min(2),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = schema.parse(await request.json());

    const baseResume = await prisma.baseResume.findFirst({
      where: { id: payload.baseResumeId, userId: user.id },
    });
    if (!baseResume) {
      return badRequest("Base resume not found.");
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    const tailoredText = tailorResumeText({
      resumeText: baseResume.parsedText ?? "",
      jobDescription: payload.jobDescription,
      role: payload.role,
      company: payload.company,
      profileSummary: profile?.summary ?? undefined,
    });

    // Storage roundtrip intentionally omitted in this initial scaffold.
    let tailoredDocxBase64: string | undefined;
    if (baseResume.mimeType.includes("word")) {
      try {
        const doc = await tailorDocxBuffer(Buffer.from(""), tailoredText);
        tailoredDocxBase64 = doc.toString("base64");
      } catch {
        tailoredDocxBase64 = undefined;
      }
    }

    return ok({
      tailoredText,
      tailoredDocxBase64,
    });
  } catch (error) {
    return handleApiError(error, "Failed to tailor resume.");
  }
}
