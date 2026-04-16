import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { providerId } = await req.json();

    if (!providerId) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
    }

    const provider = await prisma.aIProvider.findFirst({
      where: { id: providerId, userId: userId! },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    let apiKey: string;
    try {
      apiKey = decrypt(provider.apiKey);
    } catch {
      return NextResponse.json({ success: false, message: "Failed to decrypt API key" });
    }

    // Test based on provider name
    const name = provider.name.toLowerCase();

    if (name.includes("openai")) {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          return NextResponse.json({ success: true, message: "OpenAI connection successful" });
        }
        const data = await res.json();
        return NextResponse.json({ success: false, message: data.error?.message || `HTTP ${res.status}` });
      } catch (err) {
        return NextResponse.json({ success: false, message: "Network error reaching OpenAI" });
      }
    }

    if (name.includes("anthropic") || name.includes("claude")) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: provider.model || "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "test" }] }),
        });
        if (res.ok || res.status === 400) {
          return NextResponse.json({ success: true, message: "Anthropic connection successful" });
        }
        return NextResponse.json({ success: false, message: `HTTP ${res.status}` });
      } catch {
        return NextResponse.json({ success: false, message: "Network error reaching Anthropic" });
      }
    }

    // Generic: just verify key format
    if (apiKey.length > 10) {
      return NextResponse.json({ success: true, message: "API key format looks valid (cannot verify connection for this provider)" });
    }

    return NextResponse.json({ success: false, message: "API key appears too short" });
  } catch (err) {
    console.error("Test connection error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
