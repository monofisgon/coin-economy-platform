Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       DESPLIEGUE AUTOMATICO" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

$VPS_HOST = "2.24.215.174"
$VPS_USER = "root"
$SSH_KEY_PATH = "~/.ssh/hostinger_deploy_key"

Write-Host "[1/4] Validaciones..." -ForegroundColor Yellow
& npm run deploy:check
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[2/4] Push cambios..." -ForegroundColor Yellow
git push origin main

Write-Host "[3/4] Despliegue en VPS..." -ForegroundColor Yellow
ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "cd /var/www/coin-economy && git pull origin main && npm install && npm run build --workspace=apps/web && npm run build --workspace=apps/api && pm2 reload ecosystem.config.js"

Write-Host "[4/4] Verificando..." -ForegroundColor Yellow
ssh -i $SSH_KEY_PATH "$VPS_USER@$VPS_HOST" "pm2 status"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "       DESPLIEGUE EXITOSO" -ForegroundColor Green
Write-Host "  https://www.krowdco.com" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green