Write-Host "Verificando configuracion de despliegue..." -ForegroundColor Blue

$VPS_HOST = "2.24.215.174"
$VPS_USER = "root"
$SSH_KEY_PATH = "~/.ssh/hostinger_deploy_key"
$VPS_PROJECT_PATH = "/var/www/coin-economy"

Write-Host "[1/4] Verificando Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "ERROR: Hay cambios sin commit" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Git limpio" -ForegroundColor Green

Write-Host "[2/4] Verificando SSH..." -ForegroundColor Yellow
$sshResult = ssh -i $SSH_KEY_PATH -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" "echo OK" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SSH fallo" -ForegroundColor Red
    exit 1
}
Write-Host "OK: SSH conectado" -ForegroundColor Green

Write-Host "[3/4] Verificando proyecto en VPS..." -ForegroundColor Yellow
$projectCheck = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "test -d $VPS_PROJECT_PATH && echo 'exists'"
if ($projectCheck -ne "exists") {
    Write-Host "ERROR: Proyecto no encontrado en VPS" -ForegroundColor Red
    Write-Host "Necesitas clonar tu proyecto en $VPS_PROJECT_PATH" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK: Proyecto encontrado" -ForegroundColor Green

Write-Host "[4/4] Verificando PM2..." -ForegroundColor Yellow
$pm2Check = ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "which pm2"
if (-not $pm2Check) {
    Write-Host "ERROR: PM2 no instalado" -ForegroundColor Red
    exit 1
}
Write-Host "OK: PM2 disponible" -ForegroundColor Green

Write-Host ""
Write-Host "EXITO: Configuracion lista para despliegue!" -ForegroundColor Green