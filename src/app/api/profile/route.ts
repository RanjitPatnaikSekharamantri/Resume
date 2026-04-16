import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_PROFILE_FIELDS = new Set([
  "phone",
  "location",
  "linkedIn",
  "website",
  "github",
  "portfolio",
  "workAuthorization",
  "veteranStatus",
  "disabilityStatus",
  "ethnicity",
  "gender",
  "preferredRole",
  "preferredLocation",
  "salaryExpectation",
  "remotePreference",
  "summary",
]);

const MAX_FIELD_LENGTH: Record<string, number> = {
  summary: 2000,
  phone: 30,
  location: 120,
  linkedIn: 200,
  website: 200,
  github: 200,
  portfolio: 200,
};

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const profile = await prisma.profile.findUnique({
      where: { userId: userId! },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Get profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { name, ...rest } = body;

    // Update user name if provided
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 1 || trimmed.length > 100) {
        return NextResponse.json(
          { error: "Name must be between 1 and 100 characters" },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { id: userId! },
        data: { name: trimmed },
      });
    }

    // Whitelist and sanitize profile fields
    const profileData: Record<string, string> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;
      const str = String(value ?? "").trim();
      const maxLen = MAX_FIELD_LENGTH[key] || 500;
      profileData[key] = str.slice(0, maxLen);
    }

    const profile = await prisma.profile.upsert({
      where: { userId: userId! },
      update: profileData,
      create: {
        userId: userId!,
        ...profileData,
      },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
