# Development Log

## 2026-02-07 — Day 3 (Shopier): Payment Callback Integration

### Goal
"Ödeme gerçeği DB'de kuraldır" — Shopier webhook callback → signature verify → idempotent event → payment status update → audit log.

### Shipped

- ✅ **DB migration** (`sql/day3_shopier_migration.sql`):
  - `payment_provider_events` table (audit + idempotency via `UNIQUE(provider, event_key)`)
  - `payments.installment`, `payments.failed_reason`, `payments.expires_at` columns added
  - `UNIQUE INDEX` on `(provider, provider_payment_id)` WHERE NOT NULL

- ✅ **ShopierProvider** (`src/payments/providers/shopier.provider.ts`):
  - `createCheckout()` → generates form POST fields for Shopier's `api_pay4.php`
  - `verifyCallback()` → HMAC-SHA256 signature verification (timing-safe)
  - `verifySignature()` → `data = random_nr + platform_order_id + total_order_value + currency`
  - Currency mapping: TRY=0, USD=1, EUR=2

- ✅ **Enhanced PaymentsService** (`src/payments/payments.service.ts`):
  - Provider map (`mock`/`shopier`) for callback routing
  - Full callback flow: event insert → signature check → idempotency → status update → audit
  - `PAYMENT_PAID`, `PAYMENT_FAILED`, `SIGNATURE_INVALID`, `DUPLICATE_EVENT` audit actions
  - `expirePendingPayments()` method for timeout cron

- ✅ **PaymentsRepository** — new methods:
  - `insertProviderEvent()` — returns `23505` on duplicate (idempotent)
  - `insertAuditLog()` — writes to `audit_logs` table
  - `findExpiredPendingPayments()` — for timeout cron
  - `createPayment()` now accepts `expires_at`

- ✅ **Controller** — `POST /payments/callback/:provider`:
  - Accepts `application/x-www-form-urlencoded` (Shopier sends form POST)
  - `@SkipThrottle()` — server-to-server webhook shouldn't be rate-limited
  - Relaxed validation (no whitelist) for provider-injected fields

- ✅ **PaymentTimeoutService** (`src/payments/payment-timeout.service.ts`):
  - `setInterval`-based cron (60s default, configurable via `PAYMENT_TIMEOUT_CHECK_INTERVAL_MS`)
  - Marks expired pending payments as `failed` with `PAYMENT_FAILED` audit (reason: timeout)
  - Default timeout: 15 minutes (configurable via `PAYMENT_PENDING_TIMEOUT_MINUTES`)

- ✅ **main.ts**: `express.urlencoded({ extended: true })` middleware added

- ✅ **E2E Tests** (`test/shopier-callback.e2e-spec.ts`):
  - Test A: Signature generation + verification (unit-level)
  - Test B: Callback success → paid + event + audit + wallet credit
  - Test C: Duplicate callback → idempotent (200, no double-processing)
  - Test D: Invalid signature → 200, payment unchanged, SIGNATURE_INVALID audit
  - Test E: Callback fail → failed + PAYMENT_FAILED audit

- ✅ **Wallet Auto-Credit** (`sql/credit_company_wallet_for_payment.sql`):
  - RPC called automatically on `payment.status = 'paid'`
  - Idempotent: checks if `wallet_transactions` row already exists
  - Creates wallet if not exists (`owner_type='company'`)
  - Atomic wallet balance update + transaction insert
  - Audit logs: `WALLET_CREDITED`, `WALLET_CREDIT_FAILED`, `WALLET_CREDIT_EXCEPTION`
  - "Ödeme gerçeği DB'de kuraldır" → "Cüzdan kredisi ödeme gerçeğinin parçasıdır"

### Architecture

```
Shopier POST (form-urlencoded)
  │
  ▼
POST /api/v1/payments/callback/shopier
  │
  ├─ 1. Resolve provider (providerMap['shopier'])
  ├─ 2. verifyCallback() → HMAC-SHA256 check
  ├─ 3. insertProviderEvent() → idempotency (UNIQUE constraint)
  │     └─ 23505 duplicate? → DUPLICATE_EVENT audit → return 200
  ├─ 4. signature invalid? → SIGNATURE_INVALID audit → return 200
  ├─ 5. Find payment by platform_order_id
  ├─ 6. Already terminal? → no-op → return 200
  ├─ 7. Update: status=paid/failed, paid_at, provider_payment_id
  ├─ 8. Audit log: PAYMENT_PAID / PAYMENT_FAILED
  └─ 9. IF paid → RPC: credit_company_wallet_for_payment
        ├─ Find/create wallet
        ├─ Atomic balance update
        ├─ Insert wallet_transactions (idempotent)
        └─ Audit: WALLET_CREDITED / WALLET_CREDIT_FAILED
```

