/**
 * ATS-level deterministic resume scoring engine.
 *
 * This is the SINGLE SOURCE OF TRUTH for resume-to-JD match scoring across
 * the entire app. The LLM is never used for scoring — only for enhancement
 * and (optionally) keyword normalization. Scoring must be reproducible,
 * auditable, and consistent between screens.
 *
 * Score formula (100 points):
 *   Hard Requirements Match ..... 30
 *   Keyword Relevance ........... 20
 *   Experience Alignment ........ 20
 *   Skills Evidence Quality ..... 15
 *   Domain Alignment ............ 10
 *   ATS Readability ............. 5
 *
 * Penalties (subtracted AFTER summing the above, clamped at 0):
 *   Missing required skills cluster ... up to -10
 *   Seniority / title mismatch ........ up to -8
 *   Insufficient years ................ up to -8
 *   Weak evidence (listed but unused) . up to -5
 *   Domain mismatch ................... up to -5
 *
 * Every dimension is explainable — the output includes the rationale, the
 * specific missing items, and concrete improvement suggestions.
 */

// ── public types ───────────────────────────────────────────────────────

export interface AtsDimensionScore {
  label: string;
  value: number;
  max: number;
  reason: string;
}

export interface AtsPenalty {
  label: string;
  value: number; // always a positive "amount deducted"
  reason: string;
}

export interface AtsSuggestion {
  text: string;
  /** Which dimension this addresses. Used for UI grouping. */
  dimension: string;
}

export interface AtsScore {
  overall: number; // 0..100
  dimensions: {
    hardRequirements: AtsDimensionScore;
    keywordRelevance: AtsDimensionScore;
    experienceAlignment: AtsDimensionScore;
    skillsEvidenceQuality: AtsDimensionScore;
    domainAlignment: AtsDimensionScore;
    atsReadability: AtsDimensionScore;
  };
  penalties: AtsPenalty[];
  missingRequirements: string[];
  suggestions: AtsSuggestion[];
  /**
   * Legacy 4-column breakdown (0..100) for backward compat with the old
   * Application columns and existing Kanban card UI.
   */
  legacyBreakdown: {
    skillsMatch: number;
    experienceMatch: number;
    keywordCoverage: number;
    domainMatch: number;
  };
}

export interface AtsScoreInput {
  jobDescription: string;
  resumeText: string;
  jobTitle?: string;
  company?: string;
}

// ── public API ─────────────────────────────────────────────────────────

