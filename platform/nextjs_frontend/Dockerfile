# Next.js Stub-Frontend — Dev-Modus, damit der Stack ohne Build-Cache startet.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

# TODO(Prod): Multi-Stage-Build mit `npm run build` und `output: standalone`
# (server.js aus .next/standalone starten) statt `next dev`.
CMD ["npm", "run", "dev"]
