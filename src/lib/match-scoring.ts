/**
 * Multi-dimensional match scoring engine.
 *
 * Dimensions:
 *   Skills overlap       — 40 %
 *   Experience relevance — 30 %
 *   Keyword coverage     — 20 %
 *   Domain alignment     — 10 %
 */

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

const WEIGHTS = {
  skills: 0.4,
  experience: 0.3,
  keywords: 0.2,
  domain: 0.1,
};

// ── public API ──

export function calculateMatchScore(input: ScoreInput): ScoreBreakdown {
  const jd = input.jobDescription.toLowerCase();
  const resume = input.resumeText.toLowerCase();

  if (!jd || !resume) {
    return { overallScore: 0, skillsMatch: 0, experienceMatch: 0, keywordCoverage: 0, domainMatch: 0 };
  }

  const jdTokens = tokenize(jd);
  const resumeTokens = tokenize(resume);

  const skillsMatch = computeSkillsMatch(jd, resume);
  const experienceMatch = computeExperienceMatch(jd, resume, input.jobTitle);
  const keywordCoverage = computeKeywordCoverage(jdTokens, resumeTokens);
  const domainMatch = computeDomainMatch(jd, resume);

  const overallScore = Math.round(
    skillsMatch * WEIGHTS.skills +
    experienceMatch * WEIGHTS.experience +
    keywordCoverage * WEIGHTS.keywords +
    domainMatch * WEIGHTS.domain
  );

  return {
    overallScore: clamp(overallScore),
    skillsMatch: clamp(Math.round(skillsMatch)),
    experienceMatch: clamp(Math.round(experienceMatch)),
    keywordCoverage: clamp(Math.round(keywordCoverage)),
    domainMatch: clamp(Math.round(domainMatch)),
  };
}

// ── 1. Skills overlap (40 %) ──

const SKILL_PATTERNS: string[] = [
  "javascript", "typescript", "python", "java", "c\\+\\+", "c#", "ruby",
  "golang", "rust", "swift", "kotlin", "php", "scala", "r\\b",
  "react", "angular", "vue", "svelte", "next\\.?js", "nuxt",
  "node\\.?js", "express", "fastapi", "django", "flask", "spring",
  "rails", "laravel",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
  "terraform", "ansible", "ci/cd", "jenkins", "github actions",
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  "dynamodb", "cassandra", "kafka", "rabbitmq",
  "graphql", "rest api", "grpc", "microservices",
  "machine learning", "deep learning", "nlp", "computer vision",
  "tensorflow", "pytorch", "scikit",
  "html", "css", "tailwind", "sass",
  "git", "linux", "agile", "scrum", "jira",
  "figma", "sketch", "adobe",
  "sql", "nosql", "data pipeline", "etl", "spark", "hadoop",
  "security", "oauth", "jwt", "encryption",
  "product management", "project management", "leadership",
];

function computeSkillsMatch(jd: string, resume: string): number {
  const jdSkills = extractSkills(jd);
  const resumeSkills = extractSkills(resume);

  if (jdSkills.size === 0) return 50;

  let matched = 0;
  for (const skill of jdSkills) {
    if (resumeSkills.has(skill)) matched++;
  }

  return (matched / jdSkills.size) * 100;
}

function extractSkills(text: string): Set<string> {
  const found = new Set<string>();
  for (const pattern of SKILL_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, "i");
    if (regex.test(text)) {
      found.add(pattern.replace(/\\/g, "").replace(/\.\?/g, ""));
    }
  }
  return found;
}

// ── 2. Experience relevance (30 %) ──

const SENIORITY_KEYWORDS: Record<string, string[]> = {
  junior: ["junior", "entry level", "entry-level", "associate", "intern", "graduate", "0-2 years", "1-2 years"],
  mid: ["mid level", "mid-level", "intermediate", "3-5 years", "2-4 years", "3+ years"],
  senior: ["senior", "lead", "staff", "principal", "5+ years", "7+ years", "8+ years", "10+ years", "architect"],
  management: ["manager", "director", "vp", "head of", "cto", "ceo", "chief"],
};