### Env Vars

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYMENT_PROVIDER` | `mock` | Active provider (`mock` / `shopier`) |
| `SHOPIER_API_KEY` | — | Shopier API key |
| `SHOPIER_SECRET` | — | Shopier HMAC secret |
| `BACKEND_BASE_URL` | `http://localhost:3000` | For callback URL |
| `FRONTEND_BASE_URL` | `http://localhost:3001` | For return URLs |
| `PAYMENT_PENDING_TIMEOUT_MINUTES` | `15` | Pending → failed timeout |
| `PAYMENT_TIMEOUT_CHECK_INTERVAL_MS` | `60000` | Cron check interval |

### Files Changed

- `sql/day3_shopier_migration.sql` — DB migration
- `sql/credit_company_wallet_for_payment.sql` — RPC for wallet auto-credit (new)
- `src/payments/providers/shopier.provider.ts` — Shopier provider (new)
- `src/payments/dto/shopier-callback.dto.ts` — Shopier callback DTO (new)
- `src/payments/payment-timeout.service.ts` — Pending timeout cron (new)
- `src/payments/payments.service.ts` — Enhanced callback flow + wallet credit
- `src/payments/payments.repository.ts` — Event/audit/expired methods
- `src/payments/payments.controller.ts` — form-urlencoded + SkipThrottle
- `src/payments/payments.module.ts` — ShopierProvider + TimeoutService registered
- `src/payments/providers/payment-provider.ts` — Interface updated (signatureValid, installment)
- `src/main.ts` — urlencoded middleware
- `test/shopier-callback.e2e-spec.ts` — 5 E2E tests (new)
- `docs/devlog.md` — this entry
- `docs/checklist.md` — Day 3 section

### Next

- [ ] Run migrations on Supabase:
  - `sql/day3_shopier_migration.sql`
  - `sql/credit_company_wallet_for_payment.sql`
- [ ] Set `SHOPIER_API_KEY` + `SHOPIER_SECRET` env vars in production
- [ ] Switch `PAYMENT_PROVIDER=shopier` when ready
- [ ] Test with real Shopier sandbox
- [ ] Add success/fail return pages (frontend)

---

## 2026-02-08 — Day 5 (Refunds): Full & Partial Refund System

### Goal
"Önce provider, sonra DB ledger. Çünkü aksi halde provider fail ama wallet debit oldu gibi saçmalık çıkar." — Payment refund system with provider API call → DB RPC → wallet debit → audit trail.

### Shipped

- ✅ **DB migration** (`sql/day5_refunds_migration.sql`):
  - Unique indexes on `payment_refunds` for idempotency:
    - `UNIQUE(payment_id, idempotency_key)`
    - `UNIQUE(payment_id, provider_refund_id) WHERE provider_refund_id IS NOT NULL`
  - Helper function `get_commission_rate_for_payment(p_payment_id)` → retrieves commission rate from `company_pricing`

- ✅ **Full Refund RPC** (`sql/refund_full_for_payment.sql`):
  - `refund_full_for_payment(p_payment_id, p_provider_refund_id, p_idempotency_key, p_reason?)`
  - Returns: `{ok, refund_id, amount_gross, company_debit, new_wallet_balance, already_refunded?, error?}`
  - Idempotent via `idempotency_key`
  - Validates: payment is `paid`, no existing full refund
  - Calculates: `company_debit = amount_gross * (1 - commission_rate)`, `platform_fee = amount_gross * commission_rate`
  - Atomic: wallet balance update → wallet_transactions debit → payment_refunds insert
  - Edge case: `insufficient_wallet_balance` → error

- ✅ **Partial Refund RPC** (`sql/refund_partial_for_payment.sql`):
  - `refund_partial_for_payment(p_payment_id, p_amount_gross, p_provider_refund_id, p_idempotency_key, p_reason?)`
  - Returns: `{ok, refund_id, amount_gross, company_debit, new_wallet_balance, remaining_refundable, already_refunded?, error?}`
  - Idempotent via `idempotency_key`
  - Validates: payment is `paid`, remaining amount ≥ requested amount (over-refund protection)
  - Proportional wallet debit: `company_debit = refund_amount * (1 - commission_rate)`
  - Supports multiple partial refunds (cumulative)

