# =============================================================================
# pre-deploy-checks.ps1 - Validaciones antes del despliegue (PowerShell)
# =============================================================================

# Colores para output
$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$NC = "`e[0m"

# Función para logging
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host "🔍 Ejecutando validaciones pre-despliegue..." -ForegroundColor Blue
Write-Host "============================================="

# Cargar variables de entorno
if (Test-Path "deploy\.env.deploy") {
    Get-Content "deploy\.env.deploy" | ForEach-Object {
        if ($_ -match "^([^#=][^=]*)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
} else {
    Write-Host "❌ Error: Archivo deploy/.env.deploy no encontrado" -ForegroundColor Red
    Write-Host "Copia deploy/.env.deploy.example a deploy/.env.deploy y configúralo"
    exit 1
}

$VPS_HOST = $env:VPS_HOST
$VPS_USER = $env:VPS_USER
$SSH_KEY_PATH = $env:SSH_KEY_PATH
$VPS_PROJECT_PATH = $env:VPS_PROJECT_PATH

# 1. Verificar estado del repositorio Git
Write-Host "[1/6] Verificando estado de Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Hay cambios sin commit en el repositorio" -ForegroundColor Red
    Write-Host "Commitea o stashea los cambios antes del despliegue:"
    git status --short
    exit 1
}
Write-Host "✅ Repositorio limpio" -ForegroundColor Green

# 2. Verificar rama actual
Write-Host "[2/6] Verificando rama actual..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($currentBranch -ne "main" -and $currentBranch -ne "master") {
    Write-Host "⚠️  Advertencia: No estás en la rama main/master (actual: $currentBranch)" -ForegroundColor Yellow
    $response = Read-Host "¿Continuar con el despliegue? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Despliegue cancelado"
        exit 1
    }
} else {
    Write-Host "✅ Rama correcta: $currentBranch" -ForegroundColor Green
}

# 3. Verificar conectividad SSH
Write-Host "[3/6] Verificando conectividad SSH..." -ForegroundColor Yellow
$sshTest = ssh -i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" "echo 'SSH OK'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No se puede conectar al VPS via SSH" -ForegroundColor Red
    Write-Host "Verifica:"
    Write-Host "  - Clave SSH: $SSH_KEY_PATH"
    Write-Host "  - Host: $VPS_HOST"
    Write-Host "  - Usuario: $VPS_USER"
    exit 1
}
Write-Host "✅ Conexión SSH exitosa" -ForegroundColor Green

# 4. Verificar espacio en disco del VPS
Write-Host "[4/6] Verificando espacio en disco del VPS..." -ForegroundColor Yellow
$diskUsage = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "df -h / | awk 'NR==2 {print `$5}' | sed 's/%//'"
$diskUsageInt = [int]$diskUsage
if ($diskUsageInt -gt 90) {
    Write-Host "❌ Espacio en disco crítico: ${diskUsage}%" -ForegroundColor Red
    Write-Host "Libera espacio en el VPS antes del despliegue"
    exit 1
} elseif ($diskUsageInt -gt 80) {
    Write-Host "⚠️  Advertencia: Espacio en disco alto: ${diskUsage}%" -ForegroundColor Yellow
} else {
    Write-Host "✅ Espacio en disco OK: ${diskUsage}%" -ForegroundColor Green
}

# 5. Verificar que el proyecto existe en el VPS
Write-Host "[5/6] Verificando proyecto en VPS..." -ForegroundColor Yellow
$projectExists = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "test -d '$VPS_PROJECT_PATH'; echo `$?"
if ($projectExists -ne "0") {
    Write-Host "❌ Directorio del proyecto no encontrado: $VPS_PROJECT_PATH" -ForegroundColor Red
    Write-Host "Asegúrate de que el proyecto esté clonado en el VPS"
    exit 1
}
Write-Host "✅ Proyecto encontrado en VPS" -ForegroundColor Green

# 6. Verificar que PM2 está instalado
Write-Host "[6/6] Verificando PM2 en VPS..." -ForegroundColor Yellow
$pm2Exists = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "command -v pm2 >/dev/null 2>&1; echo `$?"
if ($pm2Exists -ne "0") {
    Write-Host "❌ PM2 no está instalado en el VPS" -ForegroundColor Red
    Write-Host "Instala PM2 en el VPS: npm install -g pm2"
    exit 1
}
Write-Host "✅ PM2 disponible" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Todas las validaciones pasaron exitosamente" -ForegroundColor Green
Write-Host "============================================="