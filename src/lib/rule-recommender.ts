import type { ScoreBreakdown } from "./match-scoring";

export interface RuleRecommendation {
  rewriteIntensity: "light" | "moderate" | "aggressive";
  noNewSkills: boolean;
  preserveLength: boolean;
  prioritizeRecent: boolean;
  strongSummaryRewrite: boolean;
  emphasizeTechnicalStack: boolean;
  focusDomain?: string;
  reasons: string[];
}

/**
 * Recommend enhancement rules given the job description, current resume text,
 * and (optionally) an existing match score breakdown.
 *
 * Heuristic only — this is intentionally deterministic so the recommendations
 * are explainable and predictable. UI lets the user accept, tweak, or ignore.
 */
export function recommendRules(input: {
  jobDescription: string;
  resumeText: string;
  score?: ScoreBreakdown | null;
}): RuleRecommendation {
  const { jobDescription, resumeText, score } = input;
  const jd = jobDescription.toLowerCase();
  const resume = resumeText.toLowerCase();
  const reasons: string[] = [];

  // Base defaults
  const rec: RuleRecommendation = {
    rewriteIntensity: "moderate",
    noNewSkills: false,
    preserveLength: false,
    prioritizeRecent: true,
    strongSummaryRewrite: false,
    emphasizeTechnicalStack: false,
    reasons: [],
  };

  // ── score-driven adjustments ──
  if (score) {
    if (score.overallScore < 60) {
      rec.rewriteIntensity = "aggressive";
      rec.strongSummaryRewrite = true;
      reasons.push(
        `Current match is ${score.overallScore}% — aggressive rewrite and stronger summary recommended.`
      );
    } else if (score.overallScore < 80) {
      rec.rewriteIntensity = "moderate";
      rec.strongSummaryRewrite = true;
      reasons.push(
        `Match is below target (${score.overallScore}%) — moderate rewrite with a stronger summary.`
      );
    } else if (score.overallScore >= 95) {
      rec.rewriteIntensity = "light";
      rec.preserveLength = true;
      reasons.push(
        `Match is already strong (${score.overallScore}%) — use a light touch and preserve length.`
      );
    }

    if (score.keywordCoverage < 50) {
      rec.emphasizeTechnicalStack = true;
      reasons.push(
        `Keyword coverage is low (${score.keywordCoverage}%) — emphasize the technical stack from the JD.`
      );
    }

    if (score.experienceMatch < 60) {
      rec.prioritizeRecent = true;
      reasons.push(
        `Experience match is weak (${score.experienceMatch}%) — prioritize rewriting the most recent roles.`
      );
    }
  }

  // ── JD-driven heuristics ──

  const hasStrictLength =
    /(\bone[- ]page\b|\bsingle[- ]page\b|\bconcise\b|\bbrief\b|\bshort\b)/.test(jd);
  if (hasStrictLength) {
    rec.preserveLength = true;
    reasons.push("Job mentions single-page / concise expectation — preserve length.");
  }

  // Honest / ethical requirement — assume factual accuracy matters. If JD
  // lists niche certifications the candidate clearly doesn't have, we avoid
  // adding fake skills.
  const jdSkillsMentioned = countMatches(jd, [
    "aws", "azure", "gcp", "kubernetes", "terraform", "golang", "rust",
    "typescript", "react", "graphql", "kafka", "spark", "airflow",
    "tensorflow", "pytorch",
  ]);
  const resumeSkillsMentioned = countMatches(resume, [
    "aws", "azure", "gcp", "kubernetes", "terraform", "golang", "rust",
    "typescript", "react", "graphql", "kafka", "spark", "airflow",
    "tensorflow", "pytorch",
  ]);
  if (jdSkillsMentioned > 0 && resumeSkillsMentioned <= 1 && resumeSkillsMentioned < jdSkillsMentioned / 3) {
    rec.noNewSkills = true;
    reasons.push(
      "Large skill gap detected — disabling fabrication of new skills to keep the resume truthful."
    );
  }

  // Domain focus — pick the most mentioned domain keyword cluster.
  const domainScores: Record<string, number> = {
    frontend: countMatches(jd, ["frontend", "front-end", "react", "vue", "angular", "ui"]),
    backend: countMatches(jd, ["backend", "back-end", "api", "microservices", "server"]),
    data: countMatches(jd, ["data", "analytics", "machine learning", "ml", "ai", "etl"]),
    devops: countMatches(jd, ["devops", "infrastructure", "ci/cd", "sre", "kubernetes"]),
    security: countMatches(jd, ["security", "infosec", "compliance"]),
    mobile: countMatches(jd, ["ios", "android", "mobile", "react native", "flutter"]),
  };
  const bestDomain = Object.entries(domainScores).sort((a, b) => b[1] - a[1])[0];
  if (bestDomain && bestDomain[1] >= 3) {
    rec.focusDomain = bestDomain[0];
    reasons.push(`Strong ${bestDomain[0]} signal in the JD — focusing enhancement on ${bestDomain[0]}.`);
  }

  // Seniority cue for summary rewrite
  if (/(staff|principal|director|head of|lead|vp|chief)/.test(jd)) {
    rec.strongSummaryRewrite = true;
    reasons.push("Senior / leadership role — stronger summary rewrite recommended.");
  }

  rec.reasons = reasons;
  return rec;
}

function countMatches(text: string, needles: string[]): number {
  let n = 0;
  for (const word of needles) {
    if (text.includes(word)) n++;
  }
  return n;
}
