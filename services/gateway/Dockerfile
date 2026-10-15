FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /data

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4000

VOLUME ["/data"]

CMD ["node", "dist/server.js"]