export function calculateAtsScore(input: AtsScoreInput): AtsScore {
  const jdRaw = input.jobDescription || "";
  const resumeRaw = input.resumeText || "";

  if (!jdRaw.trim() || !resumeRaw.trim()) {
    return emptyScore();
  }

  const jd = jdRaw.toLowerCase();
  const resume = resumeRaw.toLowerCase();
  const resumeBullets = extractBullets(resumeRaw);
  const resumeExperience = extractExperienceText(resumeRaw);

  // ── dimensions ──
  const hardReq = scoreHardRequirements(jd, resume, resumeExperience);
  const keywordRel = scoreKeywordRelevance(jd, resume);
  const experienceAlign = scoreExperienceAlignment(
    jd,
    resumeExperience,
    input.jobTitle
  );
  const skillsEvidence = scoreSkillsEvidenceQuality(jd, resume, resumeBullets);
  const domain = scoreDomainAlignment(jd, resume);
  const readability = scoreAtsReadability(resumeRaw);

  const rawTotal =
    hardReq.value +
    keywordRel.value +
    experienceAlign.value +
    skillsEvidence.value +
    domain.value +
    readability.value;

  // ── penalties ──
  const penalties: AtsPenalty[] = [];

  if (hardReq.missingRequired.length > 0) {
    const penalty = Math.min(10, hardReq.missingRequired.length * 2);
    penalties.push({
      label: "Missing required skills",
      value: penalty,
      reason: `JD explicitly requires ${hardReq.missingRequired
        .slice(0, 4)
        .join(", ")}${hardReq.missingRequired.length > 4 ? ", …" : ""} — not found in resume.`,
    });
  }

  if (experienceAlign.titleMismatch) {
    penalties.push({
      label: "Title / seniority mismatch",
      value: 6,
      reason: experienceAlign.titleMismatchReason || "Target role differs from recent experience.",
    });
  }

  if (experienceAlign.yearsShortfall >= 2) {
    const penalty = Math.min(8, experienceAlign.yearsShortfall * 2);
    penalties.push({
      label: "Insufficient years of experience",
      value: penalty,
      reason: `JD asks for ${experienceAlign.jdYears || "?"}+ years; resume shows ~${experienceAlign.resumeYears}.`,
    });
  }

  if (skillsEvidence.listedWithoutEvidence.length >= 3) {
    penalties.push({
      label: "Skills listed but not demonstrated",
      value: 4,
      reason: `${skillsEvidence.listedWithoutEvidence
        .slice(0, 3)
        .join(", ")} appear in skills but not in experience bullets.`,
    });
  }

  if (domain.value <= 4 && domain.max === 10) {
    penalties.push({
      label: "Domain mismatch",
      value: 4,
      reason: "Resume shows limited alignment with the JD's industry domain.",
    });
  }

  const penaltyTotal = penalties.reduce((n, p) => n + p.value, 0);
  const overall = clamp(Math.round(rawTotal - penaltyTotal));

  // ── suggestions ──
  const suggestions: AtsSuggestion[] = [];
  if (hardReq.missingRequired.length > 0) {
    suggestions.push({
      dimension: "Hard Requirements",
      text: `Add evidence for: ${hardReq.missingRequired.slice(0, 3).join(", ")}.`,
    });
  }
  if (keywordRel.missingKeywords.length > 0) {
    suggestions.push({
      dimension: "Keyword Relevance",
      text: `Weave in these JD terms where truthful: ${keywordRel.missingKeywords
        .slice(0, 5)
        .join(", ")}.`,
    });
  }
  if (experienceAlign.titleMismatch) {
    suggestions.push({
      dimension: "Experience Alignment",
      text: `Align recent role titles toward the target (${input.jobTitle || "target role"}) where supported by responsibilities.`,
    });
  }
  if (skillsEvidence.listedWithoutEvidence.length >= 3) {
    suggestions.push({
      dimension: "Skills Evidence",
      text: `Mention ${skillsEvidence.listedWithoutEvidence
        .slice(0, 3)
        .join(", ")} in experience bullets (how you used them) instead of leaving them in a skills list.`,
    });
  }
  if (readability.issues.length > 0) {
    suggestions.push({
      dimension: "ATS Readability",
      text: `Fix formatting: ${readability.issues.join("; ")}.`,
    });
  }

  // ── legacy mapping for UI backward compat ──
  const legacyBreakdown = {
    // 0..100 rescales
    skillsMatch: Math.round(
      ((skillsEvidence.value / skillsEvidence.max) * 100 +
        (hardReq.value / hardReq.max) * 100) /
        2
    ),
    experienceMatch: Math.round((experienceAlign.value / experienceAlign.max) * 100),
    keywordCoverage: Math.round((keywordRel.value / keywordRel.max) * 100),
    domainMatch: Math.round((domain.value / domain.max) * 100),
  };

  return {
    overall,
    dimensions: {
      hardRequirements: toDim(hardReq, "Hard Requirements"),
      keywordRelevance: toDim(keywordRel, "Keyword Relevance"),
      experienceAlignment: toDim(experienceAlign, "Experience Alignment"),
      skillsEvidenceQuality: toDim(skillsEvidence, "Skills Evidence"),
      domainAlignment: toDim(domain, "Domain Alignment"),
      atsReadability: toDim(readability, "ATS Readability"),
    },
    penalties,
    missingRequirements: hardReq.missingRequired,
    suggestions,
    legacyBreakdown: {
      skillsMatch: clamp(legacyBreakdown.skillsMatch),
      experienceMatch: clamp(legacyBreakdown.experienceMatch),
      keywordCoverage: clamp(legacyBreakdown.keywordCoverage),
      domainMatch: clamp(legacyBreakdown.domainMatch),
    },
  };
}

