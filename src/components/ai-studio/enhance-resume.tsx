"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Save,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchScoreCard } from "@/components/applications/match-score-card";
import type { ScoreBreakdown } from "@/lib/match-scoring";
import { computeWordDiff, type DiffSpan } from "@/lib/text-diff";

// ── types ──

interface BaseResume {
  id: string;
  name: string;
  roleCategory: string | null;
  fileType: string;
}

interface SectionData {
  kind: string;
  title: string;
  lines: string[];
  modifiable: boolean;
}

interface EnhanceResult {
  original: { sections: SectionData[]; text: string };
  enhanced: { sections: SectionData[]; text: string };
  resumeName: string;
  fileName: string;
  emphasizeTokens?: string[];
  engine?: {
    kind: string;
    label: string;
    providerConfigured: boolean;
    providerName: string | null;
    providerModel: string | null;
    note: string;
  };
}

interface Recommendation {
  rewriteIntensity: "light" | "moderate" | "aggressive";
  noNewSkills: boolean;
  preserveLength: boolean;
  prioritizeRecent: boolean;
  strongSummaryRewrite: boolean;
  emphasizeTechnicalStack: boolean;
  focusDomain?: string;
  reasons: string[];
}

type ToastData = { message: string; variant: "success" | "error" };

interface EnhanceResumeProps {
  resumes: BaseResume[];
  resumesLoading: boolean;
  onToast: (data: ToastData) => void;
  initialRole?: string;
  initialCompany?: string;
  initialJobDescription?: string;
  initialResumeId?: string;
  applicationId?: string;
  currentScore?: number | null;
}

// Canonical sections the user can pick to enhance.
const SECTION_CHOICES = [
  { kind: "summary", label: "Profile Summary" },
  { kind: "skills", label: "Technical Skills" },
  { kind: "experience", label: "Work Experience" },
  { kind: "certifications", label: "Certifications" },
] as const;

const FULL_RESUME_SECTIONS = new Set(SECTION_CHOICES.map((s) => s.kind));

