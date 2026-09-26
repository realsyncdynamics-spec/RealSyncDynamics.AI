# Playwright Scanner Microservice — production image
# Node 20 + Playwright Chromium. Build fails closed on TypeScript errors.

FROM node:20-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json server.ts executor.ts ./
RUN npm run typecheck
RUN npm run build

FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=3001
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl tini && \
    rm -rf /var/lib/apt/lists/* && \
    npx playwright install chromium --with-deps && \
    chmod -R a+rX /ms-playwright

COPY --from=builder /app/dist ./dist

RUN useradd -m -u 1001 -s /bin/bash scanner && \
    chown -R scanner:scanner /app /ms-playwright
USER scanner

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD-SHELL curl -fsS -H "Authorization: Bearer $SCANNER_API_KEY" http://localhost:3001/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
