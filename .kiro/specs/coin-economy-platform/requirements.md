# Requirements Document

## Introduction

Plataforma web y móvil de economía de monedas virtuales que conecta negocios físicos con sus clientes. Solo los Business_Owners pueden adquirir Coins mediante recargas pagadas ($50.000 COP); los Users no pueden recargar Coins directamente. Los Users obtienen Coins exclusivamente a través de Donations recibidas de negocios o comprándolas en el Marketplace usando Diamonds. Los negocios donan Coins a usuarios como recompensa por compras físicas. Los usuarios acumulan Coins en su billetera y pueden usarlas para comprar productos de negocios registrados o venderlas en el Marketplace. El mercado opera con dos divisas: Coins (recompensa de negocios) y Diamonds (divisa de compra en el mercado, recargable por Users).

## Glosario

- **Platform**: La aplicación web y móvil de economía de monedas virtuales.
- **Business**: Entidad registrada en la plataforma que representa un negocio físico. Puede tener estado "pending" (registro incompleto, sin recarga inicial) o "active" (operativo).
- **Business_Owner**: Usuario con rol de propietario de un Business registrado.
- **User**: Persona registrada en la plataforma con una Wallet activa.
- **Wallet**: Billetera virtual asociada a un User o Business que almacena Coins y Diamonds.
- **Coin**: Divisa principal de la plataforma, donada por negocios y usada para comprar productos o vender en el mercado.
- **Diamond**: Divisa secundaria de la plataforma, recargada por usuarios para comprar Coins en el mercado.
- **Donation**: Transferencia de Coins desde la Wallet de un Business hacia la Wallet de un User.
- **Product**: Artículo publicado por un Business que puede adquirirse con Coins.
- **Marketplace**: Módulo de intercambio donde los Users publican ofertas de venta de Coins a cambio de Diamonds, y donde tanto Users como Business_Owners pueden comprar Coins usando Diamonds.
- **Offer**: Publicación de un User en el Marketplace que especifica una cantidad de Coins y su precio en Diamonds.
- **Transaction**: Registro inmutable de cualquier movimiento de Coins o Diamonds entre Wallets.
- **Recharge**: Operación mediante la cual un Business_Owner añade Coins a su Business Wallet mediante pago en COP, o un User añade Diamonds a su Wallet. Los Users no pueden realizar recargas de Coins directamente.
- **Platform_Fee**: Comisión del 25% del valor de recarga destinada a la plataforma.
- **Incentive_Fund**: Fondo acumulado en Coins equivalente al 5% del valor de cada recarga (de Coins o Diamonds). Se distribuye periódicamente en Coins entre los primeros puestos de los Rankings cuando la plataforma tiene 500 o más Businesses activos. Mientras haya menos de 500 Businesses activos, el fondo acumula pero no se distribuye.
- **Ranking**: Tabla de clasificación que muestra los top 10 Users o Businesses según una métrica específica de actividad en la plataforma.
- **Active_Business_Threshold**: Número mínimo de Businesses activos (500) requerido para activar la visualización de Rankings y la distribución del Incentive_Fund.
- **Diamond_Refund**: Operación mediante la cual un User convierte Diamonds de su Wallet de vuelta a COP ($250 COP por Diamond), disponible exclusivamente cuando el saldo de Diamonds del User está en el rango [200, 500].
- **Support_Agent**: Rol especial de usuario con acceso al panel de soporte para gestionar tickets y chats en vivo.
- **Ticket**: Solicitud de soporte creada por un User o Business_Owner con descripción de un problema, que puede tener estado "abierto", "en progreso", "resuelto" o "cerrado".
- **Support_Chat**: Sesión de chat en tiempo real entre un User o Business_Owner y un Support_Agent.
- **Offer_Visibility**: Atributo de una Offer que determina si es "pública" o "privada".
- **Access_Code**: Código alfanumérico único generado automáticamente por la plataforma al crear una Offer privada, requerido para desbloquear sus detalles y proceder con la compra.
- **Feed**: Sección de la página principal del usuario autenticado que muestra las publicaciones recientes de los negocios y usuarios que sigue.
- **Follow**: Acción mediante la cual un User se suscribe a las publicaciones de otro User o Business para verlas en su Feed.

