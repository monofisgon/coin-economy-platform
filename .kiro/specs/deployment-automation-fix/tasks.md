# Tasks: Automatización de Despliegue - Hostinger VPS

## 1. Configuración de Acceso SSH al VPS

### 1.1 Configurar Clave SSH para Despliegue
- [ ] Generar clave SSH específica para despliegues: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/hostinger_deploy_key`
- [ ] Copiar clave pública al VPS: `ssh-copy-id -i ~/.ssh/hostinger_deploy_key.pub usuario@vps-ip`
- [ ] Probar conexión SSH: `ssh -i ~/.ssh/hostinger_deploy_key usuario@vps-ip`
- [ ] Crear archivo de configuración SSH en `deploy/ssh-config`

### 1.2 Configurar Variables de Entorno de Despliegue
- [ ] Crear archivo `deploy/.env.deploy` con configuración del VPS
- [ ] Agregar `deploy/.env.deploy` al `.gitignore`
- [ ] Documentar variables requeridas en `deploy/.env.deploy.example`

## 2. Scripts de Despliegue Local

### 2.1 Script Principal de Despliegue
- [ ] Crear `scripts/deploy-to-production.sh` que:
  - [ ] Cargue variables de entorno desde `deploy/.env.deploy`
  - [ ] Ejecute validaciones pre-despliegue
  - [ ] Conecte por SSH al VPS
  - [ ] Execute el script `deploy/deploy.sh` remotamente
  - [ ] Monitoree el progreso en tiempo real
  - [ ] Ejecute health checks post-despliegue

### 2.2 Script de Validaciones Pre-Despliegue
- [ ] Crear `scripts/pre-deploy-checks.sh` que verifique:
  - [ ] Estado del repositorio Git (no hay cambios sin commit)
  - [ ] Rama actual es main/master
  - [ ] Conectividad SSH con el VPS
  - [ ] Que el VPS tiene espacio suficiente en disco

### 2.3 Script de Health Check Post-Despliegue
- [ ] Crear `scripts/health-check.sh` que verifique:
  - [ ] Estado de procesos PM2 en el VPS
  - [ ] Respuesta HTTP de la API (puerto 4000)
  - [ ] Respuesta HTTP del sitio web (puerto 3000)
  - [ ] Que www.krowdco.com responde correctamente

## 3. Integración con NPM Scripts

### 3.1 Configurar Scripts en package.json
- [ ] Agregar script `deploy:production` que ejecute el despliegue completo
- [ ] Agregar script `deploy:check` para solo ejecutar validaciones
- [ ] Agregar script `deploy:health` para solo ejecutar health checks
- [ ] Hacer scripts ejecutables: `chmod +x scripts/*.sh`

## 4. Mejoras al Proceso de Despliegue Existente

### 4.1 Optimizar Script de Despliegue del VPS
- [ ] Revisar y optimizar `deploy/deploy.sh` existente
- [ ] Agregar logging detallado con timestamps
- [ ] Agregar verificación de éxito en cada paso
- [ ] Agregar rollback automático en caso de falla

### 4.2 Configurar Logging Mejorado
- [ ] Crear directorio `logs/` en el VPS si no existe
- [ ] Configurar rotación de logs para PM2
- [ ] Agregar logs de despliegue con fecha/hora

## 5. Documentación y Guías de Uso

### 5.1 Documentación de Configuración Inicial
- [ ] Crear `docs/deployment-setup.md` con:
  - [ ] Pasos para configurar SSH por primera vez
  - [ ] Configuración de variables de entorno
  - [ ] Verificación de la configuración

### 5.2 Guía de Uso Diario
- [ ] Crear `docs/deployment-guide.md` con:
  - [ ] Comandos para despliegue normal
  - [ ] Qué hacer en caso de errores
  - [ ] Cómo verificar el estado del despliegue

## 6. Testing y Validación

### 6.1 Pruebas del Proceso de Despliegue
- [ ] Probar despliegue completo con cambio menor (ej: cambio de texto)
- [ ] Verificar que los cambios aparecen en www.krowdco.com
- [ ] Probar manejo de errores (ej: falla de conexión SSH)
- [ ] Verificar rollback en caso de falla

### 6.2 Validación de Performance
- [ ] Medir tiempo total de despliegue (objetivo: < 3 minutos)
- [ ] Verificar que no hay downtime durante el despliegue
- [ ] Confirmar que PM2 reload funciona correctamente

## 7. Configuración de Seguridad

### 7.1 Hardening de SSH
- [ ] Configurar usuario específico para despliegues en VPS
- [ ] Restringir permisos del usuario de despliegue
- [ ] Configurar timeout de SSH apropiado

### 7.2 Backup y Rollback
- [ ] Crear script `scripts/rollback-production.sh`
- [ ] Configurar backup automático antes de cada despliegue
- [ ] Probar procedimiento de rollback

## 8. Monitoreo y Alertas

### 8.1 Configurar Notificaciones
- [ ] Agregar notificaciones de éxito/falla en scripts
- [ ] Configurar logging local de despliegues
- [ ] Crear dashboard simple de estado (opcional)

### 8.2 Métricas de Despliegue
- [ ] Implementar tracking de tiempo de despliegue
- [ ] Crear log de historial de despliegues
- [ ] Configurar alertas para fallos repetidos

## 9. Optimizaciones Avanzadas (Opcional)

### 9.1 Cache y Performance
- [ ] Optimizar cache de npm en VPS
- [ ] Configurar cache de Next.js build
- [ ] Implementar build incremental si es posible

### 9.2 Automatización Futura
- [ ] Evaluar integración con GitHub Actions
- [ ] Configurar webhooks para despliegue automático
- [ ] Implementar despliegue por ambientes (staging/production)

## Criterios de Aceptación

### ✅ Despliegue Exitoso
- [ ] El comando `npm run deploy:production` ejecuta sin errores
- [ ] Los cambios aparecen en www.krowdco.com en menos de 3 minutos
- [ ] No hay downtime durante el despliegue
- [ ] Todos los health checks pasan después del despliegue

### ✅ Manejo de Errores
- [ ] Los errores se reportan claramente al usuario
- [ ] El sistema puede recuperarse de fallos comunes
- [ ] El rollback funciona en caso de falla crítica

### ✅ Usabilidad
- [ ] El proceso está documentado y es fácil de seguir
- [ ] Los comandos son intuitivos y consistentes
- [ ] El feedback al usuario es claro y útil

### ✅ Seguridad
- [ ] Las credenciales están protegidas y no se commitean
- [ ] El acceso SSH está configurado de forma segura
- [ ] Los permisos están restringidos apropiadamente