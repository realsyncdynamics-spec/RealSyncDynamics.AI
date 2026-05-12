# Multi-stage build: kleines Final-Image, Tini fuer graceful-shutdown.
# Pattern matched services/playwright-scanner/Dockerfile.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app

# Production-only deps (no devDeps wie esbuild / tsx / typescript)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -S openclaw && adduser -S openclaw -G openclaw \
  && chown -R openclaw:openclaw /app
USER openclaw

EXPOSE 3001

# Tini = PID 1 fuer korrektes SIGTERM-Forwarding zu Node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
