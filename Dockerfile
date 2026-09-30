# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Compile TypeScript (contract.json/.d.ts are committed, so no emit step needed)
COPY tsconfig.json prisma.config.ts ./
COPY src ./src
RUN npx tsc

# ---- runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/prisma.config.ts ./
# prisma.config.ts imports src/config/env.config.ts, so the CLI needs the sources
COPY --from=builder /app/src ./src
COPY migrations ./migrations

EXPOSE 5000
CMD ["sh", "-c", "npx prisma db migrate --no-interactive && node dist/server.js"]
