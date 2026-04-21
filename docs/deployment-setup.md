# Configuración Inicial de Despliegue

## Configuración SSH (Solo una vez)

### 1. Generar Clave SSH
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hostinger_deploy_key
```

### 2. Copiar Clave al VPS
```bash
ssh-copy-id -i ~/.ssh/hostinger_deploy_key.pub root@2.24.215.174
```

### 3. Probar Conexión
```bash
ssh -i ~/.ssh/hostinger_deploy_key root@2.24.215.174
```

## Configuración de Variables

### 1. Configurar Variables de Entorno
El archivo `deploy/.env.deploy` ya está configurado con los valores correctos para tu VPS:
- Host: 2.24.215.174
- Usuario: root
- Rutas del proyecto en VPS

### 2. Verificar Configuración
```bash
npm run deploy:check
```

## Estructura del Proyecto en VPS

Asegúrate de que tu proyecto esté clonado en el VPS en la ruta correcta:
```bash
# En el VPS
cd /var/www/krowdco
git clone [tu-repositorio] .
npm install
```

## Verificación Final

Ejecuta las validaciones para confirmar que todo está configurado:
```bash
npm run deploy:check
```

Si todas las validaciones pasan, ya puedes usar el despliegue automático.