/** UI color / label helpers kept here so every screen uses the same thresholds. */
export function getScoreColor(score: number): string {
  if (score >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-blue-700 bg-blue-50 border-blue-200";
  if (score >= 55) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function getScoreBarColor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  return "Low";
}

// ── skill cluster library (JD-normalisation) ───────────────────────────

/**
 * Industry-standard skill families. A mention of ANY member of the cluster
 * in the JD implies the cluster is a required signal; the resume is
 * credited for covering the cluster if it mentions ANY member. This is
 * how IAM (LDAP/AD/SSO/MFA), SIEM (Splunk/QRadar/Sentinel), etc get
 * matched semantically instead of as literal strings.
 */
const SKILL_CLUSTERS: Record<string, string[]> = {
  iam: [
    "iam",
    "identity and access management",
    "identity access management",
    "active directory",
    "azure ad",
    "entra id",
    "ldap",
    "sso",
    "single sign-on",
    "single sign on",
    "mfa",
    "multi-factor authentication",
    "multifactor authentication",
    "okta",
    "ping identity",
    "sailpoint",
    "cyberark",
    "privileged access management",
    "pam",
  ],
  siem: [
    "siem",
    "splunk",
    "qradar",
    "microsoft sentinel",
    "azure sentinel",
    "arcsight",
    "logrhythm",
    "sumo logic",
    "elastic siem",
    "security information and event management",
  ],
  grc: [
    "grc",
    "governance",
    "risk management",
    "risk assessment",
    "compliance",
    "audit",
    "internal controls",
    "iso 27001",
    "iso27001",
    "nist",
    "nist 800-53",
    "sox",
    "sarbanes-oxley",
    "pci dss",
    "hipaa",
    "gdpr",
    "soc 2",
    "soc2",
    "cobit",
  ],
  vulnerabilityMgmt: [
    "vulnerability management",
    "nessus",
    "qualys",
    "rapid7",
    "tenable",
    "vulnerability scanning",
    "patch management",
    "cvss",
    "cve",
  ],
  endpointSecurity: [
    "endpoint security",
    "edr",
    "xdr",
    "crowdstrike",
    "sentinelone",
    "carbon black",
    "defender",
    "microsoft defender",
    "symantec",
    "trend micro",
  ],
  cloudSecurity: [
    "cloud security",
    "aws security",
    "azure security",
    "gcp security",
    "cspm",
    "cloud security posture management",
    "prisma cloud",
    "wiz",
    "lacework",
    "cloudtrail",
    "guardduty",
    "security hub",
    "aws waf",
  ],
  networkSecurity: [
    "network security",
    "firewall",
    "palo alto",
    "fortinet",
    "checkpoint",
    "cisco asa",
    "ids",
    "ips",
    "intrusion detection",
    "intrusion prevention",
    "vpn",
    "zero trust",
    "ztna",
  ],
  appSec: [
    "application security",
    "appsec",
    "owasp",
    "secure coding",
    "sast",
    "dast",
    "iast",
    "penetration testing",
    "pen testing",
    "burp suite",
    "zap",
    "veracode",
    "checkmarx",
    "sonarqube",
  ],
  incidentResponse: [
    "incident response",
    "ir",
    "soc",
    "security operations center",
    "threat hunting",
    "forensics",
    "digital forensics",
    "mitre att&ck",
    "mitre attack",
    "playbook",
    "soar",
  ],
  devsecops: [
    "devsecops",
    "ci/cd security",
    "kubernetes security",
    "container security",
    "iac security",
    "terraform security",
  ],
};

const CERTIFICATION_TERMS = [
  "cissp",
  "cism",
  "cisa",
  "crisc",
  "ccsp",
  "oscp",
  "ceh",
  "security+",
  "sec+",
  "comptia security+",
  "azure-104",
  "az-500",
  "az-104",
  "aws security specialty",
  "aws certified security",
  "gcp professional cloud security",
  "gcih",
  "gsec",
  "gcia",
  "pmp",
];

// ── 1. Hard Requirements (30) ──

interface DimResult {
  label: string;
  value: number;
  max: number;
  reason: string;
}

interface HardReqResult extends DimResult {
  missingRequired: string[];
}

function scoreHardRequirements(
  jd: string,
  resume: string,
  resumeExperience: string
): HardReqResult {
  const max = 30;
  const required = detectRequiredItems(jd);
  if (required.length === 0) {
    return {
      label: "Hard Requirements",
      value: Math.round(max * 0.6),
      max,
      reason: "No explicit hard requirements detected in the JD — neutral score.",
      missingRequired: [],
    };
  }

  // Evaluate each requirement with cluster matching (IAM → LDAP counts).
  let met = 0;
  const missing: string[] = [];
  for (const req of required) {
    if (requirementIsMet(req, resume, resumeExperience)) {
      met += 1;
    } else {
      missing.push(req);
    }
  }

  const ratio = met / required.length;
  const value = Math.round(max * ratio);
  return {
    label: "Hard Requirements",
    value,
    max,
    reason: `${met}/${required.length} hard requirements evidenced in resume.`,
    missingRequired: missing,
  };
}

function detectRequiredItems(jd: string): string[] {
  const out = new Set<string>();

  // Certifications required / preferred
  for (const cert of CERTIFICATION_TERMS) {
    if (jd.includes(cert)) out.add(cert.toUpperCase());
  }

  // JD phrases like "required:", "must have:", "minimum qualifications"
  const reqSectionMatches = jd.match(
    /(?:required qualifications|minimum qualifications|must have|requirements)[\s\S]{0,600}/gi
  );
  if (reqSectionMatches) {
    for (const block of reqSectionMatches) {
      for (const [cluster, terms] of Object.entries(SKILL_CLUSTERS)) {
        if (terms.some((t) => block.includes(t))) out.add(cluster);
      }
    }
  }

  // Top-2 matching skill clusters in the JD as a whole (covers cases where
  // the JD doesn't have an explicit "Required:" heading)
  const clusterScores: Array<[string, number]> = [];
  for (const [cluster, terms] of Object.entries(SKILL_CLUSTERS)) {
    let n = 0;
    for (const t of terms) if (jd.includes(t)) n++;
    if (n > 0) clusterScores.push([cluster, n]);
  }
  clusterScores.sort((a, b) => b[1] - a[1]);
  for (const [cluster] of clusterScores.slice(0, 3)) out.add(cluster);

  // Years of experience requirement
  const yearsMatch = jd.match(/(\d+)\+?\s*(?:years|yrs)/i);
  if (yearsMatch) out.add(`${yearsMatch[1]}+ years experience`);

  return [...out];
}

function requirementIsMet(
  requirement: string,
  resume: string,
  resumeExperience: string
): boolean {
  const req = requirement.toLowerCase();

  // Certification literal
  if (CERTIFICATION_TERMS.some((c) => c.toLowerCase() === req)) {
    return resume.includes(req) || resumeExperience.includes(req);
  }

  // Skill cluster
  if (SKILL_CLUSTERS[req]) {
    return SKILL_CLUSTERS[req].some((t) => resume.includes(t));
  }

  // Years-of-experience requirement
  const yearsMatch = req.match(/(\d+)\+?\s*years/);
  if (yearsMatch) {
    const needed = parseInt(yearsMatch[1], 10);
    const got = detectResumeYears(resumeExperience);
    return got >= needed;
  }

  // Fallback — literal match
  return resume.includes(req);
}

// ── 2. Keyword Relevance (20) — normalized ──

interface KeywordResult extends DimResult {
  missingKeywords: string[];
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","must","shall",
  "can","need","this","that","these","those","we","you","they","it","our",
  "your","their","its","my","his","her","as","if","not","no","all","each",
  "every","both","few","more","most","other","some","such","than","too",
  "very","just","about","above","also","who","which","what","when","where",
  "how","why","into","through","during","before","after","between","under",
  "over","work","working","role","team","ability","experience","strong",
  "including","using","used","looking","join","position","company","well",
  "within","based","across","plus","years","year","responsible","requirements",
  "ensure","ensuring","support","supporting","across","will","you'll","they'll",
]);

