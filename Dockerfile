# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-debian AS dependencies
WORKDIR /app
COPY --link package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder
COPY --link . .
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:${BUN_VERSION}-debian AS production-dependencies
WORKDIR /app
COPY --link package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION}-debian AS runner
WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates gosu \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 1001 --system tarkov \
	&& useradd --uid 1001 --gid tarkov --system --create-home tarkov \
	&& mkdir -p /data \
	&& chown tarkov:tarkov /data

COPY --from=production-dependencies --chown=tarkov:tarkov /app/node_modules ./node_modules
COPY --from=builder --chown=tarkov:tarkov /app/.output ./.output
COPY --from=builder --chown=tarkov:tarkov /app/package.json ./package.json
COPY --from=builder --chown=tarkov:tarkov /app/scripts/check-env.ts ./scripts/check-env.ts
COPY --from=builder --chown=tarkov:tarkov /app/src/lib ./src/lib
COPY --from=builder --chown=tarkov:tarkov /app/src/server/db ./src/server/db
COPY --from=builder --chown=tarkov:tarkov /app/src/server/env.ts ./src/server/env.ts
COPY --from=builder --chown=tarkov:tarkov /app/drizzle ./drizzle
COPY --from=builder --chown=tarkov:tarkov /app/data/publication ./data/publication
COPY --from=builder --chown=tarkov:tarkov /app/public/maps/masters/manifest.json ./public/maps/masters/manifest.json
COPY --chown=root:root scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod 0555 /usr/local/bin/docker-entrypoint

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint"]
CMD ["bun", "run", "start"]
