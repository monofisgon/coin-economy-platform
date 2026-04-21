# Registro de Usuarios "Failed to fetch" Bugfix Design

## Overview

El error "Failed to fetch" en el registro de usuarios indica un problema de conectividad entre el frontend Next.js (puerto 3000) y el backend Fastify (puerto 4000) durante la llamada al endpoint `/api/auth/register`. Este bug bloquea completamente el flujo de onboarding, impidiendo que nuevos usuarios se registren en la plataforma. El análisis técnico sugiere múltiples causas potenciales: problemas de CORS, configuración incorrecta de la URL del API, servicios no ejecutándose, o problemas de red/proxy.

## Glossary

- **Bug_Condition (C)**: La condición que desencadena el bug - cuando las llamadas HTTP desde el frontend al endpoint de registro fallan con "Failed to fetch"
- **Property (P)**: El comportamiento deseado cuando se envían datos de registro válidos - el sistema debe crear la cuenta exitosamente
- **Preservation**: El comportamiento existente de validación de errores (email duplicado, username duplicado, datos inválidos) que debe mantenerse sin cambios
- **api.register()**: La función en `apps/web/src/lib/api.ts` que realiza la llamada HTTP POST al endpoint de registro
- **handleSubmit()**: La función en `apps/web/src/app/register/page.tsx` que procesa el formulario de registro
- **authService.register()**: El servicio en `apps/api/src/modules/auth/auth.service.ts` que procesa el registro en el backend
- **NEXT_PUBLIC_API_URL**: Variable de entorno que define la URL base del API (actualmente `http://localhost:4000`)

## Bug Details

### Bug Condition

El bug se manifiesta cuando un usuario completa el formulario de registro con datos válidos y el sistema no puede establecer comunicación HTTP entre el frontend y el backend. La función `api.register()` falla con "Failed to fetch" antes de que la solicitud llegue al servidor Fastify.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type RegistrationFormData
  OUTPUT: boolean
  
  RETURN input.email IS valid_email_format
         AND input.username IS non_empty_string
         AND input.password IS valid_password
         AND input.name IS optional_string
         AND fetch_request_to_backend FAILS with "Failed to fetch"
