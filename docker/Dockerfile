# Install and build with the repository's committed Bun lockfile.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Run on Node because the application uses node:sqlite.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /app/storage/private /app/storage/public \
    && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts"]
