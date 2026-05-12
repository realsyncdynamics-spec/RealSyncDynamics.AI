# Playwright Scanner Microservice
# Node.js + Playwright + Chromium fuer DSGVO-Consent-Timing-Analysis
#
# Endpoints:
#   POST /scan/full           — vollstaendiger Scan (Cookies, Tracker, Requests)
#   POST /scan/consent-timing — misst welche Tracker VOR / NACH Consent-Click laden
#   POST /scan/screenshot     — Screenshot + HTML-Dump der Seite
#
# Deployment: deploy/playwright-scanner/docker-compose.yml
# Traefik-Label: scanner.realsyncdynamicsai.de (BasicAuth)
# Memory: ~1.5 GB (Chromium)

FROM node:20-slim

# Chromium-Systemabhaengigkeiten fuer Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-6 libxext6 libx11-xcb1 libxcb1 fonts-liberation \
    ca-certificates wget gnupg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Package-Dateien kopieren
COPY package.json package-lock.json* ./

# Dependencies installieren
RUN npm ci --omit=dev

# Playwright Chromium installieren (nur Chromium, kein Firefox/WebKit)
RUN npx playwright install chromium --with-deps

# App-Source kopieren
COPY server.ts tsconfig.json ./

# TypeScript kompilieren
RUN npx tsc --noEmit 2>/dev/null || true
RUN npx esbuild server.ts --bundle --platform=node --target=node20 --outfile=server.js --external:playwright

# Non-root User fuer Sicherheit
RUN useradd -m -u 1001 scanner
RUN chown -R scanner:scanner /app
USER scanner

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