const SECTION_LABELS: Record<string, string> = {
  header: "Header",
  summary: "Profile Summary",
  skills: "Technical Skills",
  experience: "Work Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  other: "Other",
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<Step, string> = {
  1: "Review context",
  2: "Current score",
  3: "Rules",
  4: "Enhance",
  5: "Compare",
  6: "Save",
};

export function EnhanceResume({
  resumes,
  resumesLoading,
  onToast,
  initialRole,
  initialCompany,
  initialJobDescription,
  initialResumeId,
  applicationId,
  currentScore,
}: EnhanceResumeProps) {
  const [selectedResume, setSelectedResume] = useState(initialResumeId || "");
  const [role, setRole] = useState(initialRole || "");
  const [company, setCompany] = useState(initialCompany || "");
  const [jobDescription, setJobDescription] = useState(initialJobDescription || "");

  useEffect(() => {
    if (initialRole && !role) setRole(initialRole);
    if (initialCompany && !company) setCompany(initialCompany);
    if (initialJobDescription && !jobDescription) setJobDescription(initialJobDescription);
    if (initialResumeId && !selectedResume) setSelectedResume(initialResumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole, initialCompany, initialJobDescription, initialResumeId]);

  const [step, setStep] = useState<Step>(1);

  // Section selection — the user must choose which sections to enhance
  // before proceeding past step 3.
  const [sectionsToEnhance, setSectionsToEnhance] = useState<Set<string>>(new Set());

  // Rules
  const [noNewSkills, setNoNewSkills] = useState(false);
  const [preserveLength, setPreserveLength] = useState(false);
  const [prioritizeRecent, setPrioritizeRecent] = useState(true);
  const [strongSummaryRewrite, setStrongSummaryRewrite] = useState(false);
  const [rewriteIntensity, setRewriteIntensity] =
    useState<"light" | "moderate" | "aggressive">("moderate");

  // Rule recommendations
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationDecision, setRecommendationDecision] =
    useState<"pending" | "accepted" | "modified" | "rejected">("pending");
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Enhance / result
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [previewMode, setPreviewMode] = useState<"enhanced" | "original" | "diff">("enhanced");

  // Scoring
  const [baselineScore, setBaselineScore] = useState<ScoreBreakdown | null>(null);
  const [afterScore, setAfterScore] = useState<ScoreBreakdown | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);

  // Save / download
  const [savingToApp, setSavingToApp] = useState(false);
  const [savedToApp, setSavedToApp] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const docxResumes = resumes.filter((r) => r.fileType === "docx");
  const selectedObj = resumes.find((r) => r.id === selectedResume);

  // If the caller supplied a cached active score (from an application
  // context), show it on Step 1 so the user can decide whether to continue
  // without waiting for the baseline fetch.
  const hasCachedActiveScore = currentScore != null;

  const contextReady = !!(
    selectedResume &&
    role.trim() &&
    company.trim() &&
    jobDescription.trim()
  );

  // ── step 2: fetch baseline score ──
  //
  // Uses the same scoring engine as every other screen (see
  // /api/ai/match-score). The resume text comes from parsing the selected
  // base resume via /api/ai/recommend-rules which parses the DOCX.
  useEffect(() => {
    if (step !== 2 || !contextReady || baselineScore) return;
    let cancelled = false;
    setBaselineLoading(true);
    fetch("/api/ai/recommend-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeId: selectedResume,
        jobDescription: jobDescription.trim(),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.score) setBaselineScore(data.score);
        if (data.recommendation) setRecommendation(data.recommendation);
      })
      .finally(() => {
        if (!cancelled) setBaselineLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, contextReady]);

  // ── rule recommendations ──

  const fetchRecommendations = async () => {
    if (!selectedResume || !jobDescription.trim()) return;
    setLoadingRecs(true);
    try {
      const res = await fetch("/api/ai/recommend-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResume,
          jobDescription: jobDescription.trim(),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRecommendation(data.recommendation);
      if (data.score) setBaselineScore(data.score);
      setRecommendationDecision("pending");
    } catch {
      /* non-critical */
    } finally {
      setLoadingRecs(false);
    }
  };

  const applyRecommendation = (rec: Recommendation) => {
    setRewriteIntensity(rec.rewriteIntensity);
    setNoNewSkills(rec.noNewSkills);
    setPreserveLength(rec.preserveLength);
    setPrioritizeRecent(rec.prioritizeRecent);
    setStrongSummaryRewrite(rec.strongSummaryRewrite);
  };

  const onAcceptRecs = () => {
    if (!recommendation) return;
    applyRecommendation(recommendation);
    setRecommendationDecision("accepted");
  };
  const onRejectRecs = () => {
    setRecommendationDecision("rejected");
  };

  // ── section toggles ──

  const toggleSection = (kind: string) => {
    setSectionsToEnhance((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };
  const selectFullResume = () => {
    setSectionsToEnhance(new Set(FULL_RESUME_SECTIONS));
  };
  const isFullResumeSelected =
    FULL_RESUME_SECTIONS.size === sectionsToEnhance.size &&
    [...FULL_RESUME_SECTIONS].every((s) => sectionsToEnhance.has(s));

  // ── step 4: enhance ──

  const handleEnhance = async () => {
    if (!contextReady || sectionsToEnhance.size === 0) return;
    setEnhancing(true);
    setError("");
    setResult(null);
    setAfterScore(null);

    try {
      const res = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResume,
          jobDescription: jobDescription.trim(),
          role: role.trim(),
          company: company.trim(),
          sectionsToEnhance: [...sectionsToEnhance],
          rules: {
            noNewSkills,
            preserveLength,
            rewriteIntensity,
            prioritizeRecent,
            strongSummaryRewrite,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Enhancement failed");
        setEnhancing(false);
        return;
      }

      const data: EnhanceResult = await res.json();
      setResult(data);
      setPreviewMode("enhanced");

      // Always compute before + after score from the SAME scoring engine,
      // feeding the SAME base-resume-derived text as the baseline.
      try {
        const [bRes, aRes] = await Promise.all([
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobDescription: jobDescription.trim(),
              resumeText: data.original.text,
              jobTitle: role.trim(),
              company: company.trim(),
            }),
          }),
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobDescription: jobDescription.trim(),
              resumeText: data.enhanced.text,
              jobTitle: role.trim(),
              company: company.trim(),
            }),
          }),
        ]);
        if (bRes.ok) setBaselineScore(await bRes.json());
        if (aRes.ok) setAfterScore(await aRes.json());
      } catch {
        /* scoring is non-critical */
      }

      onToast({ message: "Resume enhanced", variant: "success" });
      setStep(5);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setEnhancing(false);
    }
  };

  // ── step 6: save / download ──

  const handleDownload = async (format: "docx" | "pdf" = "docx") => {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/ai/enhance/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: result.enhanced.sections,
          fileName: result.fileName,
          format,
          emphasizeTokens: result.emphasizeTokens || [],
        }),
      });

      if (!res.ok) {
        onToast({ message: "Download failed", variant: "error" });
        setDownloading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = result.fileName.replace(/\.(docx|pdf)$/i, "");
      a.download = `${baseName}_enhanced.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onToast({ message: `${format.toUpperCase()} downloaded`, variant: "success" });
    } catch {
      onToast({ message: "Download failed", variant: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const copyPreview = () => {
    if (!result) return;
    const text = previewMode === "enhanced" ? result.enhanced.text : result.original.text;
    navigator.clipboard.writeText(text);
    onToast({ message: "Copied to clipboard", variant: "success" });
  };

  const handleSaveToApplication = async () => {
    if (!result) return;
    setSavingToApp(true);
    try {
      let targetAppId = applicationId;

      if (!targetAppId) {
        const appRes = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobTitle: role.trim(),
            company: company.trim(),
            jobDescription: jobDescription.trim(),
            status: "not_applied",
            baseResumeId: selectedResume || undefined,
          }),
        });
        if (!appRes.ok) {
          onToast({ message: "Failed to create application", variant: "error" });
          setSavingToApp(false);
          return;
        }
        const app = await appRes.json();
        targetAppId = app.id;
      }

      // Always create a new ResumeVersion — base resumes are never
      // overwritten, every enhancement becomes its own versioned record.
      await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: targetAppId,
          baseResumeId: selectedResume || undefined,
          content: result.enhanced.text,
          isTailored: true,
        }),
      });

      setSavedToApp(true);
      onToast({
        message: applicationId
          ? "Enhanced resume saved as new version on this application"
          : "Saved as new application with enhanced resume",
        variant: "success",
      });
    } catch {
      onToast({ message: "Save failed", variant: "error" });
    } finally {
      setSavingToApp(false);
    }
  };

  // ── step gating ──

  const canAdvanceFrom = useCallback(
    (s: Step): boolean => {
      switch (s) {
        case 1:
          return contextReady;
        case 2:
          return true;
        case 3:
          return (
            sectionsToEnhance.size > 0 &&
            (recommendation === null || recommendationDecision !== "pending")
          );
        case 4:
          return !!result;
        case 5:
          return !!result;
        case 6:
        default:
          return true;
      }
    },
    [contextReady, sectionsToEnhance.size, recommendation, recommendationDecision, result]
  );

  const goNext = () => setStep((s) => (s < 6 ? ((s + 1) as Step) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const stepper = (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {([1, 2, 3, 4, 5, 6] as Step[]).map((s, idx) => (
        <React.Fragment key={s}>
          <button
            type="button"
            onClick={() => {
              // Allow jumping backward freely; forward only if all previous
              // gates have been satisfied.
              if (s <= step) {
                setStep(s);
                return;
              }
              for (let i = step; i < s; i++) {
                if (!canAdvanceFrom(i as Step)) return;
              }
              setStep(s);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
              s === step
                ? "bg-blue-600 text-white"
                : s < step
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "bg-gray-100 text-gray-500"
            )}
          >
            <span
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold",
                s === step
                  ? "bg-white/30"
                  : s < step
                    ? "bg-blue-200"
                    : "bg-gray-200"
              )}
            >
              {s}
            </span>
            <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
          </button>
          {idx < 5 && <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );

  // ── renderers per step ──

  const renderStep1 = () => (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Review application context</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            We use these exact values for enhancement — no need to re-enter them later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadonlyField label="Role" value={role} placeholder="No role provided" highlight />
          <ReadonlyField label="Company" value={company} placeholder="No company provided" highlight />
        </div>

        <div className="space-y-1.5">
          <Label>
            Base Resume (DOCX) <span className="text-red-500">*</span>
          </Label>
          {resumesLoading ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : docxResumes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 text-center">
              <p className="text-xs text-gray-500">No DOCX resumes in your library</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Enhancement needs a DOCX source (PDF parsing is not supported)
              </p>
            </div>
          ) : (
            <Select value={selectedResume} onValueChange={setSelectedResume}>
              <SelectTrigger>
                <SelectValue placeholder="Select a DOCX resume" />
              </SelectTrigger>
              <SelectContent>
                {docxResumes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.roleCategory && (
                      <span className="text-gray-400 text-xs ml-1">· {r.roleCategory}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedObj && (
            <p className="text-[11px] text-gray-500 mt-1">
              Using: <span className="font-medium text-gray-700">{selectedObj.name}</span>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Job Description (prefilled from application)</Label>
          <div className="max-h-36 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
            {jobDescription.trim() || (
              <span className="text-gray-400 italic">No job description set</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            {jobDescription.length.toLocaleString()} characters
          </p>
        </div>

        {hasCachedActiveScore && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2">
            <div className="text-xs text-emerald-900">
              <span className="font-semibold">Active Resume Score:</span>{" "}
              {currentScore}%
            </div>
          </div>
        )}

        {!contextReady && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Missing required context. Pick a base resume and make sure the
              application has a role, company, and job description set.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Current match score</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Calculated against the selected base resume using the same scoring
            engine as the rest of the app.
          </p>
        </div>

        {baselineLoading ? (
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Scoring base resume against the JD...</p>
          </div>
        ) : baselineScore ? (
          <MatchScoreCard
            overallScore={baselineScore.overallScore}
            skillsMatch={baselineScore.skillsMatch}
            experienceMatch={baselineScore.experienceMatch}
            keywordCoverage={baselineScore.keywordCoverage}
            domainMatch={baselineScore.domainMatch}
            documentLabel="Base Resume"
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            No baseline yet — advance to the next step to continue.
          </div>
        )}

        {baselineScore && baselineScore.overallScore < 95 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Gap of {95 - baselineScore.overallScore} points to target (95%)
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                We&apos;ll recommend specific rules in the next step to help close it.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Rules & sections</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick the sections to enhance. Accept, modify, or reject the
            recommended optimization rules before proceeding.
          </p>
        </div>

        {/* Section picker */}
        <div>
          <Label>Select sections to enhance</Label>
          <div className="space-y-1.5 mt-1.5">
            {SECTION_CHOICES.map(({ kind, label }) => (
              <label
                key={kind}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                  sectionsToEnhance.has(kind)
                    ? "border-blue-200 bg-blue-50/50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={sectionsToEnhance.has(kind)}
                  onChange={() => toggleSection(kind)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">{label}</span>
              </label>
            ))}
            <label
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                isFullResumeSelected
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              )}
            >
              <input
                type="checkbox"
                checked={isFullResumeSelected}
                onChange={() =>
                  isFullResumeSelected
                    ? setSectionsToEnhance(new Set())
                    : selectFullResume()
                }
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-semibold text-gray-900">Full Resume</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                all of the above
              </Badge>
            </label>
          </div>
          {sectionsToEnhance.size === 0 && (
            <p className="text-[11px] text-amber-700 mt-2">
              Pick at least one section to continue.
            </p>
          )}
        </div>

        {/* Rule recommendations */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <Label>Recommended optimization rules</Label>
            {!recommendation ? (
              <button
                type="button"
                onClick={fetchRecommendations}
                disabled={loadingRecs}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {loadingRecs ? "Analyzing..." : "Generate recommendations"}
              </button>
            ) : (
              <Badge
                variant={
                  recommendationDecision === "accepted"
                    ? "success"
                    : recommendationDecision === "modified"
                      ? "info"
                      : recommendationDecision === "rejected"
                        ? "secondary"
                        : "outline"
                }
                className="text-[10px]"
              >
                {recommendationDecision === "pending"
                  ? "Awaiting decision"
                  : recommendationDecision === "accepted"
                    ? "Accepted"
                    : recommendationDecision === "modified"
                      ? "Modified"
                      : "Rejected"}
              </Badge>
            )}
          </div>

          {recommendation ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-[11px] text-blue-900">
                <RecLine label="Intensity" value={recommendation.rewriteIntensity} />
                <RecLine
                  label="Preserve length"
                  value={recommendation.preserveLength ? "yes" : "no"}
                />
                <RecLine
                  label="Add new skills"
                  value={recommendation.noNewSkills ? "no" : "yes"}
                />
                <RecLine
                  label="Prioritize recent roles"
                  value={recommendation.prioritizeRecent ? "yes" : "no"}
                />
                <RecLine
                  label="Strong summary rewrite"
                  value={recommendation.strongSummaryRewrite ? "yes" : "no"}
                />
                {recommendation.focusDomain && (
                  <RecLine label="Focus domain" value={recommendation.focusDomain} />
                )}
              </ul>
              {recommendation.reasons.length > 0 && (
                <div className="pt-2 border-t border-blue-200/50">
                  <p className="text-[10px] text-blue-700 uppercase tracking-wider mb-1">
                    Why
                  </p>
                  <ul className="space-y-0.5">
                    {recommendation.reasons.map((r, i) => (
                      <li key={i} className="text-[11px] text-blue-800 leading-relaxed">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="primary"
                  className="h-7"
                  onClick={onAcceptRecs}
                  disabled={recommendationDecision === "accepted"}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    applyRecommendation(recommendation);
                    setRecommendationDecision("modified");
                  }}
                >
                  Modify manually
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={onRejectRecs}>
                  Reject
                </Button>
                <button
                  type="button"
                  onClick={fetchRecommendations}
                  className="text-[11px] text-blue-600 hover:text-blue-700 ml-auto"
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500">
                {loadingRecs
                  ? "Analyzing JD and base resume..."
                  : 'Click "Generate recommendations" to analyze your JD and resume.'}
              </p>
            </div>
          )}
        </div>

        {/* Manual rule controls (always visible so a rejecting user can still tune) */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <Label>Rules</Label>
          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-500">Rewrite intensity</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["light", "moderate", "aggressive"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setRewriteIntensity(v);
                    if (recommendation && recommendationDecision === "accepted") {
                      setRecommendationDecision("modified");
                    }
                  }}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium border transition-colors capitalize",
                    rewriteIntensity === v
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <RuleToggle
            label="Don't add new skills"
            value={noNewSkills}
            onChange={(v) => {
              setNoNewSkills(v);
              if (recommendation && recommendationDecision === "accepted") {
                setRecommendationDecision("modified");
              }
            }}
          />
          <RuleToggle
            label="Preserve original length"
            value={preserveLength}
            onChange={(v) => {
              setPreserveLength(v);
              if (recommendation && recommendationDecision === "accepted") {
                setRecommendationDecision("modified");
              }
            }}
          />
          <RuleToggle
            label="Prioritize recent roles"
            value={prioritizeRecent}
            onChange={(v) => {
              setPrioritizeRecent(v);
              if (recommendation && recommendationDecision === "accepted") {
                setRecommendationDecision("modified");
              }
            }}
          />
          <RuleToggle
            label="Strong summary rewrite"
            value={strongSummaryRewrite}
            onChange={(v) => {
              setStrongSummaryRewrite(v);
              if (recommendation && recommendationDecision === "accepted") {
                setRecommendationDecision("modified");
              }
            }}
          />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
          <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <span className="font-semibold">Preserved:</span> Name, contact
            details, company names, dates, education, and certifications are
            never modified.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Enhance resume</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Applies the selected rules to the chosen sections, preserving the
            base resume structure (PROFILE SUMMARY → TECHNICAL SKILLS →
            EDUCATION → WORK EXPERIENCE → CERTIFICATIONS).
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-2">
          <SummaryRow label="Base resume" value={selectedObj?.name || "—"} />
          <SummaryRow label="Target role" value={role} />
          <SummaryRow label="Target company" value={company} />
          <SummaryRow
            label="Sections"
            value={[...sectionsToEnhance]
              .map((s) => SECTION_LABELS[s] || s)
              .join(", ")}
          />
          <SummaryRow
            label="Intensity"
            value={rewriteIntensity[0].toUpperCase() + rewriteIntensity.slice(1)}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          onClick={handleEnhance}
          disabled={
            enhancing || !contextReady || sectionsToEnhance.size === 0
          }
        >
          {enhancing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Parsing &amp; enhancing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Enhance Resume
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderStep5 = () => {
    if (!result) {
      return (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Run enhancement first.
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {/* Engine / provider status */}
        {result.engine && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
            <div>
              <span className="font-medium text-gray-700">{result.engine.label}</span>
              {result.engine.providerConfigured ? (
                <span className="text-gray-500">
                  {" "}
                  · provider configured: {result.engine.providerName}
                  {result.engine.providerModel ? ` (${result.engine.providerModel})` : ""}
                </span>
              ) : (
                <span className="text-gray-500"> · no external AI provider configured</span>
              )}
              <p className="mt-0.5 text-gray-500 leading-relaxed">{result.engine.note}</p>
            </div>
          </div>
        )}

        {/* Score comparison with Base / Enhanced / Active labels */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Before vs After
              </p>
              {afterScore && baselineScore && afterScore.overallScore > baselineScore.overallScore && (
                <Badge variant="success" className="text-[10px]">
                  +{afterScore.overallScore - baselineScore.overallScore}% improvement
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {baselineScore && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                    Base Resume Score
                  </p>
                  <MatchScoreCard
                    overallScore={baselineScore.overallScore}
                    skillsMatch={baselineScore.skillsMatch}
                    experienceMatch={baselineScore.experienceMatch}
                    keywordCoverage={baselineScore.keywordCoverage}
                    domainMatch={baselineScore.domainMatch}
                    compact
                  />
                </div>
              )}
              {afterScore && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                  <p className="text-[10px] text-blue-600 uppercase tracking-wider mb-2">
                    Enhanced Resume Score
                  </p>
                  <MatchScoreCard
                    overallScore={afterScore.overallScore}
                    skillsMatch={afterScore.skillsMatch}
                    experienceMatch={afterScore.experienceMatch}
                    keywordCoverage={afterScore.keywordCoverage}
                    domainMatch={afterScore.domainMatch}
                    compact
                  />
                </div>
              )}
            </div>
            {afterScore && afterScore.overallScore < 95 && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-900">
                    Still below 95% ({afterScore.overallScore}%)
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Try a higher intensity or enable more sections and enhance again.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-7 shrink-0"
                  onClick={() => setStep(3)}
                >
                  Adjust rules
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {(["enhanced", "diff", "original"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPreviewMode(m)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                    previewMode === m
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {result.resumeName}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={copyPreview}>
              <Copy className="w-3 h-3 mr-1.5" />
              Copy
            </Button>
          </div>
        </div>

        {/* Sections preview */}
        <Card>
          <CardContent className="p-0 divide-y divide-gray-100">
            {previewMode === "diff"
              ? result.enhanced.sections.map((section, i) => {
                  const origSection = result.original.sections[i];
                  const origText = origSection ? origSection.lines.join("\n") : "";
                  const enhText = section.lines.join("\n");
                  const diffSpans = sectionsToEnhance.has(section.kind)
                    ? computeWordDiff(origText, enhText)
                    : null;
                  return (
                    <SectionPreview
                      key={`${section.kind}-${i}`}
                      section={section}
                      isEnhanced={sectionsToEnhance.has(section.kind)}
                      diffSpans={diffSpans}
                    />
                  );
                })
              : (previewMode === "enhanced"
                  ? result.enhanced.sections
                  : result.original.sections
                ).map((section, i) => (
                  <SectionPreview
                    key={`${section.kind}-${i}`}
                    section={section}
                    isEnhanced={
                      previewMode === "enhanced" &&
                      sectionsToEnhance.has(section.kind)
                    }
                  />
                ))}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderStep6 = () => (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Save & download</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Saves the enhanced resume as a <span className="font-medium">new ResumeVersion</span>{" "}
            on {applicationId ? "this application" : "a new application"}. Your
            base resume stays untouched in the Resume Library.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => handleDownload("pdf")}
            disabled={downloading || !result}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => handleDownload("docx")}
            disabled={downloading || !result}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download DOCX
          </Button>
        </div>

        {!savedToApp ? (
          <Button
            variant="primary"
            className="w-full h-10"
            onClick={handleSaveToApplication}
            disabled={savingToApp || !result}
          >
            {savingToApp ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {applicationId ? "Save as new version on this application" : "Save as new application"}
          </Button>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-[11px] text-blue-900 leading-relaxed flex gap-2">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Versioning guarantee</p>
            <p>
              Base resumes are never overwritten. Every enhancement is stored
              as a separate ResumeVersion record linked to the application,
              so you can always go back to the original.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ── stable list of step gates used by navigation buttons ──

  const nextDisabled = useMemo(() => !canAdvanceFrom(step), [step, canAdvanceFrom]);

  return (
    <div className="space-y-4">
      {stepper}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
      {step === 6 && renderStep6()}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goBack} disabled={step === 1}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back
        </Button>
        {step < 6 && (
          <Button
            variant={step === 4 ? "outline" : "primary"}
            size="sm"
            onClick={goNext}
            disabled={nextDisabled}
          >
            Next
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── small helpers ──

function ReadonlyField({
  label,
  value,
  placeholder,
  highlight,
}: {
  label: string;
  value: string;
  placeholder?: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div
        className={cn(
          "text-sm rounded-lg border px-3 py-2",
          highlight
            ? "border-blue-200 bg-blue-50/40 text-gray-900 font-medium"
            : "border-gray-200 bg-gray-50/50 text-gray-700"
        )}
      >
        {value?.trim() || (
          <span className="text-gray-400 italic font-normal">{placeholder || "—"}</span>
        )}
      </div>
    </div>
  );
}

function RecLine({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <span className="font-medium">{label}:</span> {value}
    </li>
  );
}

function RuleToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function SectionPreview({
  section,
  isEnhanced,
  diffSpans,
}: {
  section: SectionData;
  isEnhanced: boolean;
  diffSpans?: DiffSpan[] | null;
}) {
  const label = SECTION_LABELS[section.kind] || section.title || "Section";

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h4>
        {isEnhanced ? (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            Enhanced
          </Badge>
        ) : section.modifiable ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Unchanged
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <Lock className="w-2.5 h-2.5 mr-0.5" />
            Preserved
          </Badge>
        )}
      </div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {diffSpans ? (
          <p>
            {diffSpans.map((span, i) => {
              if (span.type === "added")
                return (
                  <span key={i} className="bg-emerald-100 text-emerald-800 rounded-sm px-0.5">
                    {span.text}
                  </span>
                );
              if (span.type === "removed")
                return (
                  <span key={i} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">
                    {span.text}
                  </span>
                );
              return <span key={i}>{span.text}</span>;
            })}
          </p>
        ) : section.lines.filter(Boolean).length > 0 ? (
          section.lines.map((line, i) => (
            <p key={i} className={cn("mb-1", !line && "h-2")}>
              {line}
            </p>
          ))
        ) : (
          <p className="text-gray-400 italic text-xs">Empty section</p>
        )}
      </div>
    </div>
  );
}

export type { EnhanceResumeProps };
