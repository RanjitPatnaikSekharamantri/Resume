import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, handleApiError, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createResumeVersion } from "@/lib/services/application.service";
import { createResumeVersionSchema } from "@/lib/validations/application";

export async function GET() {
  try {
    const user = await requireUser();
    const items = await prisma.resumeVersion.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok(items);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to fetch resume versions.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = createResumeVersionSchema.parse(await request.json());
    const created = await createResumeVersion({
      userId: user.id,
      applicationId: payload.applicationId,
      baseResumeId: payload.baseResumeId,
      jobTitle: payload.jobTitle,
      company: payload.company,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      content: payload.content,
      storagePath: payload.storagePath,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest("Invalid payload.", error.flatten());
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to create resume version.");
  }
}
