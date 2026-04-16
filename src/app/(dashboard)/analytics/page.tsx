"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { getStatusLabel } from "@/lib/utils";
import {
  Briefcase,
  TrendingUp,
  Target,
  Award,
  BarChart3,
  Send,
  XCircle,
  ArrowRight,
  Plus,
  Flame,
  Trophy,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── colors ──

const STATUS_COLORS: Record<string, string> = {
  not_applied: "#d1d5db",
  saved: "#93c5fd",
  applied: "#818cf8",
  screening: "#a78bfa",
  interview: "#fbbf24",
  offer: "#34d399",
  rejected: "#f87171",
  archived: "#9ca3af",
};

const FUNNEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981"];

// ── types ──

interface AnalyticsData {
  statusDistribution: { name: string; value: number }[];
  weeklyActivity: { name: string; applications: number }[];
  funnel: { stage: string; count: number }[];
  conversionRates: {
    applicationToScreening: number;
    screeningToInterview: number;
    interviewToOffer: number;
    responseRate: number;
  };
  totalApplications: number;
  activeApplications: number;
  appliedCount: number;
  rejectedCount: number;
  offerCount: number;
  interviewRate: number;
  offerRate: number;
  responseRate: number;
  topCompanies: { company: string; count: number }[];
  gamification: {
    streak: number;
    thisWeekApps: number;
    weeklyGoal: number;
    milestones: { label: string; target: number; reached: boolean }[];
  };
}

// ── custom tooltip ──

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; payload?: Record<string, unknown> }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold text-gray-900">
          {entry.value}{suffix || ""}
        </p>
      ))}
    </div>
  );
}

// ── page ──

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[104px] bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── empty state ──
  if (data.totalApplications === 0) {
    return (
      <>
        <PageHeader title="Analytics" description="Track your job search performance" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <BarChart3 className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              No data yet
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
              Add some applications to see your job search analytics here.
            </p>
            <Link href="/applications">
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Applications
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  const pieData = data.statusDistribution.map((item) => ({
    ...item,
    displayName: getStatusLabel(item.name),
    fill: STATUS_COLORS[item.name] || "#d1d5db",
  }));

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const statCards = [
    {
      label: "Total Applications",
      value: data.totalApplications,
      icon: Briefcase,
      color: "text-blue-600 bg-blue-50",
      sub: `${data.activeApplications} active`,
    },
    {
      label: "Applied",
      value: data.appliedCount,
      icon: Send,
      color: "text-indigo-600 bg-indigo-50",
      sub: `${data.responseRate}% response rate`,
    },
    {
      label: "Interview Rate",
      value: `${data.interviewRate}%`,
      icon: Target,
      color: "text-purple-600 bg-purple-50",
      sub: `${data.offerCount} offer${data.offerCount !== 1 ? "s" : ""}`,
    },
    {
      label: "Rejected",
      value: data.rejectedCount,
      icon: XCircle,
      color: "text-red-500 bg-red-50",
      sub: `${data.offerRate}% offer rate`,
    },
  ];

  // Funnel max for width scaling
  const funnelMax = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Track your job search performance"
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
                <div className={cn("p-2 rounded-xl", stat.color)}>
                  <stat.icon className="w-4.5 h-4.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ── Custom Funnel ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Application Funnel</CardTitle>
            <CardDescription>Progression through pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.funnel.map((item, i) => {
                const pct = funnelMax > 0 ? (item.count / funnelMax) * 100 : 0;
                const convPct =
                  i > 0 && data.funnel[i - 1].count > 0
                    ? Math.round((item.count / data.funnel[i - 1].count) * 100)
                    : null;

                return (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: FUNNEL_COLORS[i] }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {convPct !== null && (
                          <span className="text-[11px] text-gray-400">
                            {convPct}% of prev
                          </span>
                        )}
                        <span className="text-sm font-bold text-gray-900 tabular-nums w-8 text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`,
                          backgroundColor: FUNNEL_COLORS[i],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Pie Chart ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
            <CardDescription>Current state of all applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-[200px] h-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { displayName: string; value: number };
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
                            <p className="text-xs font-medium text-gray-500">{d.displayName}</p>
                            <p className="text-sm font-bold text-gray-900">
                              {d.value} ({Math.round((d.value / pieTotal) * 100)}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-900">{pieTotal}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Total</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-xs text-gray-600 truncate">
                        {item.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-900 tabular-nums">
                        {item.value}
                      </span>
                      <span className="text-[10px] text-gray-400 w-8 text-right tabular-nums">
                        {Math.round((item.value / pieTotal) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ── Weekly Activity ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Weekly Applications</CardTitle>
            <CardDescription>Applications created per week (last 12 weeks)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.weeklyActivity}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<ChartTooltip suffix=" apps" />} />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke="#3b82f6"
                  fill="url(#areaGradient)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── Conversion Rates ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Conversion Metrics</CardTitle>
            <CardDescription>Stage-to-stage progression rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <ConversionBar
                label="Applied → Screening"
                value={data.conversionRates.applicationToScreening}
                color="#6366f1"
              />
              <ConversionBar
                label="Screening → Interview"
                value={data.conversionRates.screeningToInterview}
                color="#8b5cf6"
              />
              <ConversionBar
                label="Interview → Offer"
                value={data.conversionRates.interviewToOffer}
                color="#10b981"
              />
              <ConversionBar
                label="Response Rate"
                value={data.conversionRates.responseRate}
                color="#3b82f6"
              />
            </div>

            {/* Top companies */}
            {data.topCompanies.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Top Companies
                </p>
                <div className="space-y-2">
                  {data.topCompanies.map((c, i) => (
                    <div key={c.company} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 w-4 tabular-nums">{i + 1}.</span>
                        <span className="text-sm text-gray-700 truncate">{c.company}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {c.count} app{c.count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gamification ── */}
      {data.gamification && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Streak + Weekly Goal */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{data.gamification.streak}</p>
                  <p className="text-xs text-gray-500">Day streak</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Weekly goal</span>
                  <span className="text-xs font-semibold text-gray-900 tabular-nums">
                    {data.gamification.thisWeekApps}/{data.gamification.weeklyGoal}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-700"
                    style={{ width: `${Math.min((data.gamification.thisWeekApps / data.gamification.weeklyGoal) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.gamification.milestones.map((m) => (
                  <div
                    key={m.label}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                      m.reached
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-700"
                        : "border-gray-200 text-gray-400"
                    )}
                  >
                    {m.reached ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" />
                    )}
                    <span className={cn("text-xs font-medium", m.reached ? "text-emerald-700" : "text-gray-500")}>
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// ── conversion bar component ──

function ConversionBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">
          {value}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(value, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
