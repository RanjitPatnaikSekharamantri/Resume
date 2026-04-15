import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Login · ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Welcome back
          </h1>
          <p className="text-sm text-zinc-600">
            Sign in to continue managing your applications.
          </p>
        </div>
        <LoginForm />
        <p className="text-sm text-zinc-600">
          New to {APP_NAME}?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-500">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
