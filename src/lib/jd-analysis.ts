/**
 * Deterministic job-description analyzer.
 *
 * Runs BEFORE any LLM call so the AI context packet is grounded in a
 * predictable, auditable parse of the JD. The LLM is never asked "what
 * does this JD require" — it only receives the structured output of this
 * analyzer alongside the resume analysis.
 *
 * Outputs:
 *   - normalised role + role family + seniority + required years
 *   - hard requirements (must have), preferred requirements (nice to have)
 *   - keyword clusters grouped by domain (IAM, SIEM, GRC, …)
 *   - tools/platforms mentioned explicitly
 *   - domain signals (cybersecurity, GRC, IAM, cloud security, …)
 *   - recruiter intent (what the JD is really hiring for)
 *   - must-not-miss terms (the highest-priority keywords)
 */

import { extractJdKeywords } from "./docx-engine";

// ── public types ───────────────────────────────────────────────────────

export interface JdAnalysis {
  normalizedRole: string;
  roleFamily: string | null;
  seniority: "junior" | "mid" | "senior" | "lead" | "management" | null;
  requiredYears: number;
  hardRequirements: string[];
  preferredRequirements: string[];
  keywordClusters: Record<string, string[]>;
  tools: string[];
  domains: string[];
  recruiterIntent: string;
  mustNotMissTerms: string[];
  /** Top-30 frequency-ranked JD tokens. */
  topKeywords: string[];
  /** Raw length / signal — used by the LLM prompt to calibrate verbosity. */
  length: number;
}

// ── skill cluster library (shared structure with ats-scoring) ──────────

const SKILL_CLUSTERS: Record<string, string[]> = {
  iam: [
    "iam", "identity and access management", "identity access management",
    "active directory", "azure ad", "entra id", "ldap", "sso",
    "single sign-on", "single sign on", "mfa", "multi-factor authentication",
    "multifactor authentication", "okta", "ping identity", "sailpoint",
    "cyberark", "privileged access management", "pam",
  ],
  siem: [
    "siem", "splunk", "qradar", "microsoft sentinel", "azure sentinel",
    "arcsight", "logrhythm", "sumo logic", "elastic siem",
    "security information and event management",
  ],
  grc: [
    "grc", "governance", "risk management", "risk assessment", "compliance",
    "audit", "internal controls", "iso 27001", "iso27001", "nist",
    "nist 800-53", "sox", "sarbanes-oxley", "pci dss", "hipaa", "gdpr",
    "soc 2", "soc2", "cobit",
  ],
  vulnerabilityMgmt: [
    "vulnerability management", "nessus", "qualys", "rapid7", "tenable",
    "vulnerability scanning", "patch management", "cvss", "cve",
  ],
  endpointSecurity: [
    "endpoint security", "edr", "xdr", "crowdstrike", "sentinelone",
    "carbon black", "defender", "microsoft defender", "symantec", "trend micro",
  ],
  cloudSecurity: [
    "cloud security", "aws security", "azure security", "gcp security",
    "cspm", "cloud security posture management", "prisma cloud", "wiz",
    "lacework", "cloudtrail", "guardduty", "security hub", "aws waf",
  ],
  networkSecurity: [
    "network security", "firewall", "palo alto", "fortinet", "checkpoint",
    "cisco asa", "ids", "ips", "intrusion detection", "intrusion prevention",
    "vpn", "zero trust", "ztna",
  ],
  appSec: [
    "application security", "appsec", "owasp", "secure coding", "sast",
    "dast", "iast", "penetration testing", "pen testing", "burp suite",
    "zap", "veracode", "checkmarx", "sonarqube",
  ],
  incidentResponse: [
    "incident response", "soc", "security operations center", "threat hunting",
    "forensics", "digital forensics", "mitre att&ck", "mitre attack",
    "playbook", "soar",
  ],
  devsecops: [
    "devsecops", "ci/cd security", "kubernetes security", "container security",
    "iac security", "terraform security",
  ],
  swe: [
    "software engineer", "software developer", "backend", "frontend",
    "full stack", "full-stack", "microservices", "apis",
  ],
  data: [
    "data science", "data engineering", "machine learning", "ml", "ai",
    "analytics", "etl", "spark", "airflow",
  ],
  devops: [
    "devops", "sre", "site reliability", "platform engineering", "kubernetes",
    "terraform", "ansible",
  ],
};

const DOMAIN_LIB: Record<string, string[]> = {
  "cybersecurity": [
    "cyber security", "cybersecurity", "information security", "infosec",
    "security analyst", "security engineer",
  ],
  "grc": ["grc", "governance", "risk", "compliance", "audit", "controls", "policy"],
  "iam": ["iam", "identity", "access management", "sso", "mfa", "active directory", "ldap"],
  "cloud security": ["cloud security", "aws security", "azure security", "gcp security", "cspm"],
  "regulated industry": [
    "hipaa", "pci", "sox", "gdpr", "sarbanes-oxley", "healthcare",
    "financial services", "banking", "insurance", "hitrust",
  ],
  "swe": [
    "software engineer", "software developer", "backend", "frontend",
    "full stack", "microservices", "apis",
  ],
  "data": ["data science", "data engineering", "machine learning", "ml", "ai", "analytics"],
  "devops": ["devops", "sre", "site reliability", "platform engineering"],
};

