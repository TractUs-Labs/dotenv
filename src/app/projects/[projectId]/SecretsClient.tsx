"use client";
import { useEffect, useState } from "react";

type SecretMeta = { id: string; key: string; needsRotation: boolean; latestVersion: number };

export default function SecretsClient({ envId, envName }: { envId: string; envName: string }) {
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch(`/api/environments/${envId}/secrets`);
    if (res.ok) setSecrets((await res.json()).secrets);
  }
  useEffect(() => { load(); }, [envId]);

  async function reveal(id: string) {
    const res = await fetch(`/api/secrets/${id}/value`);
    if (res.ok) {
      const { value } = await res.json();
      setRevealed((r) => ({ ...r, [id]: value }));
    }
  }
  async function rotate(id: string) {
    const value = prompt("New value?");
    if (value == null) return;
    await fetch(`/api/secrets/${id}/rotate`, { method: "POST", body: JSON.stringify({ value }) });
    await load();
  }

  return (
    <section>
      <h2>{envName}</h2>
      <ul>
        {secrets.map((s) => (
          <li key={s.id}>
            <strong>{s.key}</strong>
            {s.needsRotation && <span style={{ color: "crimson" }}> ⚠ needs rotation</span>}
            <button onClick={() => reveal(s.id)}>reveal</button>
            <button onClick={() => rotate(s.id)}>rotate</button>
            {revealed[s.id] && <code> {revealed[s.id]}</code>}
          </li>
        ))}
      </ul>
    </section>
  );
}
