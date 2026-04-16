"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getStatusLabel } from "@/lib/utils";
import { getUserTimezone } from "@/lib/timezone";
import {
  Briefcase,
  Send,
  XCircle,
  Plus,
  Flame,
  Trophy,
  CheckCircle2,
  Circle,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── palette ──

const BLUE = "#2563EB";
const BLUE_LIGHT = "#dbeafe";
const FUNNEL_COLORS = [BLUE, "#4f46e5", "#7c3aed", "#d97706", "#059669"];
const STATUS_COLORS: Record<string, string> = {
  not_applied: "#d1d5db", saved: "#93c5fd", applied: "#818cf8",
  screening: "#a78bfa", interview: "#fbbf24", offer: "#34d399",
  rejected: "#f87171", archived: "#9ca3af",
};

// ── types ──

interface AnalyticsData {
  statusDistribution: { name: string; value: number }[];
  weeklyActivity: { name: string; applications: number }[];
  funnel: { stage: string; count: number }[];
  conversionRates: { applicationToScreening: number; screeningToInterview: number; interviewToOffer: number; responseRate: number };
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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-900 tabular-nums">{payload[0].value} applications</p>
    </div>
  );
}

// ── page ──

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics?tz=${encodeURIComponent(getUserTimezone())}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
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

  if (data.totalApplications === 0) {
    return (
      <>
        <PageHeader title="Analytics" description="Track your job search performance" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <BarChart3 className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No data yet</h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
              Add some applications to see your job search analytics here.
            </p>
            <Link href="/applications">
              <Button variant="primary"><Plus className="w-4 h-4 mr-2" />Add Applications</Button>
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
  const funnelMax = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <>
      <PageHeader title="Analytics" description="Track your job search performance" />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={data.totalApplications} sub={`${data.activeApplications} active`} icon={Briefcase} color="text-blue-600 bg-blue-50" />
        <StatCard label="Applied" value={data.appliedCount} sub={`${data.responseRate}% response`} icon={Send} color="text-indigo-600 bg-indigo-50" />
        <StatCard label="Interview Rate" value={`${data.interviewRate}%`} sub={`${data.offerCount} offer${data.offerCount !== 1 ? "s" : ""}`} icon={Target} color="text-violet-600 bg-violet-50" />
        <StatCard label="Rejected" value={data.rejectedCount} sub={`${data.offerRate}% offer rate`} icon={XCircle} color="text-red-500 bg-red-50" />
      </div>

      {/* ── Row 1: Funnel + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Application Funnel</CardTitle>
            <CardDescription>Stage-by-stage progression</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {data.funnel.map((item, i) => {
                const pct = funnelMax > 0 ? (item.count / funnelMax) * 100 : 0;
                const convPct = i > 0 && data.funnel[i - 1].count > 0
                  ? Math.round((item.count / data.funnel[i - 1].count) * 100)
                  : null;
                return (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[i] }} />
                        <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {convPct !== null && <span className="text-[11px] text-gray-400 tabular-nums">{convPct}%</span>}
                        <span className="text-sm font-bold text-gray-900 tabular-nums w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`, backgroundColor: FUNNEL_COLORS[i] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
            <CardDescription>Current state of all applications</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-6">
              <div className="relative w-[180px] h-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={54} outerRadius={82} paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { displayName: string; value: number };
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
                            <p className="text-[11px] font-medium text-gray-500">{d.displayName}</p>
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{d.value} ({Math.round((d.value / pieTotal) * 100)}%)</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">{pieTotal}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest">Total</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-xs text-gray-600 truncate">{item.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-900 tabular-nums">{item.value}</span>
                      <span className="text-[10px] text-gray-400 w-7 text-right tabular-nums">{Math.round((item.value / pieTotal) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Weekly Activity + Conversion Rates ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Weekly Applications</CardTitle>
            <CardDescription>Last 12 weeks (your timezone)</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.weeklyActivity}>
                <defs>
                  <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="applications" stroke={BLUE} fill="url(#weekGrad)"
                  strokeWidth={2} dot={{ r: 3, fill: BLUE, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Conversion Metrics</CardTitle>
            <CardDescription>Stage-to-stage progression rates</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-4">
              <ConversionBar label="Applied → Screening" value={data.conversionRates.applicationToScreening} color="#4f46e5" />
              <ConversionBar label="Screening → Interview" value={data.conversionRates.screeningToInterview} color="#7c3aed" />
              <ConversionBar label="Interview → Offer" value={data.conversionRates.interviewToOffer} color="#059669" />
              <ConversionBar label="Response Rate" value={data.conversionRates.responseRate} color={BLUE} />
            </div>

            {data.topCompanies.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2.5">Top Companies</p>
                <div className="space-y-1.5">
                  {data.topCompanies.map((c, i) => (
                    <div key={c.company} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-gray-400 w-4 tabular-nums">{i + 1}.</span>
                        <span className="text-sm text-gray-700 truncate">{c.company}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Gamification ── */}
      {data.gamification && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600"><Flame className="w-5 h-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{data.gamification.streak}</p>
                  <p className="text-xs text-gray-500">Day streak</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Weekly goal</span>
                  <span className="text-xs font-semibold text-gray-900 tabular-nums">{data.gamification.thisWeekApps}/{data.gamification.weeklyGoal}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((data.gamification.thisWeekApps / data.gamification.weeklyGoal) * 100, 100)}%`, backgroundColor: BLUE }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.gamification.milestones.map((m) => (
                  <div
                    key={m.label}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                      m.reached ? "border-emerald-200 bg-emerald-50/50 text-emerald-700" : "border-gray-200 text-gray-400"
                    )}
                  >
                    {m.reached ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                    <span className={cn("text-xs font-medium", m.reached ? "text-emerald-700" : "text-gray-500")}>{m.label}</span>
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

// ── stat card ──

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
          <div className={cn("p-2 rounded-xl", color)}><Icon className="w-4 h-4" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── conversion bar ──

function ConversionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(value, value > 0 ? 3 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
