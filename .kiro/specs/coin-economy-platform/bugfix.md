# Bugfix Requirements Document

## Introduction

El sistema de registro de usuarios presenta un error "Failed to fetch" que impide completar el proceso de creación de cuentas nuevas. Este bug bloquea completamente el flujo de onboarding de la plataforma, impidiendo que nuevos usuarios se registren y accedan a las funcionalidades del sistema. El error indica un problema de conectividad entre el frontend (Next.js) y el backend (Fastify API) durante la llamada al endpoint de registro.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN un usuario completa el formulario de registro con datos válidos (nombre completo, username, email, contraseña) THEN el sistema muestra el error "Failed to fetch" y no crea la cuenta

1.2 WHEN un usuario intenta registrarse con los datos específicos (Nombre: "Avilez", Username: "Cristian", Email: "monofisgon@gmail.com") THEN el sistema falla con "Failed to fetch" sin procesar la solicitud

1.3 WHEN ocurre el error "Failed to fetch" THEN no se crea el registro de usuario en la base de datos ni se inicializa la wallet correspondiente

### Expected Behavior (Correct)

2.1 WHEN un usuario completa el formulario de registro con datos válidos THEN el sistema SHALL procesar la solicitud exitosamente y crear la cuenta de usuario

2.2 WHEN un usuario se registra con datos válidos THEN el sistema SHALL crear el registro en la base de datos, inicializar una wallet con 0 Coins y 0 Diamonds, y retornar confirmación de éxito

2.3 WHEN la comunicación entre frontend y backend funciona correctamente THEN el sistema SHALL mostrar mensaje de éxito o redirigir al usuario a la página de confirmación

### Unchanged Behavior (Regression Prevention)

3.1 WHEN un usuario intenta registrarse con email duplicado THEN el sistema SHALL CONTINUE TO retornar error de validación apropiado

3.2 WHEN un usuario intenta registrarse con username duplicado THEN el sistema SHALL CONTINUE TO retornar error de validación apropiado

3.3 WHEN un usuario intenta registrarse con datos inválidos (email mal formateado, contraseña débil) THEN el sistema SHALL CONTINUE TO retornar errores de validación específicos

3.4 WHEN el sistema procesa registros exitosos THEN el sistema SHALL CONTINUE TO crear wallets iniciales con coinBalance=0 y diamondBalance=0

3.5 WHEN el sistema procesa registros exitosos THEN el sistema SHALL CONTINUE TO generar tokens JWT válidos para autenticación