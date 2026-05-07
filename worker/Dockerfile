FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
