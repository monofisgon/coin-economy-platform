#!/bin/bash
# =============================================================================
# pre-deploy-checks.sh - Validaciones antes del despliegue
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
    echo "Copia deploy/.env.deploy.example a deploy/.env.deploy y configúralo"
    exit 1
fi

echo -e "${BLUE}🔍 Ejecutando validaciones pre-despliegue...${NC}"
echo "============================================="

# 1. Verificar estado del repositorio Git
echo -e "${YELLOW}[1/6]${NC} Verificando estado de Git..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ Hay cambios sin commit en el repositorio${NC}"
    echo "Commitea o stashea los cambios antes del despliegue:"
    git status --short
    exit 1
fi
echo -e "${GREEN}✅ Repositorio limpio${NC}"

# 2. Verificar rama actual
echo -e "${YELLOW}[2/6]${NC} Verificando rama actual..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo -e "${YELLOW}⚠️  Advertencia: No estás en la rama main/master (actual: $CURRENT_BRANCH)${NC}"
    read -p "¿Continuar con el despliegue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Despliegue cancelado"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Rama correcta: $CURRENT_BRANCH${NC}"
fi

# 3. Verificar conectividad SSH
echo -e "${YELLOW}[3/6]${NC} Verificando conectividad SSH..."
if ! ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${RED}❌ No se puede conectar al VPS via SSH${NC}"
    echo "Verifica:"
    echo "  - Clave SSH: $SSH_KEY_PATH"
    echo "  - Host: $VPS_HOST"
    echo "  - Usuario: $VPS_USER"
    echo ""
    echo "Para generar una nueva clave SSH:"
    echo "  ssh-keygen -t rsa -b 4096 -f $SSH_KEY_PATH"
    echo "  ssh-copy-id -i ${SSH_KEY_PATH}.pub $VPS_USER@$VPS_HOST"
    exit 1
fi
echo -e "${GREEN}✅ Conexión SSH exitosa${NC}"

# 4. Verificar espacio en disco del VPS
echo -e "${YELLOW}[4/6]${NC} Verificando espacio en disco del VPS..."
DISK_USAGE=$(ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "df -h / | awk 'NR==2 {print \$5}' | sed 's/%//'")
if [ "$DISK_USAGE" -gt 90 ]; then
    echo -e "${RED}❌ Espacio en disco crítico: ${DISK_USAGE}%${NC}"
    echo "Libera espacio en el VPS antes del despliegue"
    exit 1
elif [ "$DISK_USAGE" -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Advertencia: Espacio en disco alto: ${DISK_USAGE}%${NC}"
else
    echo -e "${GREEN}✅ Espacio en disco OK: ${DISK_USAGE}%${NC}"
fi

# 5. Verificar que el proyecto existe en el VPS
echo -e "${YELLOW}[5/6]${NC} Verificando proyecto en VPS..."
if ! ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "[ -d '$VPS_PROJECT_PATH' ]"; then
    echo -e "${RED}❌ Directorio del proyecto no encontrado: $VPS_PROJECT_PATH${NC}"
    echo "Asegúrate de que el proyecto esté clonado en el VPS"
    exit 1
fi
echo -e "${GREEN}✅ Proyecto encontrado en VPS${NC}"

# 6. Verificar que PM2 está instalado
echo -e "${YELLOW}[6/6]${NC} Verificando PM2 en VPS..."
if ! ssh -i "$SSH_KEY_PATH" "$VPS_USER@$VPS_HOST" "command -v pm2 >/dev/null 2>&1"; then
    echo -e "${RED}❌ PM2 no está instalado en el VPS${NC}"
    echo "Instala PM2 en el VPS: npm install -g pm2"
    exit 1
fi
echo -e "${GREEN}✅ PM2 disponible${NC}"

echo ""
echo -e "${GREEN}🎉 Todas las validaciones pasaron exitosamente${NC}"
echo "============================================="