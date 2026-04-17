/**
 * Pass 1 — LLM Analysis / Planning.
 *
 * The model RECEIVES the structured AI context packet and RETURNS a
 * structured plan. It does NOT generate the final resume yet — that's
 * Pass 2 (`src/lib/llm-enhance.ts`).
 *
 * The plan schema is strict so the client can render it as a review UI
 * before the user authorises generation. If the LLM fails, we fall back
 * to a deterministic plan derived from the same inputs so the product
 * still works without a provider.
 */

import type { AiContextPacket } from "./ai-context";
import {
  callLLM,
  extractJsonObject,
  type ResolvedProvider,
} from "./llm-provider";

export interface EnhancementPlan {
  /** Which engine produced this plan. */
  producedBy: "llm" | "deterministic";
  producedReason?: string;

  targetRoleInterpretation: {
    primaryRole: string;
    alternatives: string[];
    roleFamily: string | null;
    seniority: string | null;
  };

  whatShouldChange: {
    summary: string[];
    skills: string[];
    experience: string[];
    headerRoleRecommendation: string | null;
    titleAlignmentSuggestions: Array<{ from: string; to: string; reason: string }>;
    keywordAdditions: string[];
    domainEmphasis: string[];
  };

  whatMustNotChange: {
    protectedFields: string[];
    unverifiableClaims: string[];
    unsupportedRoleUpgrades: string[];
  };

  sectionPlan: {
    summary: "keep" | "light" | "heavy";
    skills: "keep" | "light" | "heavy";
    experience: "keep" | "light" | "heavy";
    certifications: "keep" | "light" | "heavy";
    projects?: "keep" | "light" | "heavy";
  };

  risks: string[];

  optimizationRules: {
    rewriteIntensity: "light" | "moderate" | "aggressive";
    preserveLength: boolean;
    prioritizeRecent: boolean;
    keywordInsertionRules: string[];
    roleAlignmentMode: "keep" | "smart" | "manual";
  };

  expectedScoreImprovements: {
    likelyGainPoints: number;
    limitReason: string;
    ceiling: number;
  };

  /** Short natural-language rationale the UI can show verbatim. */
  summaryForUser: string;
}

export interface PlanResult {
  ok: boolean;
  plan: EnhancementPlan;
  providerName?: string;
  providerModel?: string;
  fallbackReason?: string;
  logs: string[];
}

// ── public API ─────────────────────────────────────────────────────────

/**
 * Run Pass 1. If a provider is available, call the LLM; otherwise fall
 * back to a deterministic plan derived from the context packet so the
 * rest of the flow keeps working.
 */
export async function runAnalysisPass(
  provider: ResolvedProvider | null,
  context: AiContextPacket
): Promise<PlanResult> {
  const logs: string[] = [];
  const log = (m: string) => {
    console.log(`[plan] ${m}`);
    logs.push(m);
  };

  if (!provider || (provider.kind !== "openai" && provider.kind !== "anthropic")) {
    log("no usable provider — returning deterministic plan");
    return {
      ok: true,
      plan: deterministicPlan(context, "No external AI provider configured."),
      logs,
    };
  }

  log(`provider=${provider.name} model=${provider.model}`);

  const systemPrompt = buildPlannerSystemPrompt();
  const userPrompt = buildPlannerUserPrompt(context);

  const llm = await callLLM(provider, {
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2500,
    json: true,
    onLog: log,
  });

  if (!llm.ok) {
    log(`llm failed: ${llm.reason} — falling back to deterministic plan`);
    return {
      ok: true,
      plan: deterministicPlan(context, `LLM failed: ${llm.reason}`),
      providerName: provider.name,
      providerModel: provider.model,
      fallbackReason: llm.reason,
      logs,
    };
  }

  const parsed = extractJsonObject(llm.text);
  if (!parsed || typeof parsed !== "object") {
    log("llm returned malformed JSON — falling back to deterministic plan");
    return {
      ok: true,
      plan: deterministicPlan(context, "LLM returned malformed JSON"),
      providerName: provider.name,
      providerModel: provider.model,
      fallbackReason: "Malformed JSON",
      logs,
    };
  }

  const plan = normalisePlan(parsed as Record<string, unknown>, context);
  plan.producedBy = "llm";
  log(`llm plan ok`);

  return {
    ok: true,
    plan,
    providerName: provider.name,
    providerModel: provider.model,
    logs,
  };
}

