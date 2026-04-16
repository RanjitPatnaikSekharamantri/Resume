"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side auth guard hook. Redirects to /login if unauthenticated.
 * Returns session data and loading state.
 */
export function useRequireAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  return {
    session,
    status,
    isLoading,
    isAuthenticated,
    user: session?.user ?? null,
    update,
  };
}