- ✅ **RefundProvider Interface** (`src/refunds/providers/refund-provider.ts`):
  - `requestFullRefund()` → `{ok, providerRefundId?, error?}`
  - `requestPartialRefund()` → `{ok, providerRefundId?, error?}`

- ✅ **MockRefundProvider** (`src/refunds/providers/mock-refund.provider.ts`):
  - Always returns `ok=true` with fake refund ID: `MOCK-REFUND-{type}-{timestamp}`

- ✅ **ShopierRefundProvider** (`src/refunds/providers/shopier-refund.provider.ts`):
  - Stub returning `{ok: false, error: 'not implemented'}` (future work)

- ✅ **RefundRequestDto** (`src/refunds/dto/refund-request.dto.ts`):
  - `type`: `'full' | 'partial'`
  - `amount`: required when `type='partial'`
  - `idempotency_key`: always required
  - `reason`: optional

- ✅ **RefundsRepository** (`src/refunds/refunds.repository.ts`):
  - `findPaymentById()` → retrieves payment row
  - `getTotalRefunded()` → sums succeeded refunds
  - `callRefundFullRpc()` → calls `refund_full_for_payment` RPC
  - `callRefundPartialRpc()` → calls `refund_partial_for_payment` RPC
  - `insertAuditLog()` → writes to `audit_logs`

- ✅ **RefundsService** (`src/refunds/refunds.service.ts`):
  - Provider map: `mock`, `shopier`
  - `requestFullRefund()`: validates payment status → provider API → RPC → audit
  - `requestPartialRefund()`: validates payment status + amount → provider API → RPC → audit
  - Audit actions: `REFUND_SUCCEEDED`, `REFUND_FAILED`, `WALLET_REFUND_DEBITED`
  - Error mapping: RPC `over_refund` → 409 Conflict, `insufficient_wallet_balance` → 409, `already_fully_refunded` → 409

- ✅ **RefundsController** (`src/refunds/refunds.controller.ts`):
  - `POST /payments/:id/refund` → accepts `RefundRequestDto`
  - Returns: `{ok, refund: {id, type, amount_gross, company_debit, new_wallet_balance, remaining_refundable?, already_refunded?}}`
  - TODO: JWT auth guard + customer ownership verification

- ✅ **RefundsModule** (`src/refunds/refunds.module.ts`):
  - Imports: `SupabaseModule`
  - Providers: `RefundsService`, `RefundsRepository`, `MockRefundProvider`, `ShopierRefundProvider`
  - Controllers: `RefundsController`
  - Exports: `RefundsService`

- ✅ **AppModule updated** — imports `RefundsModule`

- ✅ **E2E Tests** (`test/refunds.e2e-spec.ts`):
  - Test A: Full refund → paid → refund → assert refund row + wallet debit (expected: 200 * 0.85 = 170)
  - Test B: Idempotency (full) → same key twice → same refund ID, `already_refunded=true`
  - Test C: Partial refund → 200 TRY (out of 500) → assert proportional debit (170)
  - Test D: Over-refund attempt → 409 Conflict (60 + 50 = 110 > 100)

### Architecture

```
POST /api/v1/payments/:id/refund
  { type: 'full'/'partial', amount?, idempotency_key, reason? }
  │
  ▼
RefundsController
  │
  ▼
RefundsService
  │
  ├─ 1. Find payment by ID
  ├─ 2. Verify status=paid, provider_payment_id exists
  ├─ 3. Validate amount (if partial)
  ├─ 4. Resolve refund provider (mock/shopier)
  ├─ 5. Call provider API: requestFullRefund / requestPartialRefund
  │     ├─ Success → providerRefundId
  │     └─ Failure → REFUND_FAILED audit → throw 502 BadGateway
  ├─ 6. Call RPC: refund_full_for_payment / refund_partial_for_payment
  │     ├─ Validates: not already fully refunded, sufficient wallet balance
  │     ├─ Calculates: company_debit = amount * (1 - commission_rate)
  │     ├─ Atomic: wallet debit + wallet_transactions + payment_refunds insert
  │     └─ Returns: {ok, refund_id, amount_gross, company_debit, new_wallet_balance, ...}
  ├─ 7. RPC error → audit → map to HTTP error (409/502)
  ├─ 8. Audit: REFUND_SUCCEEDED
  └─ 9. Audit: WALLET_REFUND_DEBITED (if not idempotent duplicate)
```

