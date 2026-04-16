import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const PASSWORD_MIN_LENGTH = 8;

/**
 * PATCH /api/account/password
 *
 * Change the logged-in user's password.
 * Requires the current password, and a new password that meets the minimum length.
 */
export async function PATCH(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (
      !currentPassword ||
      typeof currentPassword !== "string" ||
      !newPassword ||
      typeof newPassword !== "string"
    ) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId! } });
    if (!user || !user.hashedPassword) {
      return NextResponse.json(
        { error: "Account not found or has no password set" },
        { status: 404 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId! },
      data: { hashedPassword: hashed },
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
