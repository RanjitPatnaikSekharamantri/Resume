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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getScoreColor,
  getScoreBarColor,
  getScoreLabel,
} from "@/lib/match-scoring";

interface MatchScoreCardProps {
  overallScore: number;
  skillsMatch?: number | null;
  experienceMatch?: number | null;
  keywordCoverage?: number | null;
  domainMatch?: number | null;
  compact?: boolean;
}

export function MatchScoreCard({
  overallScore,
  skillsMatch,
  experienceMatch,
  keywordCoverage,
  domainMatch,
  compact,
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
          <p className="text-[11px] text-gray-500">{getScoreLabel(overallScore)} match</p>
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
            Match Score
          </CardTitle>
          <Badge
            className={cn("text-xs font-semibold border", getScoreColor(overallScore))}
          >
            {getScoreLabel(overallScore)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5 mb-5">
          <ScoreRing score={overallScore} size={72} />
          <div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {overallScore}%
            </p>
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
