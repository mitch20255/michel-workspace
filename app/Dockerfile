FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

RUN mkdir -p /app/data/files /app/watched

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
