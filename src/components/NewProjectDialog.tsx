"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

const DEFAULT_ENVS = ["dev", "staging", "prod"];

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [envs, setEnvs] = useState<string[]>([...DEFAULT_ENVS]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEnvs([...DEFAULT_ENVS]);
    setError(null);
  }

  function updateEnv(index: number, value: string) {
    setEnvs((prev) => prev.map((e, i) => (i === index ? value : e)));
  }

  function removeEnv(index: number) {
    setEnvs((prev) => prev.filter((_, i) => i !== index));
  }

  function addEnv() {
    setEnvs((prev) => [...prev, ""]);
  }

  async function submit() {
    if (!name.trim()) return;
    const environments = envs.map((e) => e.trim()).filter(Boolean);
    if (environments.length === 0) {
      setError("Add at least one environment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(withBasePath("/api/projects"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), environments }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't create project. Check you have admin access.");
      return;
    }
    const { project } = await res.json();
    setOpen(false);
    reset();
    router.push(`/projects/${project.id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-3.5" />
        New
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Choose which environments to create. You can add or remove them later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Environments
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={addEnv}
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {envs.map((env, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. preview"
                    value={env}
                    onChange={(e) => updateEnv(index, e.target.value)}
                    className="font-mono text-sm"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeEnv(index)}
                    disabled={envs.length <= 1}
                    aria-label={`Remove ${env || "environment"}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
