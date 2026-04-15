#!/usr/bin/env bash
# =============================================================================
# setup-vps.sh — Initial VPS setup for Coin Economy Platform on Hostinger
# Run as root or with sudo on a fresh Ubuntu 22.04 LTS instance.
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-YOUR_DOMAIN}"
DB_NAME="${DB_NAME:-coin_economy}"
DB_USER="${DB_USER:-coin_user}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24)}"

echo "============================================="
echo " Coin Economy Platform — VPS Setup"
echo "============================================="

# -----------------------------------------------------------------------------
# 1. System update
# -----------------------------------------------------------------------------
echo "[1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget gnupg2 ca-certificates lsb-release unzip git build-essential

# -----------------------------------------------------------------------------
# 2. Node.js 20 LTS via nvm
# -----------------------------------------------------------------------------
echo "[2/8] Installing Node.js 20 LTS via nvm..."
export NVM_DIR="/root/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
nvm use default

# Make node/npm available system-wide
NODE_PATH=$(nvm which default)
ln -sf "$NODE_PATH" /usr/local/bin/node
ln -sf "$(dirname "$NODE_PATH")/npm" /usr/local/bin/npm
ln -sf "$(dirname "$NODE_PATH")/npx" /usr/local/bin/npx

echo "Node version: $(node -v)"
echo "npm version:  $(npm -v)"

# -----------------------------------------------------------------------------
# 3. PM2 globally
# -----------------------------------------------------------------------------
echo "[3/8] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

# -----------------------------------------------------------------------------
# 4. Nginx
# -----------------------------------------------------------------------------
echo "[4/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# Copy Nginx config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/coin-economy
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/coin-economy
ln -sf /etc/nginx/sites-available/coin-economy /etc/nginx/sites-enabled/coin-economy
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# -----------------------------------------------------------------------------
# 5. PostgreSQL 16
# -----------------------------------------------------------------------------
echo "[5/8] Installing PostgreSQL 16..."
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
apt-get update -y
apt-get install -y postgresql-16 postgresql-client-16
systemctl enable postgresql
systemctl start postgresql

# Create database and user
echo "[5/8] Creating database user and database..."
sudo -u postgres psql <<SQL
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

echo "PostgreSQL database: $DB_NAME"
echo "PostgreSQL user:     $DB_USER"
echo "PostgreSQL password: $DB_PASS  ← SAVE THIS!"

# -----------------------------------------------------------------------------
# 6. Redis 7
# -----------------------------------------------------------------------------
echo "[6/8] Installing Redis 7..."
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/redis.list
apt-get update -y
apt-get install -y redis
systemctl enable redis-server
systemctl start redis-server

# Harden Redis: bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl restart redis-server

# -----------------------------------------------------------------------------
# 7. Certbot (Let's Encrypt)
# -----------------------------------------------------------------------------
echo "[7/8] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "  To obtain SSL certificates, run:"
echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "  Certbot will auto-renew via systemd timer (certbot.timer)."

# -----------------------------------------------------------------------------
# 8. Firewall
# -----------------------------------------------------------------------------
echo "[8/8] Configuring UFW firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "============================================="
echo " Setup complete!"
echo "============================================="
echo ""
echo " Next steps:"
echo "  1. Point your DNS A record for $DOMAIN to this server's IP"
echo "  2. Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Clone your repo to /var/www/coin-economy"
echo "  4. Copy .env files and set DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo "  5. Run: bash deploy/deploy.sh"
echo ""