---

## Requirements

### Requirement 1: Registro y gestión de cuentas

**User Story:** As a User, I want to register and manage my account, so that I can access the platform's features with a secure identity and a public profile.

#### Acceptance Criteria

1. THE Platform SHALL require a unique email address, username, and password to create a User account.
2. WHEN a User submits valid registration data, THE Platform SHALL create a Wallet with 0 Coins and 0 Diamonds for that User.
3. WHEN a User submits invalid or duplicate registration data, THE Platform SHALL return a descriptive error message without creating an account.
4. WHEN a registered User provides valid credentials, THE Platform SHALL authenticate the User and grant access to their account.
5. IF a User provides incorrect credentials 5 consecutive times, THEN THE Platform SHALL temporarily lock the account for 15 minutes.
6. THE Platform SHALL allow a User to update their profile information (name, username, profile photo, email, password, and social media links).
7. WHEN a User updates their email, THE Platform SHALL require email verification before applying the change.
8. THE Platform SHALL display a public profile page for each User showing their username, profile photo, social media links, and active Marketplace Offers.
9. WHEN a User views another User's public profile, THE Platform SHALL display only public information and SHALL NOT expose Coin balance, Diamond balance, or Transaction history.
10. WHEN a User views a seller's name on a Marketplace Offer, THE Platform SHALL display it as a clickable link that navigates to that User's public profile page.
11. THE Platform SHALL display a "Crear negocio" option in the authenticated User's own profile, allowing them to initiate the Business creation flow from their profile.

---

### Requirement 2: Registro y gestión de negocios

**User Story:** As a Business_Owner, I want to register and manage a Business on the platform, so that I can donate Coins to my customers and publish products.

#### Acceptance Criteria

1. THE Platform SHALL allow a registered User to create a Business by providing a name, description, category, physical address, profile photo, and cover photo.
2. WHEN a Business is created, THE Platform SHALL assign a Wallet with 0 Coins to that Business.
3. THE Platform SHALL allow a Business_Owner to update the name, description, category, physical address, profile photo, cover photo, and social media links of their Business.
4. THE Platform SHALL allow a Business_Owner to add, update, or remove social media links (such as Instagram, Facebook, TikTok, WhatsApp, and website URL) from their Business profile.
5. WHEN a User views a Business profile, THE Platform SHALL display any social media links published by the Business as clickable links.
6. THE Platform SHALL allow a User to own a maximum of 3 Businesses simultaneously.
7. WHEN a Business is created, THE Platform SHALL assign the creating User the Business_Owner role for that Business.
8. IF a User attempts to create a Business and already owns 3 active Businesses, THEN THE Platform SHALL reject the operation and return a descriptive error indicating the maximum limit has been reached.
9. THE Platform SHALL include an initial Coin Recharge as a mandatory final step in the Business creation flow before the Business becomes active.
10. WHEN a Business completes the initial Coin Recharge during registration, THE Platform SHALL set the Business status to "active".
11. IF a Business creation flow is completed without performing the initial Coin Recharge, THEN THE Platform SHALL set the Business status to "pending" and SHALL prevent the Business from performing Donations or publishing Products until the Recharge is completed.

---

### Requirement 3: Recarga de Coins para negocios

**User Story:** As a Business_Owner, I want to recharge Coins into my Business Wallet by paying a fixed amount, so that I have balance available to donate to customers.

#### Acceptance Criteria