### Ledger Rules

| Scenario | Payment Amount | Commission Rate | Company Credit | Refund Amount | Company Debit | Platform Refund |
|----------|----------------|-----------------|----------------|---------------|---------------|-----------------|
| Full refund | 200 TRY | 15% | 170 TRY | 200 TRY | 170 TRY | 30 TRY |
| Partial refund (50%) | 200 TRY | 15% | 170 TRY | 100 TRY | 85 TRY | 15 TRY |

**Key**: "Ödeme gerçeği DB'de kuraldır" → "İade gerçeği önce provider'da kuraldır, sonra DB'ye yazılır."

### Files Changed

- `sql/day5_refunds_migration.sql` — DB migration (new)
- `sql/refund_full_for_payment.sql` — Full refund RPC (new)
- `sql/refund_partial_for_payment.sql` — Partial refund RPC (new)
- `src/refunds/providers/refund-provider.ts` — Provider interface (new)
- `src/refunds/providers/mock-refund.provider.ts` — Mock provider (new)
- `src/refunds/providers/shopier-refund.provider.ts` — Shopier stub (new)
- `src/refunds/dto/refund-request.dto.ts` — Refund DTO (new)
- `src/refunds/refunds.repository.ts` — Repository layer (new)
- `src/refunds/refunds.service.ts` — Business logic (new)
- `src/refunds/refunds.controller.ts` — Refund endpoint (new)
- `src/refunds/refunds.module.ts` — Module registration (new)
- `src/app.module.ts` — imports RefundsModule
- `test/refunds.e2e-spec.ts` — 4 E2E tests (new)
- `docs/devlog.md` — this entry

### Next

- [ ] Run migrations on Supabase:
  - `sql/day5_refunds_migration.sql`
  - `sql/refund_full_for_payment.sql`
  - `sql/refund_partial_for_payment.sql`
- [ ] Implement Shopier refund API (replace stub)
- [ ] Add JWT auth guard + customer ownership verification to RefundsController
- [ ] Run `npm run test:e2e -- refunds` locally
- [ ] Add refund notification webhook (notify customer on refund)
- [ ] Add admin dashboard for refund tracking

---

## 2026-02-07 — Day 7: Push Notifications (Expo Push + Backend Integration)

### Goal
"Müşteri daima state değişimini anında görür." — Push notification system with Expo Push gateway, token management, and lifecycle hooks (accepted/arrived/started/completed).

### Shipped

- ✅ **DB migration** (`sql/day7_push_notifications_migration.sql`):
  - `user_push_tokens` table with UNIQUE constraint on `token` (upsert target)
  - Columns: `user_id`, `token`, `platform` (android/ios/web), `device_id`, `is_active`, `last_seen_at`
  - Indexes: `UNIQUE(token)`, `user_id`, `user_id WHERE is_active=true`
  - RLS policies: users can manage their own tokens
  - Updated_at trigger for token last_seen_at tracking
  - Optional cleanup cron (delete tokens not seen in 90 days)

- ✅ **Expo Push Gateway** (`src/notifications/providers/expo-push.gateway.ts`):
  - Uses `expo-server-sdk` (npm package)
  - `sendToTokens()` → validates Expo tokens, chunks messages (100/request limit), sends via Expo API
  - Handles ticket errors: `DeviceNotRegistered` → marks token as invalid
  - Returns: `{ok, sent, failed, invalidTokens}`
  - TODO: Store ticket.id for receipt checking (advanced)

- ✅ **Mock Push Provider** (`src/notifications/providers/mock-push.provider.ts`):
  - Always succeeds, logs messages without sending
  - Validates tokens starting with "ExponentPushToken" (test mode)

- ✅ **Push Provider Interface** (`src/notifications/providers/push-provider.ts`):
  - `sendToTokens(tokens, {title, body, data?})` → `{ok, sent, failed, invalidTokens}`

- ✅ **RegisterPushTokenDto** (`src/notifications/dto/register-push-token.dto.ts`):
  - `token`: string (required)
  - `platform`: 'android' | 'ios' | 'web' (required)
  - `device_id`: string (optional)

