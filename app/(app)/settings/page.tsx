import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSettingsForm } from "@/components/settings/provider-settings-form";
import { getAuthSession } from "@/lib/auth/session";
import { listProviders } from "@/lib/services/ai-provider.service";

export default async function SettingsPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const providers = await listProviders(session.user.id);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage AI providers and secure API key storage.
        </p>
      </section>

      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle>AI Provider Keys</CardTitle>
          <CardDescription>
            Keys are encrypted at rest using AES-256-GCM. Only masked hints are shown in the UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProviderSettingsForm providers={providers} />
        </CardContent>
      </Card>
    </div>
  );
}
