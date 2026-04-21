# Bugfix: Automatización de Despliegue - Los Cambios Locales No Se Reflejan en Producción

## Descripción del Bug

**Problema:** Los cambios realizados en el código local de la aplicación Next.js no se reflejan automáticamente en el sitio web en producción (www.krowdco.com) alojado en Hostinger VPS.

**Impacto:** Este problema está causando retrasos significativos en el desarrollo, ya que el usuario no puede ver los cambios implementados en el sitio web en vivo, afectando la productividad y la capacidad de iterar rápidamente.

## Condición del Bug

**C(X):** Para cualquier cambio X realizado en el código fuente local:
- **Entrada:** Modificación de archivos en el directorio local `apps/web/src/`
- **Comportamiento Esperado:** Los cambios deben aparecer en www.krowdco.com después de un proceso de despliegue
- **Comportamiento Actual:** Los cambios permanecen solo en el entorno local y no se propagan a producción
- **Condición de Falla:** `cambios_en_produccion(X) = false` cuando debería ser `true`

## Contexto del Sistema

### Configuración Actual
- **Aplicación:** Next.js 14.2.5 con TypeScript
- **Estructura:** Monorepo con apps/web, apps/api, apps/mobile
- **Hosting:** Hostinger VPS con servicios pagados (email, dominio, VPS, KVM1)
- **Dominio:** www.krowdco.com
- **Configuración:** `output: 'standalone'` en next.config.js

### Estado del Problema
- ✅ Aplicación funciona correctamente en desarrollo local
- ✅ Aplicación fue subida inicialmente a Hostinger (método desconocido)
- ❌ No existe proceso de despliegue automatizado
- ❌ Cambios locales no se sincronizan con producción
- ❌ No hay CI/CD configurado

## Casos de Prueba del Bug

### Caso 1: Cambio Simple de Texto
```
DADO que modifico un texto en apps/web/src/app/page.tsx
CUANDO guardo el archivo
ENTONCES el cambio debería aparecer en www.krowdco.com
PERO actualmente no aparece
```

### Caso 2: Cambios de Estilo
```
DADO que modifico estilos CSS/Tailwind en cualquier componente
CUANDO guardo los cambios
ENTONCES los estilos deberían actualizarse en producción
PERO actualmente no se actualizan
```

### Caso 3: Nuevas Funcionalidades
```
DADO que agrego una nueva página o componente
CUANDO completo la implementación
ENTONCES la funcionalidad debería estar disponible en www.krowdco.com
PERO actualmente no está disponible
```

## Información de Diagnóstico

### Verificaciones Necesarias
1. **Estado del VPS:** Verificar qué está ejecutándose en el servidor de Hostinger
2. **Método de Despliegue Actual:** Identificar cómo se subió inicialmente la aplicación
3. **Configuración del Servidor:** Revisar la configuración de Node.js/PM2 en el VPS
4. **Proceso de Build:** Verificar si se está ejecutando `npm run build` en producción
5. **Sincronización de Archivos:** Determinar el método de transferencia de archivos

### Herramientas de Despliegue Potenciales
- **Git + SSH:** Clonar repositorio directamente en el VPS
- **FTP/SFTP:** Transferencia manual de archivos
- **CI/CD:** GitHub Actions, GitLab CI, o similar
- **Docker:** Containerización para despliegues consistentes
- **PM2:** Gestor de procesos para aplicaciones Node.js

## Criterios de Éxito

El bug se considerará resuelto cuando:

1. **Despliegue Automatizado:** Existe un proceso claro y documentado para desplegar cambios
2. **Sincronización Rápida:** Los cambios se reflejan en producción en menos de 5 minutos
3. **Proceso Confiable:** El despliegue funciona consistentemente sin errores
4. **Documentación:** El proceso está documentado para uso futuro
5. **Rollback:** Capacidad de revertir cambios si algo sale mal

## Propiedades de Correctness

### Propiedad 1: Sincronización de Cambios
```
∀ cambio C en código local:
  deploy(C) → eventually(producción_contiene(C))
```

### Propiedad 2: Integridad del Despliegue
```
∀ despliegue D:
  success(D) → (producción_funcional ∧ sin_errores_críticos)
```

### Propiedad 3: Consistencia de Estado
```
∀ momento T después del despliegue:
  estado_producción(T) = estado_código_desplegado(T)
```

## Próximos Pasos

1. **Diagnóstico:** Investigar la configuración actual del VPS
2. **Diseño:** Crear un plan de despliegue automatizado
3. **Implementación:** Configurar el proceso de despliegue
4. **Validación:** Probar el proceso con cambios de prueba
5. **Documentación:** Crear guía de uso para futuros despliegues