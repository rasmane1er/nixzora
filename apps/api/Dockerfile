# syntax=docker/dockerfile:1.7
# NIXZORA API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t nixzora-api .
#   docker build -f apps/api/Dockerfile --target migrate -t nixzora-api-migrate .
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
# Amazon RDS certificate authorities, so database TLS can be verified (sslmode=verify-full).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem
WORKDIR /repo

# Only the workspace packages the API depends on.
FROM base AS pruned
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @nixzora/api --docker

FROM base AS build
COPY --from=pruned /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
RUN pnpm turbo run build --filter=@nixzora/api
# Production dependencies only, with workspace packages copied in.
RUN pnpm --filter @nixzora/api deploy --legacy --prod /app

# One-off task that applies database migrations before a release.
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=${APP_VERSION} API_PORT=4000 \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem
COPY --from=base /etc/ssl/certs/rds-global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]
