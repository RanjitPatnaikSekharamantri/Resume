import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { callLLM, type ResolvedProvider } from "@/lib/llm-provider";

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

    if (name.includes("openai") || apiKey.startsWith("sk-")) {
      // Validate the API key first via GET /v1/models.
      try {
        const modelsRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!modelsRes.ok) {
          const data = await modelsRes.json();
          return NextResponse.json({
            success: false,
            message: data.error?.message || `HTTP ${modelsRes.status}`,
          });
        }
      } catch {
        return NextResponse.json({ success: false, message: "Network error reaching OpenAI" });
      }

      // Then exercise the configured model with a real chat-completions
      // call so we verify the selected model actually works — this is the
      // only way to catch the max_tokens / max_completion_tokens issue
      // before the user tries to enhance a resume.
      const resolved: ResolvedProvider = {
        id: provider.id,
        name: provider.name,
        model: provider.model || "gpt-4o-mini",
        apiKey,
        kind: "openai",
      };
      const call = await callLLM(resolved, {
        systemPrompt: "You are a health check. Reply with just OK.",
        userPrompt: "OK?",
        maxTokens: 16,
        temperature: 0,
        timeoutMs: 15000,
      });

      if (call.ok) {
        return NextResponse.json({
          success: true,
          message: `OpenAI model "${resolved.model}" responded successfully.`,
        });
      }
      return NextResponse.json({
        success: false,
        message: `OpenAI key valid but model "${resolved.model}" failed: ${call.reason}`,
      });
    }

    if (name.includes("anthropic") || name.includes("claude")) {
      const resolved: ResolvedProvider = {
        id: provider.id,
        name: provider.name,
        model: provider.model || "claude-3-haiku-20240307",
        apiKey,
        kind: "anthropic",
      };
      const call = await callLLM(resolved, {
        systemPrompt: "You are a health check. Reply with just OK.",
        userPrompt: "OK?",
        maxTokens: 16,
        temperature: 0,
        timeoutMs: 15000,
      });
      if (call.ok) {
        return NextResponse.json({
          success: true,
          message: `Anthropic model "${resolved.model}" responded successfully.`,
        });
      }
      return NextResponse.json({
        success: false,
        message: call.reason,
      });
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
