#!/bin/bash
# =============================================================================
# health-check.sh - Verificaciones post-despliegue
# =============================================================================
set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cargar variables de entorno
if [ -f "deploy/.env.deploy" ]; then
    source deploy/.env.deploy
else
    echo -e "${RED}❌ Error: Archivo deploy/.env.deploy no encontrado${NC}"
    exit 1
fi

echo -e "${BLUE}🏥 Ejecutando health checks post-despliegue...${NC}"
echo "============================================="

# 1. Verificar estado de PM2
echo -e "${YELLOW}[1/4]${NC} Verificando procesos PM2..."
PM2_STATUS=$(ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 jlist" 2>/dev/null || echo "[]")

if echo "$PM2_STATUS" | grep -q '"status":"online"'; then
    echo -e "${GREEN}✅ Procesos PM2 ejecutándose${NC}"
    
    # Mostrar estado detallado
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 status" | grep -E "(App name|krowdco-|online|stopped|errored)" || true
else
    echo -e "${RED}❌ Problemas con procesos PM2${NC}"
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 status"
    exit 1
fi

# 2. Verificar API (puerto 4000)
echo -e "${YELLOW}[2/4]${NC} Verificando API..."
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "curl -f -s http://localhost:4000/health >/dev/null 2>&1" || 
       ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "curl -f -s http://localhost:4000/ >/dev/null 2>&1"; then
        echo -e "${GREEN}✅ API respondiendo en puerto 4000${NC}"
        break
    else
        if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
            echo -e "${RED}❌ API no responde en puerto 4000${NC}"
            exit 1
        else
            echo -e "${YELLOW}⏳ Reintentando API... ($i/$HEALTH_CHECK_RETRIES)${NC}"
            sleep $HEALTH_CHECK_DELAY
        fi
    fi
done

# 3. Verificar Web (puerto 3000)
echo -e "${YELLOW}[3/4]${NC} Verificando aplicación web..."
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "curl -f -s http://localhost:3000/ >/dev/null 2>&1"; then
        echo -e "${GREEN}✅ Web respondiendo en puerto 3000${NC}"
        break
    else
        if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
            echo -e "${RED}❌ Web no responde en puerto 3000${NC}"
            exit 1
        else
            echo -e "${YELLOW}⏳ Reintentando Web... ($i/$HEALTH_CHECK_RETRIES)${NC}"
            sleep $HEALTH_CHECK_DELAY
        fi
    fi
done

# 4. Verificar sitio público
echo -e "${YELLOW}[4/4]${NC} Verificando sitio público..."
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if curl -f -s -L "$PRODUCTION_WEB_URL" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Sitio público accesible: $PRODUCTION_WEB_URL${NC}"
        break
    else
        if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
            echo -e "${RED}❌ Sitio público no accesible: $PRODUCTION_WEB_URL${NC}"
            echo "Verifica la configuración de Nginx/proxy"
            exit 1
        else
            echo -e "${YELLOW}⏳ Reintentando sitio público... ($i/$HEALTH_CHECK_RETRIES)${NC}"
            sleep $HEALTH_CHECK_DELAY
        fi
    fi
done

echo ""
echo -e "${GREEN}🎉 Todos los health checks pasaron exitosamente${NC}"
echo -e "${GREEN}🌐 Tu sitio está disponible en: $PRODUCTION_WEB_URL${NC}"
echo "============================================="