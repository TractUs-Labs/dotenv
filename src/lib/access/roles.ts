export type Role = "owner" | "admin" | "member" | "viewer";

const RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export function roleRank(role: Role): number {
  return RANK[role];
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export function highestRole(roles: Role[]): Role | null {
  if (roles.length === 0) return null;
  return roles.reduce((a, b) => (RANK[a] >= RANK[b] ? a : b));
}