1. THE Platform SHALL offer a single fixed Recharge option with a cost of $50.000 COP.
2. WHEN a Business_Owner initiates a Recharge, THE Platform SHALL distribute the $50.000 COP payment as follows: $12.500 COP (25%) to the Platform_Fee, $2.500 COP (5%) to the Incentive_Fund, and $35.000 COP (70%) converted into Coins for the Business Wallet.
3. WHEN a Recharge payment of $50.000 COP is processed, THE Platform SHALL add 233 Coins to the Business Wallet, calculated as floor($35.000 ÷ $150) where $150 COP is the price of 1 Coin.
4. WHEN a Recharge is completed, THE Platform SHALL create a Transaction record with the Coin amount credited (233), the COP amount paid ($50.000), the Platform_Fee amount ($12.500), the Incentive_Fund amount ($2.500), the timestamp, and the Business identifier.
5. IF a Recharge payment fails or is rejected by the payment processor, THEN THE Platform SHALL not modify the Business Wallet balance and SHALL return a descriptive error to the Business_Owner.
6. THE Platform SHALL display the current Coin balance of a Business Wallet to its Business_Owner.
7. WHEN a Business is in "pending" status due to an incomplete initial Recharge, THE Platform SHALL allow the Business_Owner to complete the initial Recharge to transition the Business status to "active".
8. THE Platform SHALL restrict Coin Recharge operations exclusively to Business_Owners acting on their own Business Wallet, and SHALL reject any attempt by a User without the Business_Owner role to perform a Coin Recharge.

---

### Requirement 4: Donación de Coins a usuarios

**User Story:** As a Business_Owner, I want to donate Coins to a User after a physical purchase, so that I can reward my customers directly from the platform.

#### Acceptance Criteria

1. WHEN a Business_Owner initiates a Donation specifying a valid User and an amount greater than 0, THE Platform SHALL transfer the specified Coin amount from the Business Wallet to the User Wallet.
2. WHEN a Donation is completed, THE Platform SHALL create a Transaction record with the amount, sender Business, recipient User, and timestamp.
3. IF a Business_Owner initiates a Donation with an amount greater than the current Business Wallet balance, THEN THE Platform SHALL reject the operation and return a descriptive error.
4. IF a Business_Owner initiates a Donation with an amount less than or equal to 0, THEN THE Platform SHALL reject the operation and return a descriptive error.
5. WHEN a Donation is completed, THE Platform SHALL notify the recipient User of the received Coins and the donating Business name.
6. THE Platform SHALL allow a Business_Owner to search for a User by username or email to initiate a Donation.
7. IF a Business_Owner attempts to initiate a Donation from their own Business Wallet to their own personal User Wallet, THEN THE Platform SHALL reject the operation and return a descriptive error indicating that self-donations are not permitted.

---

### Requirement 5: Billetera del usuario

**User Story:** As a User, I want to view and manage my Wallet, so that I can track my Coins and Diamonds balance and transaction history.

#### Acceptance Criteria

1. THE Platform SHALL display the current Coin and Diamond balance of a User Wallet to the authenticated User.
2. THE Platform SHALL display a paginated transaction history for a User Wallet, ordered by timestamp descending.
3. WHEN a Transaction is recorded, THE Platform SHALL reflect the updated balance in the User Wallet within 5 seconds.
4. THE Platform SHALL allow a User to filter their transaction history by type (Donation, Purchase, Marketplace sale, Marketplace purchase, Diamond Recharge).
5. THE Platform SHALL restrict Coin acquisition for Users exclusively to Donations received from a Business Wallet and Marketplace purchases using Diamonds, and SHALL not provide any Coin Recharge mechanism for Users.

---

### Requirement 6: Recarga de Diamonds

**User Story:** As a User or Business_Owner, I want to recharge Diamonds into a Wallet by paying a fixed amount, so that Diamonds are available to buy Coins in the Marketplace.

#### Acceptance Criteria

