FROM node:20-bookworm-slim
WORKDIR /app/proxy
ENV NODE_ENV=production
COPY proxy/package.json proxy/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY proxy/*.mjs ./
COPY public/spotcheck-inspector.js /app/public/spotcheck-inspector.js
USER node
EXPOSE 3002
CMD ["node", "server.mjs"]
