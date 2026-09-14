FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund || true
COPY . .
ENV NODE_ENV=production PORT=8787 SCAN_DB=/data/scan.db
EXPOSE 8787
CMD ["node","--experimental-strip-types","--no-warnings","src/web/server.ts"]
