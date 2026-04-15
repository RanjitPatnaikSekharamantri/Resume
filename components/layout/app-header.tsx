"use client";

import { Bell, Search } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-6">
        <div className="hidden md:block">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">
            {title ?? APP_NAME}
          </h2>
          {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
        </div>

        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input placeholder="Search applications..." className="pl-9" />
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" />
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
