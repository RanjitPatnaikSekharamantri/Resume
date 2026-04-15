import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, errorResponse, successResponse, unauthorized } from "@/lib/http";
import { createApplication, listApplications } from "@/lib/services/application.service";
import {
  applicationInputSchema,
  applicationQuerySchema,
} from "@/lib/validations/application";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = request.nextUrl.searchParams;
    const query = applicationQuerySchema.parse({
      status: params.get("status") ?? undefined,
      search: params.get("search") ?? undefined,
    });
    const applications = await listApplications(user.id, query);
    return successResponse({ applications });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid query parameters", error.flatten());
    }
    return errorResponse(error, 500, "Could not fetch applications.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const payload = applicationInputSchema.parse(body);
    const application = await createApplication(user.id, payload);
    return successResponse({ application }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid application payload", error.flatten());
    }
    return errorResponse(error, 500, "Could not create application.");
  }
}
