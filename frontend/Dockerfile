FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY proxy/package.json ./proxy/package.json
RUN npm ci --workspace @spotcheck/frontend --workspace @spotcheck/shared --include-workspace-root
COPY frontend ./frontend
COPY shared ./shared
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_PROXY_ORIGIN=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PROXY_ORIGIN=$NEXT_PUBLIC_PROXY_ORIGIN
RUN npm run build --workspace @spotcheck/shared \
  && npm run build --workspace @spotcheck/frontend \
  && mkdir -p /app/frontend/.next/cache \
  && chown -R node:node /app/frontend/.next
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@spotcheck/frontend"]
