# The Spaceblast room server for Fly.io (see fly.toml and ONLINE.md).
# Stage 1 bundles server/fly.ts into dist-server/fly.js; stage 2 runs it with
# only `ws` beside it (everything else is inside the bundle).

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:server

# Runs as root on purpose: Fly mounts the /data volume owned by root.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
# package.json for "type": "module", so Node loads the bundle as ESM.
COPY package.json ./
COPY --from=build /app/node_modules/ws ./node_modules/ws
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8080
CMD ["node", "dist-server/fly.js"]
