"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsPayload } from "@/lib/services/analytics.service";

const PIE_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#1d4ed8",
  "#334155",
  "#64748b",
];

type Props = {
  analytics: AnalyticsPayload;
};

export function AnalyticsCharts({ analytics }: Props) {
  const pieData = analytics.statusDistribution.map((item) => ({
    name: APPLICATION_STATUS_LABELS[item.status],
    value: item.count,
  }));

  const funnelData = analytics.funnel.map((item) => ({
    stage: APPLICATION_STATUS_LABELS[item.status],
    value: item.count,
  }));

  const chartConfig = {
    created: { label: "Created", color: "#2563eb" },
    advanced: { label: "Advanced", color: "#0f172a" },
    value: { label: "Count", color: "#2563eb" },
  } as const;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-zinc-200 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ChartContainer config={chartConfig} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Application Funnel</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ChartContainer config={chartConfig} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="stage" tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Weekly Activity</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ChartContainer config={chartConfig} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="weekStart" tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="created" stroke="#2563eb" strokeWidth={2.4} />
                <Line type="monotone" dataKey="advanced" stroke="#0f172a" strokeWidth={2.4} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
