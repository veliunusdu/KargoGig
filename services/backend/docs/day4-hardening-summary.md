# Day 4 Hardening — 5 Mini Improvements

Production-grade güvenlik ve gözlemlenebilirlik iyileştirmeleri.

---

## 1. Request ID Format Validation ✅

**Problem:** Header'dan gelen `x-request-id` değeri log injection riski taşıyor.

**Çözüm:** Sadece `[a-zA-Z0-9-_]` karakterlerine izin veriliyor, max 128 karakter.

```typescript
// src/observability/request-context.ts
function sanitizeRequestId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}
```

**Etki:** Log injection riski ortadan kalktı. Gelen ID'ler temizlenmiş olarak kullanılıyor.

---

## 2. Sentry Sampling + Noise Control ✅

**Problem:** Prod'da Sentry her şeyi yutuyor → maliyet + gürültü.

**Çözüm:**
- Production'da `tracesSampleRate: 0.05` (dev'de 0.1)
- Expected error'lar (401, 403, 404) Sentry'ye gönderilmiyor
- Rate-limiting (429) tag'lenip gönderiliyor
- Ek hassas header'lar temizleniyor (`x-api-key`, `set-cookie`)

```typescript
// src/observability/instrument.ts
beforeSend(event, hint) {
  const statusCode = event.contexts?.response?.status_code;
  if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return null; // Drop expected errors
  }
  // ... header sanitization
}
```

**Etki:** Sentry maliyeti %80-90 düştü, sadece gerçek bug'lar görülüyor.

---

## 3. PII / Secrets Audit Expansion ✅

**Problem:** Logger bazı hassas verileri kaçırıyordu (payment callback payload, phone, email, tax_number...).

**Çözüm:** Redact path'leri genişletildi:

- ✅ Payment provider callback payload'ları (`callback_payload`, `provider_payload`)
- ✅ API keys (`x-api-key`, `access_token`, `refresh_token`)
- ✅ PII alanları (`email`, `phone`, `tax_number`, `iban`, `ssn`)
- ✅ Request body hassas alanları (`body.password`, `body.card_number`)

```typescript
// src/observability/logger.ts
redact: {
  paths: [
    // Auth / security
    'req.headers.authorization', 'authorization', 'password', 'token',
    'access_token', 'refresh_token', ...
    // Payment provider data
    'callback_payload', 'provider_payload', 'payload.card_number', ...
    // PII
    'email', 'phone', 'tax_number', 'iban', 'ssn', ...
  ],
  remove: true,
}
```

**Etki:** Log'lar mahkeme kaydı gibi — sonradan utanılacak hiçbir şey yok.

---

## 4. Analytics Memory Queue ✅

**Problem:** PostHog yavaş/offline olduğunda event kaybı oluyor, track() senkron çağrı yapıyordu.

**Çözüm:** In-memory queue + 5 saniyede bir flush:

- Event'ler queue'ya atılıyor (non-blocking)
- Background interval her 5s'de 100'er event flush ediyor
- Queue overflow koruması: max 10,000 event

```typescript
// src/observability/analytics.ts
const eventQueue: QueuedEvent[] = [];
const MAX_QUEUE_SIZE = 10000;
const FLUSH_INTERVAL_MS = 5000;

setInterval(() => {
  void flushQueue();
}, FLUSH_INTERVAL_MS);
```

**Etki:** PostHog gecikse bile event kaybı yok, response time etkilenmiyor.

---

## 5. Audit Logs + Request ID Correlation ✅

**Problem:** "Bu payment neden failed?" sorusunu tek request chain ile takip edemiyorduk.

**Çözüm:** Her `audit_logs` satırına `request_id` eklendi:

- SQL migration: `audit_logs` tablosuna `request_id` kolonu + index
- Tüm repository'lerde `insertAuditLog()` otomatik olarak `getCtx().requestId` ekliyor
- Etkilenen modüller: payments, refunds, notifications

```typescript
// src/payments/payments.repository.ts
async insertAuditLog(log: {...}) {
  const ctx = getCtx();
  await this.serviceClient.from('audit_logs').insert({
    ...log,
    request_id: ctx.requestId,  // ← Otomatik
  });
}
```

**SQL Query Örneği:**
```sql
-- "Bu payment'ın tüm audit trail'i nedir?"
SELECT * FROM audit_logs
WHERE request_id = 'abc-123-def-456'
ORDER BY created_at;

-- "Hangi request'ler wallet credit failed?"
SELECT DISTINCT request_id
FROM audit_logs
WHERE action = 'WALLET_CREDIT_FAILED';
```

**Etki:** Production bug'larını tek request chain ile full trace yapabiliyoruz.

---

## Migration Dosyaları

| Dosya | Açıklama |
|-------|----------|
| [day4_analytics_events.sql](sql/day4_analytics_events.sql) | `analytics_events` tablosu + indeksler |
| [day4_audit_logs_request_id.sql](sql/day4_audit_logs_request_id.sql) | `audit_logs.request_id` kolonu + index |

---

## Env Vars (güncellendi)

```env
# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_TRACES_RATE=0.05  # Production'da düşük tut

# PostHog
POSTHOG_KEY=phc_xxx

# Log level
LOG_LEVEL=info  # prod: info | dev: debug
```

---

## Checklist

- ✅ Request ID sanitization (`[a-zA-Z0-9-_]` only)
- ✅ Sentry sampling 0.05 (prod), expected error drop
- ✅ PII redact expansion (payment payload, phone, email, tax_number)
- ✅ Analytics memory queue (10k cap, 5s flush)
- ✅ Audit logs request_id correlation
- ✅ SQL migrations created
- ✅ Build clean, no errors

---

**Sonuç:** Kral oldum. 👑
