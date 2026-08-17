"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";

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
  const [newValue, setNewValue] = useState("");
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

  async function reveal(id: string) {
    const res = await fetch(`/api/secrets/${id}/value`);
    if (res.ok) {
      const { value } = await res.json();
      setRevealed((r) => ({ ...r, [id]: value }));
      // auto-hide after 30 s
      setTimeout(() => setRevealed((r) => { const n = { ...r }; delete n[id]; return n; }), 30_000);
    }
  }

  function hide(id: string) {
    setRevealed((r) => { const n = { ...r }; delete n[id]; return n; });
  }

  async function confirmRotate() {
    if (!rotating || !newValue.trim()) return;
    await fetch(`/api/secrets/${rotating}/rotate`, {
      method: "POST",
      body: JSON.stringify({ value: newValue }),
    });
    setRotating(null);
    setNewValue("");
    await load();
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {envName}
          </h2>
          {secrets && secrets.some((s) => s.needsRotation) && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" />
              Needs attention
            </Badge>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32 bg-muted" />
                    <Skeleton className="h-3 w-24 bg-muted/60" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 bg-muted" />
                    <Skeleton className="h-8 w-20 bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : secrets && secrets.length === 0 ? (
            <div className="px-4 py-10 text-center bg-card">
              <p className="text-sm text-muted-foreground">No secrets in this environment.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(secrets ?? []).map((s) => (
                <SecretRow
                  key={s.id}
                  secret={s}
                  value={revealed[s.id]}
                  onReveal={() => reveal(s.id)}
                  onHide={() => hide(s.id)}
                  onRotate={() => setRotating(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rotate dialog */}
      <Dialog open={!!rotating} onOpenChange={(open) => { if (!open) { setRotating(null); setNewValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate secret</DialogTitle>
            <DialogDescription>
              Enter the new value. The old version is preserved in history.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              placeholder="New secret value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="font-mono text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmRotate()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRotating(null); setNewValue(""); }}>
              Cancel
            </Button>
            <Button onClick={confirmRotate} disabled={!newValue.trim()}>
              Rotate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SecretRow({
  secret,
  value,
  onReveal,
  onHide,
  onRotate,
}: {
  secret: SecretMeta;
  value: string | undefined;
  onReveal: () => void;
  onHide: () => void;
  onRotate: () => void;
}) {
  const isRevealed = value !== undefined;
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (!isRevealed) return;
    setSecondsLeft(30);
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRevealed]);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card group hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground truncate">{secret.key}</span>
          {secret.needsRotation && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />
              rotate
            </Badge>
          )}
        </div>

        {/* Value reveal area */}
        <div className="mt-1 h-5 flex items-center gap-2">
          {isRevealed ? (
            <>
              <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-0.5 rounded border border-primary/20 inline-block max-w-xs truncate">
                {value}
              </code>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0" aria-live="polite">
                auto-hides in {secondsLeft}s
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground font-mono select-none tracking-widest">
              {"•".repeat(16)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 shrink-0">
        {isRevealed ? (
          <Button size="sm" variant="ghost" onClick={onHide} className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <EyeOff className="w-3.5 h-3.5" />
            Hide
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onReveal} className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Eye className="w-3.5 h-3.5" />
            Reveal
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onRotate} className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-primary">
          <RefreshCw className="w-3.5 h-3.5" />
          Rotate
        </Button>
      </div>
    </div>
  );
}
