import { z } from "zod";

export const aiStudioSchema = z.object({
  role: z.string().trim().min(2),
  company: z.string().trim().min(2),
  jobDescription: z.string().trim().min(100),
  baseResumeId: z.string().trim().optional(),
  saveAsApplication: z.boolean().default(false),
});

export const providerSchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC", "GOOGLE", "AZURE"]),
  apiKey: z.string().trim().min(8),
  isActive: z.boolean().default(true),
});

export type AIStudioInput = z.infer<typeof aiStudioSchema>;
export const aiStudioInputSchema = aiStudioSchema;
export const providerApiKeySchema = providerSchema;
