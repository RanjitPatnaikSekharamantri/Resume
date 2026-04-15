import { NextRequest } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { handleApiError, notFound, ok, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { removeUserDocument } from "@/lib/services/storage.service";

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/base-resumes/[id]">,
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const { id } = await context.params;
    const resume = await prisma.baseResume.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!resume) {
      return notFound("Resume not found.");
    }

    if (resume.storagePath) {
      await removeUserDocument(resume.storagePath);
    }

    await prisma.baseResume.delete({
      where: { id: resume.id },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete resume.");
  }
}
