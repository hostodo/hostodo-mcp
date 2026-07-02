FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY src ./src
COPY README.md server.json glama.json ./

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
