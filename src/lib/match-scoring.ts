/**
 * Legacy shim — delegates to the new ATS-level scoring engine in
 * `ats-scoring.ts`. All new code should import `calculateAtsScore` and the
 * full `AtsScore` shape directly. This wrapper exists only so existing
 * call sites keep working while we migrate the UI.
 *
 * Key backward-compat points:
 *   - `calculateMatchScore` returns the legacy 4-column breakdown plus
 *     overallScore, rescaled so the numbers still live on the 0-100 scale
 *     the Application model already persists.
 *   - Color / label helpers are re-exported from `ats-scoring.ts` so every
 *     screen uses the same threshold logic.
 */

import { calculateAtsScore, type AtsScore } from "./ats-scoring";

export {
  getScoreColor,
  getScoreBarColor,
  getScoreLabel,
} from "./ats-scoring";
export type { AtsScore } from "./ats-scoring";

export interface ScoreBreakdown {
  overallScore: number;
  skillsMatch: number;
  experienceMatch: number;
  keywordCoverage: number;
  domainMatch: number;
}

export interface ScoreInput {
  jobDescription: string;
  resumeText: string;
  jobTitle?: string;
  company?: string;
}

export function calculateMatchScore(input: ScoreInput): ScoreBreakdown {
  const ats = calculateAtsScore(input);
  return {
    overallScore: ats.overall,
    skillsMatch: ats.legacyBreakdown.skillsMatch,
    experienceMatch: ats.legacyBreakdown.experienceMatch,
    keywordCoverage: ats.legacyBreakdown.keywordCoverage,
    domainMatch: ats.legacyBreakdown.domainMatch,
  };
}

/**
 * Helper that returns BOTH the legacy breakdown (for the Application
 * columns) and the full AtsScore (for the new UI). All new API routes
 * should return `full` alongside the legacy shape so the UI can
 * progressively adopt the richer model without breaking older screens.
 */
export function calculateFullMatchScore(input: ScoreInput): {
  legacy: ScoreBreakdown;
  full: AtsScore;
} {
  const full = calculateAtsScore(input);
  return {
    legacy: {
      overallScore: full.overall,
      skillsMatch: full.legacyBreakdown.skillsMatch,
      experienceMatch: full.legacyBreakdown.experienceMatch,
      keywordCoverage: full.legacyBreakdown.keywordCoverage,
      domainMatch: full.legacyBreakdown.domainMatch,
    },
    full,
  };
}
