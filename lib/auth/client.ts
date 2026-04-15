"use client";

import { signIn, signOut } from "next-auth/react";

export async function loginWithCredentials(email: string, password: string) {
  return signIn("credentials", {
    email,
    password,
    redirect: false,
  });
}

export async function logout() {
  return signOut({ callbackUrl: "/login" });
}
