FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci --workspace @spotcheck/backend --workspace @spotcheck/shared --include-workspace-root
COPY backend ./backend
COPY shared ./shared
RUN npm run db:generate --workspace @spotcheck/backend \
  && npm run build --workspace @spotcheck/shared \
  && npm run build --workspace @spotcheck/backend \
  && npm prune --omit=dev --workspace @spotcheck/backend --workspace @spotcheck/shared \
  && mkdir -p /app/data/uploads \
  && chown -R node:node /app/data
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/dev.db
ENV UPLOAD_DIRECTORY=/app/data/uploads
USER node
EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate --workspace @spotcheck/backend && exec node backend/dist/presentation/server.js"]
