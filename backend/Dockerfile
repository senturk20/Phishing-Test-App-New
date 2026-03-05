# Backend Dockerfile
# Multi-stage build for smaller image size

# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Tüm bağımlılıkları yükle (devDependencies dahil - build için gerekli)
RUN npm ci

# Kaynak kodu kopyala
COPY tsconfig.json ./
COPY src ./src

# TypeScript'i derle
RUN npm run build

# ================================
# Stage 2: Production
# ================================
FROM node:20-alpine AS production

WORKDIR /app

# Güvenlik için non-root kullanıcı oluştur
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Package dosyalarını kopyala
COPY package*.json ./

# Sadece production bağımlılıklarını yükle
RUN npm ci --only=production && npm cache clean --force

# Build edilmiş dosyaları kopyala
COPY --from=builder /app/dist ./dist

# Static dosyaları kopyala (landing page assets)
COPY static ./static

# Dosya sahipliğini değiştir
RUN chown -R nodejs:nodejs /app

# Non-root kullanıcıya geç
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Uygulamayı başlat
CMD ["node", "dist/index.js"]
