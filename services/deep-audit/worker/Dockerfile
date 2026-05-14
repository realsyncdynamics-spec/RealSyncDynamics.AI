FROM mcr.microsoft.com/playwright:v1.54.0-jammy

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

RUN npm install

COPY src ./src

# Pre-fetch the browsers that are already part of the base image so we
# don't redownload on every container start.
RUN npx playwright install --with-deps chromium || true

ENV NODE_ENV=production

CMD ["npm", "start"]
