# Simple deployment check
Write-Host "🔍 Verificando configuración de despliegue..." -ForegroundColor Blue

# Variables del VPS
$VPS_HOST = "2.24.215.174"
$VPS_USER = "root"
$SSH_KEY_PATH = "~/.ssh/hostinger_deploy_key"

# 1. Verificar Git
Write-Host "[1/4] Verificando Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Hay cambios sin commit" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git OK" -ForegroundColor Green

# 2. Verificar SSH
Write-Host "[2/4] Verificando SSH..." -ForegroundColor Yellow
$sshResult = ssh -i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" "echo OK" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SSH falló" -ForegroundColor Red
    exit 1
}
Write-Host "✅ SSH OK" -ForegroundColor Green

# 3. Verificar proyecto en VPS
Write-Host "[3/4] Verificando proyecto en VPS..." -ForegroundColor Yellow
$projectCheck = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "ls /var/www/krowdco 2>/dev/null | wc -l"
if ([int]$projectCheck -eq 0) {
    Write-Host "❌ Proyecto no encontrado en VPS" -ForegroundColor Red
    Write-Host "Necesitas clonar tu proyecto en /var/www/krowdco" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Proyecto encontrado" -ForegroundColor Green

# 4. Verificar PM2
Write-Host "[4/4] Verificando PM2..." -ForegroundColor Yellow
$pm2Check = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "which pm2 2>/dev/null"
if (-not $pm2Check) {
    Write-Host "❌ PM2 no instalado" -ForegroundColor Red
    Write-Host "Instala PM2: npm install -g pm2" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ PM2 OK" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 ¡Configuración lista para despliegue!" -ForegroundColor Green