# Deploying on Dokploy

## 1. Generate the master key (KEK)
Run once, offline:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store the output as a **mounted file secret** in Dokploy (Advanced → Volumes /
Secrets), mounted at `/run/secrets/kek.b64`. Do NOT put it in a plain env var.
Keep an offline backup — losing the KEK makes every stored secret unrecoverable.

## 2. Environment variables
- `KEK_FILE=/run/secrets/kek.b64`
- `DATABASE_URL=postgres://...`  (Dokploy-managed Postgres)
- `COMPANY_DOMAIN=yourcompany.com`
- `AUTH_SECRET=` (generate: `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID=` / `AUTH_GOOGLE_SECRET=` (Google Cloud OAuth client)
- `BASE_PATH=/dotenv` (subpath; leave empty for domain root — rebuild after changing)
- `AUTH_URL=https://adminctl.companywebsite.com/dotenv` (origin + `BASE_PATH`)
- `AUTH_TRUST_HOST=true`

Pass `BASE_PATH` as a **Docker build arg** as well (same value) — Next.js bakes
`basePath` into the client bundle at build time.

## 3. Google OAuth setup
Create an OAuth client (type: Web). Authorized redirect URI:
`https://adminctl.companywebsite.com/dotenv/api/auth/callback/google`
(include `BASE_PATH` in the path).

## 4. Reverse proxy (path-based)
Route `PathPrefix(/dotenv)` on your domain to the app container. **Do not strip**
the `/dotenv` prefix — Next expects requests at `/dotenv/...`.

## 5. Run migrations on deploy
As a post-deploy command: `pnpm db:migrate`.

## 6. First login = owner
The first person to sign in with a company Google account becomes org `owner`
automatically and can grant everyone else.
