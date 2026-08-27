"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddSecretDialog } from "@/components/AddSecretDialog";
import { ImportEnvDialog } from "@/components/ImportEnvDialog";
import { AppEmptyState } from "@/components/AppPage";
import { Eye, EyeOff, RefreshCw, AlertTriangle, Copy, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

type SecretMeta = {
  id: string;
  key: string;
  needsRotation: boolean;
  latestVersion: number;
};

async function fetchSecrets(envId: string): Promise<SecretMeta[] | null> {
  const res = await fetch(withBasePath(`/api/environments/${envId}/secrets`));
  if (!res.ok) return null;
  return (await res.json()).secrets;
}

export default function SecretsClient({ envId, envName }: { envId: string; envName: string }) {
  const [secrets, setSecrets] = useState<SecretMeta[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [rotating, setRotating] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSecrets(envId).then((data) => {
      if (cancelled) return;
      if (data) {
        setSecrets(data);
        setLoadError(null);
      } else {
        setLoadError("Couldn't load secrets. Check your access and try again.");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [envId]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const data = await fetchSecrets(envId);
    if (data) setSecrets(data);
    else setLoadError("Couldn't load secrets. Check your access and try again.");
    setLoading(false);
  }

  async function fetchValue(id: string): Promise<string | null> {
    const res = await fetch(withBasePath(`/api/secrets/${id}/value`));
    if (!res.ok) return null;
    return (await res.json()).value as string;
  }

  async function reveal(id: string) {
    const value = await fetchValue(id);
    if (value === null) return;
    setRevealed((r) => ({ ...r, [id]: value }));
    setTimeout(() => {
      setRevealed((r) => {
        const n = { ...r };
        delete n[id];
        return n;
      });
    }, 30_000);
  }

  function hide(id: string) {
    setRevealed((r) => {
      const n = { ...r };
      delete n[id];
      return n;
    });
  }

  async function copyValue(id: string): Promise<boolean> {
    const existing = revealed[id];
    const value = existing ?? (await fetchValue(id));
    if (value === null) return false;
    await navigator.clipboard.writeText(value);
    return true;
  }

  const needsAttention = secrets?.some((s) => s.needsRotation) ?? false;

  return (
    <>
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="min-h-6 flex items-center">
            {needsAttention && (
              <Badge variant="warning" className="text-xs gap-1">
                <AlertTriangle className="size-3" />
                Needs attention
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ImportEnvDialog envId={envId} onImported={load} />
            <AddSecretDialog envId={envId} onCreated={load} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading secrets">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-muted/40" />
            ))}
          </div>
        ) : loadError ? (
          <div
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {loadError}
          </div>
        ) : !secrets || secrets.length === 0 ? (
          <AppEmptyState
            icon={<KeyRound />}
            title={`No secrets in ${envName}`}
            description="Add a secret manually or import a .env file."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ImportEnvDialog envId={envId} onImported={load} />
                <AddSecretDialog envId={envId} onCreated={load} />
              </div>
            }
          />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/20">
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Value
                  </TableHead>
                  <TableHead className="w-28">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((s) => (
                  <SecretRow
                    key={s.id}
                    secret={s}
                    value={revealed[s.id]}
                    onReveal={() => reveal(s.id)}
                    onHide={() => hide(s.id)}
                    onCopy={() => copyValue(s.id)}
                    onRotate={() => setRotating(s.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <RotateDialog
        secretKey={secrets?.find((s) => s.id === rotating)?.key ?? null}
        open={!!rotating}
        onClose={() => {
          setRotating(null);
          setRotateError(null);
        }}
        rotateError={rotateError}
        onRotateErrorDismiss={() => setRotateError(null)}
        onConfirm={async (value) => {
          if (!rotating) return;
          setRotateError(null);
          const res = await fetch(withBasePath(`/api/secrets/${rotating}/rotate`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setRotateError(body.error ?? "Couldn't rotate secret.");
            return;
          }
          setRotating(null);
          setRotateError(null);
          await load();
        }}
      />
    </>
  );
}

function SecretRow({
  secret,
  value,
  onReveal,
  onHide,
  onCopy,
  onRotate,
}: {
  secret: SecretMeta;
  value: string | undefined;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => Promise<boolean>;
  onRotate: () => void;
}) {
  const isRevealed = value !== undefined;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await onCopy();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <TableRow className="border-border bg-card hover:bg-muted/20 transition-colors duration-150">
      <TableCell className="font-mono text-sm text-foreground max-w-[12rem] sm:max-w-xs truncate">
        {secret.key}
        {secret.needsRotation && (
          <span className="sr-only"> (needs rotation)</span>
        )}
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={handleCopy}
          className="group max-w-full text-left truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          aria-label={isRevealed ? `Copy value of ${secret.key}` : `Copy hidden value of ${secret.key}`}
        >
          {isRevealed ? (
            <span className="font-mono text-xs text-primary bg-primary/8 px-2 py-0.5 rounded border border-primary/20 inline-block max-w-full truncate">
              {value}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tracking-widest select-none group-hover:text-foreground transition-colors duration-150">
              {"•".repeat(16)}
            </span>
          )}
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground min-h-9 min-w-9"
            aria-label={copied ? `Copied ${secret.key}` : `Copy ${secret.key}`}
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={isRevealed ? onHide : onReveal}
            className="text-muted-foreground hover:text-foreground min-h-9 min-w-9"
            aria-label={isRevealed ? `Hide ${secret.key}` : `Reveal ${secret.key}`}
            aria-pressed={isRevealed}
          >
            {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onRotate}
            className="text-muted-foreground hover:text-primary min-h-9 min-w-9"
            aria-label={`Rotate ${secret.key}`}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RotateDialog({
  secretKey,
  open,
  onClose,
  onConfirm,
  rotateError,
  onRotateErrorDismiss,
}: {
  secretKey: string | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void>;
  rotateError: string | null;
  onRotateErrorDismiss: () => void;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [manualValue, setManualValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setMode("auto");
    setManualValue("");
  }

  async function handleConfirm() {
    const value =
      mode === "auto"
        ? crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
        : manualValue.trim();
    if (!value) return;
    setSubmitting(true);
    await onConfirm(value);
    setSubmitting(false);
    reset();
  }

  const canSubmit = mode === "auto" || manualValue.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          onRotateErrorDismiss();
          reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rotate secret</DialogTitle>
          {secretKey && (
            <DialogDescription>
              <span className="font-mono text-xs text-foreground">{secretKey}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div
            role="group"
            aria-label="Rotation mode"
            className="flex rounded-lg border border-border overflow-hidden text-sm"
          >
            {(["auto", "manual"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMode(opt)}
                aria-pressed={mode === opt}
                className={cn(
                  "flex-1 py-2 text-center text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  mode === opt
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt === "auto" ? "Auto-generate" : "Enter manually"}
              </button>
            ))}
          </div>

          {mode === "manual" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">New value</span>
              <textarea
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                rows={3}
                placeholder="New secret value"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                autoFocus
              />
            </label>
          )}

          <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs text-warning leading-relaxed">
            This updates the value immediately for everyone with access. This can&apos;t be undone.
          </div>

          {rotateError && (
            <p className="text-sm text-destructive" role="alert">
              {rotateError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              onRotateErrorDismiss();
              reset();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting}>
            {submitting ? "Rotating…" : "Rotate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
