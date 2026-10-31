import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getProfile } from "@/server/repositories/profiles.repo";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { AppShell } from "@/components/layout/AppShell";
import { DialogHost } from "@/components/task/DialogHost";
import { MidnightReview } from "@/components/midnight/MidnightReview";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const profile = userId ? await getProfile(await getDb(), userId) : null;
  if (!profile) redirect("/login");
  return (
    <WorkspaceProvider initialTimezone={profile.timezone}>
      <AppShell>{children}</AppShell>
      <DialogHost />
      <MidnightReview />
    </WorkspaceProvider>
  );
}