function scoreKeywordRelevance(jd: string, resume: string): KeywordResult {
  const max = 20;

  // Normalised keyword set: pick top-frequency content tokens from the JD,
  // then credit the resume for any token in the same skill cluster too.
  const jdTokens = tokenize(jd);
  if (jdTokens.length === 0) {
    return {
      label: "Keyword Relevance",
      value: Math.round(max * 0.5),
      max,
      reason: "JD has no detectable keywords.",
      missingKeywords: [],
    };
  }

  const freq = new Map<string, number>();
  for (const t of jdTokens) freq.set(t, (freq.get(t) || 0) + 1);
  // Bigram bonus
  for (let i = 0; i < jdTokens.length - 1; i++) {
    const bg = `${jdTokens[i]} ${jdTokens[i + 1]}`;
    freq.set(bg, (freq.get(bg) || 0) + 2);
  }

  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k]) => k);

  let covered = 0;
  const missing: string[] = [];
  for (const kw of top) {
    if (isKeywordCovered(kw, resume)) {
      covered++;
    } else {
      missing.push(kw);
    }
  }

  const ratio = covered / top.length;
  const value = Math.round(max * ratio);
  return {
    label: "Keyword Relevance",
    value,
    max,
    reason: `${covered}/${top.length} top JD keywords (or equivalents) matched in resume.`,
    missingKeywords: missing.slice(0, 12),
  };
}

