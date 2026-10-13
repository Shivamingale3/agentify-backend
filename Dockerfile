# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# Compile TypeScript (contract.json/.d.ts are committed, so no emit step needed)
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx tsc -p tsconfig.build.json

# ---- runtime ----
# Migrations are run manually against the DB, so the runtime image only needs
# production dependencies and the compiled app.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 5000
# Exec form: node is PID 1 and receives SIGTERM directly, so graceful shutdown runs.
CMD ["node", "dist/server.js"]
