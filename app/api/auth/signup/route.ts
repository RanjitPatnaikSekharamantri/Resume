import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { badRequest, conflict, handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = signupSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest("Invalid signup payload.", parsed.error.flatten());
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return conflict("An account with this email already exists.");
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
        profile: {
          create: {
            links: [],
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Failed to create account.");
  }
}
