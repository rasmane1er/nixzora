# syntax=docker/dockerfile:1.7
# NIXZORA storefront. Build from the repository root:
#   docker build -f apps/storefront/Dockerfile -t nixzora-storefront .
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS pruned
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @nixzora/storefront --docker

FROM base AS build
COPY --from=pruned /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
RUN pnpm turbo run build --filter=@nixzora/storefront

# Next.js "standalone" output: a minimal server with only the files it needs.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/storefront/.next/static ./apps/storefront/.next/static
# Standalone output leaves out public/ (app icons, demo product illustrations).
COPY --from=build --chown=node:node /repo/apps/storefront/public ./apps/storefront/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/storefront/server.js"]
