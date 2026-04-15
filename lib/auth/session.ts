import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/config";
import { unauthorizedError } from "@/lib/http";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw unauthorizedError();
  }

  return session.user;
}

export async function requireUserId() {
  const user = await requireUser();
  return user.id;
}
