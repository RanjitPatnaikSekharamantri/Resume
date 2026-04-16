import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  generateVerificationToken,
  getTokenExpiry,
  sendVerificationEmail,
} from "@/lib/email";

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

async function verifyCaptcha(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: token,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    console.error("CAPTCHA verification failed");
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, captchaToken } = body;

    // CAPTCHA verification (when configured)
    if (TURNSTILE_SECRET) {
      if (!captchaToken) {
        return NextResponse.json(
          { error: "CAPTCHA verification is required" },
          { status: 400 }
        );
      }

      const captchaValid = await verifyCaptcha(captchaToken);
      if (!captchaValid) {
        return NextResponse.json(
          { error: "CAPTCHA verification failed. Please try again." },
          { status: 403 }
        );
      }
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedName = name?.trim() || "";

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Full name is required (at least 2 characters)" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    // Optional user limit
    const maxUsersEnv = process.env.MAX_USERS;
    if (maxUsersEnv) {
      const limit = Number(maxUsersEnv);
      if (!isNaN(limit) && limit > 0) {
        const userCount = await prisma.user.count();
        if (userCount >= limit) {
          return NextResponse.json(
            { error: "Maximum number of users reached. Contact the administrator." },
            { status: 403 }
          );
        }
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = getTokenExpiry();

    // Check if email verification is enabled
    const emailVerificationEnabled = !!(
      process.env.RESEND_API_KEY || process.env.ENABLE_EMAIL_VERIFICATION === "true"
    );

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        hashedPassword,
        isVerified: !emailVerificationEnabled,
        verificationToken: emailVerificationEnabled ? verificationToken : null,
        verificationTokenExpiry: emailVerificationEnabled ? verificationTokenExpiry : null,
        profile: { create: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (emailVerificationEnabled) {
      await sendVerificationEmail(trimmedEmail, trimmedName, verificationToken);
    }

    return NextResponse.json(
      {
        user,
        requiresVerification: emailVerificationEnabled && !user.isVerified,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
