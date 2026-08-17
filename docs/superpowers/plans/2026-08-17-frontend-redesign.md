# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic-SaaS-looking frontend with a distinct, technical, Doppler/Vercel-style dark UI, add a persistent sidebar, and build UI for backend flows that currently have none (create project, add secret, manage access, view audit log).

**Architecture:** A shared `(app)` Next.js route group holds one auth-gated layout (sidebar + role fetch) wrapping all authenticated pages; `/signin` stays outside it. Existing pages move into the group and get reskinned; two new pages (`/access`, `/audit`) are added, backed by one new read-only API route and one new query function. A design-token pass (OKLCH colors, Space Grotesk/JetBrains Mono, sharp-panel/small-control radius split) and a `warning`/`destructive` color-semantics split happen first so every later task builds on the final tokens.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@theme inline` token system), shadcn components on `@base-ui/react` primitives, Drizzle ORM + Postgres, `next/font/google`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-frontend-redesign-design.md`

## Global Constraints

- Dark-only theme; no light mode toggle exists or is planned.
- Color tokens are OKLCH, exact values from the spec's token table (Task 1 applies them verbatim — they are pre-verified for ≥4.5:1 contrast, do not re-tune without re-running the contrast method in the spec).
- Fonts: Space Grotesk (`--font-sans`) + JetBrains Mono (`--font-mono`), loaded via `next/font/google`, replacing Geist Sans/Mono.
- Shape: panels/cards/rows use `--radius-panel: 0.125rem` (sharp). Buttons/inputs/badges/dialogs use `--radius: 0.375rem` (small, for grip).
- No box-shadow elevation. Hover/active states use border-color and background-tint shifts only.
- Color semantics: `warning` (amber) is for non-destructive alerts (needs rotation). `destructive` (red) is reserved for the one actually irreversible action in the app (revoke access). Never reuse `destructive` for routine/expected states.
- No new UI test tooling is introduced (`vitest.config.ts` runs `environment: "node"`, includes only `tests/**/*.test.ts`). New backend/query logic gets Vitest tests following the exact conventions already in `tests/access/authorize.test.ts` and `tests/api/grants.test.ts`. New UI is verified via `tsc --noEmit` + `eslint` + manual reasoning about states (loading/empty/error/hover/focus), not a new test framework.
- Existing tests must continue to pass unmodified after every task — this is additive/UI work, not a change to existing business logic.

---

### Task 1: Design tokens & typefaces

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties consumed by every later task — `--color-warning`, `--color-warning-foreground`, `--radius-panel` (→ Tailwind utility `rounded-panel`), refreshed `--color-*` values for the existing token names (`--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--destructive`, `--destructive-foreground`, `--border`, etc. — same names, new OKLCH values). `--font-sans` / `--font-mono` now resolve to Space Grotesk / JetBrains Mono.

- [ ] **Step 1: Replace the color tokens in `globals.css`**

Replace the entire `:root { ... }` and `.dark { ... }` blocks (currently hex-based, lines ~74–132) with the OKLCH values below. Keep `.dark` identical to `:root` (same pattern as today — this app is dark-only, `.dark` is applied unconditionally on `<html>`).

```css
:root {
  --background: oklch(0.14 0.018 255);
  --foreground: oklch(0.94 0.008 255);
  --card: oklch(0.19 0.02 255);
  --card-foreground: oklch(0.94 0.008 255);
  --popover: oklch(0.19 0.02 255);
  --popover-foreground: oklch(0.94 0.008 255);
  --primary: oklch(0.68 0.19 255);
  --primary-foreground: oklch(0.14 0.018 255);
  --secondary: oklch(0.24 0.02 255);
  --secondary-foreground: oklch(0.94 0.008 255);
  --muted: oklch(0.24 0.02 255);
  --muted-foreground: oklch(0.68 0.02 255);
  --accent: oklch(0.24 0.02 255);
  --accent-foreground: oklch(0.94 0.008 255);
  --warning: oklch(0.75 0.15 80);
  --warning-foreground: oklch(0.14 0.02 80);
  --destructive: oklch(0.55 0.21 25);
  --destructive-foreground: oklch(0.98 0.005 25);
  --border: oklch(0.27 0.02 255);
  --input: oklch(0.27 0.02 255);
  --ring: oklch(0.68 0.19 255);
  --radius: 0.375rem;
  --panel-radius: 0.125rem;
  --sidebar: oklch(0.19 0.02 255);
  --sidebar-foreground: oklch(0.94 0.008 255);
  --sidebar-primary: oklch(0.68 0.19 255);
  --sidebar-primary-foreground: oklch(0.14 0.018 255);
  --sidebar-accent: oklch(0.24 0.02 255);
  --sidebar-accent-foreground: oklch(0.94 0.008 255);
  --sidebar-border: oklch(0.27 0.02 255);
  --sidebar-ring: oklch(0.68 0.19 255);
}

.dark {
  --background: oklch(0.14 0.018 255);
  --foreground: oklch(0.94 0.008 255);
  --card: oklch(0.19 0.02 255);
  --card-foreground: oklch(0.94 0.008 255);
  --popover: oklch(0.19 0.02 255);
  --popover-foreground: oklch(0.94 0.008 255);
  --primary: oklch(0.68 0.19 255);
  --primary-foreground: oklch(0.14 0.018 255);
  --secondary: oklch(0.24 0.02 255);
  --secondary-foreground: oklch(0.94 0.008 255);
  --muted: oklch(0.24 0.02 255);
  --muted-foreground: oklch(0.68 0.02 255);
  --accent: oklch(0.24 0.02 255);
  --accent-foreground: oklch(0.94 0.008 255);
  --warning: oklch(0.75 0.15 80);
  --warning-foreground: oklch(0.14 0.02 80);
  --destructive: oklch(0.55 0.21 25);
  --destructive-foreground: oklch(0.98 0.005 25);
  --border: oklch(0.27 0.02 255);
  --input: oklch(0.27 0.02 255);
  --ring: oklch(0.68 0.19 255);
  --sidebar: oklch(0.19 0.02 255);
  --sidebar-foreground: oklch(0.94 0.008 255);
  --sidebar-primary: oklch(0.68 0.19 255);
  --sidebar-primary-foreground: oklch(0.14 0.018 255);
  --sidebar-accent: oklch(0.24 0.02 255);
  --sidebar-accent-foreground: oklch(0.94 0.008 255);
  --sidebar-border: oklch(0.27 0.02 255);
  --sidebar-ring: oklch(0.68 0.19 255);
}
```

