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
- `AUTH_URL=https://secrets.yourcompany.com`

## 3. Google OAuth setup
Create an OAuth client (type: Web). Authorized redirect URI:
`https://secrets.yourcompany.com/api/auth/callback/google`.

## 4. Run migrations on deploy
As a post-deploy command: `pnpm db:migrate`.

## 5. First login = owner
The first person to sign in with a company Google account becomes org `owner`
automatically and can grant everyone else.
