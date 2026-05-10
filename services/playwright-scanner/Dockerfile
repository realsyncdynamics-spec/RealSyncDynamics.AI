# Playwright-Scanner Microservice
# Node 20 slim + Chromium System-Deps + non-root user
#
# Build: docker build -t realsync/playwright-scanner:latest .
# Run:   docker run -p 3000:3000 -e SCANNER_SECRET=... realsync/playwright-scanner:latest
#
# Multi-stage:
#   1. builder — installs deps (incl. dev) + builds the bundle
#   2. runner  — minimal runtime image with prod-deps + Chromium

# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./
# Falls package-lock.json existiert, mitkopieren — aber tolerant wenn nicht
COPY package-lock.json* ./

RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-slim

# Chromium-Systemabhängigkeiten (analog playwright install --with-deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-6 libxext6 libx11-xcb1 libxcb1 fonts-liberation \
    ca-certificates wget curl tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Nur prod-deps installieren
COPY package.json ./
COPY package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Chromium-Browser-Binary holen (~120 MB)
RUN npx playwright install chromium

# Bundle aus Builder kopieren
COPY --from=builder /app/dist ./dist

# Non-root user — Playwright braucht aber Schreibzugriff auf cache
RUN useradd -m -u 1001 -s /bin/bash scanner && \
    mkdir -p /home/scanner/.cache && \
    cp -r /root/.cache/ms-playwright /home/scanner/.cache/ 2>/dev/null || \
    npx playwright install chromium --with-deps && \
    chown -R scanner:scanner /app /home/scanner

USER scanner

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

# Tini als PID 1 → propagiert SIGTERM korrekt für Graceful-Shutdown
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
