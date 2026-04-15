import { requireUser } from "@/lib/auth/session";
import { handleApiError, ok, unauthorized } from "@/lib/http";
import { getAnalytics } from "@/lib/services/analytics.service";

export async function GET() {
  try {
    const user = await requireUser();
    const analytics = await getAnalytics(user.id);
    return ok(analytics);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return handleApiError(error, "Failed to load analytics.");
  }
}
