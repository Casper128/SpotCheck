FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json
COPY proxy/package.json ./proxy/package.json
RUN npm ci --include=dev --ignore-scripts
COPY backend ./backend
COPY shared ./shared
RUN npm run build:backend && mkdir -p /app/data/uploads && chown -R node:node /app/data
ENV NODE_ENV=production
ENV UPLOAD_DIRECTORY=/app/data/uploads
USER node
EXPOSE 4000
CMD ["npm", "run", "start:production", "--workspace", "@spotcheck/backend"]
