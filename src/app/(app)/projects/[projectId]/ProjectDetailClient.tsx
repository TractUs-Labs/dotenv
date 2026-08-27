"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Trash2 } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { AppEmptyState } from "@/components/AppPage";
import SecretsClient from "./SecretsClient";

type Env = { id: string; name: string };

export default function ProjectDetailClient({
  projectId,
  environments: initialEnvironments,
}: {
  projectId: string;
  environments: Env[];
}) {
  const router = useRouter();
  const [environments, setEnvironments] = useState(initialEnvironments);
  const [activeId, setActiveId] = useState(initialEnvironments[0]?.id ?? "");
  const [syncedInitial, setSyncedInitial] = useState(initialEnvironments);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [envToRemove, setEnvToRemove] = useState<Env | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (initialEnvironments !== syncedInitial) {
    setSyncedInitial(initialEnvironments);
    setEnvironments(initialEnvironments);
    setActiveId((current) => {
      if (initialEnvironments.some((e) => e.id === current)) return current;
      return initialEnvironments[0]?.id ?? "";
    });
  }

  const activeEnv =
    environments.find((e) => e.id === activeId) ?? environments[0];

  async function createEnvironment() {
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(withBasePath(`/api/projects/${projectId}/environments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "environment already exists"
          ? "An environment with that name already exists."
          : "Couldn't create environment. Check you have admin access.",
      );
      return;
    }
    const { environment } = await res.json();
    setEnvironments((prev) => [...prev, environment]);
    setActiveId(environment.id);
    setCreateOpen(false);
    setNewName("");
    router.refresh();
  }

  async function confirmRemoveEnvironment() {
    if (!envToRemove) return;
    setRemoving(true);
    setRemoveError(null);
    const res = await fetch(withBasePath(`/api/environments/${envToRemove.id}`), { method: "DELETE" });
    setRemoving(false);
    if (!res.ok) {
      setRemoveError("Couldn't remove environment. Check you have admin access.");
      return;
    }
    const removedId = envToRemove.id;
    const next = environments.filter((e) => e.id !== removedId);
    setEnvironments(next);
    if (activeId === removedId) {
      setActiveId(next[0]?.id ?? "");
    }
    setEnvToRemove(null);
    router.refresh();
  }

  function openCreate() {
    setError(null);
    setNewName("");
    setCreateOpen(true);
  }

  return (
    <div>
      {environments.length > 0 && (
        <div className="flex items-end justify-between border-b border-border mb-6 gap-3">
          <div
            role="tablist"
            aria-label="Environments"
            className="flex gap-0 min-w-0 overflow-x-auto"
          >
            {environments.map((env) => {
              const selected = env.id === activeId;
              return (
                <button
                  key={env.id}
                  type="button"
                  role="tab"
                  id={`env-tab-${env.id}`}
                  aria-selected={selected}
                  aria-controls={`env-panel-${env.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(env.id)}
                  className={cn(
                    "px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors duration-200 relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    selected
                      ? "text-foreground after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {env.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 shrink-0 pb-1">
            {activeEnv && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setRemoveError(null);
                  setEnvToRemove(activeEnv);
                }}
                disabled={removing}
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              New
            </Button>
          </div>
        </div>
      )}

      {activeEnv ? (
        <div
          role="tabpanel"
          id={`env-panel-${activeEnv.id}`}
          aria-labelledby={`env-tab-${activeEnv.id}`}
        >
          <SecretsClient
            key={activeEnv.id}
            envId={activeEnv.id}
            envName={activeEnv.name}
          />
        </div>
      ) : (
        <AppEmptyState
          icon={<Layers />}
          title="No environments"
          description="Environments hold their own set of secrets (for example dev, staging, or prod)."
          action={
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              Create
            </Button>
          }
        />
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            setNewName("");
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New environment</DialogTitle>
            <DialogDescription>
              Environments hold their own set of secrets (for example preview or qa).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="flex flex-col gap-1.5 text-sm text-foreground">
              <span className="text-xs text-muted-foreground">Name</span>
              <Input
                placeholder="Environment name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && createEnvironment()}
              />
            </label>
            {error && <p className="text-sm text-destructive mt-2" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEnvironment} disabled={!newName.trim() || submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={envToRemove !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEnvToRemove(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove environment</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-mono text-foreground">{envToRemove?.name}</span>? All secrets
              in it will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <p className="text-sm text-destructive" role="alert">{removeError}</p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEnvToRemove(null);
                setRemoveError(null);
              }}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveEnvironment}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
