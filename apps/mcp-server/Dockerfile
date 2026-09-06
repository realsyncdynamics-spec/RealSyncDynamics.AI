FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3001
ENV NODE_ENV=production

# Der Pfad enthält apps/mcp-server/src, weil packages/evidence-chain
# mitkompiliert wird und tsc die Ausgabe daher relativ zur Repo-Wurzel ablegt
# (siehe tsconfig.json "rootDir").
CMD ["node", "dist/apps/mcp-server/src/index.js"]
