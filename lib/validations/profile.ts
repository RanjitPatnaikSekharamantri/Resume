import { z } from "zod";

const optionalString = () => z.string().trim().optional().or(z.literal(""));

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: optionalString(),
  location: optionalString(),
  linkedin: z.string().trim().url().optional().or(z.literal("")),
  links: z.array(z.string().trim().url()).max(10).default([]),
  workAuthorization: optionalString(),
  equalOpportunity: z
    .object({
      gender: optionalString(),
      ethnicity: optionalString(),
      veteranStatus: optionalString(),
      disabilityStatus: optionalString(),
    })
    .partial()
    .optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const profileUpdateSchema = profileSchema;

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
