# Guía de Despliegue Diario

## Comandos Principales

### Despliegue Completo
```bash
npm run deploy:production
```
Este comando ejecuta todo el proceso automáticamente:
1. ✅ Validaciones pre-despliegue
2. 📤 Push de cambios a Git
3. 💾 Backup automático
4. 🔧 Despliegue en VPS
5. 🏥 Health checks
6. 🧹 Limpieza

### Solo Validaciones
```bash
npm run deploy:check
```
Ejecuta solo las validaciones sin hacer despliegue.

### Solo Health Check
```bash
npm run deploy:health
```
Verifica que el sitio esté funcionando correctamente.

### Rollback de Emergencia
```bash
npm run deploy:rollback
```
Restaura un backup anterior en caso de problemas.

## Flujo de Trabajo Típico

### 1. Desarrollo Normal
```bash
# Hacer cambios en tu código
# Commitear cambios
git add .
git commit -m "Mi cambio"

# Desplegar a producción
npm run deploy:production
```

### 2. Verificación Rápida
```bash
# Solo verificar que todo esté bien
npm run deploy:health
```

## Qué Hacer en Caso de Errores

### Error de SSH
```
❌ No se puede conectar al VPS via SSH
```
**Solución:**
1. Verifica tu conexión a internet
2. Confirma que el VPS esté encendido en Hostinger
3. Regenera la clave SSH si es necesario

### Error de Validaciones
```
❌ Hay cambios sin commit en el repositorio
```
**Solución:**
```bash
git add .
git commit -m "Descripción del cambio"
```

### Error de Health Check
```
❌ Sitio público no accesible
```
**Solución:**
1. Espera 1-2 minutos y vuelve a intentar
2. Verifica el estado de PM2: `npm run deploy:health`
3. Si persiste, usa rollback: `npm run deploy:rollback`

### Despliegue Falló
El sistema automáticamente restaura el backup anterior, pero puedes verificar:
```bash
npm run deploy:health
```

## Logs y Monitoreo

### Ver Logs de Despliegue
Los logs se guardan automáticamente en:
```
logs/deploy-YYYYMMDD-HHMMSS.log
```

### Monitorear en Tiempo Real
Durante el despliegue verás el progreso en tiempo real con colores:
- 🔍 Azul: Información
- ⚠️ Amarillo: Advertencias
- ✅ Verde: Éxito
- ❌ Rojo: Errores

## Tiempos Esperados

- **Despliegue completo:** 2-3 minutos
- **Solo validaciones:** 10-15 segundos
- **Health checks:** 30-45 segundos
- **Rollback:** 1-2 minutos

## URLs Importantes

- **Sitio web:** https://www.krowdco.com
- **Panel Hostinger:** [Tu panel de Hostinger]
- **VPS SSH:** `ssh root@2.24.215.174`

## Consejos

1. **Siempre commitea antes de desplegar**
2. **Usa `deploy:check` antes del despliegue completo**
3. **Los backups se crean automáticamente**
4. **En caso de duda, usa rollback**
5. **Los logs te ayudan a diagnosticar problemas**