1. THE Platform SHALL offer a single fixed Diamond Recharge option with a cost of $25.000 COP.
2. WHEN a Diamond Recharge payment of $25.000 COP is processed, THE Platform SHALL distribute the payment as follows: $6.250 COP (25%) to the Platform_Fee, $1.250 COP (5%) to the Incentive_Fund, and $17.500 COP (70%) converted into Diamonds for the target Wallet.
3. WHEN a Diamond Recharge payment of $25.000 COP is processed, THE Platform SHALL add 70 Diamonds to the target Wallet, calculated as floor($17.500 ÷ $250) where $250 COP is the price of 1 Diamond.
4. WHEN a Diamond Recharge is completed, THE Platform SHALL create a Transaction record with the Diamond amount credited (70), the COP amount paid ($25.000), the Platform_Fee amount ($6.250), the Incentive_Fund amount ($1.250), the timestamp, and the target Wallet identifier.
5. IF a Diamond Recharge payment fails or is rejected by the payment processor, THEN THE Platform SHALL not modify the target Wallet balance and SHALL return a descriptive error to the requester.
6. WHEN a User initiates a Diamond Recharge, THE Platform SHALL credit the resulting Diamonds to the User Wallet.
7. WHEN a Business_Owner initiates a Diamond Recharge, THE Platform SHALL credit the resulting Diamonds to the Business Wallet, not to the Business_Owner personal User Wallet.
8. THE Platform SHALL display the current Diamond balance of a User Wallet to the authenticated User.

---

### Requirement 7: Catálogo de productos de negocios

**User Story:** As a Business_Owner, I want to publish products in my Business catalog, so that Users can browse and purchase them with Coins from nearby Businesses.

#### Acceptance Criteria

1. THE Platform SHALL allow a Business_Owner to create a Product with a name, description, image, and Coin price greater than 0.
2. THE Platform SHALL allow a Business_Owner to update the name, description, image, and Coin price of a Product they own.
3. THE Platform SHALL allow a Business_Owner to deactivate a Product, making it unavailable for purchase without deleting it.
4. WHEN a User accesses the product catalog, THE Platform SHALL prompt the User to select or confirm a location (city or area) before displaying any products.
5. WHEN a User selects a location, THE Platform SHALL display only active Products published by Businesses whose physical address is within the selected location area.
6. THE Platform SHALL allow a User to change the selected location at any time to browse products from a different area.
7. WHEN a User views a Product in the catalog, THE Platform SHALL display the Business name as a clickable link that navigates to the Business profile page.
8. WHEN a User navigates to a Business profile page, THE Platform SHALL display the Business name, description, category, physical address, a map with the Business location marker, and all active Products published by that Business.
9. WHEN a Business_Owner sets a Product Coin price less than or equal to 0, THE Platform SHALL reject the operation and return a descriptive error.

---

### Requirement 8: Compra de productos con Coins

**User Story:** As a User, I want to purchase products from registered Businesses using my Coins, so that I can redeem my rewards for goods.

#### Acceptance Criteria

1. WHEN a User initiates a purchase of an active Product and the User Wallet has sufficient Coins, THE Platform SHALL deduct the Product Coin price from the User Wallet and register the purchase.
2. WHEN a purchase is completed, THE Platform SHALL create a Transaction record with the Coin amount, buyer User, seller Business, Product identifier, and timestamp.
3. IF a User initiates a purchase and the User Wallet has fewer Coins than the Product price, THEN THE Platform SHALL reject the operation and return a descriptive error.
4. IF a User initiates a purchase of an inactive Product, THEN THE Platform SHALL reject the operation and return a descriptive error.
5. WHEN a purchase is completed, THE Platform SHALL notify the Business_Owner of the sale, including the Product name and buyer User.

---

### Requirement 9: Mercado de intercambio (Marketplace)

**User Story:** As a User or Business_Owner, I want to browse and accept Offers in the Marketplace, so that I can buy Coins using Diamonds; and as a User, I also want to publish Offers to sell my Coins.

#### Acceptance Criteria

