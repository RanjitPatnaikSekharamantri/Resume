"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { maskApiKey } from "@/lib/utils";

interface AIProviderConfig {
  id?: string;
  name: string;
  apiKey: string;
  model: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const addProvider = () => {
    setProviders((prev) => [
      ...prev,
      { name: "OpenAI", apiKey: "", model: "gpt-4", isActive: true },
    ]);
  };

  const updateProvider = (
    index: number,
    field: keyof AIProviderConfig,
    value: string | boolean
  ) => {
    setProviders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const removeProvider = (index: number) => {
    setProviders((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleKeyVisibility = (index: number) => {
    setShowKey((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and integrations"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              Account
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={session?.user?.name || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session?.user?.email || ""} disabled />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              To update your name, visit the Profile page.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-500" />
                  AI Providers
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure AI API keys for document generation
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addProvider}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Provider
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <div className="text-center py-8">
                <Key className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-3">
                  No AI providers configured
                </p>
                <p className="text-xs text-gray-400">
                  The app uses built-in generation by default. Add an API key
                  for enhanced AI-powered outputs.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {providers.map((provider, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-gray-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        Provider {index + 1}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeProvider(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Provider Name</Label>
                        <Input
                          value={provider.name}
                          onChange={(e) =>
                            updateProvider(index, "name", e.target.value)
                          }
                          placeholder="OpenAI"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Model</Label>
                        <Input
                          value={provider.model}
                          onChange={(e) =>
                            updateProvider(index, "model", e.target.value)
                          }
                          placeholder="gpt-4"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <div className="relative">
                        <Input
                          type={showKey[index] ? "text" : "password"}
                          value={
                            showKey[index]
                              ? provider.apiKey
                              : provider.apiKey
                              ? maskApiKey(provider.apiKey)
                              : ""
                          }
                          onChange={(e) =>
                            updateProvider(index, "apiKey", e.target.value)
                          }
                          placeholder="sk-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(index)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showKey[index] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {providers.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="primary" size="sm" disabled={saving}>
                  {saving ? "Saving..." : "Save Providers"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Delete Account
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
