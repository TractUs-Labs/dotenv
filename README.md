# Team Secrets Manager

A lightweight, self-hosted secrets manager for a small team — a place to
create, edit, rotate, and share credentials (API keys, DB passwords, tokens)
organized into projects and environments. Think of it as a minimal,
self-hosted alternative to Doppler or 1Password, scoped to ~5–6 people on one
team.

This README records the **architecture decisions** made during design. It is
the source of truth for *why* things are built the way they are. Implementation
has not started yet.

---

## Goals

- Create / edit / rotate secrets, organized into **projects** and
  **environments** (dev / staging / prod).
- Rule-based access: grant/revoke per project or environment, role-based
  (owner / admin / member / viewer).
- Secrets encrypted at rest.
- When a secret is rotated, everyone with access sees the new value
  immediately (no manual re-share).
- Genuinely secure for the team's threat model — not security theater — while
  staying simple enough for a 5–6 person tool.

## Non-goals

- Scaling past ~50 users.
- Per-provider automatic upstream rotation (rotating the real AWS/Stripe/DB
  credential). The tool tracks and flags rotation; humans perform it.
- Surviving a full compromise of the application host (see Threat Model).

---

## Threat model & security posture

**Model: server-trusted encryption at rest (NOT end-to-end).**

End-to-end encryption was considered and deliberately dropped. True E2E (per-user
X25519 keypairs, vault keys wrapped per member, client-side crypto) would let the
system survive a fully compromised app server, but it costs: client-side crypto,
key wrapping, "pending access" invite flows, re-wrapping on every password
change, and a hard lockout footgun (lose your password → lose your data). For a
5–6 person internal tool that complexity isn't worth it.

**What we defend against:** database-level compromise — dumped tables (e.g. SQL
injection), stolen or offsite backups, read replicas, `pg_dump` files on
laptops. These are the common, realistic leak vectors, and the encryption key
never lives in the database.

**What we explicitly concede:** full host compromise. Someone who gets root on
the VPS can read both the master key and the database. Accepted for this team
size and deployment.

---

## Encryption

**Envelope encryption:**

- Each secret has its own **data encryption key (DEK)**.
- Every DEK is wrapped (encrypted) by a single **master key (KEK)**.
- Secret values are encrypted with **XChaCha20-Poly1305** (or AES-256-GCM).
- The database stores only ciphertext and wrapped DEKs — never plaintext, never
  the KEK.

**Why envelope encryption (even without per-user keys):**

- **Crypto-shredding** — destroy a secret by deleting its DEK.
- **KEK rotation** without re-encrypting every row.
- **Blast-radius isolation** between secrets.

### Key custody

- The **KEK is stored as a mounted Docker secret (a file), not a raw
  environment variable**, in Dokploy — held separately from Postgres.
  - Env vars leak more readily: visible in `docker inspect`, inherited by child
    processes, and captured in crash dumps/logs. A mounted file avoids all of
    that for the same effort.
- **Why logical separation matters even on one box:** the KEK and the database
  leak through different doors. Databases leak constantly via backups shipped to
  S3, dumps on laptops, replicas, and ORM-level injection — none of which touch
  the app's mounted secret. So keeping the KEK out of the DB genuinely defends
  the likely vectors, even though app and DB share a host.
- **Upgrade path (deferred — YAGNI for now):** because envelope encryption
  already isolates the KEK, DEK unwrapping can later be moved to a network call
  to a cloud KMS (AWS KMS / GCP KMS) or a small OpenBao instance. That would
  restore host-compromise protection with **no data migration** — only the
  wrap/unwrap location changes.

---

## Identity & authentication

- **Google Workspace SSO, restricted to the company domain.**
- Gate on the `hd` (hosted-domain) claim `== company-domain` **and**
  `email_verified == true` — not a substring match on the email address. The
  `hd` claim is the trustworthy Workspace-domain signal.
- **Authentication ≠ authorization.** SSO proves someone is a real teammate;
  it grants access to nothing on its own. A valid company login with no grants
  sees an empty app.

---

## Access control & onboarding

- Structure: **projects → environments** (dev / staging / prod).
- Roles: **owner / admin / member / viewer**. Grants are assigned **per project
  or per environment**.
- **Secret reads are authorized live against the grants table on every
  request** — never from cached JWT claims. This is what makes revocation
  instant (see below).