1. WHEN a User creates an Offer specifying a Coin amount greater than 0 and a Diamond price per Coin greater than 0, THE Platform SHALL reserve the specified Coin amount from the User Wallet and publish the Offer in the Marketplace.
2. IF a User creates an Offer with a Coin amount greater than the available Coin balance in the User Wallet, THEN THE Platform SHALL reject the operation and return a descriptive error.
3. IF a Business_Owner attempts to create an Offer in the Marketplace, THEN THE Platform SHALL reject the operation and return a descriptive error indicating that Business_Owners are not permitted to publish Offers.
4. THE Platform SHALL display all active Offers in the Marketplace to any authenticated User or Business_Owner, ordered by Diamond price per Coin ascending.
5. WHEN a User accepts an Offer and the User Wallet has sufficient Diamonds to cover the total cost, THE Platform SHALL transfer the reserved Coins to the buyer User Wallet, deduct the Diamond cost from the buyer User Wallet, and transfer the Diamonds to the seller User Wallet.
6. WHEN a Business_Owner accepts an Offer and the Business Wallet has sufficient Diamonds to cover the total cost, THE Platform SHALL transfer the reserved Coins to the Business Wallet, deduct the Diamond cost from the Business Wallet, and transfer the Diamonds to the seller User Wallet.
7. WHEN a Marketplace Transaction is completed, THE Platform SHALL create a Transaction record with the Coin amount, Diamond amount, buyer identifier, seller User, and timestamp.
8. IF a User accepts an Offer and the User Wallet has fewer Diamonds than the total Offer cost, THEN THE Platform SHALL reject the operation and return a descriptive error.
9. IF a Business_Owner accepts an Offer and the Business Wallet has fewer Diamonds than the total Offer cost, THEN THE Platform SHALL reject the operation and return a descriptive error.
10. THE Platform SHALL allow a User to cancel their own active Offer, returning the reserved Coins to the User Wallet.
11. WHEN an Offer is cancelled, THE Platform SHALL create a Transaction record reflecting the return of reserved Coins to the seller Wallet.
12. THE Platform SHALL allow a User to filter Marketplace Offers by Coin amount range and Diamond price per Coin range.
13. WHEN a User creates an Offer, THE Platform SHALL require the User to select an Offer_Visibility of "pública" or "privada" for that Offer.
14. WHEN a User creates an Offer with Offer_Visibility "privada", THE Platform SHALL automatically generate a unique Access_Code for that Offer and associate it exclusively with that Offer.
15. WHILE an Offer has Offer_Visibility "privada", THE Platform SHALL display the Offer in the Marketplace listing with the Coin amount and Diamond price hidden, showing only non-sensitive metadata such as the seller identifier and creation timestamp.
16. WHEN a User with the seller role requests the Access_Code of their own Offer with Offer_Visibility "privada", THE Platform SHALL return the Access_Code of that Offer to the requesting User.
17. IF a buyer attempts to accept an Offer with Offer_Visibility "privada" without providing the correct Access_Code, THEN THE Platform SHALL reject the operation and return a descriptive error indicating that a valid Access_Code is required.
18. WHEN a buyer provides the correct Access_Code for an Offer with Offer_Visibility "privada", THE Platform SHALL unlock the full Offer details including Coin amount and Diamond price, and SHALL allow the buyer to proceed with the purchase under the same conditions as a public Offer.

---

### Requirement 10: Integridad de transacciones

**User Story:** As a User or Business_Owner, I want all financial operations to be atomic and consistent, so that no Coins or Diamonds are lost or duplicated during transfers.

#### Acceptance Criteria

1. THE Platform SHALL execute every Wallet balance modification as an atomic operation, ensuring no partial updates are persisted.
2. WHEN two concurrent operations attempt to modify the same Wallet simultaneously, THE Platform SHALL serialize the operations to prevent race conditions.
3. IF any step of a multi-step Transaction fails, THEN THE Platform SHALL roll back all balance changes made during that Transaction.
4. THE Platform SHALL ensure that the total Coin supply across all Wallets equals the sum of all completed Business Recharges minus the sum of all Coins spent on purchases.
5. THE Platform SHALL ensure that the total Diamond supply across all Wallets equals the sum of all completed User Diamond Recharges.

---

### Requirement 11: Notificaciones