function isKeywordCovered(kw: string, resume: string): boolean {
  const k = kw.toLowerCase();
  if (resume.includes(k)) return true;
  // Cluster-equivalent?
  for (const terms of Object.values(SKILL_CLUSTERS)) {
    if (terms.some((t) => t.includes(k) || k.includes(t))) {
      // If any cluster member is mentioned anywhere in the resume → covered
      if (terms.some((t) => resume.includes(t))) return true;
    }
  }
  return false;
}

// ── 3. Experience Alignment (20) ──

interface ExperienceResult extends DimResult {
  titleMismatch: boolean;
  titleMismatchReason?: string;
  jdYears: number;
  resumeYears: number;
  yearsShortfall: number;
}

const SENIORITY_LEVELS = ["junior", "mid", "senior", "lead", "management"] as const;
type Seniority = (typeof SENIORITY_LEVELS)[number];

function scoreExperienceAlignment(
  jd: string,
  resumeExperience: string,
  jobTitle: string | undefined
): ExperienceResult {
  const max = 20;

  const jdSeniority = detectSeniority(jd + " " + (jobTitle || ""));
  const resumeSeniority = detectSeniority(resumeExperience);

  let seniorityScore = 0;
  let titleMismatch = false;
  let titleMismatchReason: string | undefined;
  if (jdSeniority && resumeSeniority) {
    const diff = Math.abs(
      SENIORITY_LEVELS.indexOf(jdSeniority) -
        SENIORITY_LEVELS.indexOf(resumeSeniority)
    );
    if (diff === 0) seniorityScore = 8;
    else if (diff === 1) seniorityScore = 5;
    else {
      seniorityScore = 2;
      titleMismatch = true;
      titleMismatchReason = `Resume is ${resumeSeniority}-level, JD targets ${jdSeniority}-level.`;
    }
  } else {
    seniorityScore = 4; // neutral
  }

  const jdYears = detectJdYears(jd);
  const resumeYears = detectResumeYears(resumeExperience);
  let yearsScore = 0;
  let yearsShortfall = 0;
  if (jdYears > 0 && resumeYears > 0) {
    if (resumeYears >= jdYears) yearsScore = 8;
    else if (resumeYears >= jdYears - 2) {
      yearsScore = 5;
      yearsShortfall = jdYears - resumeYears;
    } else {
      yearsScore = 2;
      yearsShortfall = jdYears - resumeYears;
    }
  } else {
    yearsScore = 4;
  }

  // Recent-role keyword overlap: does the most recent role's text share
  // tokens with the JD? Higher share → higher relevance.
  const recentBlock = extractMostRecentRoleBlock(resumeExperience);
  const recentShare = keywordShare(jd, recentBlock);
  const recencyScore = Math.round(recentShare * 4); // up to 4 pts

  const value = clamp(seniorityScore + yearsScore + recencyScore, 0, max);
  return {
    label: "Experience Alignment",
    value,
    max,
    reason:
      `Seniority: ${jdSeniority || "?"} vs ${resumeSeniority || "?"}. ` +
      `Years: JD ${jdYears || "?"} vs resume ~${resumeYears}. ` +
      `Recent-role JD overlap: ${Math.round(recentShare * 100)}%.`,
    titleMismatch,
    titleMismatchReason,
    jdYears,
    resumeYears,
    yearsShortfall,
  };
}