const ROLE_FAMILIES: Array<{
  family: string;
  patterns: RegExp[];
}> = [
  { family: "cyber-security", patterns: [/\bcyber\s*security\b/i, /\bcybersecurity\b/i, /\binfosec\b/i] },
  { family: "information-security", patterns: [/\binformation\s*security\b/i, /\bIT\s*security\b/i] },
  { family: "grc", patterns: [/\bGRC\b/, /\bgovernance,?\s*risk(?:,?\s*and)?\s*compliance\b/i, /\brisk\s*and\s*compliance\b/i] },
  { family: "soc", patterns: [/\bSOC\s+(analyst|engineer|specialist)\b/i, /\bsecurity\s+operations\b/i] },
  { family: "network", patterns: [/\bnetwork\s+(engineer|analyst|administrator)\b/i] },
  { family: "cloud-security", patterns: [/\bcloud\s+security\b/i] },
  { family: "iam", patterns: [/\bIAM\b/, /\bidentity\s*(?:and|&)?\s*access\s*management\b/i] },
  { family: "appsec", patterns: [/\bapplication\s+security\b/i, /\bappsec\b/i] },
  { family: "devops", patterns: [/\bdevops\b/i, /\bsre\b/i, /\bsite\s+reliability\b/i] },
  { family: "swe", patterns: [/\bsoftware\s+engineer\b/i, /\bsoftware\s+developer\b/i, /\bfull[\s-]*stack\b/i] },
];

// ── analyzer ──────────────────────────────────────────────────────────

export function analyzeJobDescription(jd: string, jobTitle?: string): JdAnalysis {
  if (!jd || !jd.trim()) {
    return emptyAnalysis();
  }

  const lower = jd.toLowerCase();

  const seniority = detectSeniority(lower + " " + (jobTitle || "").toLowerCase());
  const roleFamily = detectRoleFamily(lower);
  const normalizedRole = normalizeRoleTitle(jobTitle || inferTitleFromJd(lower), seniority);
  const requiredYears = detectYears(lower);

  const { hard, preferred } = extractRequirements(jd);
  const clusters = detectClusters(lower);
  const tools = detectTools(lower);
  const domains = detectDomains(lower);
  const mustNotMiss = mustNotMissFromClusters(clusters).slice(0, 10);
  const topKeywords = extractJdKeywords(jd).slice(0, 30);
  const recruiterIntent = buildRecruiterIntent({
    roleFamily,
    seniority,
    clusters,
    domains,
    tools,
  });

  return {
    normalizedRole,
    roleFamily,
    seniority,
    requiredYears,
    hardRequirements: hard,
    preferredRequirements: preferred,
    keywordClusters: clusters,
    tools,
    domains,
    recruiterIntent,
    mustNotMissTerms: mustNotMiss,
    topKeywords,
    length: jd.length,
  };
}

function emptyAnalysis(): JdAnalysis {
  return {
    normalizedRole: "",
    roleFamily: null,
    seniority: null,
    requiredYears: 0,
    hardRequirements: [],
    preferredRequirements: [],
    keywordClusters: {},
    tools: [],
    domains: [],
    recruiterIntent: "",
    mustNotMissTerms: [],
    topKeywords: [],
    length: 0,
  };
}

function detectSeniority(text: string): JdAnalysis["seniority"] {
  if (/\b(manager|director|vp|head of|chief|cto|ceo|cio)\b/.test(text)) return "management";
  if (/\b(lead|staff|principal|architect)\b/.test(text)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(text)) return "senior";
  if (/\b(junior|jr\.?|entry[\s-]*level|intern|graduate)\b/.test(text)) return "junior";
  if (/\b(mid[\s-]*level|intermediate|associate)\b/.test(text)) return "mid";
  return null;
}

function detectRoleFamily(jd: string): string | null {
  for (const f of ROLE_FAMILIES) {
    if (f.patterns.some((re) => re.test(jd))) return f.family;
  }
  return null;
}

function detectYears(jd: string): number {
  const m = jd.match(/(\d+)\+?\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp|relevant)?/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Extract structured lists from explicit "Required / Preferred" headings.
 * Falls back to heuristic extraction of bullet-like lines starting with "-".
 */
function extractRequirements(jdRaw: string): { hard: string[]; preferred: string[] } {
  const hard: string[] = [];
  const preferred: string[] = [];

  const blocks = splitRequirementBlocks(jdRaw);
  for (const { type, text } of blocks) {
    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/^[\s•·\-–—\*\d.)]+/, "").trim())
      .filter((l) => l.length > 4 && l.length < 300);
    for (const line of lines) {
      (type === "hard" ? hard : preferred).push(line);
    }
  }

  // Dedup + cap length for prompt use.
  const dedup = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.replace(/\s+/g, " ").trim())));
  return { hard: dedup(hard).slice(0, 12), preferred: dedup(preferred).slice(0, 10) };
}

