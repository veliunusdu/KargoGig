# Project Checklist

## Day 3 (Shopier) — Payment Callback Integration

- [x] DB migration: `payment_provider_events` table (audit + idempotency)
- [x] DB migration: `payments` new columns (`installment`, `failed_reason`, `expires_at`)
- [x] DB migration: unique index on `(provider, provider_payment_id)`
- [x] RPC: `credit_company_wallet_for_payment` (idempotent wallet credit)
- [x] ShopierProvider: `createCheckout()` → form POST fields
- [x] ShopierProvider: `verifyCallback()` → HMAC-SHA256 + base64
- [x] ShopierProvider: `verifySignature()` with `timingSafeEqual`
- [x] PaymentsService: provider map (mock/shopier) for callback routing
- [x] PaymentsService: event insert → signature check → idempotency → update → audit
- [x] PaymentsService: `creditCompanyWallet()` — RPC call on payment paid
- [x] PaymentsService: `expirePendingPayments()` for timeout cron
- [x] PaymentsRepository: `insertProviderEvent()` (23505 = duplicate)
- [x] PaymentsRepository: `insertAuditLog()` (PAYMENT_PAID/FAILED/SIGNATURE_INVALID/DUPLICATE_EVENT/WALLET_*)
- [x] PaymentsRepository: `findExpiredPendingPayments()`
- [x] Controller: `POST /payments/callback/:provider` accepts form-urlencoded
- [x] Controller: `@SkipThrottle()` on callback endpoint
- [x] `main.ts`: `express.urlencoded({ extended: true })`
- [x] PaymentTimeoutService: interval-based cron (60s), expires pending payments
- [x] E2E Test A: Signature verification (unit)
- [x] E2E Test B: Callback success → paid + event + audit + wallet credit verification
- [x] E2E Test C: Idempotency (duplicate callback safe)
- [x] E2E Test D: Invalid signature → 200, payment unchanged, SIGNATURE_INVALID audit
- [x] E2E Test E: Callback fail → failed + PAYMENT_FAILED audit
- [ ] Run migrations on Supabase (`day3_shopier_migration.sql` + `credit_company_wallet_for_payment.sql`)
- [ ] Set SHOPIER_API_KEY + SHOPIER_SECRET in production env
- [ ] Switch PAYMENT_PROVIDER=shopier
- [ ] Test with real Shopier sandbox

## Day 5 (Refunds) - Full & Partial Refund System

- [x] DB migration: unique indexes on `payment_refunds` (idempotency)
- [x] DB migration: `get_commission_rate_for_payment()` helper function
- [x] RPC: `refund_full_for_payment()` — full refund with wallet debit + idempotency
- [x] RPC: `refund_partial_for_payment()` — partial refund with over-refund protection
- [x] RefundProvider interface: `requestFullRefund()`, `requestPartialRefund()`
- [x] MockRefundProvider: always succeeds with fake refund IDs
- [x] ShopierRefundProvider: stub (returns "not implemented")
- [x] RefundRequestDto: type (full/partial), amount, idempotency_key, reason
- [x] RefundsRepository: `findPaymentById()`, `getTotalRefunded()`, RPC callers
- [x] RefundsService: provider map, full/partial refund methods, audit logs
- [x] RefundsController: `POST /payments/:id/refund`
- [x] RefundsModule: imports SupabaseModule, registers providers/service/repository
- [x] AppModule: imports RefundsModule
- [x] E2E Test A: Full refund → assert refund row + wallet debit
- [x] E2E Test B: Idempotency (full refund) → same key twice → same result
- [x] E2E Test C: Partial refund → proportional wallet debit
- [x] E2E Test D: Over-refund attempt → 409 Conflict
- [ ] Run migrations on Supabase:
  - [ ] `sql/day5_refunds_migration.sql`
  - [ ] `sql/refund_full_for_payment.sql`
  - [ ] `sql/refund_partial_for_payment.sql`
- [ ] Implement Shopier refund API (replace stub)
- [ ] Add JWT auth guard + customer ownership verification
- [ ] Run `npm run test:e2e -- refunds` locally

## Day 7 - Push Notifications (Expo Push + Backend)

- [x] DB migration: `user_push_tokens` table (UNIQUE token, RLS, updated_at trigger)
- [x] Install `expo-server-sdk` package
- [x] ExpoPushGateway: Expo API integration with chunk support
- [x] MockPushProvider: Test provider (always succeeds)
- [x] PushProvider interface: `sendToTokens()` abstraction
- [x] RegisterPushTokenDto: token + platform + device_id validation
- [x] NotificationsRepository: upsert, getActiveTokens, markInactive, insert notification row
- [x] NotificationsService: registerToken + notifyCustomer/Driver + lifecycle hooks
- [x] NotificationsController: `POST /me/push-tokens` endpoint
- [x] NotificationsModule: wire up all providers + service + repository
- [x] Lifecycle hooks integrated:
  - [x] Offer accepted → onShipmentAccepted()
  - [x] Driver arrived → onShipmentArrived()
  - [x] Cargo picked up → onShipmentStarted()
  - [x] Delivery completed → onShipmentCompleted()