function detectSeniority(text: string): Seniority | null {
  const t = text.toLowerCase();
  if (/\b(manager|director|vp|head of|chief|cto|ceo|cio)\b/.test(t)) return "management";
  if (/\b(lead|staff|principal|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry[\s-]*level|intern|graduate)\b/.test(t)) return "junior";
  if (/\b(mid[\s-]*level|intermediate|associate)\b/.test(t)) return "mid";
  return null;
}

function detectJdYears(jd: string): number {
  const m = jd.match(/(\d+)\+?\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp|relevant)?/i);
  return m ? parseInt(m[1], 10) : 0;
}

function detectResumeYears(resumeExperience: string): number {
  // Estimate by spanning the earliest year to latest year / "Present".
  const years = [...resumeExperience.matchAll(/\b(19|20)\d{2}\b/g)].map((m) =>
    parseInt(m[0], 10)
  );
  if (years.length === 0) return 0;
  const min = Math.min(...years);
  const thisYear = new Date().getFullYear();
  const hasPresent = /\bpresent\b/i.test(resumeExperience);
  const max = hasPresent ? thisYear : Math.max(...years);
  return Math.max(0, max - min);
}

function extractMostRecentRoleBlock(resumeExperience: string): string {
  const lines = resumeExperience.split("\n");
  const idx = lines.findIndex((l) =>
    /\bpresent\b/i.test(l) || /\b20\d{2}\s*[–—\-]\s*present\b/i.test(l)
  );
  if (idx === -1) {
    // fall back to the first ~20 lines of experience
    return lines.slice(0, 20).join("\n");
  }
  return lines.slice(idx, idx + 12).join("\n");
}

function keywordShare(jd: string, block: string): number {
  if (!block.trim()) return 0;
  const jdSet = new Set(tokenize(jd));
  const blockTokens = new Set(tokenize(block));
  if (jdSet.size === 0) return 0;
  let overlap = 0;
  for (const t of blockTokens) if (jdSet.has(t)) overlap++;
  return Math.min(1, overlap / Math.max(20, jdSet.size * 0.15));
}

// ── 4. Skills Evidence Quality (15) ──

interface SkillsEvidenceResult extends DimResult {
  listedWithoutEvidence: string[];
}