- [ ] **Step 2: Add `warning` and `radius-panel` to the `@theme inline` mapping block**

In the same file, in the existing `@theme inline { ... }` block (top of file, currently lines ~36–71), add these lines alongside the existing `--color-destructive` / `--radius-lg` entries (Tailwind v4 auto-generates `bg-warning`/`text-warning`/`rounded-panel` utilities from `--color-warning`/`--color-warning-foreground`/`--radius-panel`).

The theme-namespace key must be a **different name** from the raw variable it points to — this is why every existing entry in this block (`--color-primary: var(--primary)`, `--radius-lg: var(--radius)`, etc.) has two different names, never the same name on both sides. `--radius-panel: var(--radius-panel)` would be a self-reference and resolve to nothing; that's why Step 1 named the raw variable `--panel-radius`, not `--radius-panel`:

```css
  --color-warning-foreground: var(--warning-foreground);
  --color-warning: var(--warning);
  --radius-panel: var(--panel-radius);
```

Add `--color-warning-foreground` / `--color-warning` right after the existing `--color-destructive` line, and `--radius-panel` right after the existing `--radius-2xl` line.

- [ ] **Step 3: Update the font variable references in `globals.css`**

Change:

```css
@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
```

to:

```css
@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: var(--font-space-grotesk);
  --font-mono: var(--font-jetbrains-mono);
```

- [ ] **Step 4: Swap the fonts loaded in `src/app/layout.tsx`**

Replace:

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

with:

```tsx
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});
```

And update the `<html>` tag's `className`:

```tsx
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
```

- [ ] **Step 5: Verify**

```bash
grep -c -- "--warning: oklch" src/app/globals.css       # expect 2 (root + .dark)
grep -c -- "--panel-radius: 0.125rem" src/app/globals.css  # expect 1 (root only, .dark has no radius vars)
grep -c -- "--color-warning: var(--warning)" src/app/globals.css  # expect 1 (theme mapping block only)
grep -c -- "--radius-panel: var(--panel-radius)" src/app/globals.css  # expect 1
npx tsc --noEmit
```

Expected: all four greps return the counts noted, `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: refresh design tokens to OKLCH palette, Space Grotesk/JetBrains Mono"
```

---

### Task 2: Shared component layer — warning variant, radius corrections

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/dialog.tsx`

**Interfaces:**
- Consumes: `--color-warning`, `--color-warning-foreground`, `--radius` from Task 1.
- Produces: `<Badge variant="warning">` and `<Button variant="warning">`, consumed by Task 6 (SecretsClient rotation badges). `DialogContent`/`DialogFooter` corner radius drops from `rounded-xl`/`rounded-b-xl` to `rounded-lg`/`rounded-b-lg` (both map to `--radius`, i.e. 6px, matching the "controls get small radius" rule) — consumed visually by every dialog added in later tasks.

- [ ] **Step 1: Add the `warning` variant to `badgeVariants` in `src/components/ui/badge.tsx`**

In the `variants.variant` object, add a `warning` entry alongside the existing `destructive` one:

```ts
        warning:
          "bg-warning/10 text-warning focus-visible:ring-warning/20 dark:bg-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20",
```

- [ ] **Step 2: Add the `warning` variant to `buttonVariants` in `src/components/ui/button.tsx`**

In the `variants.variant` object, add a `warning` entry alongside the existing `destructive` one:

```ts
        warning:
          "bg-warning/10 text-warning hover:bg-warning/20 focus-visible:border-warning/40 focus-visible:ring-warning/20 dark:bg-warning/20 dark:hover:bg-warning/30 dark:focus-visible:ring-warning/40",
```

- [ ] **Step 3: Sharpen dialog corners in `src/components/ui/dialog.tsx`**

In `DialogContent`, change `rounded-xl` to `rounded-lg` in the class string. In `DialogFooter`, change `rounded-b-xl` to `rounded-b-lg`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx eslint src/components/ui/badge.tsx src/components/ui/button.tsx src/components/ui/dialog.tsx
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/button.tsx src/components/ui/dialog.tsx
git commit -m "feat: add warning variant to Badge/Button, sharpen dialog radius"
```

