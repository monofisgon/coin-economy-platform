# Diseño: Automatización de Despliegue para Hostinger VPS

## Resumen Ejecutivo

El sistema actual tiene la infraestructura de despliegue configurada (`deploy/deploy.sh` y `ecosystem.config.js`), pero requiere ejecución manual. Diseñaremos una solución que automatice el proceso de despliegue desde el desarrollo local hasta producción en Hostinger VPS.

## Análisis de la Configuración Actual

### ✅ Infraestructura Existente
- **Script de Despliegue:** `deploy/deploy.sh` - Proceso completo de 5 pasos
- **Gestor de Procesos:** PM2 configurado con `ecosystem.config.js`
- **Aplicaciones:** API (puerto 4000) y Web (puerto 3000)
- **Base de Datos:** Migraciones automáticas con Prisma
- **Logs:** Configuración completa de logging

### ❌ Problemas Identificados
1. **Ejecución Manual:** El script debe ejecutarse manualmente en el VPS
2. **Acceso al VPS:** Necesita SSH para ejecutar comandos
3. **Sincronización:** No hay automatización desde el entorno local
4. **Notificaciones:** No hay feedback del estado del despliegue

## Arquitectura de la Solución

### Opción 1: Despliegue SSH Automatizado (Recomendado)
```
[Desarrollo Local] → [SSH Script] → [Hostinger VPS] → [deploy.sh] → [PM2 Reload]
```

**Ventajas:**
- Utiliza la infraestructura existente
- Implementación rápida
- Control total sobre el proceso
- No requiere servicios externos

### Opción 2: Git Hooks + Webhook
```
[Git Push] → [GitHub Webhook] → [VPS Endpoint] → [deploy.sh] → [PM2 Reload]
```

**Ventajas:**
- Despliegue automático en cada push
- Integración con Git workflow
- Escalable para equipos

### Opción 3: GitHub Actions CI/CD
```
[Git Push] → [GitHub Actions] → [SSH Deploy] → [Hostinger VPS] → [deploy.sh]
```

**Ventajas:**
- Pipeline completo de CI/CD
- Testing automático
- Historial de despliegues

## Diseño Detallado - Opción 1 (Implementación Inmediata)

### Componentes del Sistema

#### 1. Script de Despliegue Local
**Archivo:** `scripts/deploy-to-production.sh`
```bash
#!/bin/bash
# Script que se ejecuta desde el entorno local
# Conecta por SSH al VPS y ejecuta el despliegue
```

**Funcionalidades:**
- Validación de cambios locales
- Conexión SSH segura al VPS
- Ejecución remota del script de despliegue
- Monitoreo del progreso
- Reporte de estado final

#### 2. Configuración SSH
**Archivo:** `deploy/ssh-config`
```
Host hostinger-vps
    HostName [IP_DEL_VPS]
    User [USUARIO]
    Port 22
    IdentityFile ~/.ssh/hostinger_key
```

#### 3. Script de Validación Pre-Despliegue
**Archivo:** `scripts/pre-deploy-checks.sh`
```bash
# Verificaciones antes del despliegue:
# - Estado del repositorio Git
# - Tests locales
# - Build local exitoso
# - Conectividad con VPS
```

#### 4. Configuración de Entorno
**Archivo:** `deploy/.env.deploy`
```bash
VPS_HOST=tu-vps-ip
VPS_USER=tu-usuario
VPS_PATH=/path/to/project
SSH_KEY_PATH=~/.ssh/hostinger_key
```

### Flujo de Despliegue Automatizado

#### Paso 1: Preparación Local
```bash
# El usuario ejecuta desde su máquina local:
npm run deploy:production
```

#### Paso 2: Validaciones Pre-Despliegue
1. Verificar que no hay cambios sin commit
2. Verificar que está en la rama main/master
3. Ejecutar tests locales (opcional)
4. Verificar conectividad SSH con VPS

#### Paso 3: Sincronización y Despliegue
1. Push de cambios al repositorio Git
2. Conexión SSH al VPS
3. Ejecución del script `deploy/deploy.sh` en el VPS
4. Monitoreo del progreso en tiempo real

#### Paso 4: Verificación Post-Despliegue
1. Verificar que PM2 procesos están corriendo
2. Health check de la API (puerto 4000)
3. Health check del Web (puerto 3000)
4. Verificar que www.krowdco.com responde correctamente

### Estructura de Archivos Propuesta

