# Implementation Plan: Coin Economy Platform

## Overview

Implementación incremental del monolito modular en TypeScript con Next.js 14 (web), React Native + Expo (móvil), Fastify + Node.js (backend), PostgreSQL + Prisma, Redis, BullMQ y Socket.IO. Cada tarea construye sobre la anterior y termina con integración completa.

## Tasks

- [x] 1. Configuración del proyecto y estructura base
  - Inicializar monorepo con workspaces: `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`
  - Configurar TypeScript, ESLint y Prettier en todos los workspaces
  - Configurar Prisma con schema inicial (modelos User, Wallet, Business, Transaction, Product, Offer, Follow, Notification, Ticket, IncentiveFund, RankingSnapshot)
  - Configurar conexión a PostgreSQL y Redis
  - Configurar BullMQ con conexión Redis
  - Instalar fast-check como dependencia de desarrollo
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Auth Module — registro, login y gestión de sesiones
  - [x] 2.1 Implementar `AuthService`: `register`, `login`, `verifyEmail`, `lockAccount`, `updateProfile`
    - Crear endpoint `POST /api/auth/register` con validación de email único y username único
    - Crear endpoint `POST /api/auth/login` con JWT y bloqueo tras 5 intentos fallidos (15 min)
    - Crear endpoint `POST /api/auth/verify-email`
    - Crear endpoint `PATCH /api/auth/profile`
    - Al registrar usuario, crear Wallet con coinBalance=0 y diamondBalance=0
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.2 Property test — unicidad de registro (Property 1)
    - **Property 1: Unicidad de registro**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 2.3 Property test — wallet inicial en cero para usuarios (Property 2)
    - **Property 2: Wallet inicial en cero**
    - **Validates: Requirements 1.2, 2.2**

  - [ ]* 2.4 Unit tests — bloqueo de cuenta, verificación de email, actualización de perfil
    - Test: bloqueo tras 5 intentos fallidos consecutivos
    - Test: desbloqueo automático tras 15 minutos
    - Test: verificación de email requerida al cambiar email
    - _Requirements: 1.5, 1.7_

- [x] 3. Business Module — registro y gestión de negocios
  - [x] 3.1 Implementar `BusinessService`: `create`, `activate`, `update`, `getProfile`, `listByOwner`
    - Crear endpoint `POST /api/businesses` con validación de máx. 3 negocios por usuario
    - Crear endpoint `PATCH /api/businesses/:id`
    - Crear endpoint `GET /api/businesses/:id` (perfil público con productos activos)
    - Al crear negocio, crear Wallet con coinBalance=0 y asignar rol Business_Owner
    - Negocio creado sin recarga inicial → status PENDING
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ]* 2.5 Property test — límite de 3 negocios por usuario (Property 3)
    - **Property 3: Límite de 3 negocios por usuario**
    - **Validates: Requirements 2.6, 2.8**

  - [ ]* 3.2 Unit tests — transición PENDING → ACTIVE, validación de campos
    - Test: negocio en PENDING no puede donar ni publicar productos
    - Test: transición a ACTIVE tras recarga inicial
    - _Requirements: 2.10, 2.11_

