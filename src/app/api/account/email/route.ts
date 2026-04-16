import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  generateVerificationToken,
  getTokenExpiry,
  sendVerificationEmail,
} from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/account/email
 *
 * Change the logged-in user's email.
 * Requires current password for verification.
 *
 * If email verification is enabled (RESEND_API_KEY or ENABLE_EMAIL_VERIFICATION=true),
 * the account is marked unverified again and a verification email is sent
 * to the new address.
 */
export async function PATCH(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { newEmail, currentPassword } = body;

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json({ error: "New email is required" }, { status: 400 });
    }

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required to change email" },
        { status: 400 }
      );
    }

    const trimmed = newEmail.toLowerCase().trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
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

    if (user.email === trimmed) {
      return NextResponse.json(
        { error: "New email is the same as current email" },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: trimmed } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    const emailVerificationEnabled = !!(
      process.env.RESEND_API_KEY || process.env.ENABLE_EMAIL_VERIFICATION === "true"
    );

    if (emailVerificationEnabled) {
      const token = generateVerificationToken();
      const expiry = getTokenExpiry();
      await prisma.user.update({
        where: { id: userId! },
        data: {
          email: trimmed,
          isVerified: false,
          emailVerified: null,
          verificationToken: token,
          verificationTokenExpiry: expiry,
        },
      });
      await sendVerificationEmail(trimmed, user.name || "", token);
      return NextResponse.json({
        success: true,
        requiresVerification: true,
        message:
          "Email updated. A verification link has been sent to the new address — please verify to restore access.",
      });
    }

    await prisma.user.update({
      where: { id: userId! },
      data: { email: trimmed },
    });

    return NextResponse.json({
      success: true,
      requiresVerification: false,
      message: "Email updated successfully.",
    });
  } catch (err) {
    console.error("Change email error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
