"use client";

import { useState, Fragment } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppEmptyState, AppPage, AppPageHeader } from "@/components/AppPage";
import { MoreHorizontal, Plus, Users } from "lucide-react";
import { type Role, roleRank, highestRole } from "@/lib/access/roles";
import { withBasePath } from "@/lib/base-path";

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

function accessSummary(grants: Grant[], projects: Project[], environments: Environment[]): string {
  if (grants.length === 0) return "No access";
  return grants.map((g) => `${scopeLabel(g, projects, environments)} · ${g.role}`).join(", ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
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
  const [revokeTarget, setRevokeTarget] = useState<{ userId: string; email: string; grant: Grant } | null>(
    null,
  );
  const [revoking, setRevoking] = useState(false);

  async function refresh() {
    const res = await fetch(withBasePath("/api/grants"));
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
      form.scopeType === "project"
        ? form.projectId || null
        : form.scopeType === "environment"
          ? form.environmentId || null
          : null;
    if (form.scopeType !== "org" && !scopeId) return;

    setSubmitting(true);
    setError(null);
    const res = await fetch(withBasePath("/api/grants"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: form.userId,
        scopeType: form.scopeType,
        scopeId,
        role: form.role,
      }),
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

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setPageError(null);
    const res = await fetch(withBasePath("/api/grants"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: revokeTarget.userId,
        scopeType: revokeTarget.grant.scopeType,
        scopeId: revokeTarget.grant.scopeId,
      }),
    });
    setRevoking(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPageError(body.error ?? "Couldn't revoke access.");
      setRevokeTarget(null);
      return;
    }
    setRevokeTarget(null);
    await refresh();
  }

  const envsForProject = environments.filter((e) => e.projectId === form.projectId);
  const grantableRoles = ALL_ROLES.filter((r) => roleRank(r) <= roleRank(currentRole));
  const canSubmitGrant =
    !!form.userId &&
    (form.scopeType === "org" ||
      (form.scopeType === "project" && !!form.projectId) ||
      (form.scopeType === "environment" && !!form.projectId && !!form.environmentId));

  return (
    <AppPage>
      <AppPageHeader
        title="Team access"
        description={`${users.length} member${users.length !== 1 ? "s" : ""}`}
        actions={
          <Dialog
            open={grantOpen}
            onOpenChange={(o) => {
              setGrantOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Plus className="size-3.5" />
              Grant
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Grant access</DialogTitle>
                <DialogDescription>
                  Assign a role to a team member at the org, project, or environment level.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>User</FieldLabel>
                  <Select
                    value={form.userId || null}
                    onValueChange={(v) => setForm((f) => ({ ...f, userId: v ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a user…" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user.id} value={u.user.id}>
                          {u.user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Scope</FieldLabel>
                  <Select
                    value={form.scopeType}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        scopeType: (v ?? "org") as Grant["scopeType"],
                        projectId: "",
                        environmentId: "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org">Organization (all projects)</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="environment">Environment</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                {(form.scopeType === "project" || form.scopeType === "environment") && (
                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Project</FieldLabel>
                    <Select
                      value={form.projectId || null}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, projectId: v ?? "", environmentId: "" }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a project…" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}

                {form.scopeType === "environment" && form.projectId && (
                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Environment</FieldLabel>
                    <Select
                      value={form.environmentId || null}
                      onValueChange={(v) => setForm((f) => ({ ...f, environmentId: v ?? "" }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an environment…" />
                      </SelectTrigger>
                      <SelectContent>
                        {envsForProject.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Role</FieldLabel>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((f) => ({ ...f, role: (v ?? "member") as Role }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {grantableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
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
                <Button onClick={submitGrant} disabled={!canSubmitGrant || submitting}>
                  {submitting ? "Granting…" : "Grant"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {pageError && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {pageError}
        </div>
      )}

      {users.length === 0 ? (
        <AppEmptyState
          icon={<Users />}
          title="No members yet"
          description="Grant access to teammates so they can view or manage secrets."
          action={
            <Button size="sm" className="gap-1.5" onClick={() => setGrantOpen(true)}>
              <Plus className="size-3.5" />
              Grant
            </Button>
          }
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Member
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Access
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(({ user, grants }) => {
                const top = highestRole(grants.map((g) => g.role));
                return (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
                            {user.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground truncate">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {top ? (
                        <RoleBadge role={top} />
                      ) : (
                        <span className="text-xs text-muted-foreground">No access</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {accessSummary(grants, projects, environments)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {grants.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground min-h-9 min-w-9"
                                aria-label={`Actions for ${user.email}`}
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            {grants.map((g, idx) => (
                              <Fragment key={g.id}>
                                {idx > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer text-xs"
                                  onClick={() =>
                                    setRevokeTarget({ userId: user.id, email: user.email, grant: g })
                                  }
                                >
                                  Revoke {g.role} on {scopeLabel(g, projects, environments)}
                                </DropdownMenuItem>
                              </Fragment>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRevokeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              Revoke{" "}
              <span className="font-medium text-foreground">{revokeTarget?.grant.role}</span> on{" "}
              <span className="font-medium text-foreground">
                {revokeTarget
                  ? scopeLabel(revokeTarget.grant, projects, environments)
                  : ""}
              </span>{" "}
              for{" "}
              <span className="font-medium text-foreground">{revokeTarget?.email}</span>? They will
              lose access to secrets in that scope.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revoking}>
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