function splitRequirementBlocks(
  jd: string
): Array<{ type: "hard" | "preferred"; text: string }> {
  const HEADINGS: Array<{ type: "hard" | "preferred"; re: RegExp }> = [
    { type: "hard", re: /\b(required|minimum|must[\s-]have|basic)\s+(qualifications|requirements|skills)?\s*:?/i },
    { type: "hard", re: /\bwhat\s+you\s+(bring|need)\s*:?/i },
    { type: "preferred", re: /\b(preferred|nice[\s-]to[\s-]have|bonus|desired)\s+(qualifications|requirements|skills)?\s*:?/i },
  ];

  const blocks: Array<{ type: "hard" | "preferred"; text: string }> = [];
  for (const { type, re } of HEADINGS) {
    const m = re.exec(jd);
    if (!m) continue;
    const start = m.index + m[0].length;
    // Block continues until the next heading or 1200 chars.
    const rest = jd.slice(start);
    let end = rest.search(
      /\b(required|preferred|nice[\s-]to[\s-]have|bonus|desired|what\s+you|responsibilities|about\s+the\s+role|how\s+you'll|benefits)\b/i
    );
    if (end === -1 || end > 1200) end = Math.min(rest.length, 1200);
    blocks.push({ type, text: rest.slice(0, end) });
  }
  return blocks;
}

function detectClusters(jd: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [cluster, terms] of Object.entries(SKILL_CLUSTERS)) {
    const present = terms.filter((t) => jd.includes(t));
    if (present.length > 0) result[cluster] = present;
  }
  return result;
}

function detectTools(jd: string): string[] {
  const tools = new Set<string>();
  for (const terms of Object.values(SKILL_CLUSTERS)) {
    for (const t of terms) {
      if (/^[a-z][a-z0-9 .+\-/#]*$/i.test(t) && jd.includes(t)) {
        // Skip generic umbrella terms, keep product names.
        if (t.length > 2 && !/^(grc|iam|siem|soc|edr|xdr|ids|ips|vpn|pam|sso|mfa|sast|dast|iast|ml|ai)$/i.test(t)) {
          tools.add(titleCase(t));
        }
      }
    }
  }
  return [...tools].slice(0, 20);
}

function detectDomains(jd: string): string[] {
  const out: string[] = [];
  for (const [d, terms] of Object.entries(DOMAIN_LIB)) {
    if (terms.some((t) => jd.includes(t))) out.push(d);
  }
  return out;
}

function mustNotMissFromClusters(clusters: Record<string, string[]>): string[] {
  // The "most specific" term from each cluster — usually the first
  // product name (e.g. "Splunk" rather than "siem"). Fall back to the
  // cluster label itself if no specific term was matched.
  const out: string[] = [];
  for (const [cluster, terms] of Object.entries(clusters)) {
    const specific = terms.find((t) => !/^[a-z]{2,5}$/.test(t));
    out.push(titleCase(specific || cluster));
  }
  return out;
}

function buildRecruiterIntent(args: {
  roleFamily: string | null;
  seniority: JdAnalysis["seniority"];
  clusters: Record<string, string[]>;
  domains: string[];
  tools: string[];
}): string {
  const parts: string[] = [];
  if (args.seniority) parts.push(`${args.seniority}-level`);
  if (args.roleFamily) parts.push(args.roleFamily);
  const clusterNames = Object.keys(args.clusters).slice(0, 3);
  if (clusterNames.length > 0) parts.push(`hands-on with ${clusterNames.join(", ")}`);
  if (args.domains.length > 0) parts.push(`grounded in ${args.domains.slice(0, 2).join(" / ")}`);
  if (args.tools.length > 0) parts.push(`familiarity with ${args.tools.slice(0, 3).join(", ")}`);
  return parts.length > 0
    ? `Looking for a ${parts.join(", ")}.`
    : "Insufficient signal in the JD to infer recruiter intent.";
}

function normalizeRoleTitle(
  raw: string,
  seniority: JdAnalysis["seniority"]
): string {
  let title = (raw || "").trim();
  if (!title) return "";
  // Strip surrounding punctuation / parentheticals.
  title = title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  // Prepend seniority if the title doesn't already carry one.
  if (seniority && seniority !== "mid") {
    const alreadyHasSeniority = /^(senior|staff|lead|principal|junior|manager|director)/i.test(title);
    if (!alreadyHasSeniority) {
      const prefix = {
        senior: "Senior ",
        lead: "Lead ",
        management: "",
        junior: "Junior ",
        mid: "",
      }[seniority];
      if (prefix) title = prefix + title;
    }
  }
  return title;
}

function inferTitleFromJd(jd: string): string {
  // Take the longest "X Engineer/Analyst/Specialist/Manager" phrase seen.
  const re =
    /\b([A-Za-z][A-Za-z\s/&-]{2,40}\s+(?:engineer|analyst|specialist|manager|architect|consultant|administrator))\b/gi;
  const matches = [...jd.matchAll(re)].map((m) => m[1]);
  if (matches.length === 0) return "";
  matches.sort((a, b) => b.length - a.length);
  return titleCase(matches[0]);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}