**User Story:** As a User or Business_Owner, I want to receive real-time notifications for relevant events, so that I stay informed of activity on my account.

#### Acceptance Criteria

1. WHEN a Donation is received, THE Platform SHALL deliver a notification to the recipient User within 10 seconds.
2. WHEN a Marketplace Transaction is completed, THE Platform SHALL deliver a notification to both the buyer User and the seller User within 10 seconds.
3. WHEN a Product purchase is completed, THE Platform SHALL deliver a notification to the Business_Owner within 10 seconds.
4. THE Platform SHALL allow a User to view a list of their past notifications ordered by timestamp descending.
5. THE Platform SHALL allow a User to mark notifications as read.

---

### Requirement 12: Reembolso de Diamonds

**User Story:** As a User, I want to refund my Diamonds back to COP, so that I can recover the monetary value of unused Diamonds when my balance is within the eligible range.

#### Acceptance Criteria

1. THE Platform SHALL restrict Diamond_Refund operations exclusively to Users, and SHALL reject any Diamond_Refund request initiated by a Business_Owner.
2. WHILE a User Wallet has a Diamond balance greater than or equal to 200 and less than or equal to 500, THE Platform SHALL allow the User to initiate a Diamond_Refund.
3. IF a User initiates a Diamond_Refund and the User Wallet Diamond balance is less than 200, THEN THE Platform SHALL reject the operation and return a descriptive error indicating the minimum balance of 200 Diamonds has not been reached.
4. IF a User initiates a Diamond_Refund and the User Wallet Diamond balance is greater than 500, THEN THE Platform SHALL reject the operation and return a descriptive error indicating the maximum balance of 500 Diamonds has been exceeded.
5. WHEN a Diamond_Refund is approved, THE Platform SHALL calculate the refund amount in COP as the number of Diamonds being refunded multiplied by $250 COP per Diamond.
6. WHEN a Diamond_Refund is completed, THE Platform SHALL deduct the refunded Diamond amount from the User Wallet and create a Transaction record with the Diamond amount deducted, the COP amount refunded, the timestamp, and the User identifier.
7. IF a Diamond_Refund payment disbursement fails, THEN THE Platform SHALL not modify the User Wallet balance and SHALL return a descriptive error to the User.

---

### Requirement 13: Sistema de atención al cliente

**User Story:** As a User or Business_Owner, I want access to a customer support system that combines automated FAQ responses, support tickets, and live chat with agents, so that I can resolve issues efficiently through the most appropriate channel.

#### Acceptance Criteria

1. WHEN a User or Business_Owner submits a question to the support system, THE Chatbot SHALL search the FAQ knowledge base and return a matching answer if one exists.
2. IF the Chatbot cannot find a matching answer for a submitted question, THEN THE Platform SHALL offer the User or Business_Owner the option to escalate to a Ticket or a Support_Chat.
3. WHEN a User or Business_Owner creates a Ticket, THE Platform SHALL require a description of the problem and SHALL assign the Ticket an initial status of "abierto".
4. THE Platform SHALL allow a Ticket to transition through the following statuses in order: "abierto" → "en progreso" → "resuelto" → "cerrado", and SHALL reject any status transition that does not follow this sequence.
5. WHEN a Ticket status changes, THE Platform SHALL deliver a notification to the Ticket creator within 10 seconds indicating the new status.
6. WHEN a User or Business_Owner requests a Support_Chat and a Support_Agent is available, THE Platform SHALL initiate a real-time Support_Chat session between the requester and the available Support_Agent.
7. IF a User or Business_Owner requests a Support_Chat and no Support_Agent is available, THEN THE Platform SHALL automatically create a Ticket on behalf of the requester with the chat context as the problem description and SHALL notify the requester that a Ticket has been created.
8. THE Platform SHALL restrict access to the support agent panel exclusively to users with the Support_Agent role, and SHALL reject any access attempt by a User or Business_Owner without that role.
9. WHEN a Ticket is set to "cerrado" status, THE Platform SHALL allow the Ticket creator to submit a rating from 1 to 5 for the support received.
10. WHEN a Support_Chat session ends, THE Platform SHALL allow the User or Business_Owner to submit a rating from 1 to 5 for the Support_Agent's assistance.