---

### Task 3: Shared org-role helper

**Files:**
- Modify: `src/lib/access/authorize.ts`
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/grants/route.ts`
- Test: `tests/access/authorize.test.ts`

**Interfaces:**
- Produces: `getOrgRole(db: Db, userId: string): Promise<Role | null>` — exported from `@/lib/access/authorize`. Consumed by Task 4 (`(app)/layout.tsx` sidebar nav gating), Task 7 (`GET /api/audit-log`), Task 9 (`/access` and `/audit` page gating).

Both `src/app/api/projects/route.ts` and `src/app/api/grants/route.ts` currently define byte-for-byte identical local functions (`orgRole` / `requireOrgRole`) that query the org-scoped grant for a user. This task extracts that into one shared, tested function and removes the duplicates.

- [ ] **Step 1: Write the failing test**

Add to `tests/access/authorize.test.ts` (new `describe` block, same file, after the existing `describe("authorize", ...)` block):

```ts
import { getOrgRole } from "@/lib/access/authorize";

describe("getOrgRole", () => {
  it("returns null when the user has no org grant", async () => {
    const user = await seedUser("noone@example.com");
    expect(await getOrgRole(testDb, user.id)).toBeNull();
  });

  it("returns the org-scoped role, ignoring project/environment-scoped grants", async () => {
    const { user, proj, env } = await fixture();
    await testDb.insert(grants).values({ userId: user.id, scopeType: "project", scopeId: proj.id, role: "owner" });
    await testDb.insert(grants).values({ userId: user.id, scopeType: "environment", scopeId: env.id, role: "owner" });
    expect(await getOrgRole(testDb, user.id)).toBeNull();

    await testDb.insert(grants).values({ userId: user.id, scopeType: "org", scopeId: null, role: "member" });
    expect(await getOrgRole(testDb, user.id)).toBe("member");
  });
});
```

(This reuses the existing `fixture()` helper and `grants` import already present at the top of the file — no new imports needed beyond `getOrgRole` itself.)

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/access/authorize.test.ts
```

Expected: FAIL — `getOrgRole` is not exported from `@/lib/access/authorize`.

- [ ] **Step 3: Implement `getOrgRole` in `src/lib/access/authorize.ts`**

The file's existing import line (`import { and, eq, or, isNull } from "drizzle-orm";`, line 2) already includes every name this function needs (`and`, `eq`, `isNull`) — no import changes required. Add the function itself, anywhere after the existing imports:

```ts
export async function getOrgRole(db: Db, userId: string): Promise<Role | null> {
  const rows = await db.select({ role: grants.role }).from(grants)
    .where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  return highestRole(rows.map((r) => r.role as Role));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/access/authorize.test.ts
```

Expected: PASS, all tests in the file green.

- [ ] **Step 5: Replace the duplicate in `src/app/api/projects/route.ts`**

Delete the local `orgRole` function:

```ts
async function orgRole(userId: string): Promise<Role | null> {
  const rows = await getDb().select().from(grants).where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  return highestRole(rows.map((r) => r.role as Role));
}
```

Replace its one call site (`const role = await orgRole(user.id);`) with `const role = await getOrgRole(getDb(), user.id);`.

In this file, `grants`, `and`, `eq`, `isNull`, `highestRole`, and the `Role` type are used **only** by the deleted `orgRole` function — nothing else in `GET`/`POST` touches them (`POST` still uses `roleAtLeast`, which stays). So the full import block:

```ts
import { grants } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { roleAtLeast, highestRole, Role } from "@/lib/access/roles";
```

becomes:

```ts
import { roleAtLeast } from "@/lib/access/roles";
import { getOrgRole } from "@/lib/access/authorize";
```

(the `@/lib/db/schema` and `drizzle-orm` import lines are deleted entirely; `roleAtLeast` is the only surviving name from `@/lib/access/roles`, so `highestRole` and `Role` drop out of that line).

- [ ] **Step 6: Replace the duplicate in `src/app/api/grants/route.ts`**

Delete the local `requireOrgRole` function:

```ts
async function requireOrgRole(userId: string): Promise<Role | null> {
  const rows = await getDb().select().from(grants).where(and(eq(grants.userId, userId), eq(grants.scopeType, "org"), isNull(grants.scopeId)));
  return highestRole(rows.map((r) => r.role as Role));
}
```

Replace every call site (`await requireOrgRole(user.id)`, 3 occurrences: in `GET`, `POST`, `DELETE`) with `await getOrgRole(getDb(), user.id)`. Add:

```ts
import { getOrgRole } from "@/lib/access/authorize";
```

Unlike `projects/route.ts` in Step 5, **do not** remove any existing imports here: `grants`, `and`, `eq`, `isNull`, `highestRole`, and `Role` are all still used elsewhere in this file independent of the deleted function — `DELETE`'s `targetRows` query uses `and`/`eq`/`isNull`/`grants` directly, and `highestRole`/`Role` are used for `targetRole` in that same handler. Only the `requireOrgRole` function body and its 3 call sites change.

- [ ] **Step 7: Run the full existing test suite for these two routes**

```bash
npx vitest run tests/api/projects.test.ts tests/api/grants.test.ts tests/access/authorize.test.ts
npx tsc --noEmit
```

