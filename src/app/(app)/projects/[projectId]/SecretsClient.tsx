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
import { Input } from "@/components/ui/input";
import { AddSecretDialog } from "@/components/AddSecretDialog";
import { ImportEnvDialog } from "@/components/ImportEnvDialog";
import { Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SecretMeta = {
  id: string;
  key: string;
  needsRotation: boolean;
  latestVersion: number;
};

export default function SecretsClient({ envId, envName }: { envId: string; envName: string }) {
  const [secrets, setSecrets] = useState<SecretMeta[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [rotating, setRotating] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/environments/${envId}/secrets`);
    if (res.ok) setSecrets((await res.json()).secrets);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [envId]);

  async function fetchValue(id: string): Promise<string | null> {
    const res = await fetch(`/api/secrets/${id}/value`);
    if (!res.ok) return null;
    return (await res.json()).value as string;
  }

  async function reveal(id: string) {
    const value = await fetchValue(id);
    if (value === null) return;
    setRevealed((r) => ({ ...r, [id]: value }));
    setTimeout(
      () => setRevealed((r) => { const n = { ...r }; delete n[id]; return n; }),
      30_000
    );
  }

  function hide(id: string) {
    setRevealed((r) => { const n = { ...r }; delete n[id]; return n; });
  }

  async function copyValue(id: string): Promise<boolean> {
    const existing = revealed[id];
    const value = existing ?? (await fetchValue(id));
    if (value === null) return false;
    await navigator.clipboard.writeText(value);
    return true;
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {envName}
            </h2>
            {secrets && secrets.some((s) => s.needsRotation) && (
              <Badge variant="warning" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" />
                Needs attention
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ImportEnvDialog envId={envId} onImported={load} />
            <AddSecretDialog envId={envId} onCreated={load} />
          </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-muted/40" />
          ))}
        </div>
      ) : !secrets || secrets.length === 0 ? (
        <div className="py-12 text-center border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No secrets in {envName}.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1.5fr_auto] gap-0 border-b border-border bg-muted/20 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</span>
            <span className="w-24" />
          </div>

          <div className="divide-y divide-border">
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
          </div>
        </div>
      )}

      <RotateDialog
        secretKey={secrets?.find((s) => s.id === rotating)?.key ?? null}
        open={!!rotating}
        onClose={() => { setRotating(null); setRotateError(null); }}
        rotateError={rotateError}
        onRotateErrorDismiss={() => setRotateError(null)}
        onConfirm={async (value) => {
          if (!rotating) return;
          setRotateError(null);
          const res = await fetch(`/api/secrets/${rotating}/rotate`, {
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
    <div className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-0 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
      {/* Name */}
      <span className="font-mono text-sm text-foreground truncate pr-4">{secret.key}</span>

      {/* Value — click to copy */}
      <button
        type="button"
        onClick={handleCopy}
        title="Click to copy"
        className="group text-left truncate pr-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        {isRevealed ? (
          <span className="font-mono text-xs text-primary bg-primary/8 px-2 py-0.5 rounded border border-primary/20 inline-block max-w-full truncate">
            {value}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground tracking-widest select-none group-hover:text-foreground transition-colors">
            {"•".repeat(16)}
          </span>
        )}
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 w-24 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Copy value"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={isRevealed ? onHide : onReveal}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title={isRevealed ? "Hide" : "Show"}
        >
          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRotate}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          title="Rotate"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
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
        if (!o) { onClose(); onRotateErrorDismiss(); reset(); }
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
          {/* Segmented control */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(["auto", "manual"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMode(opt)}
                className={cn(
                  "flex-1 py-1.5 text-center text-sm transition-colors",
                  mode === opt
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt === "auto" ? "Auto-generate" : "Enter manually"}
              </button>
            ))}
          </div>

          {mode === "manual" && (
            <textarea
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              rows={3}
              placeholder="New secret value"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              autoFocus
            />
          )}

          {/* Warning callout */}
          <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs text-warning leading-relaxed">
            This updates the value immediately for everyone with access. This can&apos;t be undone.
          </div>

          {rotateError && (
            <p className="text-xs text-destructive">{rotateError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); onRotateErrorDismiss(); reset(); }}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting}>
            {submitting ? "Rotating…" : "Rotate secret"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
