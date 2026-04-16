import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const providers = await prisma.aIProvider.findMany({
      where: { userId: userId! },
      orderBy: { createdAt: "desc" },
    });

    const safe = providers.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      isActive: p.isActive,
      createdAt: p.createdAt,
      keyLastFour: safeKeyPreview(p.apiKey),
    }));

    return NextResponse.json(safe);
  } catch (err) {
    console.error("Get providers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { name, apiKey, model, isActive } = body;

    if (!name || !apiKey) {
      return NextResponse.json({ error: "Name and API key are required" }, { status: 400 });
    }

    const encrypted = encrypt(apiKey);

    const provider = await prisma.aIProvider.create({
      data: {
        userId: userId!,
        name: String(name).trim().slice(0, 100),
        apiKey: encrypted,
        model: model ? String(model).trim().slice(0, 100) : null,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({
      id: provider.id,
      name: provider.name,
      model: provider.model,
      isActive: provider.isActive,
      keyLastFour: safeKeyPreview(encrypted),
    }, { status: 201 });
  } catch (err) {
    console.error("Create provider error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function safeKeyPreview(encryptedKey: string): string {
  try {
    const decrypted = decrypt(encryptedKey);
    if (decrypted.length <= 8) return "••••";
    return `${decrypted.slice(0, 3)}•••${decrypted.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}
