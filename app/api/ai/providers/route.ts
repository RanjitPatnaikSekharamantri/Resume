import type { NextRequest } from "next/server";
import type { AIProviderType } from "@prisma/client";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth/session";
import { badRequest, forbidden, handleApiError, ok, unauthorized } from "@/lib/http";
import {
  listProviders,
  removeProvider,
  upsertAIProvider,
} from "@/lib/services/ai-provider.service";
import { providerApiKeySchema } from "@/lib/validations/ai";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listProviders(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to load providers.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const current = await listProviders(user.id);
    if (current.length >= 4) {
      return forbidden("Maximum 4 provider keys allowed.");
    }

    const payload = providerApiKeySchema.parse(await request.json());
    const created = await upsertAIProvider(
      user.id,
      payload.provider,
      payload.apiKey,
    );
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    if (error instanceof ZodError) {
      return badRequest("Invalid provider payload.", error.flatten());
    }
    return handleApiError(error, "Failed to save provider key.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as AIProviderType | null;
    if (!provider) {
      return badRequest("provider query param is required.");
    }

    await removeProvider(user.id, provider);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to delete provider key.");
  }
}
