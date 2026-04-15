import type { ApplicationStatus } from "@prisma/client";

export const APP_NAME = "AI Career OS";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/ai-studio", label: "AI Studio" },
  { href: "/resume-library", label: "Resume Library" },
  { href: "/analytics", label: "Analytics" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
] as const;

export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "NOT_APPLIED",
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NOT_APPLIED: "Not Applied",
  SAVED: "Saved",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const CHART_COLORS = {
  blue: "#2f6feb",
  blueMuted: "#4f87f8",
  gray900: "#111827",
  gray700: "#374151",
  gray500: "#6b7280",
  gray300: "#d1d5db",
} as const;

export const applicationStatuses = APPLICATION_STATUS_ORDER;

export const documentTypeLabels = {
  RESUME: "Resume Versions",
  COVER_LETTER: "Cover Letter Versions",
} as const;
