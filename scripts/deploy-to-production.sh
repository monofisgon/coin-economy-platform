#!/bin/bash
# =============================================================================
# deploy-to-production.sh - Despliegue automatizado a Hostinger VPS
# =============================================================================
set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Función para logging con timestamp
log() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Función para manejo de errores
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    exit 1
}

# Cargar variables de entorno
if [ -f "deploy/.env.deploy" ]; then
    source deploy/.env.deploy
else
    error_exit "Archivo deploy/.env.deploy no encontrado. Copia deploy/.env.deploy.example y configúralo."
fi

# Banner de inicio
echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║                    🚀 DESPLIEGUE AUTOMÁTICO                   ║${NC}"
echo -e "${PURPLE}║                      Hostinger VPS                          ║${NC}"
echo -e "${PURPLE}║                    www.krowdco.com                          ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

START_TIME=$(date +%s)

# Crear directorio de logs si no existe
mkdir -p logs

# Archivo de log para este despliegue
LOG_FILE="logs/deploy-$(date '+%Y%m%d-%H%M%S').log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

log "${BLUE}📋 Iniciando despliegue a producción...${NC}"
log "Host: $VPS_HOST"
log "Usuario: $VPS_USER"
log "Proyecto: $VPS_PROJECT_PATH"
log "Log: $LOG_FILE"

# Paso 1: Validaciones pre-despliegue
log "${YELLOW}🔍 [1/6] Ejecutando validaciones pre-despliegue...${NC}"
if ! bash scripts/pre-deploy-checks.sh; then
    error_exit "Validaciones pre-despliegue fallaron"
fi

# Paso 2: Push de cambios a Git
log "${YELLOW}📤 [2/6] Sincronizando cambios con repositorio...${NC}"
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)

log "Rama actual: $CURRENT_BRANCH"
log "Commit actual: $CURRENT_COMMIT"

# Push solo si hay commits para pushear
if [ "$(git rev-list @{u}..HEAD 2>/dev/null | wc -l)" -gt 0 ] 2>/dev/null; then
    log "Pusheando cambios al repositorio..."
    git push origin "$CURRENT_BRANCH"
else
    log "No hay cambios nuevos para pushear"
fi

# Paso 3: Crear backup en VPS
log "${YELLOW}💾 [3/6] Creando backup en VPS...${NC}"
BACKUP_NAME="backup-$(date '+%Y%m%d-%H%M%S')"
ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
    mkdir -p $VPS_BACKUP_PATH
    if [ -d '$VPS_PROJECT_PATH' ]; then
        cp -r $VPS_PROJECT_PATH $VPS_BACKUP_PATH/$BACKUP_NAME
        echo 'Backup creado: $VPS_BACKUP_PATH/$BACKUP_NAME'
    fi
"

# Paso 4: Ejecutar despliegue en VPS
log "${YELLOW}🔧 [4/6] Ejecutando despliegue en VPS...${NC}"
log "Conectando a VPS y ejecutando deploy.sh..."

# Ejecutar el script de despliegue existente en el VPS
ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
    cd $VPS_PROJECT_PATH
    echo '============================================='
    echo '🚀 Ejecutando despliegue en VPS...'
    echo '============================================='
    
    # Ejecutar el script de despliegue existente
    if [ -f 'deploy/deploy.sh' ]; then
        bash deploy/deploy.sh
    else
        echo '❌ Script deploy/deploy.sh no encontrado'
        exit 1
    fi
"

if [ $? -ne 0 ]; then
    log "${RED}❌ Despliegue falló en VPS${NC}"
    log "${YELLOW}🔄 Restaurando backup...${NC}"
    
    # Intentar restaurar backup
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
        if [ -d '$VPS_BACKUP_PATH/$BACKUP_NAME' ]; then
            rm -rf $VPS_PROJECT_PATH
            cp -r $VPS_BACKUP_PATH/$BACKUP_NAME $VPS_PROJECT_PATH
            cd $VPS_PROJECT_PATH
            pm2 reload ecosystem.config.js --update-env
            echo 'Backup restaurado exitosamente'
        fi
    "
    
    error_exit "Despliegue falló. Backup restaurado."
fi

# Paso 5: Health checks
log "${YELLOW}🏥 [5/6] Ejecutando health checks...${NC}"
sleep 5  # Dar tiempo a que los servicios se inicien

if ! bash scripts/health-check.sh; then
    log "${RED}❌ Health checks fallaron${NC}"
    log "${YELLOW}🔄 Restaurando backup...${NC}"
    
    # Restaurar backup si health checks fallan
    ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
        if [ -d '$VPS_BACKUP_PATH/$BACKUP_NAME' ]; then
            rm -rf $VPS_PROJECT_PATH
            cp -r $VPS_BACKUP_PATH/$BACKUP_NAME $VPS_PROJECT_PATH
            cd $VPS_PROJECT_PATH
            pm2 reload ecosystem.config.js --update-env
        fi
    "
    
    error_exit "Health checks fallaron. Backup restaurado."
fi

# Paso 6: Limpieza y finalización
log "${YELLOW}🧹 [6/6] Limpieza y finalización...${NC}"

# Limpiar backups antiguos (mantener solo los últimos 5)
ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "
    cd $VPS_BACKUP_PATH
    ls -t | tail -n +6 | xargs -r rm -rf
    echo 'Backups antiguos limpiados'
"

# Calcular tiempo total
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Banner de éxito
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ DESPLIEGUE EXITOSO                     ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  🌐 Sitio web: https://www.krowdco.com                      ║${NC}"
echo -e "${GREEN}║  ⏱️  Tiempo total: ${MINUTES}m ${SECONDS}s                                    ║${NC}"
echo -e "${GREEN}║  📝 Log: $LOG_FILE                    ║${NC}"
echo -e "${GREEN}║  💾 Backup: $BACKUP_NAME                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

log "${GREEN}🎉 Despliegue completado exitosamente${NC}"
log "Commit desplegado: $CURRENT_COMMIT"
log "Rama: $CURRENT_BRANCH"
log "Duración: ${MINUTES}m ${SECONDS}s"

# Mostrar estado final de PM2
log "${BLUE}📊 Estado final de PM2:${NC}"
ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 status"