- [x] 4. Wallet Module — balances, recargas y transferencias atómicas
  - [x] 4.1 Implementar `WalletService`: `getBalance`, `rechargeCoins`, `rechargeDiamonds`, `donate`, `transfer`, `refundDiamonds`, `getTransactionHistory`
    - Toda modificación de balance usa transacción PostgreSQL con `SELECT FOR UPDATE`
    - Constantes: `COIN_RECHARGE_AMOUNT = 233`, `DIAMOND_RECHARGE_AMOUNT = 70`
    - Crear endpoint `GET /api/wallets/:id/balance`
    - Crear endpoint `GET /api/wallets/:id/transactions` (paginado, filtrable por tipo)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.2 Implementar recarga de Coins para negocios
    - Crear endpoint `POST /api/wallets/recharge/coins` (solo Business_Owner)
    - Integrar con procesador de pagos usando idempotency key
    - Distribuir: 233 Coins a Business Wallet, $12.500 Platform_Fee, $2.500 → Incentive_Fund (+16 Coins)
    - Crear Transaction record con todos los campos requeridos
    - Activar negocio PENDING → ACTIVE si es recarga inicial
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x]* 4.3 Property test — cálculo correcto de recarga de Coins (Property 4)
    - **Property 4: Cálculo correcto de recarga de Coins**
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x]* 4.4 Property test — restricción de recarga de Coins a Business_Owners (Property 10)
    - **Property 10: Restricción de recarga de Coins a Business_Owners**
    - **Validates: Requirements 3.8, 5.5**

  - [x] 4.5 Implementar recarga de Diamonds
    - Crear endpoint `POST /api/wallets/recharge/diamonds` (User o Business_Owner)
    - Distribuir: 70 Diamonds a Wallet destino, $6.250 Platform_Fee, $1.250 → Incentive_Fund (+8 Coins)
    - Routing: User → User Wallet; Business_Owner → Business Wallet
    - Crear Transaction record con todos los campos requeridos
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x]* 4.6 Property test — cálculo correcto de recarga de Diamonds (Property 5)
    - **Property 5: Cálculo correcto de recarga de Diamonds**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x]* 4.7 Property test — routing correcto de recarga de Diamonds (Property 6)
    - **Property 6: Routing correcto de recarga de Diamonds**
    - **Validates: Requirements 6.6, 6.7**

  - [x]* 4.8 Property test — contribución al Incentive_Fund por recargas (Properties 28, 29)
    - **Property 28: Contribución al Incentive_Fund por recarga de Coins**
    - **Property 29: Contribución al Incentive_Fund por recarga de Diamonds**
    - **Validates: Requirements 16.1, 16.2**

  - [x] 4.9 Implementar donación de Coins
    - Crear endpoint `POST /api/wallets/donate`
    - Validar: amount > 0, balance suficiente, no auto-donación, negocio ACTIVE
    - Crear Transaction record (DONATION)
    - Disparar notificación al usuario receptor
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 4.10 Property test — conservación de balance en donaciones (Property 7)
    - **Property 7: Conservación de balance en donaciones**
    - **Validates: Requirements 4.1, 4.2**

  - [x]* 4.11 Property test — invariante de balance no negativo (Property 8)
    - **Property 8: Invariante de balance no negativo**
    - **Validates: Requirements 4.3, 8.3, 9.2, 9.8, 9.9**

  - [x]* 4.12 Property test — prohibición de auto-donaciones (Property 9)
    - **Property 9: Prohibición de auto-donaciones**
    - **Validates: Requirements 4.7**

  - [x] 4.13 Implementar Diamond Refund
    - Crear endpoint `POST /api/wallets/refund/diamonds` (solo Users)
    - Validar rango [200, 500] Diamonds; calcular COP = n * 250
    - Crear Transaction record (DIAMOND_REFUND)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x]* 4.14 Property test — rango válido para reembolso de Diamonds (Property 22)
    - **Property 22: Rango válido para reembolso de Diamonds**
    - **Validates: Requirements 12.2, 12.3, 12.4**

  - [x]* 4.15 Property test — cálculo correcto de reembolso de Diamonds (Property 23)
    - **Property 23: Cálculo correcto de reembolso de Diamonds**
    - **Validates: Requirements 12.5, 12.6**

  - [x]* 4.16 Property test — atomicidad transaccional (Property 19)
    - **Property 19: Atomicidad transaccional**
    - **Validates: Requirements 10.1, 10.3**

  - [x]* 4.17 Property test — conservación global de Coins (Property 20)
    - **Property 20: Conservación global de Coins**
    - **Validates: Requirements 10.4**

  - [x]* 4.18 Property test — conservación global de Diamonds (Property 21)
    - **Property 21: Conservación global de Diamonds**
    - **Validates: Requirements 10.5**

  - [x]* 4.19 Unit tests — fallo de pago no modifica balance, idempotency key
    - Test: pago fallido no modifica ningún balance
    - Test: idempotency key previene doble cobro
    - _Requirements: 3.5, 6.5_

- [x] 5. Checkpoint — Asegurar que todos los tests del núcleo financiero pasan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Catalog Module — productos de negocios
  - [x] 6.1 Implementar CRUD de productos
    - Crear endpoint `POST /api/businesses/:id/products`
    - Crear endpoint `PATCH /api/businesses/:id/products/:productId`
    - Crear endpoint `DELETE /api/businesses/:id/products/:productId` (soft delete: isActive=false)
    - Validar coinPrice > 0
    - _Requirements: 7.1, 7.2, 7.3, 7.9_

  - [x] 6.2 Implementar catálogo por ubicación
    - Crear endpoint `GET /api/catalog?location=<city>` filtrando por dirección/coordenadas
    - Retornar solo productos activos de negocios activos en la ubicación seleccionada
    - Incluir nombre del negocio como referencia navegable al perfil
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 6.3 Implementar compra de productos con Coins
    - Crear endpoint `POST /api/products/:id/purchase`
    - Validar: producto activo, balance suficiente
    - Deducir coinPrice del User Wallet, crear Transaction (PRODUCT_PURCHASE)
    - Disparar notificación al Business_Owner
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 6.4 Property test — conservación de balance en compra de productos (Property 11)
    - **Property 11: Conservación de balance en compra de productos**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 6.5 Property test — productos inactivos no comprables (Property 12)
    - **Property 12: Productos inactivos no comprables**
    - **Validates: Requirements 8.4**

