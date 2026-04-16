import { NextResponse } from "next/server";
import { getAuthSession } from "./auth";

/**
 * Extracts the authenticated user from the session.
 * Returns { userId, session } or a 401 NextResponse.
 */
export async function authenticateRequest() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      session: null,
    };
  }

  return {
    error: null,
    userId: session.user.id,
    session,
  };
}