- [x] OffersModule → imports NotificationsModule
- [x] RidesModule → imports NotificationsModule
- [x] AppModule → imports NotificationsModule
- [x] E2E Test A: Token registration (upsert logic)
- [x] E2E Test B: Token upsert (same token, different user_id)
- [x] E2E Test C: Invalid token (mock provider rejects)
- [x] E2E Test D: Shipment accepted → notification sent
- [x] E2E Test E: Missing user_id → 401 Unauthorized
- [ ] Run migration: `sql/day7_push_notifications_migration.sql`
- [ ] Set EXPO_ACCESS_TOKEN in production
- [ ] Switch PUSH_PROVIDER=expo
- [ ] Add JWT auth guard to token registration endpoint
- [ ] Test with real Expo push tokens (mobile app)
- [ ] Configure FCM v1 credentials for Android

## Day 7 - Ride Rating System (Customer Feedback)

- [x] RateRideDto: driver_rating (1-5), company_rating (1-5), comment validation
- [x] RidesService.rate(): validate completed status + insert ratings
- [x] RidesController: `POST /rides/:id/rate` endpoint (HTTP 201)
- [x] Idempotency: UNIQUE(shipment_id, customer_id, target_type, target_id) → 23505 error handled
- [x] E2E Test A: Cannot rate before completion → 400
- [x] E2E Test B: Rate after completion → 201 + ride_ratings rows
- [x] E2E Test C: Idempotent (duplicate rating) → 201, inserted=0
- [x] E2E Test D: Averages updated (driver.rating, companies.rating_avg)
- [x] E2E Test E: Partial rating (only driver or company) → 201
- [x] E2E Test F: Reject empty rating → 400
- [ ] **Migration Required**: Ensure DB schema is up-to-date (profiles, companies, drivers with proper columns)
- [ ] Run DB migration: `ride_ratings` table (if not already deployed)
- [ ] Deploy DB triggers: update_driver_rating_avg(), update_company_rating_avg()
- [ ] Run `npm run test:e2e -- ride-rating` locally (requires schema migration)
- [ ] Add mobile UI: Rating screen after delivery completion
- [ ] Add rating notification: Push notification "Please rate your driver!"

## Day 6 - Cancellation E2E (Integration Tests)

- [x] Service role admin client for test seeding (RLS-safe)
- [x] Real auth tokens (signInWithPassword) for endpoint calls
- [x] `E2E_STRICT_DB` mode (`true` → fail if RPC missing, else skip)
- [x] `handleRpcMissing` — precise PostgreSQL function-not-found detection
- [x] Test A: Customer cancel (fee = 0)
- [x] Test B: Customer cancel idempotency (409)
- [x] Test C: Driver cancel full E2E (assignment → cancel → unassign + rebroadcast)
  - [x] Pre-condition: shipment.driver_id == assigned driver
  - [x] POST endpoint with real driver token
  - [x] shipment.driver_id → NULL verified in DB
  - [x] shipment.cancellation_reason verified in DB
  - [x] shipment.status → driver_cancelled/cancelled verified
  - [x] announcement status reverts (pending/broadcasting/rebroadcasting)
  - [x] announcement_broadcast_batches row verified (if rebroadcasted)
  - [x] shipment_cancellations audit log (soft check — warns if table absent)
  - [x] Driver cancel idempotency (second cancel → 400/403/404/409)
- [x] Test D: Customer cancel with fee (env-based `CANCEL_FREE_WINDOW_MINUTES`)

## Day 4 - Configuration & Security

- [x] Health endpoint (`GET /health` → 200 OK)
- [x] Request logging (`x-request-id` header)
- [x] Rate limiting (short: 60/min, auth: 10/min)
- [x] Trust proxy (for production behind Nginx/Cloudflare)
- [x] CORS enabled
- [ ] E2E onboarding flow test passing
- [ ] Devlog updated

## Day 3 - Database & API (Previous)

- [x] Supabase integration
- [x] Companies CRUD
- [x] Drivers CRUD
- [x] Vehicles CRUD
- [x] Shipments CRUD
- [x] Announcements CRUD
- [x] Offers CRUD
- [x] Profiles module

## Upcoming

- [ ] Auth guards (JWT validation)
- [ ] User roles & permissions
- [ ] Pricing module
- [ ] Order status workflow
- [ ] Push notifications
- [ ] File uploads (delivery photos)