// ── prompts ───────────────────────────────────────────────────────────

function buildPlannerSystemPrompt(): string {
  return `You are a senior resume analyst. Read the structured AI context packet and return a strict JSON PLAN describing what should and should not change in the candidate's resume to better match the target job.

CRITICAL — you are PLANNING ONLY. Do NOT generate any rewritten resume text. Return ONLY the JSON object described below.

JSON SCHEMA:
{
  "targetRoleInterpretation": {
    "primaryRole": string,
    "alternatives": string[],
    "roleFamily": string | null,
    "seniority": string | null
  },
  "whatShouldChange": {
    "summary": string[],
    "skills": string[],
    "experience": string[],
    "headerRoleRecommendation": string | null,
    "titleAlignmentSuggestions": [ { "from": string, "to": string, "reason": string } ],
    "keywordAdditions": string[],
    "domainEmphasis": string[]
  },
  "whatMustNotChange": {
    "protectedFields": string[],
    "unverifiableClaims": string[],
    "unsupportedRoleUpgrades": string[]
  },
  "sectionPlan": {
    "summary": "keep" | "light" | "heavy",
    "skills":  "keep" | "light" | "heavy",
    "experience": "keep" | "light" | "heavy",
    "certifications": "keep" | "light" | "heavy"
  },
  "risks": string[],
  "optimizationRules": {
    "rewriteIntensity": "light" | "moderate" | "aggressive",
    "preserveLength": boolean,
    "prioritizeRecent": boolean,
    "keywordInsertionRules": string[],
    "roleAlignmentMode": "keep" | "smart" | "manual"
  },
  "expectedScoreImprovements": {
    "likelyGainPoints": number,
    "limitReason": string,
    "ceiling": number
  },
  "summaryForUser": string
}

STRICT RULES:
1. Base every suggestion on the context packet. Do not invent facts.
2. Never recommend fabricating skills, dates, companies, or certifications.
3. Respect the packet's "locked" fields — list them explicitly under whatMustNotChange.protectedFields.
4. If "nonFixableGaps" contains a JD requirement the candidate clearly lacks, surface it under risks and limit the ceiling.
5. Every string must be concise — keep bullets under 160 chars.
6. Output ONLY the JSON object. No markdown, no prose, no code fences.`;
}

function buildPlannerUserPrompt(context: AiContextPacket): string {
  return [
    "AI CONTEXT PACKET (ground truth — do not invent anything not present here):",
    JSON.stringify(context, null, 2),
    "",
    "Return the plan JSON object per the schema in the system prompt.",
  ].join("\n");
}

// ── normalisation ────────────────────────────────────────────────────

