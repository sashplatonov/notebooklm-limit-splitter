ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
EXPOSE 80
CMD ["node", "server.mjs"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
