"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/RoleBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X } from "lucide-react";
import { type Role, roleRank, highestRole } from "@/lib/access/roles";

type Grant = { id: string; scopeType: "org" | "project" | "environment"; scopeId: string | null; role: Role };
type UserWithAccess = { user: { id: string; email: string }; grants: Grant[] };
type Project = { id: string; name: string };
type Environment = { id: string; projectId: string; name: string };

const ALL_ROLES: Role[] = ["viewer", "member", "admin", "owner"];

function scopeLabel(g: Grant, projects: Project[], environments: Environment[]): string {
  if (g.scopeType === "org") return "Organization";
  if (g.scopeType === "project") return projects.find((p) => p.id === g.scopeId)?.name ?? "Unknown project";
  return environments.find((e) => e.id === g.scopeId)?.name ?? "Unknown environment";
}

export default function AccessClient({
  initialUsers,
  projects,
  environments,
  currentRole,
}: {
  initialUsers: UserWithAccess[];
  projects: Project[];
  environments: Environment[];
  currentRole: Role;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [grantOpen, setGrantOpen] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    scopeType: "org" as Grant["scopeType"],
    projectId: "",
    environmentId: "",
    role: "member" as Role,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/grants");
    if (res.ok) {
      setUsers((await res.json()).users);
    } else {
      const body = await res.json().catch(() => ({}));
      setPageError(body.error ?? "Couldn't refresh access list.");
    }
  }

  function resetForm() {
    setForm({ userId: "", scopeType: "org", projectId: "", environmentId: "", role: "member" });
    setError(null);
  }

  async function submitGrant() {
    if (!form.userId) return;
    const scopeId =
      form.scopeType === "project" ? form.projectId || null : form.scopeType === "environment" ? form.environmentId || null : null;
    if (form.scopeType !== "org" && !scopeId) return;

    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: form.userId, scopeType: form.scopeType, scopeId, role: form.role }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't grant access.");
      return;
    }
    setGrantOpen(false);
    resetForm();
    await refresh();
  }

  async function revoke(userId: string, g: Grant) {
    if (!confirm("Revoke this access? Secrets in scope will be flagged for rotation.")) return;
    setPageError(null);
    const res = await fetch("/api/grants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scopeType: g.scopeType, scopeId: g.scopeId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPageError(body.error ?? "Couldn't revoke access.");
      return;
    }
    await refresh();
  }

  const envsForProject = environments.filter((e) => e.projectId === form.projectId);
  const grantableRoles = ALL_ROLES.filter((r) => roleRank(r) <= roleRank(currentRole));

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Access</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team access</h1>
        </div>

        <Dialog
          open={grantOpen}
          onOpenChange={(o) => {
            setGrantOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="w-3.5 h-3.5" />
            Grant access
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Grant access</DialogTitle>
              <DialogDescription>Assign a role to a team member at the org, project, or environment level.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                User
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.user.id} value={u.user.id}>
                      {u.user.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Scope
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.scopeType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scopeType: e.target.value as Grant["scopeType"], projectId: "", environmentId: "" }))
                  }
                >
                  <option value="org">Organization (all projects)</option>
                  <option value="project">Project</option>
                  <option value="environment">Environment</option>
                </select>
              </label>

              {(form.scopeType === "project" || form.scopeType === "environment") && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Project
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                    value={form.projectId}
                    onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, environmentId: "" }))}
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.scopeType === "environment" && form.projectId && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Environment
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                    value={form.environmentId}
                    onChange={(e) => setForm((f) => ({ ...f, environmentId: e.target.value }))}
                  >
                    <option value="">Select an environment…</option>
                    {envsForProject.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Role
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  {grantableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setGrantOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitGrant} disabled={!form.userId || submitting}>
                {submitting ? "Granting…" : "Grant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pageError && <p className="text-xs text-destructive mb-3">{pageError}</p>}

      <div className="border border-border rounded-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Highest role</TableHead>
              <TableHead>Grants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(({ user, grants }) => {
              const top = highestRole(grants.map((g) => g.role));
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-semibold">
                          {user.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {top ? <RoleBadge role={top} /> : <span className="text-xs text-muted-foreground">No access</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {grants.map((g) => (
                        <span
                          key={g.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          {scopeLabel(g, projects, environments)} · {g.role}
                          <button
                            type="button"
                            onClick={() => revoke(user.id, g)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Revoke ${g.role} on ${scopeLabel(g, projects, environments)} for ${user.email}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
