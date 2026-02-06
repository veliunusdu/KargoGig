# Project Checklist

## Day 5 - Cancellation E2E (Integration Tests)

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
