"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import SecretsClient from "./SecretsClient";

type Env = { id: string; name: string };

export default function ProjectDetailClient({
  environments,
}: {
  environments: Env[];
}) {
  const [activeId, setActiveId] = useState(environments[0]?.id ?? "");

  const activeEnv =
    environments.find((e) => e.id === activeId) ?? environments[0];

  if (!activeEnv) return null;

  return (
    <div>
      {/* Tab strip + new-secret button */}
      <div className="flex items-end justify-between border-b border-border mb-6">
        <div className="flex gap-0">
          {environments.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => setActiveId(env.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative",
                env.id === activeId
                  ? "text-foreground after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {env.name}
            </button>
          ))}
        </div>
      </div>

      <SecretsClient
        key={`${activeEnv.id}`}
        envId={activeEnv.id}
        envName={activeEnv.name}
      />
    </div>
  );
}