function normalisePlan(
  raw: Record<string, unknown>,
  context: AiContextPacket
): EnhancementPlan {
  const fallback = deterministicPlan(context, "Normalising LLM output");
  const safe = <T>(v: unknown, def: T): T => (v === undefined || v === null ? def : (v as T));

  const targetRoleInterpretation = {
    primaryRole: strOr(
      (raw.targetRoleInterpretation as Record<string, unknown>)?.primaryRole,
      fallback.targetRoleInterpretation.primaryRole
    ),
    alternatives: arrStr((raw.targetRoleInterpretation as Record<string, unknown>)?.alternatives),
    roleFamily: nullableStr((raw.targetRoleInterpretation as Record<string, unknown>)?.roleFamily),
    seniority: nullableStr((raw.targetRoleInterpretation as Record<string, unknown>)?.seniority),
  };

  const wsc = raw.whatShouldChange as Record<string, unknown> | undefined;
  const whatShouldChange = {
    summary: arrStr(wsc?.summary),
    skills: arrStr(wsc?.skills),
    experience: arrStr(wsc?.experience),
    headerRoleRecommendation: nullableStr(wsc?.headerRoleRecommendation),
    titleAlignmentSuggestions: Array.isArray(wsc?.titleAlignmentSuggestions)
      ? (wsc!.titleAlignmentSuggestions as Array<Record<string, unknown>>)
          .map((t) => ({
            from: strOr(t.from, ""),
            to: strOr(t.to, ""),
            reason: strOr(t.reason, ""),
          }))
          .filter((t) => t.from && t.to)
      : [],
    keywordAdditions: arrStr(wsc?.keywordAdditions),
    domainEmphasis: arrStr(wsc?.domainEmphasis),
  };

  const wmnc = raw.whatMustNotChange as Record<string, unknown> | undefined;
  const whatMustNotChange = {
    protectedFields: arrStr(wmnc?.protectedFields, fallback.whatMustNotChange.protectedFields),
    unverifiableClaims: arrStr(wmnc?.unverifiableClaims),
    unsupportedRoleUpgrades: arrStr(wmnc?.unsupportedRoleUpgrades),
  };

  const sp = raw.sectionPlan as Record<string, unknown> | undefined;
  const sectionPlan = {
    summary: depth(sp?.summary, fallback.sectionPlan.summary),
    skills: depth(sp?.skills, fallback.sectionPlan.skills),
    experience: depth(sp?.experience, fallback.sectionPlan.experience),
    certifications: depth(sp?.certifications, fallback.sectionPlan.certifications),
  };

  const or = raw.optimizationRules as Record<string, unknown> | undefined;
  const optimizationRules = {
    rewriteIntensity: intensity(or?.rewriteIntensity, fallback.optimizationRules.rewriteIntensity),
    preserveLength: !!or?.preserveLength,
    prioritizeRecent: or?.prioritizeRecent === false ? false : true,
    keywordInsertionRules: arrStr(or?.keywordInsertionRules),
    roleAlignmentMode: alignmentMode(
      or?.roleAlignmentMode,
      fallback.optimizationRules.roleAlignmentMode
    ),
  };

  const es = raw.expectedScoreImprovements as Record<string, unknown> | undefined;
  const expectedScoreImprovements = {
    likelyGainPoints: clamp(Number(es?.likelyGainPoints) || fallback.expectedScoreImprovements.likelyGainPoints, 0, 50),
    limitReason: strOr(es?.limitReason, fallback.expectedScoreImprovements.limitReason),
    ceiling: clamp(Number(es?.ceiling) || fallback.expectedScoreImprovements.ceiling, 0, 100),
  };

  return {
    producedBy: "llm",
    targetRoleInterpretation,
    whatShouldChange,
    whatMustNotChange,
    sectionPlan,
    risks: arrStr(raw.risks, fallback.risks),
    optimizationRules,
    expectedScoreImprovements,
    summaryForUser: strOr(raw.summaryForUser, fallback.summaryForUser),
  };

  function strOr(v: unknown, def: string): string {
    return typeof v === "string" && v.trim() ? v.trim() : def;
  }
  function nullableStr(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }
  function arrStr(v: unknown, def: string[] = []): string[] {
    if (!Array.isArray(v)) return def;
    return v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  }
  function depth(v: unknown, def: "keep" | "light" | "heavy"): "keep" | "light" | "heavy" {
    return v === "keep" || v === "light" || v === "heavy" ? v : def;
  }
  function intensity(
    v: unknown,
    def: "light" | "moderate" | "aggressive"
  ): "light" | "moderate" | "aggressive" {
    return v === "light" || v === "moderate" || v === "aggressive" ? v : def;
  }
  function alignmentMode(v: unknown, def: "keep" | "smart" | "manual"): "keep" | "smart" | "manual" {
    return v === "keep" || v === "smart" || v === "manual" ? v : def;
  }
  function clamp(n: number, lo: number, hi: number) {
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }
  void safe; // keep reference
}

// ── deterministic fallback plan ───────────────────────────────────────

