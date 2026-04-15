import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
    const { name, ...profileData } = body;

    if (name) {
      await prisma.user.update({
        where: { id: userId! },
        data: { name },
      });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: userId! },
      update: profileData,
      create: {
        userId: userId!,
        ...profileData,
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
