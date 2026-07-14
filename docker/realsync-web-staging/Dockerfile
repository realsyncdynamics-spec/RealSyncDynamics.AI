# Dockerfile — Vite SPA (RealSyncDynamics.AI) → nginx:alpine
#
# Multi-stage build für VPS-Deployment mit Traefik-Reverse-Proxy.
#
# Build-Zeit-Variablen (VITE_*) werden über --build-arg oder docker-compose
# eingespeist und in den statischen Bundle gebacken. Runtime-Variablen gibt es
# bewusst keine — eine SPA hat keine.
#
# Build-Beispiel (manuell):
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://... \
#     --build-arg VITE_SUPABASE_ANON_KEY=... \
#     --build-arg VITE_SENTRY_DSN=... \
#     -t realsync-frontend:latest .
#
# Über docker-compose: Werte kommen aus .env, siehe docker-compose.yml.

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Lockfiles kopieren — stabiler Layer-Cache für Dependencies.
COPY package.json package-lock.json ./

# Dependencies ohne Audit/Fund-Warnungen (CI/CD-freundlich).
RUN npm ci --no-audit --no-fund

# Build-Args → Vite-Environment-Variablen (nur VITE_* landen im Bundle).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SENTRY_DSN
ARG VITE_GOOGLE_GENAI_API_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_GOOGLE_GENAI_API_KEY=$VITE_GOOGLE_GENAI_API_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

# Komplettes Source-Code-Verzeichnis kopieren.
COPY . .

# Build — erzeugt dist/.
RUN npm run build

# ── Stage 2: Runtime (nginx) ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# nginx-Server-Tokens verbergen.
RUN sed -i 's/server_tokens on;/server_tokens off;/' /etc/nginx/nginx.conf

# Default-Config entfernen, Custom-Config einfügen.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/frontend.conf

# Build-Output (dist/) als statische Dateien in nginx.
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck-Datei (statisch, wird von Traefik gepingt).
RUN printf 'ok\n' > /usr/share/nginx/html/healthz

EXPOSE 80

# Traefik-Healthcheck: GET /healthz sollte 200 OK zurück geben.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