END FUNCTION
```

### Examples

- **Ejemplo 1**: Usuario ingresa "Avilez" (nombre), "Cristian" (username), "monofisgon@gmail.com" (email), contraseña válida → Sistema muestra "Failed to fetch"
- **Ejemplo 2**: Usuario ingresa cualquier combinación de datos válidos → Sistema falla antes de validar duplicados en el backend
- **Ejemplo 3**: Usuario con datos válidos en red local → Falla la conexión HTTP al puerto 4000
- **Caso Edge**: Usuario intenta registro cuando el backend está caído → Debería mostrar error específico de conectividad

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Las validaciones de email duplicado deben continuar funcionando cuando el backend esté disponible
- Las validaciones de username duplicado deben continuar funcionando cuando el backend esté disponible  
- Las validaciones de formato de datos (email, contraseña) deben continuar funcionando
- La creación de wallet inicial con 0 Coins y 0 Diamonds debe continuar funcionando
- La generación de tokens JWT debe continuar funcionando

**Scope:**
Todas las entradas que NO involucran problemas de conectividad de red deben ser completamente no afectadas por este fix. Esto incluye:
- Validaciones del lado del cliente (formato de email, longitud de contraseña)
- Respuestas de error del servidor cuando la conexión es exitosa
- Flujos de autenticación posteriores al registro exitoso

## Hypothesized Root Cause

Basado en la descripción del bug y el análisis del código, las causas más probables son:

1. **Problemas de Configuración de CORS**: El backend Fastify puede no estar configurado correctamente para aceptar requests desde el frontend Next.js
   - El CORS está configurado con `origin: true` pero puede haber problemas con credenciales
   - Headers de Content-Type pueden estar siendo rechazados

2. **Servicios No Ejecutándose**: Uno o ambos servicios pueden no estar corriendo en los puertos esperados
   - Backend Fastify no está ejecutándose en puerto 4000
   - Frontend Next.js no está ejecutándose en puerto 3000
   - Nginx reverse proxy no está configurado correctamente

3. **Problemas de Red/Conectividad**: Problemas de red local o configuración de proxy
   - Firewall bloqueando conexiones entre puertos
   - Nginx no está redirigiendo correctamente las requests `/api/` al puerto 4000
   - DNS local no resuelve `localhost` correctamente

4. **Configuración de Variables de Entorno**: La URL del API puede estar mal configurada
   - `NEXT_PUBLIC_API_URL` apunta a una URL incorrecta o inaccesible
   - Variables de entorno no están siendo cargadas correctamente en el frontend

## Correctness Properties

Property 1: Bug Condition - Registro Exitoso con Conectividad

_For any_ input donde los datos de registro son válidos (email válido, username no vacío, contraseña válida) y la conectividad de red funciona correctamente, la función api.register() fija SHALL completar exitosamente la llamada HTTP, crear la cuenta de usuario en la base de datos, inicializar una wallet con 0 Coins y 0 Diamonds, y retornar un token JWT válido.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Validaciones de Error Existentes

_For any_ input que NO involucra problemas de conectividad de red (email duplicado, username duplicado, datos inválidos), el código fijo SHALL producir exactamente el mismo comportamiento que el código original, preservando todas las validaciones de error y respuestas del servidor existentes.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Asumiendo que nuestro análisis de causa raíz es correcto:

**File**: `apps/web/src/lib/api.ts`

**Function**: `request()` y configuración de API_BASE

**Specific Changes**:
1. **Mejorar Manejo de Errores de Red**: Agregar detección específica de errores de conectividad
   - Capturar errores de `fetch()` que indican problemas de red
   - Proporcionar mensajes de error más descriptivos para problemas de conectividad
   - Implementar retry logic para requests fallidos

2. **Validar Configuración de URL**: Verificar que NEXT_PUBLIC_API_URL esté correctamente configurada
   - Agregar validación de la variable de entorno al inicializar
   - Proporcionar fallback a localhost:4000 si no está definida
   - Logging para debug de la URL utilizada

**File**: `apps/api/src/index.ts`

**Function**: Configuración de CORS y servidor

**Specific Changes**:
3. **Mejorar Configuración de CORS**: Asegurar que el CORS esté configurado correctamente
   - Especificar origins explícitos en lugar de `origin: true`
   - Verificar que los headers necesarios estén permitidos
   - Agregar logging para requests CORS rechazados

4. **Agregar Health Check Mejorado**: Implementar endpoint de health check más robusto
   - Verificar conectividad a base de datos y Redis
   - Retornar información de estado del servidor
   - Permitir verificación desde el frontend

**File**: `deploy/nginx.conf`

**Function**: Configuración de reverse proxy

**Specific Changes**:
5. **Verificar Configuración de Proxy**: Asegurar que Nginx esté configurado correctamente
   - Verificar que las rutas `/api/` se redirijan al puerto 4000
   - Agregar headers de debug para troubleshooting
   - Configurar timeouts apropiados para requests

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, exponer contraejemplos que demuestren el bug en código no arreglado, luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Exponer contraejemplos que demuestren el bug ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz. Si refutamos, necesitaremos re-hipotetizar.

**Test Plan**: Escribir tests que simulen el flujo de registro completo y verifiquen la conectividad entre frontend y backend. Ejecutar estos tests en el código NO ARREGLADO para observar fallas y entender la causa raíz.

**Test Cases**:
1. **Test de Conectividad Básica**: Verificar que el backend responda en puerto 4000 (fallará en código no arreglado si el servicio no está corriendo)
2. **Test de CORS**: Simular request desde frontend y verificar headers CORS (fallará en código no arreglado si CORS está mal configurado)
3. **Test de Registro con Datos Válidos**: Simular registro completo con datos válidos (fallará en código no arreglado con "Failed to fetch")
4. **Test de Variables de Entorno**: Verificar que NEXT_PUBLIC_API_URL esté correctamente configurada (puede fallar en código no arreglado)

**Expected Counterexamples**:
- Requests HTTP fallan con "Failed to fetch" antes de llegar al servidor
- Posibles causas: servicios no ejecutándose, CORS mal configurado, problemas de red, variables de entorno incorrectas

### Fix Checking

**Goal**: Verificar que para todas las entradas donde la condición de bug se cumple, la función arreglada produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := api.register_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas las entradas donde la condición de bug NO se cumple, la función arreglada produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT api.register_original(input) = api.register_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos casos de test automáticamente a través del dominio de entrada
- Captura casos edge que los unit tests manuales podrían perder
- Proporciona garantías fuertes de que el comportamiento no cambia para todas las entradas no buggy

**Test Plan**: Observar comportamiento en código NO ARREGLADO primero para validaciones de error y respuestas exitosas, luego escribir property-based tests capturando ese comportamiento.

**Test Cases**:
1. **Preservación de Validación de Email Duplicado**: Verificar que emails duplicados continúen siendo rechazados después del fix
2. **Preservación de Validación de Username Duplicado**: Verificar que usernames duplicados continúen siendo rechazados después del fix
3. **Preservación de Validación de Datos**: Verificar que datos inválidos continúen siendo rechazados con los mismos mensajes de error
4. **Preservación de Creación de Wallet**: Verificar que las wallets se inicialicen correctamente con 0 Coins y 0 Diamonds

### Unit Tests

- Test de conectividad entre frontend y backend en diferentes escenarios de red
- Test de configuración de CORS con diferentes origins y headers
- Test de manejo de errores para diferentes tipos de fallas de conectividad
- Test de validación de variables de entorno y configuración de URL

### Property-Based Tests

- Generar datos de registro aleatorios válidos y verificar que el registro funcione correctamente
- Generar configuraciones de red aleatorias y verificar que el manejo de errores sea consistente
- Test que todas las validaciones de error existentes continúen funcionando a través de muchos escenarios

### Integration Tests

- Test de flujo completo de registro desde frontend hasta base de datos
- Test de diferentes configuraciones de deployment (desarrollo, producción, con/sin Nginx)
- Test de que las notificaciones y respuestas visuales ocurran cuando el registro es exitoso