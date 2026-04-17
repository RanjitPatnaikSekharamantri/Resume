/**
 * LLM provider adapter.
 *
 * Finds the user's active AI provider (AIProvider row where isActive=true),
 * decrypts the API key, and exposes a single `callLLM()` entrypoint that
 * talks to OpenAI or Anthropic depending on the provider name.
 *
 * The adapter returns `{ ok: true, text, provider, model }` on success or
 * `{ ok: false, reason, provider? }` on failure. The enhancement route
 * uses this to decide between the LLM path and the built-in fallback.
 */

import { prisma } from "./prisma";
import { decrypt } from "./encryption";

export interface ResolvedProvider {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  kind: "openai" | "anthropic" | "unknown";
}

export interface LlmSuccess {
  ok: true;
  text: string;
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface LlmFailure {
  ok: false;
  reason: string;
  provider?: string;
  model?: string;
}

export type LlmResult = LlmSuccess | LlmFailure;

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-haiku-20240307";

export async function getActiveProviderForUser(
  userId: string
): Promise<ResolvedProvider | null> {
  const provider = await prisma.aIProvider.findFirst({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!provider) return null;

  let apiKey: string;
  try {
    apiKey = decrypt(provider.apiKey);
  } catch (err) {
    console.warn("[llm-provider] Failed to decrypt API key:", err);
    return null;
  }

  const nameLower = provider.name.toLowerCase();
  let kind: ResolvedProvider["kind"] = "unknown";
  let defaultModel = "";
  if (nameLower.includes("openai") || /^sk-/.test(apiKey)) {
    kind = "openai";
    defaultModel = DEFAULT_OPENAI_MODEL;
  } else if (nameLower.includes("anthropic") || nameLower.includes("claude")) {
    kind = "anthropic";
    defaultModel = DEFAULT_ANTHROPIC_MODEL;
  }

  return {
    id: provider.id,
    name: provider.name,
    model: (provider.model && provider.model.trim()) || defaultModel,
    apiKey,
    kind,
  };
}

export interface CallLlmOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Default 0.4 — slightly creative but still grounded. */
  temperature?: number;
  /** Default 2500 — enough room for resume-size JSON responses. */
  maxTokens?: number;
  /** Called with short status strings for server-side logging. */
  onLog?: (msg: string) => void;
  /** Abort after this many ms (default 45s). */
  timeoutMs?: number;
  /** Whether to request JSON output mode (OpenAI only). */
  json?: boolean;
}

export async function callLLM(
  provider: ResolvedProvider,
  opts: CallLlmOptions
): Promise<LlmResult> {
  const log = opts.onLog || (() => {});
  const timeoutMs = opts.timeoutMs ?? 45000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider.kind === "openai") {
      return await callOpenAI(provider, opts, log, controller.signal);
    }

