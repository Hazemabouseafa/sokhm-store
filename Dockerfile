# ✦ SOKHM ATELIER — Production Dockerfile (Coolify VPS + Local SQLite)
FROM node:22-slim

WORKDIR /app

# Install production dependencies cleanly
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy application source (bundled seed database/sokhm.db is preserved at /app/database/sokhm.db)
COPY . .

# Prepare persistent volume mount directories (SQLite DB + Uploaded Images + JSON Backups)
RUN mkdir -p /app/storage/database /app/storage/uploads /app/storage/backups

# Default environment for Coolify VPS with Local SQLite Database
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_DRIVER=sqlite \
    USE_LOCAL_SQLITE=true \
    STORAGE_DIR=/app/storage

VOLUME ["/app/storage"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
