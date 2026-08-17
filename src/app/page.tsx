import { auth, signOut } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listProjectsForUser } from "@/lib/projects/projects";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderLock, ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const userId = (session as unknown as { userId?: string }).userId;
  if (!userId) redirect("/signin");

  const projects = await listProjectsForUser(getDb(), userId);
  const email = session.user.email;

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/signin" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader email={email} signOutAction={signOutAction} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {projects.length === 0 ? "No projects yet" : "Your projects"}
          </h2>
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="group block">
                <Card className="border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all duration-150 cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <FolderLock className="w-4 h-4 text-primary" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardTitle className="text-base font-semibold text-foreground leading-snug">
                      {p.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">View secrets →</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
        <FolderLock className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No projects</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Projects appear here once an admin adds you to one.
      </p>
    </div>
  );
}
