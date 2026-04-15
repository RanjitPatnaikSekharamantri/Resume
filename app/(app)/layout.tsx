import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
