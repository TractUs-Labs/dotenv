# Frontend Redesign — Design Spec

## Context

The app's frontend (sign-in, projects list, project detail/secrets view) currently
reads as generic AI-generated SaaS boilerplate: default shadcn styling, an
icon-card grid for the projects list, soft rounded corners throughout, and no
distinct visual identity. Separately, the backend already supports several
flows — creating a project, adding a secret, granting/revoking access — that
have no UI at all, and the audit log has no UI or even a read API.

This spec covers a full visual redesign plus the missing UI surface needed to
make the backend's existing capabilities usable.

## Goals

- Replace the generic visual system with a distinct, technical, Doppler/Vercel-style
  dark UI: Space Grotesk + JetBrains Mono, sharp panels with small-radius
  controls, refined (not replaced) blue accent, hairline-border-driven depth
  instead of shadows.
- Replace the top-bar-only shell with a persistent left sidebar for navigation.
- Add UI for flows that already have working APIs: create project, add secret.
- Add UI + minimal backend (read-only) for grants (Access page) and audit log
  (Audit Log page), which currently have zero frontend surface.
- Fix an existing color-semantics bug: "needs rotation" (routine, expected) and
  "revoke access" (actually destructive) currently share the same red
  `destructive` styling. Split into `warning` (amber) vs `destructive` (red).

## Non-goals

- No change to encryption, envelope crypto, or the API's authorization logic
  (`roleAtLeast`, grant/revoke behavior) — UI only consumes what exists.
- No pagination/infinite-scroll for the audit log in this pass; a reasonable
  fixed limit (most recent 100 entries) is enough for a 5-6 person team.
- No project-scoped or environment-scoped Access sub-views; the Access page
  covers all scopes (org/project/environment) from one screen via the grant
  dialog's scope picker, consistent with `listUsersWithAccess` returning
  every grant per user regardless of scope.
- No component-level UI test suite is introduced — this repo has no UI testing
  tooling (`vitest.config.ts` runs `environment: "node"` and only includes
  `tests/**/*.test.ts`, no `.tsx`). New backend logic gets vitest tests
  following existing conventions; new UI is verified manually via dev server.

## Visual system

### Color (OKLCH, refine existing dark palette — do not replace)

Keep the near-black, blue-tinted background family. Changes:
- Widen the separation between `--background` and `--card` (currently too
  close, reads muddy) so surfaces read as distinct layers via tone alone.
- Sharpen `--primary` to a more saturated azure (current `#4F9EFF` is soft).
- Add `--warning` / `--warning-foreground` (amber) as a new semantic token.
  `needsRotation` state (badges, "needs attention" indicators) moves from
  `destructive` to `warning`. `--destructive` (red) is reserved for the one
  actually irreversible action in the app: revoking a user's access.
- Borders stay hairline (1px), same border-token approach as today.

Concrete token values (OKLCH, dark theme — this app is dark-only, no light
mode toggle exists or is planned):

| Token | Value | Notes |
|---|---|---|
| `--background` | `oklch(0.14 0.018 255)` | near-black, blue-tinted |
| `--card` / `--popover` / `--sidebar` | `oklch(0.19 0.02 255)` | clearly separated from background |
| `--foreground` / `--card-foreground` | `oklch(0.94 0.008 255)` | |
| `--muted` / `--secondary` / `--accent` | `oklch(0.24 0.02 255)` | |
| `--muted-foreground` | `oklch(0.68 0.02 255)` | verify ≥4.5:1 against both `--background` and `--card` when implemented |
| `--border` / `--input` | `oklch(0.27 0.02 255)` | |
| `--primary` / `--ring` / `--sidebar-primary` | `oklch(0.68 0.19 255)` | sharper/more saturated than current `#4F9EFF` |
| `--primary-foreground` | `oklch(0.14 0.018 255)` | same as background, dark-on-blue |
| `--warning` | `oklch(0.75 0.15 80)` | new token |
| `--warning-foreground` | `oklch(0.14 0.02 80)` | dark text on amber |
| `--destructive` | `oklch(0.55 0.21 25)` | darkened from initial draft; verified below |
| `--destructive-foreground` | `oklch(0.98 0.005 25)` | |
| `--radius` (controls: button/input/badge/dialog) | `0.375rem` (6px) | |
| `--radius-panel` (cards/rows/sidebar) | `0.125rem` (2px) | new token, used on containers instead of `--radius` |

These values are pre-verified (WCAG relative-luminance contrast, computed via
OKLCH→linear-sRGB conversion, not eyeballed):

| Pair | Ratio |
|---|---|
| foreground / background | 16.70:1 |
| foreground / card | 15.49:1 |
| muted-foreground / background | 6.92:1 |
| muted-foreground / card | 6.42:1 |
| primary-foreground / primary | 6.84:1 |
| warning-foreground / warning | 8.81:1 |
| destructive-foreground / destructive | 5.10:1 |

All exceed the 4.5:1 AA floor for body text. Task 1 in the implementation
plan applies these exact values directly; no further tuning needed unless
manual QA finds a rendering discrepancy (e.g. a browser's OKLCH gamut
mapping clipping a value), in which case re-run the same verification method
before adjusting.

### Typography

- `--font-sans` → Space Grotesk (headings, UI chrome), replacing Geist Sans.
- `--font-mono` → JetBrains Mono (secret keys/values, timestamps, IDs, audit
  log rows), replacing Geist Mono. Both are available via `next/font/google`,
  same integration pattern as the current Geist fonts in `src/app/layout.tsx`.
