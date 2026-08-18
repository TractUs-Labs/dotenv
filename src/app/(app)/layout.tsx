import { auth, signOut } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { AppSidebar } from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const userId = (session as unknown as { userId?: string }).userId;
  if (!userId) redirect("/signin");
  const email = session.user.email;

  const role = await getOrgRole(getDb(), userId);
  const isOrgAdmin = !!role && roleAtLeast(role, "admin");

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/signin" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar email={email} isOrgAdmin={isOrgAdmin} signOutAction={signOutAction} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
