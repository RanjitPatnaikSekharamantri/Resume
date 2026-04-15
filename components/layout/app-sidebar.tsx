"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  FileText,
  Home,
  Settings,
  Sparkles,
  UserCircle,
} from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/resume-library", label: "Resume Library", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserCircle },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 border-r border-zinc-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-16 items-center border-b border-zinc-200/80 px-6">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700" />
          <div>
            <p className="text-sm font-semibold text-zinc-950">{APP_NAME}</p>
            <p className="text-xs text-zinc-500">Career command center</p>
          </div>
        </div>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