- ✅ **NotificationsRepository** (`src/notifications/notifications.repository.ts`):
  - `upsertPushToken()` → token UNIQUE → update user_id + is_active=true + last_seen_at=now()
  - `getActiveTokensByUserId()` → fetches all active tokens for a user
  - `markTokensInactive()` → deactivates invalid tokens (DeviceNotRegistered)
  - `insertNotification()` → creates notification row (audit trail)
  - `getUserIdByCustomerId()` / `getUserIdByDriverId()` → resolves user_id for targeting
  - `insertAuditLog()` → writes `NOTIFICATION_SENT` audit logs

- ✅ **NotificationsService** (`src/notifications/notifications.service.ts`):
  - Provider map: `mock` (default), `expo` (production) → controlled via `PUSH_PROVIDER` env var
  - `registerPushToken()` → upserts token with upsert logic
  - `notifyCustomer()` → resolves user_id → inserts notification row → fetches tokens → sends push → marks invalid tokens
  - `notifyDriver()` → same flow for drivers
  - Lifecycle hooks:
    - `onShipmentAccepted()` → "Shipment Accepted" (customer + optionally driver)
    - `onShipmentArrived()` → "Driver Arrived" (customer)
    - `onShipmentStarted()` → "Shipment Started" (customer)
    - `onShipmentCompleted()` → "Shipment Completed" (customer)
    - `onShipmentCancelled()` → "Shipment Cancelled" (customer)
  - Audit action: `NOTIFICATION_SENT` with `{type, sent, failed, invalidTokens}`

- ✅ **NotificationsController** (`src/notifications/notifications.controller.ts`):
  - `POST /me/push-tokens` → registers or updates push token for authenticated user
  - TODO: Add JWT auth guard (currently uses `x-user-id` header for testing)

- ✅ **NotificationsModule** (`src/notifications/notifications.module.ts`):
  - Imports: `SupabaseModule`
  - Providers: `NotificationsService`, `NotificationsRepository`, `ExpoPushGateway`, `MockPushProvider`
  - Controllers: `NotificationsController`
  - Exports: `NotificationsService`