Expected: all PASS, no type errors (this is a pure refactor — behavior must be identical).

- [ ] **Step 8: Commit**

```bash
git add src/lib/access/authorize.ts src/app/api/projects/route.ts src/app/api/grants/route.ts tests/access/authorize.test.ts
git commit -m "refactor: extract shared getOrgRole helper, remove duplicate org-role queries"
```

---

### Task 4: AppSidebar + auth-gated route group

**Files:**
- Create: `src/components/AppSidebar.tsx`
- Create: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getOrgRole` (Task 3), `roleAtLeast` from `@/lib/access/roles`, `auth`/`signOut` from `@/lib/auth/auth`, `getDb` from `@/lib/db/client`.
- Produces: `AppSidebar({ email, isOrgAdmin, signOutAction }): JSX.Element` — a client component. The `(app)` layout performs the auth redirect and role fetch once; every page moved into the group in Tasks 5–6, 9 relies on this and no longer does its own `auth()`/redirect/sign-out-action boilerplate.

This route group does not change any URL — `src/app/(app)/page.tsx` still serves `/`, `src/app/(app)/projects/[projectId]/page.tsx` still serves `/projects/[projectId]`. Only the file location changes (parenthesized segments are excluded from the URL). This task creates the layout and sidebar; Tasks 5 and 6 move the existing pages into the group.

- [ ] **Step 1: Create `src/components/AppSidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldCheck, FolderLock, Users, ScrollText, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof FolderLock };

