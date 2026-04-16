"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.verified) {
          setStatus("success");
          setMessage("Your email has been verified.");
        } else if (data.alreadyVerified) {
          setStatus("already");
          setMessage("Your email was already verified.");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900">Verifying your email...</h1>
          <p className="text-sm text-gray-500 mt-1">Please wait a moment.</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900">{message}</h1>
          <p className="text-sm text-gray-500 mt-1">You can now sign in to your account.</p>
          <Link href="/login">
            <Button variant="primary" className="mt-6">Sign in</Button>
          </Link>
        </>
      )}

      {status === "already" && (
        <>
          <CheckCircle2 className="w-10 h-10 text-blue-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900">{message}</h1>
          <Link href="/login">
            <Button variant="primary" className="mt-6">Sign in</Button>
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900">Verification failed</h1>
          <p className="text-sm text-red-600 mt-1">{message}</p>
          <Link href="/signup">
            <Button variant="outline" className="mt-6">Sign up again</Button>
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">AI Career OS</span>
          </div>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
