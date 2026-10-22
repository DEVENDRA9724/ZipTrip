FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/backend/package*.json ./apps/backend/
RUN npm ci --prefix apps/backend

COPY apps/backend ./apps/backend
COPY apps/web ./apps/web

WORKDIR /app/apps/backend
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt \
  && npm run db:pg:generate \
  && npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
