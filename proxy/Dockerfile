FROM node:22-bookworm-slim
WORKDIR /app/proxy
ENV NODE_ENV=production
COPY proxy/package.json proxy/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY proxy/*.mjs ./
COPY frontend/public/spotcheck-inspector.js /app/frontend/public/spotcheck-inspector.js
USER node
EXPOSE 3002
CMD ["npm", "start"]
