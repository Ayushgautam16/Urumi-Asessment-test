FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data

# Create data directory with proper ownership for persistent volume
RUN mkdir -p /data && chown -R node:node /data

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4000

VOLUME ["/data"]

CMD ["node", "dist/server.js"]
