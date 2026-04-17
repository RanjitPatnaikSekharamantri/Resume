"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Briefcase,
  Key,
  Globe,
  TrendingUp,
  Shield,
  Wrench,
  AlertTriangle,
  Lightbulb,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getScoreColor,
  getScoreBarColor,
  getScoreLabel,
} from "@/lib/match-scoring";
import type { AtsScore } from "@/lib/ats-scoring";

interface MatchScoreCardProps {
  /**
   * Preferred: full ATS score from the new engine. When provided, the card
   * renders the six-dimension /100 breakdown with missing requirements
   * and improvement suggestions.
   */
  ats?: AtsScore | null;
  /**
   * Legacy fields — still accepted so older screens keep working during
   * the migration. If `ats` is provided, these are ignored.
   */
  overallScore?: number;
  skillsMatch?: number | null;
  experienceMatch?: number | null;
  keywordCoverage?: number | null;
  domainMatch?: number | null;

  compact?: boolean;
  /** "Base Resume" / "Enhanced Resume" / "Current Active Resume" etc. */
  documentLabel?: string;
}

export function MatchScoreCard(props: MatchScoreCardProps) {
  if (props.ats) return <AtsBreakdownCard {...props} ats={props.ats} />;

  // Legacy path — unchanged visually so older screens keep working while
  // they migrate to the new `ats` prop.
  return <LegacyCard {...props} />;
}

// ── new ATS card ───────────────────────────────────────────────────────

function AtsBreakdownCard({
  ats,
  compact,
  documentLabel,
}: MatchScoreCardProps & { ats: AtsScore }) {
  const overall = ats.overall;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ScoreRing score={overall} size={48} />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {overall}
            <span className="text-xs text-gray-400 font-normal">/100</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {getScoreLabel(overall)} · ATS Fit
          </p>
        </div>
      </div>
    );
  }

  const rows = [
    {
      key: "hard",
      label: "Hard Requirements",
      icon: Shield,
      dim: ats.dimensions.hardRequirements,
      color: "#ef4444",
    },
    {
      key: "keywords",
      label: "Keyword Relevance",
      icon: Key,
      dim: ats.dimensions.keywordRelevance,
      color: "#f59e0b",
    },
    {
      key: "exp",
      label: "Experience Alignment",
      icon: Briefcase,
      dim: ats.dimensions.experienceAlignment,
      color: "#8b5cf6",
    },
    {
      key: "skills",
      label: "Skills Evidence",
      icon: Wrench,
      dim: ats.dimensions.skillsEvidenceQuality,
      color: "#3b82f6",
    },
    {
      key: "domain",
      label: "Domain Alignment",
      icon: Globe,
      dim: ats.dimensions.domainAlignment,
      color: "#10b981",
    },
    {
      key: "readability",
      label: "ATS Readability",
      icon: FileText,
      dim: ats.dimensions.atsReadability,
      color: "#6b7280",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            {documentLabel ? `${documentLabel} Score` : "ATS Fit Score"}
          </CardTitle>
          <Badge
            className={cn(
              "text-xs font-semibold border",
              getScoreColor(overall)
            )}
          >
            {getScoreLabel(overall)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-5">
          <ScoreRing score={overall} size={72} />
          <div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {overall}
              <span className="text-base text-gray-400 font-normal">/100</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Overall ATS fit</p>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map(({ key, label, icon: Icon, dim, color }) => {
            const pct = dim.max > 0 ? (dim.value / dim.max) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">
                    {dim.value}
                    <span className="text-gray-400 font-normal">/{dim.max}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(pct, pct > 0 ? 3 : 0)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                  {dim.reason}
                </p>
              </div>
            );
          })}
        </div>

        {ats.penalties.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
            <p className="text-[10px] text-red-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Penalties
            </p>
            <ul className="space-y-1 text-[11px] text-red-800">
              {ats.penalties.map((p, i) => (
                <li key={i}>
                  <span className="font-semibold">−{p.value}</span> · {p.label}{" "}
                  <span className="text-red-600">— {p.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ats.missingRequirements.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-[10px] text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Missing requirements
            </p>
            <div className="flex flex-wrap gap-1">
              {ats.missingRequirements.map((r, i) => (
                <span
                  key={i}
                  className="text-[11px] rounded-md border border-amber-200 bg-white px-1.5 py-0.5 text-amber-900"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {ats.suggestions.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-[10px] text-blue-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Improvement suggestions
            </p>
            <ul className="space-y-1 text-[11px] text-blue-900 leading-relaxed">
              {ats.suggestions.map((s, i) => (
                <li key={i}>
                  <span className="font-semibold">{s.dimension}:</span>{" "}
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── legacy card (kept for screens that haven't migrated yet) ──────────

function LegacyCard({
  overallScore = 0,
  skillsMatch,
  experienceMatch,
  keywordCoverage,
  domainMatch,
  compact,
  documentLabel,
}: MatchScoreCardProps) {
  const hasBreakdown =
    skillsMatch != null ||
    experienceMatch != null ||
    keywordCoverage != null ||
    domainMatch != null;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ScoreRing score={overallScore} size={48} />
        <div>
          <p className="text-sm font-semibold text-gray-900">{overallScore}%</p>
          <p className="text-[11px] text-gray-500">
            {getScoreLabel(overallScore)} match
          </p>
        </div>
      </div>
    );
  }

  const dimensions = [
    { label: "Skills", value: skillsMatch, weight: "40%", icon: Target, color: "#3b82f6" },
    { label: "Experience", value: experienceMatch, weight: "30%", icon: Briefcase, color: "#8b5cf6" },
    { label: "Keywords", value: keywordCoverage, weight: "20%", icon: Key, color: "#f59e0b" },
    { label: "Domain", value: domainMatch, weight: "10%", icon: Globe, color: "#10b981" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            {documentLabel ? `${documentLabel} Score` : "Match Score"}
          </CardTitle>
          <Badge className={cn("text-xs font-semibold border", getScoreColor(overallScore))}>
            {getScoreLabel(overallScore)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5 mb-5">
          <ScoreRing score={overallScore} size={72} />
          <div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{overallScore}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Overall match</p>
          </div>
        </div>

        {hasBreakdown && (
          <div className="space-y-3">
            {dimensions.map(({ label, value, weight, icon: Icon, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                    <span className="text-[10px] text-gray-400">({weight})</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">
                    {value ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(value ?? 0, (value ?? 0) > 0 ? 3 : 0)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── circular score ring ──

function ScoreRing({ score, size }: { score: number; size: number }) {
  const stroke = size >= 64 ? 5 : 4;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const barColor = getScoreBarColor(score);

  const colorMap: Record<string, string> = {
    "bg-emerald-500": "#10b981",
    "bg-blue-500": "#3b82f6",
    "bg-amber-500": "#f59e0b",
    "bg-red-500": "#ef4444",
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[barColor] || "#3b82f6"}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "font-bold tabular-nums",
            size >= 64 ? "text-lg" : "text-xs"
          )}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ── inline score badge for kanban / list views ──

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold tabular-nums",
        getScoreColor(score)
      )}
    >
      {score}%
    </span>
  );
}
