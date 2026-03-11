# Backend Dockerfile — Multi-stage build

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build output
COPY --from=builder /app/dist ./dist

# Static files (landing page cloned assets)
COPY static ./static

# Create logs directory for crash handler
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# No HEALTHCHECK here — docker-compose.yml defines it with proper
# start_period/retries tuning. Embedding it here causes conflicts.

CMD ["node", "dist/index.js"]