    if (provider.kind === "anthropic") {
      log(`anthropic: calling model=${provider.model}`);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider.model,
          max_tokens: opts.maxTokens ?? 2500,
          temperature: opts.temperature ?? 0.4,
          system: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
        }),
      });

      if (!res.ok) {
        const errText = await safeReadError(res);
        log(`anthropic: HTTP ${res.status} ${errText}`);
        return {
          ok: false,
          reason: `Anthropic HTTP ${res.status}: ${errText}`,
          provider: provider.name,
          model: provider.model,
        };
      }

      const data = await res.json();
      const text: string =
        data?.content?.[0]?.text || data?.content?.[0]?.value || "";
      if (!text) {
        return {
          ok: false,
          reason: "Anthropic returned an empty response",
          provider: provider.name,
          model: provider.model,
        };
      }
      log(
        `anthropic: ok · input=${data?.usage?.input_tokens ?? "?"} output=${data?.usage?.output_tokens ?? "?"} tokens`
      );
      return {
        ok: true,
        text,
        provider: provider.name,
        model: provider.model,
        usage: {
          promptTokens: data?.usage?.input_tokens,
          completionTokens: data?.usage?.output_tokens,
        },
      };
    }

    return {
      ok: false,
      reason: `Provider "${provider.name}" is not supported. Use OpenAI or Anthropic.`,
      provider: provider.name,
      model: provider.model,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        reason: `Provider request timed out after ${timeoutMs}ms`,
        provider: provider.name,
        model: provider.model,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    log(`llm error: ${msg}`);
    return {
      ok: false,
      reason: msg,
      provider: provider.name,
      model: provider.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenAI call ────────────────────────────────────────────────────────
//
// The OpenAI Chat Completions API has split into two parameter dialects:
//
//   Legacy models (gpt-4o, gpt-4-turbo, gpt-3.5-*):
//     - max_tokens
//     - temperature accepted
//
//   Reasoning / GPT-5 / o-series / most gpt-4.1-* models:
//     - max_completion_tokens   (max_tokens is rejected with HTTP 400)
//     - temperature is IGNORED for o1/o3/o4/gpt-5; sending a non-default
//       value produces HTTP 400 ("temperature does not support ...").
//     - response_format json_object is supported by o-series but NOT always
//       by gpt-5 preview tiers; we retry without it if needed.
//
// Strategy:
//   1. Decide a best-guess dialect from the model name.
//   2. Call the API.
//   3. If the response is HTTP 400 and OpenAI explicitly complains about
//      max_tokens or temperature, retry with the adjusted payload.
//   4. Surface clear logging so debugging is possible from Vercel logs.

function openAiSupportsMaxTokens(model: string): boolean {
  const m = model.toLowerCase();
  // Known models that REQUIRE max_completion_tokens (block max_tokens):
  if (/^(o1|o3|o4|gpt-5|gpt-4\.1|gpt-4o.*realtime)/.test(m)) return false;
  // Everything else (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-*) accepts max_tokens.
  return true;
}

function openAiSupportsTemperature(model: string): boolean {
  const m = model.toLowerCase();
  if (/^(o1|o3|o4|gpt-5)/.test(m)) return false;
  return true;
}

interface OpenAIPayload {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format?: { type: "json_object" };
}

async function callOpenAI(
  provider: ResolvedProvider,
  opts: CallLlmOptions,
  log: (msg: string) => void,
  signal: AbortSignal
): Promise<LlmResult> {
  const model = provider.model;
  const maxToks = opts.maxTokens ?? 2500;
  const temperature = opts.temperature ?? 0.4;
  const useMaxCompletion = !openAiSupportsMaxTokens(model);
  const includeTemperature = openAiSupportsTemperature(model);

  const payload: OpenAIPayload = {
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  };
  if (useMaxCompletion) payload.max_completion_tokens = maxToks;
  else payload.max_tokens = maxToks;
  if (includeTemperature) payload.temperature = temperature;
  if (opts.json) payload.response_format = { type: "json_object" };

  log(
    `openai: calling model=${model} json=${!!opts.json} ` +
      `tokens_param=${useMaxCompletion ? "max_completion_tokens" : "max_tokens"} ` +
      `temp=${includeTemperature ? temperature : "(omitted)"}`
  );

  const doRequest = async (p: OpenAIPayload): Promise<Response> =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify(p),
    });

  let res = await doRequest(payload);

  // Retry once on the specific "unsupported parameter" errors so newer
  // OpenAI models don't require manual provider reconfiguration.
  if (!res.ok && res.status === 400) {
    const raw = await res.text();
    const lower = raw.toLowerCase();
    let retried = false;

    if (lower.includes("max_tokens") && !useMaxCompletion) {
      log(`openai: HTTP 400 on max_tokens — retrying with max_completion_tokens`);
      delete payload.max_tokens;
      payload.max_completion_tokens = maxToks;
      res = await doRequest(payload);
      retried = true;
    } else if (lower.includes("max_completion_tokens") && useMaxCompletion) {
      log(`openai: HTTP 400 on max_completion_tokens — retrying with max_tokens`);
      delete payload.max_completion_tokens;
      payload.max_tokens = maxToks;
      res = await doRequest(payload);
      retried = true;
    }

    if (!res.ok && lower.includes("temperature") && includeTemperature) {
      log(`openai: HTTP 400 on temperature — retrying without it`);
      delete payload.temperature;
      res = await doRequest(payload);
      retried = true;
    }

    if (!res.ok && lower.includes("response_format") && opts.json) {
      log(`openai: HTTP 400 on response_format — retrying without JSON mode`);
      delete payload.response_format;
      res = await doRequest(payload);
      retried = true;
    }

    if (!retried) {
      log(`openai: HTTP 400 ${raw.slice(0, 300)}`);
      return {
        ok: false,
        reason: `OpenAI HTTP 400: ${extractErrorMessage(raw)}`,
        provider: provider.name,
        model,
      };
    }
  }

  if (!res.ok) {
    const errText = await safeReadError(res);
    log(`openai: HTTP ${res.status} ${errText}`);
    return {
      ok: false,
      reason: `OpenAI HTTP ${res.status}: ${errText}`,
      provider: provider.name,
      model,
    };
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || "";
  if (!text) {
    return {
      ok: false,
      reason: "OpenAI returned an empty response",
      provider: provider.name,
      model,
    };
  }
  log(
    `openai: ok · prompt=${data?.usage?.prompt_tokens ?? "?"} completion=${data?.usage?.completion_tokens ?? "?"} tokens`
  );
  return {
    ok: true,
    text,
    provider: provider.name,
    model,
    usage: {
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
    },
  };
}

function extractErrorMessage(raw: string): string {
  try {
    const data = JSON.parse(raw);
    return (
      data?.error?.message ||
      data?.message ||
      raw.slice(0, 300)
    );
  } catch {
    return raw.slice(0, 300);
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data).slice(0, 300)
    );
  } catch {
    try {
      return (await res.text()).slice(0, 300);
    } catch {
      return res.statusText;
    }
  }
}

/**
 * Safely extract the first JSON object embedded in an LLM response.
 * Tolerates leading/trailing prose, fences, and partial trailing garbage.
 */
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  // Strip markdown code fences if present.
  const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/i, "$1").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through */
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}
