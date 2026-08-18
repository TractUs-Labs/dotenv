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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setKey("");
          setValue("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1.5 text-xs" />}>
        <Plus className="w-3.5 h-3.5" />
        Add secret
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add secret</DialogTitle>
          <DialogDescription>Stored encrypted at rest, versioned from the first write.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <Input
            placeholder="KEY_NAME"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono text-sm"
            autoFocus
          />
          <Input
            type="password"
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!key.trim() || !value.trim() || submitting}>
            {submitting ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
