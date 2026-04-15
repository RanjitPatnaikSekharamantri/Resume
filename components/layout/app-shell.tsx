"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { APP_NAME } from "@/lib/constants";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

type AppShellProps = {
  children: ReactNode;
};

function resolveTitle(pathname: string) {
  if (pathname.startsWith("/applications/")) return "Application Detail";
  if (pathname.startsWith("/applications")) return "Applications";
  if (pathname.startsWith("/ai-studio")) return "AI Studio";
  if (pathname.startsWith("/resume-library")) return "Resume Library";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const pageTitle = resolveTitle(pathname);

  return (
    <div className="flex min-h-screen bg-zinc-50/80">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={pageTitle} subtitle={APP_NAME} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-8 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