function computeExperienceMatch(jd: string, resume: string, jobTitle?: string): number {
  const jdFull = `${jd} ${jobTitle || ""}`.toLowerCase();

  const jdLevel = detectSeniority(jdFull);
  const resumeLevel = detectSeniority(resume);

  let levelScore = 0;
  let hasLevelSignal = false;

  if (jdLevel && resumeLevel) {
    hasLevelSignal = true;
    const levels = ["junior", "mid", "senior", "management"];
    const jdIdx = levels.indexOf(jdLevel);
    const resumeIdx = levels.indexOf(resumeLevel);
    const diff = Math.abs(jdIdx - resumeIdx);

    if (diff === 0) levelScore = 90;
    else if (diff === 1) levelScore = 60;
    else levelScore = 25;
  } else if (jdLevel || resumeLevel) {
    hasLevelSignal = true;
    levelScore = 40;
  }

  const yearPatterns = [
    /(\d+)\+?\s*years?\s*(of)?\s*(experience|exp)/gi,
    /(\d+)\+?\s*years?\s*(in|with|of)/gi,
  ];

  let jdYears = 0;
  let resumeYears = 0;
  for (const pat of yearPatterns) {
    for (const m of jdFull.matchAll(pat)) jdYears = Math.max(jdYears, parseInt(m[1]));
    for (const m of resume.matchAll(pat)) resumeYears = Math.max(resumeYears, parseInt(m[1]));
  }

  let yearsScore = 0;
  let hasYearsSignal = false;

  if (jdYears > 0 && resumeYears > 0) {
    hasYearsSignal = true;
    if (resumeYears >= jdYears) yearsScore = 95;
    else if (resumeYears >= jdYears - 2) yearsScore = 65;
    else yearsScore = 30;
  }

  if (hasLevelSignal && hasYearsSignal) return levelScore * 0.5 + yearsScore * 0.5;
  if (hasLevelSignal) return levelScore;
  if (hasYearsSignal) return yearsScore;
  return 30;
}

function detectSeniority(text: string): string | null {
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return level;
    }
  }
  return null;
}

// ── 3. Keyword coverage (20 %) ──

function computeKeywordCoverage(jdTokens: string[], resumeTokens: string[]): number {
  if (jdTokens.length === 0) return 50;

  const jdFreq = frequencyMap(jdTokens);
  const resumeSet = new Set(resumeTokens);

  const topJdKeywords = [...jdFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);

  if (topJdKeywords.length === 0) return 50;

  let found = 0;
  for (const kw of topJdKeywords) {
    if (resumeSet.has(kw)) found++;
  }

  return (found / topJdKeywords.length) * 100;
}

// ── 4. Domain alignment (10 %) ──

const DOMAINS: Record<string, string[]> = {
  frontend: ["frontend", "front-end", "react", "angular", "vue", "css", "html", "ui", "ux", "web"],
  backend: ["backend", "back-end", "server", "api", "microservices", "database", "sql"],
  fullstack: ["full stack", "full-stack", "fullstack"],
  devops: ["devops", "infrastructure", "ci/cd", "deployment", "cloud", "sre", "reliability"],
  data: ["data science", "data engineering", "analytics", "machine learning", "ml", "ai", "deep learning"],
  mobile: ["mobile", "ios", "android", "react native", "flutter", "swift", "kotlin"],
  security: ["security", "cybersecurity", "penetration", "infosec", "compliance"],
  product: ["product management", "product manager", "roadmap", "stakeholder"],
  design: ["design", "figma", "sketch", "user experience", "user interface", "prototyping"],
};

function computeDomainMatch(jd: string, resume: string): number {
  const jdDomains = detectDomains(jd);
  const resumeDomains = detectDomains(resume);

  if (jdDomains.size === 0) return 60;

  let matched = 0;
  for (const d of jdDomains) {
    if (resumeDomains.has(d)) matched++;
  }

  return jdDomains.size > 0 ? (matched / jdDomains.size) * 100 : 50;
}

function detectDomains(text: string): Set<string> {
  const found = new Set<string>();
  for (const [domain, keywords] of Object.entries(DOMAINS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        found.add(domain);
        break;
      }
    }
  }
  return found;
}

// ── helpers ──

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "need",
  "this", "that", "these", "those", "we", "you", "they", "it", "he",
  "she", "our", "your", "their", "its", "my", "his", "her", "as", "if",
  "not", "no", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "than", "too", "very", "just", "about",
  "also", "who", "which", "what", "when", "where", "how", "why",
  "into", "through", "during", "before", "after", "between", "under",
  "over", "work", "working", "role", "team", "ability", "experience",
  "strong", "including", "using", "used", "looking", "join", "position",
  "company", "well", "within", "based", "across", "plus", "years",
  "year", "responsible", "requirements",
]);

function tokenize(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function frequencyMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tokens) {
    map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// ── score color helpers (shared by UI) ──

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
  if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}
