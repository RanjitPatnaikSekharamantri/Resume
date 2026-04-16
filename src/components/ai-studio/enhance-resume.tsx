"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  ArrowRight,
  ShieldCheck,
  Pencil,
  Lock,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchScoreCard } from "@/components/applications/match-score-card";
import type { ScoreBreakdown } from "@/lib/match-scoring";

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
}

type ToastData = { message: string; variant: "success" | "error" };

interface EnhanceResumeProps {
  resumes: BaseResume[];
  resumesLoading: boolean;
  onToast: (data: ToastData) => void;
}

const SECTION_LABELS: Record<string, string> = {
  header: "Header",
  summary: "Professional Summary",
  skills: "Skills & Competencies",
  experience: "Professional Experience",
  education: "Education",
  certifications: "Certifications",
  other: "Other",
};

const MODIFIABLE_SECTIONS = ["summary", "skills", "experience"] as const;

export function EnhanceResume({ resumes, resumesLoading, onToast }: EnhanceResumeProps) {
  const [selectedResume, setSelectedResume] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [sectionsToEnhance, setSectionsToEnhance] = useState<Set<string>>(
    new Set(MODIFIABLE_SECTIONS)
  );

  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [previewMode, setPreviewMode] = useState<"enhanced" | "original">("enhanced");
  const [downloading, setDownloading] = useState(false);
  const [beforeScore, setBeforeScore] = useState<ScoreBreakdown | null>(null);
  const [afterScore, setAfterScore] = useState<ScoreBreakdown | null>(null);

  const canEnhance =
    selectedResume && role.trim() && company.trim() && jobDescription.trim();

  const docxResumes = resumes.filter((r) => r.fileType === "docx");
  const selectedObj = resumes.find((r) => r.id === selectedResume);

  const toggleSection = (kind: string) => {
    setSectionsToEnhance((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  // ── enhance handler ──

  const handleEnhance = async () => {
    if (!canEnhance) return;
    setEnhancing(true);
    setError("");
    setResult(null);

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

      // Calculate before/after match scores
      try {
        const [bRes, aRes] = await Promise.all([
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: jobDescription.trim(), resumeText: data.original.text, jobTitle: role.trim(), company: company.trim() }),
          }),
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: jobDescription.trim(), resumeText: data.enhanced.text, jobTitle: role.trim(), company: company.trim() }),
          }),
        ]);
        if (bRes.ok) setBeforeScore(await bRes.json());
        if (aRes.ok) setAfterScore(await aRes.json());
      } catch { /* non-critical */ }

      onToast({ message: "Resume enhanced successfully", variant: "success" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setEnhancing(false);
    }
  };

  // ── download handler ──

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ─── Left: Config ─── */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Enhance Existing Resume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resume select */}
            <div className="space-y-1.5">
              <Label>
                Base Resume (DOCX) <span className="text-red-500">*</span>
              </Label>
              {resumesLoading ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : docxResumes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500">
                    No DOCX resumes found in your library
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    PDF enhancement is not supported — upload a DOCX file
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
                          <span className="text-gray-400 text-xs ml-1">
                            · {r.roleCategory}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Role + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="enh-role">
                  Target Role <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="enh-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Senior Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enh-company">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="enh-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Google"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="enh-jd">
                  Job Description <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {jobDescription.length.toLocaleString()} chars
                </span>
              </div>
              <Textarea
                id="enh-jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={8}
                placeholder="Paste the job description..."
                className="resize-y text-sm"
              />
            </div>

            {/* Sections to enhance */}
            <div className="space-y-2">
              <Label>Sections to Enhance</Label>
              <div className="space-y-1.5">
                {MODIFIABLE_SECTIONS.map((kind) => (
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
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {SECTION_LABELS[kind]}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {kind === "summary" && "Tailor summary to the target role"}
                        {kind === "skills" && "Add missing keywords from the JD"}
                        {kind === "experience" && "Enhance bullet points (last 1–2 roles)"}
                      </p>
                    </div>
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </label>
                ))}
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-semibold">Preserved:</span> Name,
                  company names, dates, education, and certifications are never
                  modified.
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Enhance button */}
            <Button
              variant="primary"
              className="w-full"
              onClick={handleEnhance}
              disabled={enhancing || !canEnhance}
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
      </div>

      {/* ─── Right: Preview ─── */}
      <div className="lg:col-span-3 space-y-4">
        {result ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Toggle original / enhanced */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewMode("enhanced")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      previewMode === "enhanced"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Enhanced
                  </button>
                  <button
                    onClick={() => setPreviewMode("original")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      previewMode === "original"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Original
                  </button>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {result.resumeName}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={copyPreview}
                >
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => handleDownload("pdf")}
                  disabled={downloading}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  PDF
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8"
                  onClick={() => handleDownload("docx")}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  DOCX
                </Button>
              </div>
            </div>

            {/* Score comparison */}
            {(beforeScore || afterScore) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Match Score</p>
                    {afterScore && beforeScore && afterScore.overallScore > beforeScore.overallScore && (
                      <Badge variant="success" className="text-[10px]">+{afterScore.overallScore - beforeScore.overallScore}% improvement</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {beforeScore && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Before</p>
                        <MatchScoreCard overallScore={beforeScore.overallScore} skillsMatch={beforeScore.skillsMatch} experienceMatch={beforeScore.experienceMatch} keywordCoverage={beforeScore.keywordCoverage} domainMatch={beforeScore.domainMatch} compact />
                      </div>
                    )}
                    {afterScore && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                        <p className="text-[10px] text-blue-600 uppercase tracking-wider mb-2">After</p>
                        <MatchScoreCard overallScore={afterScore.overallScore} skillsMatch={afterScore.skillsMatch} experienceMatch={afterScore.experienceMatch} keywordCoverage={afterScore.keywordCoverage} domainMatch={afterScore.domainMatch} compact />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sections preview */}
            <Card>
              <CardContent className="p-0 divide-y divide-gray-100">
                {(previewMode === "enhanced"
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
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Eye className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Resume Preview
              </h3>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Select a DOCX resume and click Enhance to see a side-by-side
                preview of the original and enhanced content.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── section preview card ──

function SectionPreview({
  section,
  isEnhanced,
}: {
  section: SectionData;
  isEnhanced: boolean;
}) {
  const label = SECTION_LABELS[section.kind] || section.title || "Section";

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </h4>
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
        {section.lines.filter(Boolean).length > 0
          ? section.lines.map((line, i) => (
              <p key={i} className={cn("mb-1", !line && "h-2")}>
                {line}
              </p>
            ))
          : (
            <p className="text-gray-400 italic text-xs">Empty section</p>
          )}
      </div>
    </div>
  );
}
