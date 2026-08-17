import { auth, signOut } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listProjectsForUser } from "@/lib/projects/projects";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const userId = (session as unknown as { userId?: string }).userId;
  if (!userId) redirect("/signin");
  const projects = await listProjectsForUser(getDb(), userId);
  return (
    <main>
      <p>Signed in as {session.user.email}</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
      <h1>Projects</h1>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <a href={`/projects/${p.id}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
