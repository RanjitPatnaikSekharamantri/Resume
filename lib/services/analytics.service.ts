import { ApplicationStatus } from "@prisma/client";
import { startOfWeek, subWeeks } from "date-fns";

import { APPLICATION_STATUS_ORDER } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

type WeeklyActivity = {
  weekStart: string;
  created: number;
  advanced: number;
};

export type AnalyticsPayload = Awaited<ReturnType<typeof getAnalytics>>;

export async function getAnalytics(userId: string) {
  const appCountByStatus = await prisma.application.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  const totals = Object.fromEntries(
    APPLICATION_STATUS_ORDER.map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;

  for (const row of appCountByStatus) {
    totals[row.status] = row._count._all;
  }

  const totalApplications = Object.values(totals).reduce((acc, count) => acc + count, 0);

  const statusDistribution = APPLICATION_STATUS_ORDER.map((status) => {
    const count = totals[status];
    return {
      status,
      count,
      percentage:
        totalApplications === 0 ? 0 : Number(((count / totalApplications) * 100).toFixed(1)),
    };
  });

  const funnel = [
    { status: ApplicationStatus.SAVED, count: totals.SAVED },
    { status: ApplicationStatus.APPLIED, count: totals.APPLIED },
    { status: ApplicationStatus.SCREENING, count: totals.SCREENING },
    { status: ApplicationStatus.INTERVIEW, count: totals.INTERVIEW },
    { status: ApplicationStatus.OFFER, count: totals.OFFER },
  ];

  const conversionRates = {
    savedToApplied:
      totals.SAVED === 0 ? 0 : Number(((totals.APPLIED / totals.SAVED) * 100).toFixed(1)),
    appliedToInterview:
      totals.APPLIED === 0
        ? 0
        : Number(((totals.INTERVIEW / totals.APPLIED) * 100).toFixed(1)),
    interviewToOffer:
      totals.INTERVIEW === 0 ? 0 : Number(((totals.OFFER / totals.INTERVIEW) * 100).toFixed(1)),
    rejectionRate:
      totalApplications === 0
        ? 0
        : Number(((totals.REJECTED / totalApplications) * 100).toFixed(1)),
  };

  const now = new Date();
  const weeklyActivity: WeeklyActivity[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });

    const [created, advanced] = await Promise.all([
      prisma.application.count({
        where: {
          userId,
          createdAt: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.applicationActivity.count({
        where: {
          application: { userId },
          createdAt: { gte: weekStart, lt: weekEnd },
          type: "status_changed",
        },
      }),
    ]);

    weeklyActivity.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      created,
      advanced,
    });
  }

  return {
    totalApplications,
    statusDistribution,
    funnel,
    conversionRates,
    weeklyActivity,
  };
}
