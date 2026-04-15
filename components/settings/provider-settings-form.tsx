"use client";

import { useMemo, useState, useTransition } from "react";
import type { AIProviderType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskApiKeyHint } from "@/lib/utils";
import type { MaskedProvider } from "@/lib/types";

type Props = {
  providers: MaskedProvider[];
};

const providerOptions: AIProviderType[] = ["OPENAI", "ANTHROPIC", "GOOGLE", "AZURE"];

export function ProviderSettingsForm({ providers }: Props) {
  const [provider, setProvider] = useState<AIProviderType>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string>("");

  const providerSet = useMemo(() => new Set(providers.map((p) => p.provider)), [providers]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    startTransition(async () => {
      const response = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(body.error ?? "Failed to save provider key.");
        return;
      }

      setApiKey("");
      setNotice("Provider key saved.");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-500">No providers configured yet.</p>
        ) : (
          providers.map((providerItem) => (
            <div
              key={providerItem.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-900">{providerItem.provider}</p>
                <p className="text-zinc-500">{maskApiKeyHint(providerItem.keyHint)}</p>
              </div>
              <span className="text-xs text-zinc-500">
                {providerItem.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-lg border border-zinc-200 p-4 md:grid-cols-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProviderType)}
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          >
            {providerOptions.map((option) => (
              <option key={option} value={option}>
                {option} {providerSet.has(option) ? "(update)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="sk-..."
            required
          />
        </div>
        <div className="md:col-span-3 flex items-center justify-between">
          <p className="text-xs text-zinc-500">{notice}</p>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save provider key"}
          </Button>
        </div>
      </form>
    </div>
  );
}