- [x] 7. Marketplace Module — ofertas de Coins
  - [x] 7.1 Implementar creación y listado de Offers
    - Crear endpoint `POST /api/marketplace/offers` (solo Users, no Business_Owners)
    - Reservar coinAmount del User Wallet al crear Offer
    - Generar accessCode único para Offers privadas
    - Crear endpoint `GET /api/marketplace/offers` (ordenado por diamondPricePerCoin ASC, filtrable)
    - Crear endpoint `GET /api/marketplace/offers/:id/access-code` (solo el vendedor)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.12, 9.13, 9.14, 9.15, 9.16_

  - [ ]* 7.2 Property test — restricción de creación de Offers a Users (Property 13)
    - **Property 13: Restricción de creación de Offers a Users**
    - **Validates: Requirements 9.3**

  - [ ]* 7.3 Property test — reserva de Coins al crear Offer (Property 14)
    - **Property 14: Reserva de Coins al crear Offer**
    - **Validates: Requirements 9.1**

  - [ ]* 7.4 Property test — unicidad de Access_Code para Offers privadas (Property 17)
    - **Property 17: Unicidad de Access_Code para Offers privadas**
    - **Validates: Requirements 9.14**

  - [x] 7.5 Implementar aceptación y cancelación de Offers
    - Crear endpoint `POST /api/marketplace/offers/:id/accept` (User o Business_Owner como comprador)
    - Validar accessCode para Offers privadas
    - Transferir Coins al comprador, Diamonds al vendedor, crear Transaction (MARKETPLACE_SALE/PURCHASE)
    - Disparar notificaciones a comprador y vendedor
    - Crear endpoint `DELETE /api/marketplace/offers/:id` (cancelación por el vendedor)
    - Retornar Coins reservados al cancelar, crear Transaction (OFFER_CANCEL_RETURN)
    - _Requirements: 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.17, 9.18_

  - [ ]* 7.6 Property test — conservación en transacción de Marketplace (Property 15)
    - **Property 15: Conservación en transacción de Marketplace**
    - **Validates: Requirements 9.5, 9.6, 9.7**

  - [ ]* 7.7 Property test — round-trip de cancelación de Offer (Property 16)
    - **Property 16: Round-trip de cancelación de Offer**
    - **Validates: Requirements 9.10, 9.11**

  - [ ]* 7.8 Property test — control de acceso a Offers privadas (Property 18)
    - **Property 18: Control de acceso a Offers privadas**
    - **Validates: Requirements 9.17, 9.18**

  - [ ]* 7.9 Unit tests — ordenamiento de Offers, filtros de búsqueda
    - Test: listado ordenado por diamondPricePerCoin ASC
    - Test: filtros por rango de coinAmount y diamondPricePerCoin
    - _Requirements: 9.4, 9.12_

- [x] 8. Checkpoint — Asegurar que todos los tests de Marketplace y Catálogo pasan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Notification Module — notificaciones en tiempo real
  - [x] 9.1 Implementar `NotificationService` con Socket.IO
    - Configurar Socket.IO en el servidor Fastify
    - Implementar `send`, `listNotifications`, `markAsRead`
    - Crear endpoint `GET /api/notifications` (ordenado por timestamp DESC)
    - Crear endpoint `PATCH /api/notifications/:id/read`
    - Conectar eventos: DONATION_RECEIVED, MARKETPLACE_COMPLETED, PRODUCT_PURCHASED, TICKET_STATUS_CHANGED
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 9.2 Integration tests — entrega de notificaciones
    - Test: notificación de donación entregada en < 10 segundos
    - Test: notificación de marketplace entregada a comprador y vendedor
    - Test: notificación de compra de producto entregada al Business_Owner
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 10. Search Module — búsqueda de negocios y usuarios
  - [x] 10.1 Implementar endpoints de búsqueda
    - Crear endpoint `GET /api/search/businesses?q=<query>` (solo negocios ACTIVE, sin datos financieros)
    - Crear endpoint `GET /api/search/users?q=<query>` (sin datos financieros)
    - Integrar Maps API para mostrar coordenadas del negocio en resultados
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [ ]* 10.2 Property test — privacidad en resultados de búsqueda (Property 25)
    - **Property 25: Privacidad en resultados de búsqueda**
    - **Validates: Requirements 14.3, 1.9**

  - [ ]* 10.3 Property test — solo negocios activos en búsqueda (Property 26)
    - **Property 26: Solo negocios activos en búsqueda**
    - **Validates: Requirements 14.8**