- Expand mono usage: anywhere showing "data" (not prose) — timestamps, IDs,
  role names in the Access table — uses mono, reinforcing the technical read.

### Shape & elevation

- Panels, cards, table/list rows: sharp corners (0–2px radius).
- Buttons, inputs, badges, dialogs: small radius (4–6px) for grip.
- No box-shadow-based elevation. Hover/active states communicate via
  border-color and background-tint shifts only.

## Navigation / IA

Replace `AppHeader` (top bar) with a persistent left sidebar (`AppSidebar`):

- **Top**: wordmark.
- **Nav items**: Projects (default), Access (org admin/owner only), Audit Log
  (org admin/owner only). Role gating mirrors the existing API gating
  (`roleAtLeast(role, "admin")` on the org-scoped grant).
- **Bottom**: user avatar + email, sign-out action (moved out of the current
  top-right dropdown).

Each page keeps its own slim in-content header (breadcrumb/title + page
actions) but the global top app-bar is removed; its jobs move into the
sidebar.

Routes:
- `/` — Projects list (existing, redesigned)
- `/projects/[projectId]` — Project detail / secrets (existing, redesigned)
- `/access` — Access management (new)
- `/audit` — Audit log (new)
- `/signin` — unchanged structurally (no sidebar; pre-auth), cosmetic pass only

## Page-by-page

### Sign-in (`src/app/signin/page.tsx`)

Cosmetic only: new fonts, sharper card edges, refined palette. No structural
or copy change beyond what's already fixed (the false E2E-encryption claim
was corrected in a prior pass).

### Projects list (`src/app/page.tsx`)

Replace the icon-card grid with a dense list: one row per project (name,
environment count, created date, chevron). Top-right "New Project" button
opens a dialog (name field) → `POST /api/projects` → redirect to
`/projects/[newId]`.

### Project detail (`src/app/projects/[projectId]/page.tsx`, `SecretsClient.tsx`)

Keep the existing environment-sectioned/secret-row structure — it's already
appropriately dense — reskin to new tokens and split warning/destructive per
the color section above. Each environment section header gets an "Add
secret" button opening a dialog (key + value fields) → `POST
/api/environments/[envId]/secrets`, followed by a reload of that section's
secrets.

### Access (`src/app/access/page.tsx`, new)

Table of all org users (`listUsersWithAccess`) — email, highest role badge,
scope detail on row expand. "Grant access" button opens a dialog: user
picker (existing users only — grants require an existing `userId`), scope
type (org/project/environment) with cascading project/environment pickers
when scoped, role picker → `POST /api/grants`. Revoke is a row action →
`DELETE /api/grants`, styled with the reserved `destructive` red — the one
truly destructive action in the app.

### Audit Log (`src/app/audit/page.tsx`, new)

Reverse-chronological table, most recent 100 entries: timestamp (mono),
actor email, action, target type/id, expandable JSON metadata.

Backend additions required (none exist today):
- `listAuditLog(db, { limit }): Promise<Array<AuditEntry & { actorEmail: string | null }>>`
  in `src/lib/audit/audit.ts` — joins `auditLog` to `users` on `actorId`,
  orders by `createdAt desc`, limits to the given count (default 100).
- `GET /api/audit-log` in `src/app/api/audit-log/route.ts` — same org-admin
  gate pattern as `src/app/api/grants/route.ts` (`requireOrgRole` +
  `roleAtLeast(role, "admin")`), returns `{ entries }`.

## Component inventory

- Keep shadcn/base-ui primitives (`Button`, `Badge`, `Card`, `Dialog`,
  `Input`, `Breadcrumb`, `Separator`, `Avatar`, `DropdownMenu`, `Skeleton`)
  restyled via updated tokens in `globals.css` plus targeted `cva` variant
  edits where the current variant set doesn't support the new semantics
  (e.g. `badgeVariants`/`buttonVariants` need a `warning` variant alongside
  the existing `destructive` one).
- New hand-rolled component: `AppSidebar` (`src/components/AppSidebar.tsx`),
  replacing `AppHeader` usage across all authenticated pages.
- New: a shared `RoleBadge` component (role → color/label) used by both the
  Access page and anywhere a role is displayed.
- Projects list and Access/Audit tables are hand-rolled dense row layouts
  (not `Card`), consistent with "cards are the lazy container" guidance.

## Testing

- New backend logic (`listAuditLog`, `GET /api/audit-log`) gets vitest tests
  in `tests/audit/audit.test.ts` (extend) and a new `tests/api/audit-log.test.ts`,
  following the exact conventions already in `tests/api/grants.test.ts`
  (`vi.mock` for `getDb`/`requireUser`, `seedUser`/`resetDb` helpers,
  assert 403 for non-admin, assert shape/order for admin).
- No new UI test tooling is introduced (see Non-goals). UI flows are verified
  manually: dev server + browser, checking contrast, keyboard focus, hover/
  loading/empty/error states per the design skill's craft-floor checklist.
- Existing tests (`tests/projects/projects.test.ts`, etc.) must continue to
  pass unmodified — this is a UI-layer and additive-backend change, not a
  change to existing business logic.

## Open sequencing note

This is a large surface (token/component system, sidebar, 3 redesigned
pages, 2 new pages, 1 new backend endpoint). The implementation plan should
sequence it so the visual system + sidebar + redesigned existing pages +
Create Project/Add Secret land first (a shippable, coherent state), with
Access and Audit Log as later tasks in the same plan — not a separate plan,
per the user's instruction to proceed directly to planning.