```
proyecto/
├── deploy/
│   ├── deploy.sh              # ✅ Existente - Script principal de despliegue
│   ├── ecosystem.config.js    # ✅ Existente - Configuración PM2
│   ├── ssh-config            # 🆕 Configuración SSH
│   ├── .env.deploy           # 🆕 Variables de entorno para despliegue
│   └── nginx.conf            # ✅ Existente - Configuración Nginx
├── scripts/
│   ├── deploy-to-production.sh  # 🆕 Script de despliegue desde local
│   ├── pre-deploy-checks.sh     # 🆕 Validaciones pre-despliegue
│   └── health-check.sh          # 🆕 Verificaciones post-despliegue
└── package.json               # 🆕 Agregar script npm run deploy:production
```

## Configuración de Seguridad

### Autenticación SSH
1. **Clave SSH Dedicada:** Crear clave específica para despliegues
2. **Configuración de Host:** Usar alias SSH para simplificar conexión
3. **Permisos Restringidos:** Usuario con permisos mínimos necesarios

### Variables de Entorno Sensibles
```bash
# deploy/.env.deploy (no commitear)
VPS_HOST=xxx.xxx.xxx.xxx
VPS_USER=deploy_user
VPS_PATH=/var/www/krowdco
SSH_KEY_PATH=~/.ssh/hostinger_deploy_key
```

## Scripts NPM Propuestos

### package.json (raíz del proyecto)
```json
{
  "scripts": {
    "deploy:production": "./scripts/deploy-to-production.sh",
    "deploy:check": "./scripts/pre-deploy-checks.sh",
    "deploy:health": "./scripts/health-check.sh"
  }
}
```

### Comandos de Usuario
```bash
# Despliegue completo
npm run deploy:production

# Solo verificaciones
npm run deploy:check

# Solo health check
npm run deploy:health
```

## Monitoreo y Logging

### Logs de Despliegue
- **Local:** `logs/deploy-$(date).log`
- **Remoto:** Usar logs existentes de PM2

### Notificaciones
- **Éxito:** Mensaje con URL y tiempo de despliegue
- **Error:** Detalles del error y pasos para resolución
- **Progreso:** Indicador en tiempo real del progreso

## Rollback y Recuperación

### Estrategia de Rollback
1. **Git Tags:** Etiquetar cada despliegue exitoso
2. **Backup Automático:** Backup de la versión anterior antes del despliegue
3. **Script de Rollback:** `scripts/rollback-production.sh`

### Procedimiento de Emergencia
```bash
# En caso de falla crítica
npm run rollback:production
# o directamente en el VPS:
pm2 reload ecosystem.config.js
```

## Métricas y KPIs

### Tiempo de Despliegue
- **Objetivo:** < 3 minutos desde local hasta producción
- **Medición:** Timestamp inicio/fin en logs

### Confiabilidad
- **Objetivo:** 95% de despliegues exitosos
- **Medición:** Ratio éxito/total en logs

### Tiempo de Recuperación
- **Objetivo:** < 1 minuto para rollback
- **Medición:** Tiempo desde detección hasta servicio restaurado

## Fases de Implementación

### Fase 1: Configuración Básica (Inmediata)
1. Configurar SSH y credenciales
2. Crear script de despliegue local básico
3. Probar despliegue manual mejorado

### Fase 2: Automatización Completa
1. Implementar validaciones pre-despliegue
2. Agregar health checks post-despliegue
3. Configurar logging y notificaciones

### Fase 3: Mejoras Avanzadas (Futuro)
1. Implementar rollback automático
2. Integrar con CI/CD (GitHub Actions)
3. Monitoreo avanzado y alertas

## Consideraciones de Hostinger VPS

### Limitaciones Conocidas
- **Recursos:** Verificar límites de CPU/memoria durante build
- **Conectividad:** Asegurar SSH habilitado y configurado
- **Permisos:** Usuario con permisos para PM2 y Git

### Optimizaciones Específicas
- **Build Remoto:** Ejecutar build en VPS para evitar transferir node_modules
- **Cache:** Aprovechar cache de npm/next para builds más rápidos
- **Compresión:** Usar compresión para transferencia de archivos si es necesario

## Próximos Pasos para Implementación

1. **Configurar SSH:** Crear clave y configurar acceso al VPS
2. **Crear Scripts:** Implementar scripts de despliegue local
3. **Probar Proceso:** Ejecutar despliegue de prueba con cambio menor
4. **Documentar:** Crear guía de uso para el usuario
5. **Optimizar:** Mejorar tiempos y agregar funcionalidades avanzadas