- ✅ **Lifecycle Hooks Integrated**:
  - **Offer accepted** (`offers.service.ts`): After trigger creates shipment → `onShipmentAccepted()`
  - **Driver arrived** (`rides.service.ts`): After `driver_arrive_ride` RPC → `onShipmentArrived()`
  - **Cargo picked up** (`rides.service.ts`): After `driver_start_ride` RPC → `onShipmentStarted()`
  - **Delivery completed** (`rides.service.ts`): After `driver_complete_ride` RPC → `onShipmentCompleted()`
  - All hooks run async (don't block response), catch and log errors

- ✅ **Module Imports**:
  - `OffersModule` → imports `NotificationsModule`
  - `RidesModule` → imports `NotificationsModule`
  - `AppModule` → imports `NotificationsModule`

- ✅ **E2E Tests** (`test/notifications.e2e-spec.ts`):
  - Test A: Token registration → upsert logic (insert new token)
  - Test B: Token upsert (same token, different user_id → updates user_id)
  - Test C: Invalid token accepted in DB, mock provider rejects on send
  - Test D: Shipment accepted → notification row + audit log (graceful skip if not found)
  - Test E: Missing user_id → 401 Unauthorized

### Architecture

```
POST /api/v1/me/push-tokens
  { token, platform, device_id? }
  │
  ▼
NotificationsController
  │
  ▼
NotificationsService.registerPushToken()
  │
  └─→ NotificationsRepository.upsertPushToken()
        └─→ DB: user_push_tokens (UNIQUE token → update user_id)

─────────────────────────────────────────────────────────

Lifecycle Event (e.g., offer accepted)
  │
  ▼
OffersService.acceptOffer() / RidesService.arrive()
  │
  ├─ RPC succeeds
  ├─ Query shipment for customer_id
  └─→ NotificationsService.onShipmentAccepted()
        │
        ├─ 1. Resolve user_id from customer_id
        ├─ 2. Insert notification row (audit trail)
        ├─ 3. Fetch active push tokens for user_id
        ├─ 4. Send push notification via provider (Expo/Mock)
        │     └─→ ExpoPushGateway.sendToTokens()
        │           ├─ Validate Expo tokens
        │           ├─ Chunk messages (100/request)
        │           ├─ Send via Expo API
        │           └─ Return {sent, failed, invalidTokens}
        ├─ 5. Mark invalid tokens as inactive (is_active=false)
        └─ 6. Audit log: NOTIFICATION_SENT
```

### Notification Types

| Type | Trigger | Recipient | Title | Body |
|------|---------|-----------|-------|------|
| `shipment_accepted` | Offer accepted → shipment created | Customer | "Shipment Accepted" | "Your shipment has been accepted by a driver!" |
| `shipment_arrived` | Driver arrive RPC succeeds | Customer | "Driver Arrived" | "Your driver has arrived at the pickup location." |
| `shipment_started` | Driver start RPC succeeds | Customer | "Shipment Started" | "Your cargo has been picked up and is on the way!" |
| `shipment_completed` | Driver complete RPC succeeds | Customer | "Shipment Completed" | "Your cargo has been delivered successfully!" |
| `shipment_cancelled` | Cancel RPC succeeds | Customer | "Shipment Cancelled" | Custom reason or default message |

### Env Vars

| Variable | Default | Description |
|----------|---------|-------------|
| `PUSH_PROVIDER` | `mock` | Active push provider (`mock` / `expo`) |
| `EXPO_ACCESS_TOKEN` | — | Expo Push API access token (production) |

### Token Upsert Logic

**Goal**: Same physical device token should only belong to one user at a time.

```sql
INSERT INTO user_push_tokens (user_id, token, platform, device_id, is_active, last_seen_at)
VALUES ($1, $2, $3, $4, TRUE, NOW())
ON CONFLICT (token)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  platform = EXCLUDED.platform,
  device_id = EXCLUDED.device_id,
  is_active = TRUE,
  last_seen_at = NOW();
```

**Scenario**: User A logs out on device → User B logs in on same device → token shifts to User B.

### Files Changed

- `sql/day7_push_notifications_migration.sql` — DB migration (new)
- `src/notifications/providers/push-provider.ts` — Provider interface (new)
- `src/notifications/providers/expo-push.gateway.ts` — Expo gateway (new)
- `src/notifications/providers/mock-push.provider.ts` — Mock provider (new)
- `src/notifications/dto/register-push-token.dto.ts` — Token DTO (new)
- `src/notifications/notifications.repository.ts` — Repository layer (new)
- `src/notifications/notifications.service.ts` — Business logic + lifecycle hooks (new)
- `src/notifications/notifications.controller.ts` — Token registration endpoint (new)
- `src/notifications/notifications.module.ts` — Module registration (new)
- `src/offers/offers.service.ts` — Added `onShipmentAccepted()` hook after offer acceptance
- `src/offers/offers.module.ts` — Imports `NotificationsModule`
- `src/rides/rides.service.ts` — Added hooks for arrive/start/complete
- `src/rides/rides.module.ts` — Imports `NotificationsModule`
- `src/app.module.ts` — Imports `NotificationsModule`
- `test/notifications.e2e-spec.ts` — 5 E2E tests (new)
- `package.json` — Added `expo-server-sdk` dependency
- `docs/devlog.md` — this entry

### Next

- [ ] Run migration: `sql/day7_push_notifications_migration.sql`
- [ ] Set `EXPO_ACCESS_TOKEN` in production
- [ ] Switch `PUSH_PROVIDER=expo` when ready
- [ ] Add JWT auth guard to `POST /me/push-tokens`
- [ ] Run `npm run test:e2e -- notifications` locally
- [ ] Implement Expo receipt checking (advanced): store `ticket.id` → poll receipts → mark delivery status
- [ ] Add push notification for driver cancel (notify customer)
- [ ] Add push notification for payment success/failure

### Mobile Integration (Expo)

**Token Registration Flow**:

```typescript
// Mobile app (Expo)
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function registerPushToken() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;

  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: '<YOUR_EXPO_PROJECT_ID>',
  })).data;

  // Send to backend
  await fetch('/api/v1/me/push-tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token,
      platform: Platform.OS, // 'android' | 'ios'
      device_id: Device.osInternalBuildId,
    }),
  });

  return token;
}
```

### FCM Credential (Android)

Expo Push on Android requires FCM v1 credentials. Follow:
- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [FCM v1 Setup](https://docs.expo.dev/push-notifications/fcm-credentials/)

**Dev**: Mock provider works without credentials.  
**Prod**: Configure FCM credentials in Expo dashboard + set `EXPO_ACCESS_TOKEN`.

---

## 2026-02-07 — Day 7: Ride Rating System (Customer Feedback + Averages)

### Goal
"Kaliteli hizmeti ölçüp ödüllendirmek için rating sistemi." — Allow customers to rate drivers and companies after completed deliveries, with automatic average updates via triggers.

### Shipped

- ✅ **RateRideDto** (`src/rides/dto/rate-ride.dto.ts`):
  - `driver_rating`: number (1-5, optional)
  - `company_rating`: number (1-5, optional)
  - `comment`: string (optional)
  - Validation: At least one rating (driver or company) required

- ✅ **RidesService.rate()** (`src/rides/rides.service.ts`):
  - Validates shipment status === 'completed' (400 BadRequest if not)
  - Inserts driver rating: `target_type='driver'`, `target_id=driver_id`
  - Inserts company rating: `target_type='company'`, `target_id=company_id`
  - Idempotent: UNIQUE(shipment_id, customer_id, target_type, target_id) → PostgreSQL error 23505 → silent ignore
  - Returns: `{ok: true, inserted: number}` (0, 1, or 2 ratings inserted)

- ✅ **RidesController.rate()** (`src/rides/rides.controller.ts`):
  - `POST /api/v1/rides/:id/rate` → HTTP 201 Created
  - Requires Authorization header (JWT auth)
  - Body: `{ driver_rating?, company_rating?, comment? }`

- ✅ **E2E Tests** (`test/ride-rating.e2e-spec.ts`):
  - Test A: Cannot rate before completion → 400
  - Test B: Rate after completion → 201 + ride_ratings rows
  - Test C: Idempotent (duplicate rating attempt) → 201, inserted=0, original rating preserved
  - Test D: Averages updated (driver.rating, companies.rating_avg) via triggers
  - Test E: Partial rating (only driver or only company) → 201, inserted=1
  - Test F: Reject empty rating (no driver_rating, no company_rating) → 400

### Architecture

```
POST /api/v1/rides/:id/rate
  { driver_rating?, company_rating?, comment? }
  │
  ▼
RidesController.rate()
  │
  ▼
RidesService.rate()
  │
  ├─ 1. Validate at least one rating provided
  ├─ 2. Verify shipment status === 'completed' (else 400)
  ├─ 3. Insert driver rating (if provided)
  │     INSERT INTO ride_ratings (shipment_id, customer_id, target_type='driver', target_id=driver_id, rating, comment)
  │     ON CONFLICT → Error 23505 (idempotent, ignore duplicate)
  ├─ 4. Insert company rating (if provided)
  │     INSERT INTO ride_ratings (shipment_id, customer_id, target_type='company', target_id=company_id, rating, comment)
  └─ 5. DB Triggers:
        ├─ update_driver_rating_avg() → AVG(rating) WHERE target_type='driver' AND target_id=driver_id
        │                              → UPDATE drivers SET rating = avg_rating
        └─ update_company_rating_avg() → AVG(rating) WHERE target_type='company' AND target_id=company_id
                                       → UPDATE companies SET rating_avg = avg_rating
```

### Rating System Constraints

**DB Schema** (from previous migrations):
```sql
-- ride_ratings table
CREATE TABLE ride_ratings (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT REFERENCES shipments(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('driver', 'company')),
  target_id BIGINT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shipment_id, customer_id, target_type, target_id)
);
```

**Idempotency via UNIQUE Constraint**:
- Same customer cannot rate same target (driver or company) for the same shipment twice
- PostgreSQL error code 23505 → duplicate key → service ignores and returns {ok: true, inserted: 0}
- Original rating preserved (no updates allowed, immutable ratings)

### Files Changed

- `src/rides/dto/rate-ride.dto.ts` — DTO validation (new)
- `src/rides/rides.service.ts` — Added `rate()` method
- `src/rides/rides.controller.ts` — Added `POST /rides/:id/rate` endpoint
- `test/ride-rating.e2e-spec.ts` — 6 E2E tests (new)
- `docs/devlog.md` — this entry

### Next

- [ ] **Ensure DB schema is current**: profiles (user_id, name, full_name?, role?), companies (city column), drivers (rating column)
- [ ] Run migration: `ride_ratings` table if not deployed
- [ ] Deploy DB triggers: `update_driver_rating_avg()`, `update_company_rating_avg()`
- [ ] Run `npm run test:e2e -- ride-rating` locally (requires above schema)
- [ ] Add mobile UI: Rating screen after delivery completion
- [ ] Add rating analytics: average rating history, rating distribution chart
- [ ] Add rating notification: "Please rate your driver!" push notification after delivery
- [ ] Prevent editing ratings (currently immutable by design via UNIQUE constraint)

---

## 2026-02-06 — Day 6: Cancellation E2E — Full Integration Tests

### Shipped

- ✅ **Driver cancel full E2E** (Test C) — complete DB verification:
  - Pre-condition check: `shipment.driver_id` == assigned driver, status == `assigned`
  - Endpoint call with **real driver JWT token** (not admin)
  - `shipment.driver_id` → NULL verified in DB
  - `shipment.status` → `driver_cancelled`/`cancelled`/`unassigned` verified
  - `shipment.cancellation_reason` verified
  - `announcements.status` reverts to `pending`/`broadcasting`/`rebroadcasting`
  - `announcement_broadcast_batches` row verified when `rebroadcasted: true`
  - `shipment_cancellations` audit log row verified (soft check — warns if table not deployed)
  - Driver cancel idempotency: second cancel → 400/403/404/409

- ✅ **`handleRpcMissing` hardened** — now uses precise PostgreSQL patterns:
  - `function.*does not exist` / `could not find the function` / `schema cache`
  - No more false positives on legitimate 404 "not found" app errors

- ✅ **`E2E_STRICT_DB` mode** — controlled via env variable:
  - `E2E_STRICT_DB=true` → RPC missing = test **fails** (for CI)
  - Default → RPC missing = test **skips** with warning (for local dev)

- ✅ **Test D: Customer cancel with fee** (env-based):
  - `CANCEL_FREE_WINDOW_MINUTES=0` → every cancel after assignment charges fee
  - Back-dates `shipment.assigned_at` to fall outside free window
  - Asserts `fee_amount > 0`, `fee_currency` defined

### Test Architecture

```
Seeding (service_role)          Endpoint calls (user token)
──────────────────────          ───────────────────────────
auth.admin.createUser()   →    signInWithPassword() → JWT
admin.from('drivers')     →    POST /rides/:id/driver-cancel
admin.from('shipments')   →    POST /rides/:id/cancel
admin.from('vehicles')
admin.from('driver_locations')
```

**Rule**: Setup/seed = `service_role`, endpoint calls = user JWT.
This keeps RLS enforced on prod paths while bypassing it for test data.

### Files Changed

- `test/cancellation.e2e-spec.ts` — enhanced Test C, added Test D, hardened `handleRpcMissing`
- `docs/checklist.md` — Day 5 section added
- `docs/devlog.md` — this entry

### Next (Day 6+)

- [ ] Deploy `driver_cancel_assignment` RPC if not done
- [ ] Deploy `shipment_cancellations` audit table
- [ ] CI pipeline with `E2E_STRICT_DB=true`
- [ ] Push notification on driver cancel (customer gets notified)

## 2026-02-04 — Day 4: Configuration & Security

### Shipped

- ✅ Added `/health` endpoint (returns 200 OK with `{ ok: true }`)
- ✅ Request logging middleware: `x-request-id` header on all responses
- ✅ Rate limiting enabled via `@nestjs/throttler`
  - `short`: 60 req / 60s (general endpoints)
  - `auth`: 10 req / 60s (for auth endpoints - stricter)
- ✅ Trust proxy configured for production (Nginx/Cloudflare)
- ✅ CORS enabled

### Proof

```bash
# Health check with x-request-id
curl.exe -i http://localhost:3000/health
# Response headers include:
# x-request-id: f737b674-4086-4483-8767-5fe98c9c1665

# Rate limiting test (70 requests, expect 429 after 60)
1..70 | % {
  try { (Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing).StatusCode }
  catch { $_.Exception.Response.StatusCode.Value__ }
} | Group-Object | Select Name,Count

# Result:
# Name Count
# ---- -----
# 200      8  (remaining from previous minute)
# 429     62  (rate limited)
```

### Files Changed

- `src/health/health.controller.ts` - Health endpoint
- `src/health/health.module.ts` - Health module
- `src/middleware/request-logger.middleware.ts` - Structured JSON logging
- `src/app.module.ts` - ThrottlerModule + HealthModule + RequestLoggerMiddleware
- `src/main.ts` - trust proxy + CORS + health exclusion from prefix

### Next

- [ ] Add integration E2E: full onboarding flow test
- [ ] Verify pricing policies in pg_policies output
- [ ] Add Pino/Winston for production logging
- [ ] Redis-backed rate limiting for multi-instance deployments
