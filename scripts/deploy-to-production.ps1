# =============================================================================
# deploy-to-production.ps1 - Despliegue automatizado a Hostinger VPS
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       DESPLIEGUE AUTOMATICO" -ForegroundColor Magenta
Write-Host "         Hostinger VPS" -ForegroundColor Magenta
Write-Host "       www.krowdco.com" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$StartTime = Get-Date

# Variables del VPS
$VPS_HOST = "2.24.215.174"
$VPS_USER = "root"
$SSH_KEY_PATH = "~/.ssh/hostinger_deploy_key"
$VPS_PROJECT_PATH = "/var/www/coin-economy"

Write-Host "Iniciando despliegue a produccion..." -ForegroundColor Blue
Write-Host "Host: $VPS_HOST"
Write-Host "Usuario: $VPS_USER"
Write-Host "Proyecto: $VPS_PROJECT_PATH"
Write-Host ""

# Paso 1: Validaciones
Write-Host "[1/5] Ejecutando validaciones..." -ForegroundColor Yellow
& npm run deploy:check
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Validaciones fallaron" -ForegroundColor Red
    exit 1
}

# Paso 2: Push cambios
Write-Host "[2/5] Sincronizando con repositorio..." -ForegroundColor Yellow
$currentCommit = git rev-parse HEAD
$currentBranch = git branch --show-current

Write-Host "Rama: $currentBranch"
Write-Host "Commit: $currentCommit"

# Verificar si hay commits para pushear
$commitsToPush = git rev-list "@{u}..HEAD" 2>$null
if ($commitsToPush) {
    Write-Host "Pusheando cambios..."
    git push origin $currentBranch
} else {
    Write-Host "No hay cambios nuevos para pushear"
}

# Paso 3: Crear backup
Write-Host "[3/5] Creando backup en VPS..." -ForegroundColor Yellow
$backupName = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "
    mkdir -p /var/backups
    if [ -d '$VPS_PROJECT_PATH' ]; then
        cp -r $VPS_PROJECT_PATH /var/backups/$backupName
        echo 'Backup creado: /var/backups/$backupName'
    fi
"

# Paso 4: Ejecutar despliegue en VPS
Write-Host "[4/5] Ejecutando despliegue en VPS..." -ForegroundColor Yellow
Write-Host "Conectando a VPS y ejecutando deploy.sh..."

ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "
    cd $VPS_PROJECT_PATH
    echo '========================================='
    echo 'Ejecutando despliegue en VPS...'
    echo '========================================='
    
    # Ejecutar el script de despliegue existente
    if [ -f 'deploy/deploy.sh' ]; then
        bash deploy/deploy.sh
    else
        echo 'Script deploy/deploy.sh no encontrado'
        echo 'Ejecutando despliegue manual...'
        
        # Despliegue manual
        git pull origin main
        npm install --frozen-lockfile
        npm run build --workspace=apps/api
        npm run build --workspace=apps/web
        npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
        pm2 reload ecosystem.config.js --update-env
        pm2 save
    fi
"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Despliegue fallo en VPS" -ForegroundColor Red
    Write-Host "Restaurando backup..." -ForegroundColor Yellow
    
    ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "
        if [ -d '/var/backups/$backupName' ]; then
            rm -rf $VPS_PROJECT_PATH
            cp -r /var/backups/$backupName $VPS_PROJECT_PATH
            cd $VPS_PROJECT_PATH
            pm2 reload ecosystem.config.js --update-env
            echo 'Backup restaurado exitosamente'
        fi
    "
    
    Write-Host "ERROR: Despliegue fallo. Backup restaurado." -ForegroundColor Red
    exit 1
}

# Paso 5: Health checks
Write-Host "[5/5] Ejecutando health checks..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Health check simple
Write-Host "Verificando estado de PM2..."
ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 status"

Write-Host "Verificando sitio web..."
$webCheck = curl -s -o /dev/null -w "%{http_code}" "https://www.krowdco.com" 2>$null
if ($webCheck -eq "200") {
    Write-Host "OK: Sitio web responde correctamente" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: Sitio web no responde como esperado (codigo: $webCheck)" -ForegroundColor Yellow
}

# Calcular tiempo total
$EndTime = Get-Date
$Duration = $EndTime - $StartTime
$Minutes = [math]::Floor($Duration.TotalMinutes)
$Seconds = [math]::Floor($Duration.TotalSeconds % 60)

# Banner de exito
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "       DESPLIEGUE EXITOSO" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Sitio web: https://www.krowdco.com" -ForegroundColor Green
Write-Host "  Tiempo total: ${Minutes}m ${Seconds}s" -ForegroundColor Green
Write-Host "  Backup: $backupName" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host "Commit desplegado: $currentCommit"
Write-Host "Rama: $currentBranch"
Write-Host "Duracion: ${Minutes}m ${Seconds}s"

# Mostrar estado final de PM2
Write-Host ""
Write-Host "Estado final de PM2:" -ForegroundColor Blue
ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "cd $VPS_PROJECT_PATH && pm2 status"