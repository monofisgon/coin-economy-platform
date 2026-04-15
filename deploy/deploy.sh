#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy Coin Economy Platform to Hostinger VPS
# Run from the project root after cloning / on each release.
# =============================================================================
set -euo pipefail

echo "============================================="
echo " Coin Economy Platform — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 1. Pull latest code
# -----------------------------------------------------------------------------
echo "[1/5] Pulling latest code..."
git pull origin main

# -----------------------------------------------------------------------------
# 2. Install dependencies
# -----------------------------------------------------------------------------
echo "[2/5] Installing dependencies..."
npm install --frozen-lockfile

# -----------------------------------------------------------------------------
# 3. Build API and Web
# -----------------------------------------------------------------------------
echo "[3/5] Building applications..."

echo "  → Building API (Fastify)..."
npm run build --workspace=apps/api

echo "  → Building Web (Next.js)..."
npm run build --workspace=apps/web

# -----------------------------------------------------------------------------
# 4. Run database migrations
# -----------------------------------------------------------------------------
echo "[4/5] Running Prisma migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# -----------------------------------------------------------------------------
# 5. Reload PM2 processes
# -----------------------------------------------------------------------------
echo "[5/5] Reloading PM2 processes..."
pm2 reload ecosystem.config.js --update-env

# Save PM2 process list so it survives reboots
pm2 save

echo ""
echo "============================================="
echo " Deploy complete!"
echo "============================================="
echo ""
pm2 status
