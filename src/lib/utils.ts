import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_applied: "bg-gray-100 text-gray-700",
    saved: "bg-blue-50 text-blue-700",
    applied: "bg-indigo-50 text-indigo-700",
    screening: "bg-purple-50 text-purple-700",
    interview: "bg-amber-50 text-amber-700",
    offer: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    archived: "bg-gray-50 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_applied: "Not Applied",
    saved: "Saved",
    applied: "Applied",
    screening: "Screening",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    archived: "Archived",
  };
  return labels[status] || status;
}

export const APPLICATION_STATUSES = [
  "not_applied",
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "archived",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
