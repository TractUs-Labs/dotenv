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
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export function AddSecretDialog({ envId, onCreated }: { envId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!key.trim() || !value.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/environments/${envId}/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), value }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't add secret. Key may already exist in this environment.");
      return;
    }
    setOpen(false);
    setKey("");
    setValue("");
    onCreated();
  }

  function handleClose() {
    setKey("");
    setValue("");
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) handleClose();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" />}>
        <Plus className="w-3.5 h-3.5" />
        Add secret
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New secret</DialogTitle>
          <DialogDescription>Stored encrypted at rest, versioned from the first write.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <Input
            placeholder="STRIPE_SECRET_KEY"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono text-sm"
            autoFocus
          />
          <textarea
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); handleClose(); }}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!key.trim() || !value.trim() || submitting}>
            {submitting ? "Adding…" : "Add secret"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
