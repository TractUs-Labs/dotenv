"use client";

import { useState } from "react";
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
import { Upload } from "lucide-react";
import { parseEnvFile } from "@/lib/env-parser/parse-dotenv";

type ParsedPair = { key: string; value: string };

type Props = { envId: string; onImported: () => void };

export function ImportEnvDialog({ envId, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pairs: ParsedPair[] = raw.trim() ? parseEnvFile(raw) : [];

  function handleClose(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setRaw("");
      setResult(null);
      setError(null);
    }
  }

  async function submit() {
    if (!pairs.length) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/environments/${envId}/secrets/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secrets: pairs }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Import failed. Check you have member access.");
      return;
    }
    const data: { created: number; skipped: string[] } = await res.json();
    setResult(data);
    onImported();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1.5 text-xs" />}>
        <Upload className="w-3.5 h-3.5" />
        Import .env
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import .env file</DialogTitle>
          <DialogDescription>
            Paste your <code className="font-mono text-xs">.env</code> file contents. Comments and blank lines are ignored. Existing keys are skipped.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-green-600">{result.created}</span> secret{result.created !== 1 ? "s" : ""} imported.
            </p>
            {result.skipped.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Skipped (already exist):</p>
                <div className="flex flex-wrap gap-1">
                  {result.skipped.map((k) => (
                    <code key={k} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                      {k}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 space-y-3">
            <textarea
              className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk-...\n# comments are ignored"}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              autoFocus
              spellCheck={false}
            />
            {pairs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pairs.length} variable{pairs.length !== 1 ? "s" : ""} detected
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={!pairs.length || submitting}>
              {submitting ? "Importing…" : `Import ${pairs.length || ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