const BASE_NAV: NavItem[] = [{ href: "/", label: "Projects", icon: FolderLock }];
const ADMIN_NAV: NavItem[] = [
  { href: "/access", label: "Access", icon: Users },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppSidebar({
  email,
  isOrgAdmin,
  signOutAction,
}: {
  email: string;
  isOrgAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const items = isOrgAdmin ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <span className="font-semibold tracking-tight text-sidebar-foreground">dotenv</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 px-4 h-14 border-t border-border text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer bg-transparent"
          aria-label="User menu"
        >
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials(email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-sidebar-foreground truncate">{email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer gap-2"
            onClick={() => formRef.current?.requestSubmit()}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form ref={formRef} action={signOutAction} className="hidden" />
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/layout.tsx`**

```tsx
import { auth, signOut } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { AppSidebar } from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const userId = (session as unknown as { userId?: string }).userId;
  if (!userId) redirect("/signin");
  const email = session.user.email;

  const role = await getOrgRole(getDb(), userId);
  const isOrgAdmin = !!role && roleAtLeast(role, "admin");

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/signin" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar email={email} isOrgAdmin={isOrgAdmin} signOutAction={signOutAction} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx eslint src/components/AppSidebar.tsx "src/app/(app)/layout.tsx"
```

Expected: no errors. (The layout has no page under it yet in this task, so there's nothing to render — Task 5 moves the first page into the group and is where this becomes visually checkable.)

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: add AppSidebar and auth-gated (app) route group layout"
```

---

### Task 5: Move & redesign the Projects list

**Files:**
- Create: `src/app/(app)/page.tsx` (moved from `src/app/page.tsx`)
- Delete: `src/app/page.tsx`
- Create: `src/components/NewProjectDialog.tsx`
- Modify: `src/lib/projects/projects.ts`
- Test: `tests/projects/projects.test.ts`

**Interfaces:**
- Consumes: `AppLayout` (Task 4) now wraps this page — no local auth check or `AppHeader` needed.
- Produces: `listProjectsForUserWithCounts(db: Db, userId: string): Promise<Array<Project & { environmentCount: number }>>` in `@/lib/projects/projects`, used only by this page. `NewProjectDialog(): JSX.Element` (no props — posts to `/api/projects` and redirects), reused nowhere else but structured as its own component per the file-structure convention (one clear responsibility).

- [ ] **Step 1: Write the failing test for `listProjectsForUserWithCounts`**

Add to `tests/projects/projects.test.ts`:

```ts
import { listProjectsForUserWithCounts } from "@/lib/projects/projects";
```

```ts
it("includes environment counts and only returns projects the user can access", async () => {
  const u = await seedUser("carol@example.com");
  const { project } = await createProject(testDb, { name: "Has Access", userId: u.id });
  await createProject(testDb, { name: "No Access", userId: u.id });
  await testDb.insert(schema.grants).values({ userId: u.id, scopeType: "project", scopeId: project.id, role: "viewer" });

  const rows = await listProjectsForUserWithCounts(testDb, u.id);
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("Has Access");
  expect(rows[0].environmentCount).toBe(3);
});
```

This needs `schema` imported — add `import * as schema from "@/lib/db/schema";` to the top of the test file alongside the existing imports (the file currently imports `createProject, listProjects, getEnvironments` directly from `@/lib/projects/projects`; keep those and add the new import name to that same line).

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/projects/projects.test.ts
```

Expected: FAIL — `listProjectsForUserWithCounts` is not exported.

- [ ] **Step 3: Implement `listProjectsForUserWithCounts` in `src/lib/projects/projects.ts`**

Add `count` to the existing `drizzle-orm` import (currently `import { and, eq, inArray, isNull } from "drizzle-orm";`):

```ts
import { and, count, eq, inArray, isNull } from "drizzle-orm";
```

Add this function after `listProjectsForUser`:

```ts
export async function listProjectsForUserWithCounts(
  db: Db,
  userId: string,
): Promise<Array<Project & { environmentCount: number }>> {
  const base = await listProjectsForUser(db, userId);
  if (base.length === 0) return [];
  const ids = base.map((p) => p.id);
  const counts = await db
    .select({ projectId: environments.projectId, count: count() })
    .from(environments)
    .where(inArray(environments.projectId, ids))
    .groupBy(environments.projectId);
  const countMap = new Map(counts.map((c) => [c.projectId, Number(c.count)]));
  return base.map((p) => ({ ...p, environmentCount: countMap.get(p.id) ?? 0 }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/projects/projects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `src/components/NewProjectDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't create project. Check you have admin access.");
      return;
    }
    const { project } = await res.json();
    setOpen(false);
    setName("");
    router.push(`/projects/${project.id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setName("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-3.5 h-3.5" />
        New project
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Creates dev, staging, and prod environments automatically.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Move `src/app/page.tsx` to `src/app/(app)/page.tsx` with the redesigned content**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
```

Replace the full contents of `src/app/(app)/page.tsx` with:

```tsx
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { listProjectsForUserWithCounts } from "@/lib/projects/projects";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { FolderLock, ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string }).userId!;
  const projects = await listProjectsForUserWithCounts(getDb(), userId);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {projects.length === 0 ? "No projects yet" : "Your projects"}
          </h1>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-panel border border-border overflow-hidden divide-y divide-border">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderLock className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-muted-foreground font-mono">
                  {p.environmentCount} env{p.environmentCount !== 1 ? "s" : ""}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-panel">
      <div className="w-14 h-14 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
        <FolderLock className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No projects</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Create a project to get started, or ask an admin to add you to one.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/(app)/page.tsx" src/components/NewProjectDialog.tsx src/lib/projects/projects.ts
npx vitest run tests/projects/projects.test.ts tests/api/projects.test.ts
```

Expected: no type/lint errors, both test files PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/page.tsx" src/components/NewProjectDialog.tsx src/lib/projects/projects.ts tests/projects/projects.test.ts
git commit -m "feat: move Projects page into (app) shell, redesign as dense list, add New Project flow"
```

---

### Task 6: Move & redesign Project detail — Add Secret flow, warning/destructive split

**Files:**
- Create: `src/app/(app)/projects/[projectId]/page.tsx` (moved)
- Create: `src/app/(app)/projects/[projectId]/SecretsClient.tsx` (moved)
- Delete: `src/app/projects/[projectId]/page.tsx`
- Delete: `src/app/projects/[projectId]/SecretsClient.tsx`
- Create: `src/components/AddSecretDialog.tsx`

**Interfaces:**
- Consumes: `AppLayout` (Task 4, no local auth/sidebar needed), `getProject`/`getEnvironments` from `@/lib/projects/projects` (already exist), `Badge`/`Button` `warning` variant (Task 2).
- Produces: `AddSecretDialog({ envId, onCreated }: { envId: string; onCreated: () => void }): JSX.Element`, used inside `SecretsClient`.

- [ ] **Step 1: Move the directory**

```bash
mkdir -p "src/app/(app)/projects/[projectId]"
git mv "src/app/projects/[projectId]/page.tsx" "src/app/(app)/projects/[projectId]/page.tsx"
git mv "src/app/projects/[projectId]/SecretsClient.tsx" "src/app/(app)/projects/[projectId]/SecretsClient.tsx"
```

- [ ] **Step 2: Replace `src/app/(app)/projects/[projectId]/page.tsx` in full**

```tsx
import { getDb } from "@/lib/db/client";
import { getEnvironments, getProject } from "@/lib/projects/projects";
import { notFound } from "next/navigation";
import SecretsClient from "./SecretsClient";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = getDb();
  const project = await getProject(db, projectId);
  if (!project) notFound();
  const environments = await getEnvironments(db, projectId);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground text-sm">
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground text-sm font-medium">{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {environments.length} environment{environments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Separator className="mb-8 bg-border" />

      {environments.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">No environments configured for this project.</p>
        </div>
      ) : (
        environments.map((e) => <SecretsClient key={e.id} envId={e.id} envName={e.name} />)
      )}
    </main>
  );
}
```

- [ ] **Step 3: Create `src/components/AddSecretDialog.tsx`**

```tsx
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
```

- [ ] **Step 4: Edit `src/app/(app)/projects/[projectId]/SecretsClient.tsx`**

Add the import:

```tsx
import { AddSecretDialog } from "@/components/AddSecretDialog";
```

Change the section header block from:

```tsx
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
```

to:

```tsx
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
          <AddSecretDialog envId={envId} onCreated={load} />
        </div>

        <div className="rounded-panel border border-border overflow-hidden">
```

In `SecretRow`, change the per-secret badge's variant from `destructive` to `warning`:

```tsx
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 shrink-0">
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/(app)/projects/[projectId]/page.tsx" "src/app/(app)/projects/[projectId]/SecretsClient.tsx" src/components/AddSecretDialog.tsx
npx vitest run tests/api/secrets.test.ts tests/secrets/secrets.test.ts tests/secrets/rotate.test.ts
```

Expected: no errors, existing secrets tests still PASS (this task doesn't touch `src/lib/secrets/secrets.ts`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/projects" src/components/AddSecretDialog.tsx
git commit -m "feat: move project detail into (app) shell, add Add Secret flow, split warning/destructive"
```

---

### Task 7: Audit log backend — query + read API

**Files:**
- Create: `src/components/RoleBadge.tsx`
- Modify: `src/lib/audit/audit.ts`
- Create: `src/app/api/audit-log/route.ts`
- Test: `tests/audit/audit.test.ts` (extend)
- Test: `tests/api/audit-log.test.ts` (new)

**Interfaces:**
- Produces: `listAuditLog(db: Db, opts?: { limit?: number }): Promise<Array<{ id: string; action: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: Date; actorEmail: string | null }>>` from `@/lib/audit/audit`, consumed by Task 8's Audit Log page and by the new API route below. `RoleBadge({ role }: { role: string }): JSX.Element` from `@/components/RoleBadge`, consumed by Task 8's Access page.
- `GET /api/audit-log` returns `{ entries: <same shape as listAuditLog> }`, 403 for non-org-admins, mirroring the existing pattern in `src/app/api/grants/route.ts`.

- [ ] **Step 1: Write `RoleBadge`**

```tsx
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
```

- [ ] **Step 2: Write the failing test for `listAuditLog`**

Add to `tests/audit/audit.test.ts` (new `describe` block, needs `listAuditLog` added to the existing `import { writeAudit } from "@/lib/audit/audit";` line):

```ts
import { writeAudit, listAuditLog } from "@/lib/audit/audit";
```

```ts
describe("listAuditLog", () => {
  it("returns entries newest first, joined to the actor's email", async () => {
    const alice = await seedUser("alice@example.com");
    const bob = await seedUser("bob@example.com");
    await writeAudit(testDb, { actorId: alice.id, action: "project.create", metadata: { name: "P1" } });
    await writeAudit(testDb, { actorId: bob.id, action: "grant.create", metadata: { role: "member" } });

    const rows = await listAuditLog(testDb);
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("grant.create");
    expect(rows[0].actorEmail).toBe("bob@example.com");
    expect(rows[1].action).toBe("project.create");
    expect(rows[1].actorEmail).toBe("alice@example.com");
  });

  it("respects the limit option", async () => {
    const u = await seedUser("carol@example.com");
    for (let i = 0; i < 5; i++) {
      await writeAudit(testDb, { actorId: u.id, action: `event.${i}` });
    }
    expect(await listAuditLog(testDb, { limit: 2 })).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run tests/audit/audit.test.ts
```

Expected: FAIL — `listAuditLog` is not exported.

- [ ] **Step 4: Implement `listAuditLog` in `src/lib/audit/audit.ts`**

Add these imports to the top of the file:

```ts
import { desc, eq } from "drizzle-orm";
import { auditLog, users } from "@/lib/db/schema";
```

(Replace the existing `import { auditLog } from "@/lib/db/schema";` line with the combined `import { auditLog, users } from "@/lib/db/schema";` above.)

Add the function:

```ts
export async function listAuditLog(
  db: Db,
  opts: { limit?: number } = {},
): Promise<Array<{
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
  actorEmail: string | null;
}>> {
  const limit = opts.limit ?? 100;
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run tests/audit/audit.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write the failing test for the API route**

Create `tests/api/audit-log.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { resetDb, seedUser, testDb } from "../helpers/db";
import { grants } from "@/lib/db/schema";
import { writeAudit } from "@/lib/audit/audit";

vi.mock("@/lib/db/client", () => ({ getDb: () => testDb }));
const requireUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock(), UnauthorizedError: class extends Error {} }));

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });

describe("audit-log API", () => {
  it("returns entries for an org admin", async () => {
    const admin = await seedUser("admin@example.com");
    await testDb.insert(grants).values({ userId: admin.id, scopeType: "org", scopeId: null, role: "admin" });
    await writeAudit(testDb, { actorId: admin.id, action: "project.create" });
    requireUserMock.mockResolvedValue({ id: admin.id, email: admin.email });

    const { GET } = await import("@/app/api/audit-log/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].action).toBe("project.create");
  });

  it("returns 403 for a non-admin", async () => {
    const member = await seedUser("m@example.com");
    await testDb.insert(grants).values({ userId: member.id, scopeType: "org", scopeId: null, role: "member" });
    requireUserMock.mockResolvedValue({ id: member.id, email: member.email });

    const { GET } = await import("@/app/api/audit-log/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
npx vitest run tests/api/audit-log.test.ts
```

Expected: FAIL — `@/app/api/audit-log/route` does not exist.

- [ ] **Step 8: Implement `src/app/api/audit-log/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";

export async function GET() {
  try {
    const user = await requireUser();
    const role = await getOrgRole(getDb(), user.id);
    if (!role || !roleAtLeast(role, "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ entries: await listAuditLog(getDb()) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx vitest run tests/api/audit-log.test.ts
npx tsc --noEmit
npx eslint src/components/RoleBadge.tsx src/lib/audit/audit.ts src/app/api/audit-log/route.ts
```

Expected: all PASS, no lint/type errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/RoleBadge.tsx src/lib/audit/audit.ts src/app/api/audit-log/route.ts tests/audit/audit.test.ts tests/api/audit-log.test.ts
git commit -m "feat: add listAuditLog query and GET /api/audit-log endpoint"
```

---

### Task 8: Audit Log page

**Files:**
- Create: `src/app/(app)/audit/page.tsx`

**Interfaces:**
- Consumes: `getOrgRole` (Task 3), `listAuditLog` (Task 7), `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` from `@/components/ui/table`.

- [ ] **Step 1: Create `src/app/(app)/audit/page.tsx`**

```tsx
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listAuditLog } from "@/lib/audit/audit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AuditLogPage() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const role = await getOrgRole(db, userId);
  if (!role || !roleAtLeast(role, "admin")) notFound();

  const entries = await listAuditLog(db);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Audit</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">Most recent {entries.length} events.</p>
      </div>

      {entries.length === 0 ? (
        <div className="py-20 text-center border border-border rounded-panel">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{e.actorEmail ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{e.action}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.targetType ? `${e.targetType}:${e.targetId?.slice(0, 8)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {e.metadata ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary select-none">view</summary>
                        <pre className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border rounded-lg p-2 max-w-xs overflow-x-auto">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/(app)/audit/page.tsx"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/audit/page.tsx"
git commit -m "feat: add Audit Log page"
```

---

### Task 9: Access page

**Files:**
- Modify: `src/lib/projects/projects.ts`
- Create: `src/app/(app)/access/page.tsx`
- Create: `src/app/(app)/access/AccessClient.tsx`
- Test: `tests/projects/projects.test.ts` (extend)

**Interfaces:**
- Consumes: `getOrgRole` (Task 3), `listUsersWithAccess` from `@/lib/access/grants` (already exists), `RoleBadge` (Task 7), `Table` components.
- Produces: `listAllEnvironments(db: Db): Promise<Environment[]>` in `@/lib/projects/projects`, used only by the Access page's scope picker.

- [ ] **Step 1: Write the failing test for `listAllEnvironments`**

Add `listAllEnvironments` to the existing `@/lib/projects/projects` import line in `tests/projects/projects.test.ts` (by this point in the plan, Task 5 has already extended it once to include `listProjectsForUserWithCounts`; add this name to that same line rather than a new import statement).

```ts
it("lists environments across all projects", async () => {
  const u = await seedUser("dave@example.com");
  await createProject(testDb, { name: "A", userId: u.id });
  await createProject(testDb, { name: "B", userId: u.id });
  const rows = await listAllEnvironments(testDb);
  expect(rows).toHaveLength(6); // 3 environments per project x 2 projects
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/projects/projects.test.ts
```

Expected: FAIL — `listAllEnvironments` is not exported.

- [ ] **Step 3: Implement `listAllEnvironments` in `src/lib/projects/projects.ts`**

Add after `getEnvironments`:

```ts
export async function listAllEnvironments(db: Db): Promise<Environment[]> {
  return db.select().from(environments);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/projects/projects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `src/app/(app)/access/page.tsx`**

```tsx
import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getOrgRole } from "@/lib/access/authorize";
import { roleAtLeast } from "@/lib/access/roles";
import { listUsersWithAccess } from "@/lib/access/grants";
import { listProjects, listAllEnvironments } from "@/lib/projects/projects";
import AccessClient from "./AccessClient";

export default async function AccessPage() {
  const session = await auth();
  const userId = (session as unknown as { userId?: string } | null)?.userId;
  if (!userId) redirect("/signin");

  const db = getDb();
  const role = await getOrgRole(db, userId);
  if (!role || !roleAtLeast(role, "admin")) notFound();

  const [usersWithAccess, projects, environments] = await Promise.all([
    listUsersWithAccess(db),
    listProjects(db),
    listAllEnvironments(db),
  ]);

  return (
    <AccessClient
      initialUsers={usersWithAccess}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      environments={environments.map((e) => ({ id: e.id, projectId: e.projectId, name: e.name }))}
      currentRole={role}
    />
  );
}
```

- [ ] **Step 6: Create `src/app/(app)/access/AccessClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/RoleBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X } from "lucide-react";

type Role = "owner" | "admin" | "member" | "viewer";
type Grant = { id: string; scopeType: "org" | "project" | "environment"; scopeId: string | null; role: Role };
type UserWithAccess = { user: { id: string; email: string }; grants: Grant[] };
type Project = { id: string; name: string };
type Environment = { id: string; projectId: string; name: string };

const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };
const ALL_ROLES: Role[] = ["viewer", "member", "admin", "owner"];

function highestRole(grants: Grant[]): Role | null {
  if (grants.length === 0) return null;
  return grants.reduce((a, g) => (ROLE_RANK[g.role] >= ROLE_RANK[a] ? g.role : a), grants[0].role);
}

function scopeLabel(g: Grant, projects: Project[], environments: Environment[]): string {
  if (g.scopeType === "org") return "Organization";
  if (g.scopeType === "project") return projects.find((p) => p.id === g.scopeId)?.name ?? "Unknown project";
  return environments.find((e) => e.id === g.scopeId)?.name ?? "Unknown environment";
}

export default function AccessClient({
  initialUsers,
  projects,
  environments,
  currentRole,
}: {
  initialUsers: UserWithAccess[];
  projects: Project[];
  environments: Environment[];
  currentRole: Role;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [grantOpen, setGrantOpen] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    scopeType: "org" as Grant["scopeType"],
    projectId: "",
    environmentId: "",
    role: "member" as Role,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/grants");
    if (res.ok) setUsers((await res.json()).users);
  }

  function resetForm() {
    setForm({ userId: "", scopeType: "org", projectId: "", environmentId: "", role: "member" });
    setError(null);
  }

  async function submitGrant() {
    if (!form.userId) return;
    const scopeId =
      form.scopeType === "project" ? form.projectId || null : form.scopeType === "environment" ? form.environmentId || null : null;
    if (form.scopeType !== "org" && !scopeId) return;

    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: form.userId, scopeType: form.scopeType, scopeId, role: form.role }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't grant access.");
      return;
    }
    setGrantOpen(false);
    resetForm();
    await refresh();
  }

  async function revoke(userId: string, g: Grant) {
    if (!confirm("Revoke this access? Secrets in scope will be flagged for rotation.")) return;
    await fetch("/api/grants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scopeType: g.scopeType, scopeId: g.scopeId }),
    });
    await refresh();
  }

  const envsForProject = environments.filter((e) => e.projectId === form.projectId);
  const grantableRoles = ALL_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[currentRole]);

  return (
    <main className="max-w-4xl w-full mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Access</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team access</h1>
        </div>

        <Dialog
          open={grantOpen}
          onOpenChange={(o) => {
            setGrantOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="w-3.5 h-3.5" />
            Grant access
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Grant access</DialogTitle>
              <DialogDescription>Assign a role to a team member at the org, project, or environment level.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                User
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.user.id} value={u.user.id}>
                      {u.user.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Scope
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.scopeType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scopeType: e.target.value as Grant["scopeType"], projectId: "", environmentId: "" }))
                  }
                >
                  <option value="org">Organization (all projects)</option>
                  <option value="project">Project</option>
                  <option value="environment">Environment</option>
                </select>
              </label>

              {(form.scopeType === "project" || form.scopeType === "environment") && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Project
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                    value={form.projectId}
                    onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, environmentId: "" }))}
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.scopeType === "environment" && form.projectId && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Environment
                  <select
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                    value={form.environmentId}
                    onChange={(e) => setForm((f) => ({ ...f, environmentId: e.target.value }))}
                  >
                    <option value="">Select an environment…</option>
                    {envsForProject.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Role
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  {grantableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setGrantOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitGrant} disabled={!form.userId || submitting}>
                {submitting ? "Granting…" : "Grant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Highest role</TableHead>
              <TableHead>Grants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(({ user, grants }) => {
              const top = highestRole(grants);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-semibold">
                          {user.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {top ? <RoleBadge role={top} /> : <span className="text-xs text-muted-foreground">No access</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {grants.map((g) => (
                        <span
                          key={g.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          {scopeLabel(g, projects, environments)} · {g.role}
                          <button
                            type="button"
                            onClick={() => revoke(user.id, g)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Revoke ${g.role} on ${scopeLabel(g, projects, environments)} for ${user.email}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
npx eslint "src/app/(app)/access/page.tsx" "src/app/(app)/access/AccessClient.tsx" src/lib/projects/projects.ts
npx vitest run tests/projects/projects.test.ts tests/api/grants.test.ts
```

Expected: no errors, both test files PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/access" src/lib/projects/projects.ts tests/projects/projects.test.ts
git commit -m "feat: add Access page with grant/revoke UI"
```

---

### Task 10: Sign-in cosmetic pass, cleanup, final verification

**Files:**
- Modify: `src/app/signin/page.tsx`
- Delete: `src/components/AppHeader.tsx`

**Interfaces:**
- Consumes: nothing new — this task only applies the Task 1 tokens/fonts (already global) and removes the now-fully-unused `AppHeader`.

- [ ] **Step 1: Confirm `AppHeader` has no remaining references**

```bash
grep -rn "AppHeader" src/
```

Expected: no matches (Tasks 5 and 6 already replaced its two usages with the `(app)` layout's sidebar).

- [ ] **Step 2: Delete it**

```bash
git rm src/components/AppHeader.tsx
```

- [ ] **Step 3: Sharpen the sign-in card in `src/app/signin/page.tsx`**

Change the wordmark icon container from `rounded-xl` to `rounded-lg`, and the `Card` itself — it already uses the shared `Card` component, which is unaffected by the panel/control radius split (it's a control-scale surface, small dialogs and cards keep `--radius`). No structural change needed beyond confirming the page renders with the new tokens. Change:

```tsx
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
```

to:

```tsx
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
```

- [ ] **Step 4: Full verification pass**

```bash
npx tsc --noEmit
npx eslint src/
npx vitest run
```

Expected: `tsc` clean, `eslint` clean (aside from any pre-existing findings unrelated to this plan — see the note below), all Vitest suites PASS.

If `eslint` reports the pre-existing `react-hooks/set-state-in-effect` finding in `SecretsClient.tsx` (present before this plan, on the `load()` call in the env-load effect and the reveal-countdown effect) — that is out of scope for this plan; do not fix it here unless it now blocks a lint gate that previously passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/signin/page.tsx
git commit -m "chore: sign-in cosmetic pass, remove superseded AppHeader"
```

(`AppHeader.tsx`'s removal is already staged from Step 2 — no need to `git rm` it again here.)
