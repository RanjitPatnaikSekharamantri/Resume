import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  const defaultValues = {
    name: user.name ?? "",
    email: user.email ?? "",
    phone: profile?.phone ?? "",
    location: profile?.location ?? "",
    linkedin: profile?.linkedin ?? "",
    links: profile?.links ?? [],
    workAuthorization: profile?.workAuthorization ?? "",
    summary: profile?.summary ?? "",
    preferences: (profile?.preferences as Record<string, unknown> | null) ?? {},
    equalOpportunity:
      (profile?.equalOpportunity as Record<string, unknown> | null) ?? {},
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Profile</h1>
        <p className="text-sm text-zinc-500">
          Maintain candidate details used in AI-generated documents.
        </p>
      </div>

      <Card className="border-zinc-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>Candidate profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}
