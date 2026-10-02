# syntax=docker/dockerfile:1.7
# NIXZORA admin. Build from the repository root:
#   docker build -f apps/admin/Dockerfile -t nixzora-admin .
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS pruned
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @nixzora/admin --docker

FROM base AS build
COPY --from=pruned /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
RUN pnpm turbo run build --filter=@nixzora/admin

# Next.js "standalone" output: a minimal server with only the files it needs.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]
