#!/bin/bash
# =============================================================================
# rollback-production.sh - Rollback de emergencia
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

echo -e "${RED}🚨 ROLLBACK DE EMERGENCIA${NC}"
echo "============================================="

# Listar backups disponibles
echo -e "${YELLOW}📋 Backups disponibles:${NC}"
BACKUPS=$(ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "ls -t $VPS_BACKUP_PATH 2>/dev/null || echo ''")

if [ -z "$BACKUPS" ]; then
    echo -e "${RED}❌ No hay backups disponibles${NC}"
    exit 1
fi

echo "$BACKUPS" | head -10 | nl

# Seleccionar backup
echo ""
read -p "Selecciona el número del backup a restaurar (1 para el más reciente): " BACKUP_NUM

SELECTED_BACKUP=$(echo "$BACKUPS" | sed -n "${BACKUP_NUM}p")

if [ -z "$SELECTED_BACKUP" ]; then
    echo -e "${RED}❌ Selección inválida${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Restaurando backup: $SELECTED_BACKUP${NC}"

# Confirmar rollback
echo -e "${RED}⚠️  ADVERTENCIA: Esto revertirá todos los cambios actuales${NC}"
read -p "¿Estás seguro? (escribe 'ROLLBACK' para confirmar): " CONFIRM

if [ "$CONFIRM" != "ROLLBACK" ]; then
    echo "Rollback cancelado"
    exit 1
fi

# Ejecutar rollback
echo -e "${YELLOW}🔄 Ejecutando rollback...${NC}"

ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
    echo 'Deteniendo servicios...'
    cd $VPS_PROJECT_PATH
    pm2 stop all
    
    echo 'Creando backup del estado actual...'
    cp -r $VPS_PROJECT_PATH $VPS_BACKUP_PATH/pre-rollback-\$(date '+%Y%m%d-%H%M%S')
    
    echo 'Restaurando backup...'
    rm -rf $VPS_PROJECT_PATH
    cp -r $VPS_BACKUP_PATH/$SELECTED_BACKUP $VPS_PROJECT_PATH
    
    echo 'Reiniciando servicios...'
    cd $VPS_PROJECT_PATH
    pm2 reload ecosystem.config.js --update-env
    pm2 save
    
    echo 'Rollback completado'
"

# Verificar que el rollback funcionó
echo -e "${YELLOW}🏥 Verificando rollback...${NC}"
sleep 5

if bash scripts/health-check.sh; then
    echo -e "${GREEN}✅ Rollback exitoso${NC}"
    echo -e "${GREEN}🌐 Sitio restaurado: $PRODUCTION_WEB_URL${NC}"
else
    echo -e "${RED}❌ Rollback falló - verifica manualmente${NC}"
    exit 1
fi