export function deterministicPlan(
  context: AiContextPacket,
  reason: string
): EnhancementPlan {
  const jd = context.jdAnalysis;
  const ra = context.resumeAnalysis;

  const intensity = context.userControls.rewriteIntensity;

  const whatShouldChangeSummary: string[] = [];
  const whatShouldChangeSkills: string[] = [];
  const whatShouldChangeExp: string[] = [];

  if (ra.weakSections.includes("summary")) {
    whatShouldChangeSummary.push("Open with a concrete value proposition for the target role.");
    whatShouldChangeSummary.push("State years of relevant experience explicitly.");
    whatShouldChangeSummary.push(`Mention the top JD terms: ${jd.mustNotMissTerms.slice(0, 4).join(", ")}.`);
  }
  if (ra.weakSections.includes("skills")) {
    whatShouldChangeSkills.push('Organise as "· Category: item1, item2, item3" bullets.');
    whatShouldChangeSkills.push(
      `Ensure every JD cluster is represented: ${Object.keys(jd.keywordClusters).slice(0, 5).join(", ")}.`
    );
  }
  const weakExpBullets = ra.experienceSummary.reduce((n, r) => n + r.weakBullets, 0);
  if (weakExpBullets > 0) {
    whatShouldChangeExp.push(`Replace ${weakExpBullets} weak-opening bullets with strong action verbs.`);
  }
  if (jd.mustNotMissTerms.length > 0) {
    whatShouldChangeExp.push(
      `Weave these JD terms into recent-role bullets truthfully: ${jd.mustNotMissTerms.slice(0, 4).join(", ")}.`
    );
  }

  const protectedFields = [
    "Candidate name",
    "Contact info (email, phone, LinkedIn)",
    "Employer company names",
    "Employment dates",
    "Education (school, degree, year)",
    "Certifications",
    ...context.locked.userLocked,
  ];

  const ceiling = Math.max(
    60,
    Math.min(
      98,
      100 - context.resumeAnalysis.nonFixableGaps.length * 8 - (jd.hardRequirements.length === 0 ? 10 : 0)
    )
  );

  const likelyGain = Math.max(
    5,
    Math.min(
      30,
      ra.realisticImprovements.length * 4 + (jd.mustNotMissTerms.length > 3 ? 6 : 3)
    )
  );

  const roleAlignmentMode =
    context.userControls.roleAlignmentMode || "smart";

  return {
    producedBy: "deterministic",
    producedReason: reason,
    targetRoleInterpretation: {
      primaryRole: jd.normalizedRole || context.application.targetRole,
      alternatives: [],
      roleFamily: jd.roleFamily,
      seniority: jd.seniority,
    },
    whatShouldChange: {
      summary: whatShouldChangeSummary,
      skills: whatShouldChangeSkills,
      experience: whatShouldChangeExp,
      headerRoleRecommendation: context.resume.selectedHeaderRole || jd.normalizedRole || null,
      titleAlignmentSuggestions: [],
      keywordAdditions: context.resume.keywordCoverage.missing.slice(0, 8),
      domainEmphasis: jd.domains.slice(0, 3),
    },
    whatMustNotChange: {
      protectedFields,
      unverifiableClaims: context.resumeAnalysis.nonFixableGaps,
      unsupportedRoleUpgrades: [],
    },
    sectionPlan: {
      summary: context.userControls.sectionsToEnhance.includes("summary")
        ? (intensity === "light" ? "light" : "heavy")
        : "keep",
      skills: context.userControls.sectionsToEnhance.includes("skills") ? "light" : "keep",
      experience: context.userControls.sectionsToEnhance.includes("experience")
        ? intensity === "aggressive"
          ? "heavy"
          : "light"
        : "keep",
      certifications: "keep",
    },
    risks: context.resumeAnalysis.nonFixableGaps.slice(0, 5),
    optimizationRules: {
      rewriteIntensity: intensity,
      preserveLength: context.userControls.preserveLength,
      prioritizeRecent: context.userControls.prioritizeRecent,
      keywordInsertionRules: [
        "Only insert JD keywords that are supported by existing experience bullets.",
        "Prefer specific tools over generic nouns (e.g. Splunk > log analysis tools).",
      ],
      roleAlignmentMode,
    },
    expectedScoreImprovements: {
      likelyGainPoints: likelyGain,
      limitReason:
        context.resumeAnalysis.nonFixableGaps[0] ||
        "Structural limits — some JD signals can't be created from nothing.",
      ceiling,
    },
    summaryForUser: `Plan focuses on ${context.userControls.sectionsToEnhance.join(", ") ||
      "selected sections"} with ${intensity} intensity. Expected lift ~${likelyGain} points, ceiling ~${ceiling}/100.`,
  };
}
