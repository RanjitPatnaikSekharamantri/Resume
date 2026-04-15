import { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

export const applicationStatusSchema = z.nativeEnum(ApplicationStatus);

export const applicationInputSchema = z.object({
  jobTitle: z.string().trim().min(2),
  company: z.string().trim().min(2),
  location: z.string().trim().optional().or(z.literal("")),
  salary: z.string().trim().optional().or(z.literal("")),
  postedDate: z.string().trim().optional().or(z.literal("")),
  jobDescription: z.string().optional(),
  jobUrl: z.string().url().optional().or(z.literal("")),
  source: z.string().trim().optional().or(z.literal("")),
  notes: z.string().optional(),
  status: applicationStatusSchema.optional().default(ApplicationStatus.SAVED),
  matchScore: z.number().int().min(0).max(100).optional(),
});

export const updateApplicationInputSchema = applicationInputSchema.partial();

export const applicationQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
  search: z.string().trim().optional(),
});

export const createApplicationSchema = applicationInputSchema;
export const updateApplicationSchema = updateApplicationInputSchema;
export const listApplicationsSchema = applicationQuerySchema;

export const createResumeVersionSchema = z.object({
  type: z.literal("resume").optional(),
  applicationId: z.string().optional(),
  baseResumeId: z.string().optional(),
  jobTitle: z.string().trim().min(2),
  company: z.string().trim().min(2),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().optional().default("text/plain"),
  content: z.string().trim().optional().default(""),
  storagePath: z.string().trim().optional(),
  version: z.number().int().min(1).optional().default(1),
});

export const createCoverLetterSchema = z.object({
  type: z.literal("cover_letter").optional(),
  applicationId: z.string().optional(),
  jobTitle: z.string().trim().min(2),
  company: z.string().trim().min(2),
  content: z.string().trim().min(5),
  storagePath: z.string().trim().optional(),
  version: z.number().int().min(1).optional().default(1),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationInputSchema>;
export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;
