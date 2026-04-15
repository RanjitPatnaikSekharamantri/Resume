import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applications = await prisma.application.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: true,
      },
    });

    const statusCounts: Record<string, number> = {};
    for (const app of applications) {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    }

    const weeklyActivity: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      const weekKey = `Week ${12 - i}`;
      weeklyActivity[weekKey] = 0;
    }

    for (const app of applications) {
      const weeksAgo = Math.floor(
        (now.getTime() - new Date(app.createdAt).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weeksAgo < 12) {
        const weekKey = `Week ${12 - weeksAgo}`;
        weeklyActivity[weekKey] = (weeklyActivity[weekKey] || 0) + 1;
      }
    }

    const totalApps = applications.length;
    const appliedCount = applications.filter(
      (a) => !["not_applied", "saved"].includes(a.status)
    ).length;
    const interviewCount = applications.filter(
      (a) => a.status === "interview"
    ).length;
    const offerCount = applications.filter(
      (a) => a.status === "offer"
    ).length;

    const conversionRates = {
      applicationToScreening:
        totalApps > 0
          ? Math.round(
              (applications.filter((a) =>
                ["screening", "interview", "offer"].includes(a.status)
              ).length /
                Math.max(appliedCount, 1)) *
                100
            )
          : 0,
      screeningToInterview:
        appliedCount > 0
          ? Math.round(
              (applications.filter((a) =>
                ["interview", "offer"].includes(a.status)
              ).length /
                Math.max(
                  applications.filter((a) =>
                    ["screening", "interview", "offer"].includes(a.status)
                  ).length,
                  1
                )) *
                100
            )
          : 0,
      interviewToOffer:
        interviewCount > 0
          ? Math.round(
              (offerCount / Math.max(interviewCount + offerCount, 1)) * 100
            )
          : 0,
    };

    return NextResponse.json({
      statusDistribution: Object.entries(statusCounts).map(
        ([status, count]) => ({
          name: status,
          value: count,
        })
      ),
      weeklyActivity: Object.entries(weeklyActivity).map(([week, count]) => ({
        name: week,
        applications: count,
      })),
      funnel: [
        { stage: "Total", count: totalApps },
        { stage: "Applied", count: appliedCount },
        {
          stage: "Screening",
          count: applications.filter((a) =>
            ["screening", "interview", "offer"].includes(a.status)
          ).length,
        },
        { stage: "Interview", count: interviewCount + offerCount },
        { stage: "Offer", count: offerCount },
      ],
      conversionRates,
      totalApplications: totalApps,
      activeApplications: applications.filter(
        (a) => !["rejected", "archived"].includes(a.status)
      ).length,
      interviewRate: conversionRates.screeningToInterview,
      offerRate: conversionRates.interviewToOffer,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
