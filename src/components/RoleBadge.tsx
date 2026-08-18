import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  owner: {
    label: "Owner",
    className: "bg-primary/15 text-primary border-primary/20",
  },
  admin: {
    label: "Admin",
    className: "bg-env-dev-bg text-env-dev border-env-dev/20",
  },
  member: {
    label: "Member",
    className: "bg-muted/60 text-muted-foreground border-border",
  },
  viewer: {
    label: "Viewer",
    className: "bg-transparent text-muted-foreground border-border",
  },
};

export function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] ?? {
    label: role,
    className: "bg-muted/60 text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        style.className
      )}
    >
      {style.label}
    </span>
  );
}