- [x] 11. Follow/Feed Module — seguimiento y feed personalizado
  - [x] 11.1 Implementar Follow/Unfollow
    - Crear endpoint `POST /api/follows` (seguir User o Business)
    - Crear endpoint `DELETE /api/follows/:id` (dejar de seguir)
    - Validar: no duplicar Follow, no Unfollow inexistente
    - Exponer contadores de followers/following en perfiles
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7, 18.8_

  - [ ]* 11.2 Property test — round-trip de Follow/Unfollow en Feed (Property 30)
    - **Property 30: Round-trip de Follow/Unfollow en Feed**
    - **Validates: Requirements 18.1, 18.2**

  - [ ]* 11.3 Property test — idempotencia negativa de Follow (Property 31)
    - **Property 31: Idempotencia negativa de Follow**
    - **Validates: Requirements 18.7, 18.8**

  - [x] 11.4 Implementar Feed
    - Crear endpoint `GET /api/feed` (publicaciones de cuentas seguidas, ordenado por timestamp DESC)
    - Incluir nuevos Products de Businesses seguidos y nuevas Offers de Users seguidos
    - Retornar mensaje descriptivo si el usuario no sigue a nadie
    - _Requirements: 17.2, 17.3, 17.4, 18.5, 18.6_

- [x] 12. Support Module — tickets, chatbot y chat en vivo
  - [x] 12.1 Implementar chatbot FAQ y tickets
    - Crear endpoint `POST /api/support/query` (búsqueda en base de conocimiento FAQ)
    - Crear endpoint `POST /api/support/tickets` (crear ticket con status ABIERTO)
    - Crear endpoint `PATCH /api/support/tickets/:id/status` (solo Support_Agent, secuencia válida)
    - Crear endpoint `POST /api/support/tickets/:id/rating` (solo tras status CERRADO)
    - Disparar notificación al creador cuando cambia el status del ticket
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.8, 13.9_

  - [ ]* 12.2 Property test — secuencia válida de estados de Ticket (Property 24)
    - **Property 24: Secuencia válida de estados de Ticket**
    - **Validates: Requirements 13.4**

  - [x] 12.3 Implementar Support_Chat en tiempo real
    - Crear endpoint `POST /api/support/chat` (iniciar sesión de chat)
    - Si hay Support_Agent disponible: iniciar sesión Socket.IO entre usuario y agente
    - Si no hay agente disponible: crear Ticket automáticamente con contexto del chat
    - Crear endpoint `POST /api/support/chats/:id/rating` (tras finalizar sesión)
    - _Requirements: 13.6, 13.7, 13.10_

  - [ ]* 12.4 Unit tests — chatbot FAQ, escalación automática, ratings
    - Test: chatbot retorna respuesta si existe en FAQ
    - Test: escalación automática a Ticket cuando no hay agente disponible
    - Test: rating solo disponible tras CERRADO/fin de chat
    - _Requirements: 13.1, 13.2, 13.7, 13.9, 13.10_

- [ ] 13. Ranking Module — rankings y distribución del Incentive_Fund
  - [x] 13.1 Implementar cálculo de rankings
    - Crear endpoint `GET /api/rankings?type=<type>&year=<year>` (visible si >= 500 negocios activos)
    - Implementar `RankingService.computeWeeklyRankings` (cron BullMQ cada 7 días)
    - Calcular los 6 tipos de ranking (3 de usuarios, 3 de negocios) y persistir en RankingSnapshot
    - Mantener rankings anuales separados por año calendario
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 13.2 Property test — Rankings ocultos con menos de 500 negocios activos (Property 27)
    - **Property 27: Rankings ocultos con menos de 500 negocios activos**
    - **Validates: Requirements 15.3, 16.3**

  - [x] 13.3 Implementar distribución del Incentive_Fund
    - Implementar `RankingService.distributeIncentiveFund` (ejecutado tras computeWeeklyRankings si >= 500 negocios)
    - Distribuir Coins acumulados entre top-ranked Users y Businesses de los 6 rankings
    - Crear Transaction record por cada transferencia (INCENTIVE_DISTRIBUTION)
    - Si falla una transferencia individual: rollback solo de esa, preservar fondo restante, loguear error
    - _Requirements: 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

  - [ ]* 13.4 Integration tests — cálculo semanal, rankings anuales, distribución del fondo
    - Test: rankings no visibles con < 500 negocios activos
    - Test: distribución del fondo solo cuando >= 500 negocios activos
    - Test: fallo individual no afecta otras transferencias del ciclo
    - _Requirements: 15.3, 16.3, 16.4, 16.8_

