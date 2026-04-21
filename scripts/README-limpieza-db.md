# Limpieza de Base de Datos de Producción

## ⚠️ ADVERTENCIA CRÍTICA
Estos scripts eliminarán **TODOS** los datos de tu base de datos de producción. Úsalos solo si estás completamente seguro.

## Opciones de Limpieza

### Opción 1: Script Node.js (Recomendado)
```bash
# En tu VPS o máquina local con acceso a la DB de producción
cd /path/to/your/project
export DATABASE_URL="postgresql://usuario:password@host:puerto/database"
node scripts/clean-production-db.js
```

### Opción 2: Script SQL Directo
```bash
# Conectar directamente a PostgreSQL
psql -U tu_usuario -h tu_host -d tu_database -f scripts/clean-production-db.sql
```

### Opción 3: Usando Prisma (Más Agresivo)
```bash
# En el directorio de tu API
cd apps/api
export DATABASE_URL="postgresql://usuario:password@host:puerto/database"
npx prisma db push --force-reset
```

## Verificación Post-Limpieza

Después de ejecutar cualquier script, verifica que la API siga funcionando:

```bash
# Verificar que PM2 esté corriendo
pm2 status

# Probar endpoint de salud
curl http://localhost:4000/health

# Intentar registro del usuario
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "monofisgon@gmail.com",
    "username": "Cristian", 
    "name": "Avilez",
    "password": "tu_password"
  }'
```

## Datos del Usuario a Registrar
- **Email**: monofisgon@gmail.com
- **Username**: Cristian
- **Nombre**: Avilez

## Troubleshooting

Si encuentras errores:

1. **Error de conexión**: Verifica que DATABASE_URL sea correcta
2. **Error de permisos**: Asegúrate de tener permisos de DELETE en todas las tablas
3. **API no responde**: Reinicia PM2 con `pm2 restart all`
4. **Nginx issues**: Verifica configuración con `nginx -t`

## Rollback

Si necesitas restaurar datos, asegúrate de tener un backup antes de ejecutar estos scripts.