---

### Requirement 14: Sistema de búsqueda

**User Story:** As a User, I want to search for Businesses and other Users on the platform, so that I can find relevant Businesses to visit physically and connect with other Users.

#### Acceptance Criteria

1. WHEN a User submits a search query by Business name or category, THE Platform SHALL return a list of matching Businesses including their name, category, description, and physical address.
2. WHEN a User selects a Business from the search results, THE Platform SHALL navigate to the Business profile page showing the Business name, description, category, physical address, a map with the Business location marker, and all active Products published by that Business.
3. WHEN a User submits a search query by username, THE Platform SHALL return a list of matching Users including their username and profile photo.
4. WHEN a User selects a User from the search results, THE Platform SHALL navigate to that User's public profile page showing their username, profile photo, and active Marketplace Offers.
3. THE Platform SHALL exclude Coin balance, Diamond balance, and Transaction history from all search results.
4. WHEN a User views a Business profile from search results, THE Platform SHALL display the Business physical address so the User can visit the location in person.
5. WHEN a User views a Business profile from search results, THE Platform SHALL display a map showing the geographic location of that specific Business as a marker.
6. WHEN a User selects the Business marker on the map, THE Platform SHALL display the Business name, category, and physical address.
7. IF a search query returns no matching results, THEN THE Platform SHALL return an empty list and a descriptive message indicating no results were found.
8. THE Platform SHALL restrict Business search results exclusively to Businesses with "active" status.

---

### Requirement 15: Rankings de usuarios y negocios

**User Story:** As a User, I want to view Rankings of the most active Users and Businesses on the platform, so that I can identify top contributors and discover relevant Businesses.

> **Nota:** Esta funcionalidad es futura y se activará automáticamente cuando la plataforma alcance 500 negocios activos.

#### Acceptance Criteria

1. WHILE the platform has 500 or more active Businesses, THE Platform SHALL display the following three User Rankings to any authenticated User:
   - Top 10 Users who have published the most Coins for sale in the Marketplace.
   - Top 10 Users who have the highest accumulated Coin balance in their Wallet.
   - Top 10 Users who have redeemed the most Coins purchasing Products from Businesses.
2. WHILE the platform has 500 or more active Businesses, THE Platform SHALL display the following three Business Rankings to any authenticated User:
   - Top 10 Businesses that have donated the most Coins to Users.
   - Top 10 Businesses that have purchased the most Coins in the Marketplace.
   - Top 10 Businesses whose Products Users have redeemed the most Coins on.
3. WHILE the platform has fewer than 500 active Businesses, THE Platform SHALL NOT display any Ranking to any User.
4. THE Platform SHALL update all Rankings every 7 days based on the accumulated activity metrics from the previous week.
5. THE Platform SHALL maintain a separate set of annual Rankings for each calendar year, accumulating activity metrics from January 1 to December 31, preserving the historical record of each year's top Users and Businesses.
6. THE Platform SHALL display each Ranking as a table showing position, name, and the relevant metric value for each entry.
5. WHEN a User views a Ranking, THE Platform SHALL display each User or Business name as a clickable link that navigates to that User's or Business's public profile page.
6. THE Platform SHALL make Rankings publicly visible to any visitor, including unauthenticated users.
7. IF a Ranking has fewer than 10 qualifying entries, THEN THE Platform SHALL display only the available entries without padding the table.

---

### Requirement 16: Fondo de incentivos

**User Story:** As a platform participant, I want the Incentive_Fund to be distributed among top-ranked Users and Businesses, so that active contributors are rewarded when the platform reaches sufficient scale.

> **Nota:** La distribución del fondo es funcionalidad futura. Desde el inicio la plataforma acumula el fondo pero no lo distribuye hasta alcanzar 500 negocios activos.

