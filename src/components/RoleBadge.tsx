import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function RoleBadge({ role }: { role: string }) {
  const variant = role === "owner" || role === "admin" ? "default" : "outline";
  return (
    <Badge variant={variant} className="font-mono text-[10px] uppercase tracking-wide">
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}
