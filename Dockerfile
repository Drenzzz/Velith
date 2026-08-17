# Bun runtime
FROM oven/bun:1.3.14 AS base

# Dependencies layer
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Runtime layer
FROM base AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY bunfig.toml ./
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/backups && chown -R bun:bun /app

USER bun
ENV NODE_ENV=production
ENV APP_ENV=production

EXPOSE 3000

# Default: run bot. Override with command for one-off scripts.
CMD ["bun", "run", "src/index.ts"]