function scoreSkillsEvidenceQuality(
  jd: string,
  resume: string,
  bullets: string[]
): SkillsEvidenceResult {
  const max = 15;
  const bulletsText = bullets.join(" ").toLowerCase();
  const listedBlock = extractSkillsBlock(resume);

  // Clusters referenced by the JD
  const jdClusters = new Set<string>();
  for (const [cluster, terms] of Object.entries(SKILL_CLUSTERS)) {
    if (terms.some((t) => jd.includes(t))) jdClusters.add(cluster);
  }

  if (jdClusters.size === 0) {
    return {
      label: "Skills Evidence",
      value: Math.round(max * 0.6),
      max,
      reason: "No JD skill clusters detected — neutral score.",
      listedWithoutEvidence: [],
    };
  }

  let listedHits = 0;
  let demonstratedHits = 0;
  const listedWithoutEvidence: string[] = [];

  for (const cluster of jdClusters) {
    const terms = SKILL_CLUSTERS[cluster];
    const inList = terms.some((t) => listedBlock.includes(t));
    const inBullets = terms.some((t) => bulletsText.includes(t));
    if (inList) listedHits++;
    if (inBullets) demonstratedHits++;
    if (inList && !inBullets) listedWithoutEvidence.push(cluster);
  }

  // 70% weight on demonstrated, 30% on listed.
  const demonstratedRatio = demonstratedHits / jdClusters.size;
  const listedRatio = listedHits / jdClusters.size;
  const weighted = demonstratedRatio * 0.7 + listedRatio * 0.3;
  const value = Math.round(max * weighted);

  return {
    label: "Skills Evidence",
    value,
    max,
    reason:
      `${demonstratedHits}/${jdClusters.size} skill clusters demonstrated in experience bullets, ` +
      `${listedHits}/${jdClusters.size} listed in skills section.`,
    listedWithoutEvidence,
  };
}

function extractSkillsBlock(resumeRaw: string): string {
  const lowered = resumeRaw.toLowerCase();
  const startMatch =
    lowered.match(/\btechnical skills:?|\bskills:?\b|\bcompetencies:?\b/) ||
    lowered.match(/\btechnologies:?/);
  if (!startMatch) return lowered;
  const start = startMatch.index || 0;
  // Until the next canonical heading or 2000 chars.
  const afterStart = lowered.slice(start);
  const nextHeading = afterStart.slice(60).search(
    /\b(work experience|experience|education|certifications|projects)[:\s]/i
  );
  const end = nextHeading === -1 ? Math.min(afterStart.length, 2000) : 60 + nextHeading;
  return afterStart.slice(0, end);
}

// ── 5. Domain Alignment (10) ──

function scoreDomainAlignment(jd: string, resume: string): DimResult {
  const max = 10;

  const DOMAIN_LIB: Record<string, string[]> = {
    "cybersecurity / infosec": [
      "cyber security","cybersecurity","information security","infosec","soc",
      "security analyst","security engineer","threat","incident response",
    ],
    "grc": ["grc","governance","risk","compliance","audit","controls","policy"],
    "iam": ["iam","identity","access management","sso","mfa","active directory","ldap"],
    "cloud security": ["cloud security","aws security","azure security","gcp security","cspm"],
    "regulated industry": [
      "hipaa","pci","sox","gdpr","sarbanes-oxley","healthcare","financial services",
      "banking","insurance","hitrust",
    ],
    "swe / engineering": [
      "software engineer","software developer","backend","frontend","full stack",
      "microservices","apis",
    ],
    "data / ml": [
      "data science","data engineering","machine learning","ml","ai","analytics","etl",
    ],
    "devops / sre": ["devops","sre","site reliability","platform engineering","kubernetes"],
  };

  const jdDomains = new Set<string>();
  for (const [d, terms] of Object.entries(DOMAIN_LIB)) {
    if (terms.some((t) => jd.includes(t))) jdDomains.add(d);
  }
  const resumeDomains = new Set<string>();
  for (const [d, terms] of Object.entries(DOMAIN_LIB)) {
    if (terms.some((t) => resume.includes(t))) resumeDomains.add(d);
  }

  if (jdDomains.size === 0) {
    return {
      label: "Domain Alignment",
      value: Math.round(max * 0.6),
      max,
      reason: "No clear JD domain signal — neutral score.",
    };
  }

  let matched = 0;
  for (const d of jdDomains) if (resumeDomains.has(d)) matched++;
  const ratio = matched / jdDomains.size;
  const value = Math.round(max * ratio);
  return {
    label: "Domain Alignment",
    value,
    max,
    reason: `${matched}/${jdDomains.size} JD domains also present in resume (${[...jdDomains].join(", ")}).`,
  };
}

