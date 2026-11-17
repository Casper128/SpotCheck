FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json
COPY proxy/package.json ./proxy/package.json
RUN npm ci --include=dev --ignore-scripts
COPY backend ./backend
COPY frontend ./frontend
COPY shared ./shared
COPY scripts ./scripts
COPY proxy ./proxy
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_PROXY_ORIGIN=http://preview.localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PROXY_ORIGIN=$NEXT_PUBLIC_PROXY_ORIGIN
RUN npm run build && mkdir -p /app/data/uploads /app/frontend/.next/cache && chown -R node:node /app/data /app/frontend/.next
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "start"]
