import type { AIProviderType, ApplicationStatus } from "@prisma/client";

export type AppUser = {
  id: string;
  name: string | null;
  email: string;
};

export type ApiErrorShape = {
  error: string;
  details?: unknown;
};

export type MaskedProvider = {
  id: string;
  provider: AIProviderType;
  keyHint: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type KanbanCard = {
  id: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus;
  matchScore: number | null;
  hasResume: boolean;
  hasNotes: boolean;
};

export type ApplicationListItem = {
  id: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus;
  matchScore: number | null;
  updatedAt: Date | string;
};