- [x] 14. Página principal — contadores en tiempo real y contenido público
  - [x] 14.1 Implementar endpoint de estadísticas de la plataforma
    - Crear endpoint `GET /api/stats` (total Users, total active Businesses, total Incentive_Fund Coins)
    - Actualizar contadores en Redis con pub/sub para reflejar cambios en < 5 segundos
    - _Requirements: 17.1, 17.5_

  - [ ]* 14.2 Integration tests — contadores en tiempo real
    - Test: contador de usuarios actualizado en < 5 segundos tras nuevo registro
    - Test: contador de negocios activos actualizado en < 5 segundos
    - _Requirements: 17.5_

- [x] 15. Frontend Web — Next.js 14
  - [x] 15.1 Implementar páginas de autenticación y perfil de usuario
    - Páginas: `/register`, `/login`, `/profile/[username]`
    - Mostrar perfil público: username, foto, social links, Offers activas
    - Mostrar opción "Crear negocio" en perfil propio
    - Mostrar nombre del vendedor en Offers como link al perfil
    - _Requirements: 1.8, 1.9, 1.10, 1.11_

  - [x] 15.2 Implementar páginas de negocio y catálogo
    - Páginas: `/businesses/[id]`, `/catalog`
    - Catálogo: selector de ubicación antes de mostrar productos
    - Perfil de negocio: nombre, descripción, categoría, dirección, mapa con marcador, productos activos
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8, 14.2, 14.5, 14.6, 14.7_

  - [x] 15.3 Implementar páginas de Wallet, Marketplace y Rankings
    - Páginas: `/wallet`, `/marketplace`, `/rankings`
    - Wallet: balance Coins y Diamonds, historial paginado con filtros
    - Marketplace: listado de Offers con filtros, formulario de creación, gestión de Offers propias
    - Rankings: 6 tablas con posición, nombre (link) y métrica; ocultas si < 500 negocios activos
    - _Requirements: 5.1, 5.2, 5.4, 9.4, 9.12, 9.15, 15.1, 15.2, 15.6_

  - [x] 15.4 Implementar página principal y feed
    - Página: `/` con rankings anuales, contadores en tiempo real, feed personalizado para autenticados
    - Feed vacío con mensaje descriptivo si no hay follows
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 15.5 Implementar módulo de soporte en web
    - Páginas: `/support` con chatbot FAQ, formulario de ticket, chat en vivo
    - Panel de agente en `/support/agent` (solo rol Support_Agent)
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.7, 13.8_

- [ ] 16. Frontend Mobile — React Native + Expo
  - [ ] 16.1 Implementar pantallas de autenticación, perfil y wallet
    - Pantallas: Login, Register, Profile, Wallet (balance + historial)
    - _Requirements: 1.1, 1.4, 1.8, 5.1, 5.2_

  - [ ] 16.2 Implementar pantallas de catálogo, marketplace y donaciones
    - Pantallas: Catalog (con selector de ubicación), BusinessProfile, ProductDetail, Marketplace, DonateCoins
    - _Requirements: 7.4, 7.5, 7.7, 7.8, 4.1, 4.6, 9.4_

  - [ ] 16.3 Implementar notificaciones push y soporte
    - Configurar notificaciones push con Expo Notifications
    - Pantalla: Support (chatbot, tickets, chat en vivo)
    - _Requirements: 11.1, 11.2, 11.3, 13.1, 13.6_

- [x] 17. Configuración de infraestructura en Hostinger VPS
  - [x] 17.1 Configurar Nginx como reverse proxy con SSL
    - Crear configuración Nginx con proxy a Next.js (puerto 3000) y Fastify (puerto 4000)
    - Configurar WebSocket upgrade para `/ws`
    - Configurar Let's Encrypt con Certbot
    - _Requirements: arquitectura_

  - [x] 17.2 Configurar PM2 para gestión de procesos
    - Crear `ecosystem.config.js` para API (Fastify) y Web (Next.js)
    - Configurar restart automático y logs
    - _Requirements: arquitectura_

- [x] 18. Checkpoint final — Integración completa y todos los tests pasan
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los property tests usan fast-check con mínimo 100 iteraciones (`{ numRuns: 100 }`)
- Cada property test debe incluir el comentario: `// Feature: coin-economy-platform, Property N: <texto>`
- Los checkpoints aseguran validación incremental antes de continuar
- La activación de Rankings e Incentive_Fund es automática al alcanzar 500 negocios activos
