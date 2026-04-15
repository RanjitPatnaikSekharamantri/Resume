import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import {
  badRequest,
  errorResponse,
  ok,
  unauthorized,
} from "@/lib/http";
import { getProfile, upsertProfile } from "@/lib/services/profile.service";
import { profileUpdateSchema } from "@/lib/validations/profile";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    return ok(profile);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return errorResponse(error, 500, "Failed to fetch profile.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = profileUpdateSchema.parse(await request.json());
    const profile = await upsertProfile(user.id, payload);
    return ok(profile);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid profile payload.", error.flatten());
    }
    return errorResponse(error, 500, "Failed to update profile.");
  }
}
