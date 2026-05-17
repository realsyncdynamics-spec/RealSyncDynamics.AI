FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 5000

# Persistent storage for export artifacts. Mount a volume here in
# docker-compose / k8s — defaults to /data/evidence inside the container.
VOLUME ["/data/evidence"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

USER node
CMD ["node", "src/index.js"]
