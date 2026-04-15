"use client";

import { BriefcaseBusiness, FileText, Sparkles, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardOverviewProps = {
  metrics?: {
    totalApplications: number;
    interviews: number;
    offers: number;
    resumes: number;
  };
  analytics?: {
    totalApplications: number;
    funnel: Array<{ status: string; count: number }>;
  };
};

const cards = [
  {
    key: "totalApplications",
    label: "Total Applications",
    icon: BriefcaseBusiness,
  },
  {
    key: "interviews",
    label: "Interviews",
    icon: TrendingUp,
  },
  {
    key: "offers",
    label: "Offers",
    icon: Sparkles,
  },
  {
    key: "resumes",
    label: "Base Resumes",
    icon: FileText,
  },
] as const;

export function DashboardOverview({ metrics, analytics }: DashboardOverviewProps) {
  const normalizedMetrics = metrics ?? {
    totalApplications: analytics?.totalApplications ?? 0,
    interviews:
      analytics?.funnel.find((item) => item.status === "INTERVIEW")?.count ?? 0,
    offers: analytics?.funnel.find((item) => item.status === "OFFER")?.count ?? 0,
    resumes: 0,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-semibold text-zinc-900">
                {normalizedMetrics[card.key]}
              </p>
              <div className="rounded-lg border border-zinc-200 bg-white p-2">
                <Icon className="h-4 w-4 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