- Secrets are **append-only versioned**: rotating a secret creates a new version
  and preserves history. Everyone with access reads the latest version, so
  rotation propagates immediately with no manual re-share.

### Onboarding (self-serve)

- Teammates sign in via SSO, then an **admin grants access** from a list of
  known/pending users. No emailed invite tokens are needed — domain-gated SSO
  already establishes identity.
- **Bootstrap:** the first successful login becomes `owner` (or seed a
  hardcoded owner email), so initial grants can be made.

---

## Revocation

Applies to full removal and to role downgrades (same machinery, smaller scope).

On revoke:

1. **Remove the grant** — delete/deactivate the person's access rows for the
   scope. Pure authorization change; no crypto.
2. **Access cuts off instantly** — because secret reads authorize live against
   the grants table, the next read fails the moment the row is gone. (You may
   also kill their login session so they can't see the UI, but the
   secret-access guarantee doesn't depend on it.)
3. **Flag every in-scope secret as `needs_rotation`.** Blast radius = the union
   of everything they could see (org → all; project → that project's;
   environment → that env's). Treat those values as burned — assume they were
   copied.
4. **Notify remaining admins** with the flagged list.
5. **Write an audit-log entry:** who was revoked, by whom, when, and the exact
   set of flagged secrets. That record *is* the blast-radius report.
6. **Delete any pending invite/grant** if the person never actually signed up.

**Do NOT rotate the DEK on revoke** — it does nothing against someone who saw
plaintext through the app (they never held the DEK). Only rotating the real
upstream value matters.

**Honest limitation:** between "person saw the secret" and "a human rotates it
upstream," the value is exposed. The tool shrinks that window and makes it
visible and tracked — it does not eliminate it. Upstream rotation (minting a new
AWS/Stripe/DB credential and pasting the new value in, which creates a new
version) is a human step. Per-provider auto-rotation is out of scope for v1.

---

## Stack

- **Next.js (App Router)** — chosen for its mature, battle-tested auth/session
  ecosystem (Auth.js / Lucia) and route handlers that fit the "server does the
  crypto" model cleanly. (React Router v7 framework mode would also work; this
  choice is not load-bearing.)
- **PostgreSQL** for storage.
- Deployed on **Dokploy** (self-hosted, Docker-based PaaS on the team's own VPS).

---

## Deploy on a VPS (Docker Compose)

`docker-compose.yml` bundles everything needed to run on a single VPS: the
Next.js **app**, a **Postgres** database, a one-shot **migrate** service, and
**Caddy** as a reverse proxy that provisions HTTPS automatically. Nothing but
Caddy's ports 80/443 is exposed to the internet — Postgres and the app are only
reachable on the internal compose network.

**How the app reaches Postgres:** Compose puts every service on a private
network where each service is reachable by its name as a hostname. The app and
migrate service connect using `db:5432` (the `db` service) — no host IP, no TLS
(traffic never leaves the VPS), which is why `DATABASE_URL` here has no
`sslmode=require`.

**Startup order:** Postgres has a healthcheck; the `migrate` service waits for
it, runs `pnpm db:migrate`, and exits. The `app` service only starts once
migrations have completed successfully.

### One-time setup

On the VPS, in the project directory:

```bash
# 1. Encryption key (KEK) — the 32-byte key that encrypts all stored secrets.
#    Back this file up somewhere safe; losing it makes every secret unrecoverable.
mkdir -p secrets
openssl rand -base64 32 > secrets/kek.b64

# 2. Environment file — copy the template and fill in every value.
cp .env.example .env
#    Generate strong values for these before editing:
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -base64 24   # -> POSTGRES_PASSWORD (also update DATABASE_URL to match)
#    Set APP_DOMAIN / AUTH_URL to your domain, and add your Google OAuth creds.

# 3. Point your domain's DNS A record at the VPS's IP (needed for Caddy's cert).

# 4. Build and start everything.
docker compose up -d --build
```

The KEK stays a plain host file mounted read-only into the app container — it is
never copied into the image or committed to git (`/secrets` is gitignored).

### Day-to-day

```bash
docker compose logs -f app        # tail app logs
docker compose up -d --build      # redeploy after pulling new code (re-runs migrations)
docker compose down               # stop (Postgres data persists in the pgdata volume)
```

---

## Status

Design settled; implementation not yet started. The next step is turning these
decisions into an implementation plan.
