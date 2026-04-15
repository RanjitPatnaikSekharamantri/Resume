import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import {
  badRequest,
  errorResponse,
  notFound,
  successResponse,
  unauthorized,
} from "@/lib/http";
import {
  deleteApplication,
  getApplicationDetail,
  updateApplication,
} from "@/lib/services/application.service";
import { updateApplicationSchema } from "@/lib/validations/application";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/applications/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) {
      return notFound("Application not found.");
    }
    return successResponse({ application: detail });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return errorResponse(error, 500, "Failed to fetch application.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/applications/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const payload = updateApplicationSchema.parse(json);
    const updated = await updateApplication(user.id, id, payload);

    if (!updated) {
      return notFound("Application not found.");
    }

    return successResponse({ application: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid application payload.", error.flatten());
    }
    return errorResponse(error, 500, "Failed to update application.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/applications/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deleted = await deleteApplication(user.id, id);

    if (!deleted) {
      return notFound("Application not found.");
    }

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return errorResponse(error, 500, "Failed to delete application.");
  }
}