#### Acceptance Criteria

1. WHEN a Coin Recharge of $50.000 COP is processed, THE Platform SHALL convert the $2.500 COP Incentive_Fund portion into Coins at the rate of floor($2.500 ÷ $150) and accumulate those Coins in the Incentive_Fund.
2. WHEN a Diamond Recharge of $25.000 COP is processed, THE Platform SHALL convert the $1.250 COP Incentive_Fund portion into Coins at the rate of floor($1.250 ÷ $150) and accumulate those Coins in the Incentive_Fund.
3. WHILE the platform has fewer than 500 active Businesses, THE Platform SHALL accumulate Coins in the Incentive_Fund and SHALL NOT distribute them.
4. WHEN the platform reaches 500 or more active Businesses, THE Platform SHALL automatically activate weekly Incentive_Fund distribution every 7 days.
5. WHEN an Incentive_Fund distribution is executed, THE Platform SHALL distribute the accumulated Coins among the top-ranked Users and Businesses across all six Rankings.
6. THE Platform SHALL distribute the Incentive_Fund exclusively in Coins, and SHALL NOT distribute COP or Diamonds.
7. WHEN an Incentive_Fund distribution is completed, THE Platform SHALL create a Transaction record for each Coin transfer to a recipient Wallet, including the Coin amount, recipient identifier, distribution timestamp, and Incentive_Fund source identifier.
8. IF an Incentive_Fund distribution step fails for a specific recipient, THEN THE Platform SHALL roll back only that recipient's transfer, preserve the remaining Incentive_Fund balance, and return a descriptive error log entry.

---

### Requirement 17: Página principal

**User Story:** As a visitor or authenticated User, I want the main page to show relevant platform information and personalized content, so that I can quickly access rankings, platform stats, and recent activity from accounts I follow.

#### Acceptance Criteria

1. WHEN an unauthenticated visitor accesses the main page, THE Platform SHALL display the six annual Ranking tables defined in Requirement 15, the total number of registered Users, the total number of active Businesses, and the total Coins accumulated in the Incentive_Fund.
2. WHEN an authenticated User accesses the main page, THE Platform SHALL display all content visible to unauthenticated visitors plus a personalized Feed.
3. WHILE an authenticated User is viewing the main page, THE Platform SHALL populate the Feed with new Products published by Businesses that User follows and new Marketplace Offers published by Users that User follows, ordered by publication timestamp descending.
4. IF an authenticated User has no Follow relationships, THEN THE Platform SHALL display the Feed section as empty with a descriptive message inviting the User to follow Businesses or Users.
5. THE Platform SHALL display the total number of registered Users, total active Businesses, and total Incentive_Fund Coins as real-time counters updated within 5 seconds of any change.

---

### Requirement 18: Sistema de seguimiento (Follow)

**User Story:** As a User, I want to follow and unfollow other Users and Businesses, so that I can receive their new publications in my Feed and track their activity on the platform.

#### Acceptance Criteria

1. WHEN a User follows another User or a Business, THE Platform SHALL register the Follow relationship and include that account's future publications in the follower's Feed.
2. WHEN a User unfollows another User or Business, THE Platform SHALL remove the Follow relationship and stop including that account's publications in the follower's Feed.
3. THE Platform SHALL display the follower count and the following count on the public profile page of each User.
4. THE Platform SHALL display the follower count on the profile page of each Business.
5. WHEN a Business_Owner publishes a new Product, THE Platform SHALL include that Product in the Feed of all Users who follow that Business.
6. WHEN a User publishes a new Marketplace Offer, THE Platform SHALL include that Offer in the Feed of all Users who follow that User.
7. IF a User attempts to follow an account they already follow, THEN THE Platform SHALL reject the operation and return a descriptive error indicating the Follow relationship already exists.
8. IF a User attempts to unfollow an account they do not follow, THEN THE Platform SHALL reject the operation and return a descriptive error indicating no Follow relationship exists.
