FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
# src + tsconfig are needed by the `migrate` service, which runs the
# tsx-based `pnpm db:migrate` script (it imports `@/lib/env` via the
# tsconfig path alias). The `app` service ignores them and serves .next.
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