// ── 6. ATS Readability (5) ──

interface ReadabilityResult extends DimResult {
  issues: string[];
}

function scoreAtsReadability(resumeRaw: string): ReadabilityResult {
  const max = 5;
  let score = max;
  const issues: string[] = [];

  // Heading coverage: check for canonical section headings.
  const lowered = resumeRaw.toLowerCase();
  const expected = ["profile summary", "technical skills", "experience", "education"];
  for (const e of expected) {
    if (!lowered.includes(e)) {
      score -= 1;
      issues.push(`missing "${e.toUpperCase()}" section`);
    }
  }

  // Line-length sanity — very long single lines suggest text blocks (bad for ATS).
  const lines = resumeRaw.split("\n");
  const longLines = lines.filter((l) => l.length > 250).length;
  if (longLines >= 3) {
    score -= 1;
    issues.push(`${longLines} overly long lines (ATS parsing may truncate)`);
  }

  // Detect resume tables / icons / non-ASCII "decorations" beyond bullets.
  if (/[■□▶►◆◇]/u.test(resumeRaw)) {
    score -= 1;
    issues.push("non-standard glyphs detected (use · for bullets)");
  }

  score = clamp(score, 0, max);
  return {
    label: "ATS Readability",
    value: score,
    max,
    reason:
      issues.length === 0
        ? "Clean, ATS-friendly structure detected."
        : `${issues.length} readability issue(s) found.`,
    issues,
  };
}

// ── helpers ────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function extractBullets(resumeRaw: string): string[] {
  return resumeRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•·\-–—\*]/.test(l))
    .map((l) => l.replace(/^[•·\-–—\*]\s*/, ""));
}

function extractExperienceText(resumeRaw: string): string {
  const lowered = resumeRaw.toLowerCase();
  const m = lowered.match(/\bwork experience:?|\bprofessional experience:?|\bexperience:?\b/);
  if (!m) return resumeRaw;
  const start = m.index || 0;
  // Stop at EDUCATION or CERTIFICATIONS or the string end.
  const rest = resumeRaw.slice(start);
  const stopIdx = rest.toLowerCase().search(
    /\b(education|certifications|projects)[:\s]/
  );
  return stopIdx === -1 ? rest : rest.slice(0, stopIdx);
}

function toDim(d: DimResult, label: string): AtsDimensionScore {
  return { label, value: d.value, max: d.max, reason: d.reason };
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function emptyScore(): AtsScore {
  const mk = (label: string, max: number): AtsDimensionScore => ({
    label,
    value: 0,
    max,
    reason: "No inputs.",
  });
  return {
    overall: 0,
    dimensions: {
      hardRequirements: mk("Hard Requirements", 30),
      keywordRelevance: mk("Keyword Relevance", 20),
      experienceAlignment: mk("Experience Alignment", 20),
      skillsEvidenceQuality: mk("Skills Evidence", 15),
      domainAlignment: mk("Domain Alignment", 10),
      atsReadability: mk("ATS Readability", 5),
    },
    penalties: [],
    missingRequirements: [],
    suggestions: [],
    legacyBreakdown: { skillsMatch: 0, experienceMatch: 0, keywordCoverage: 0, domainMatch: 0 },
  };
}
