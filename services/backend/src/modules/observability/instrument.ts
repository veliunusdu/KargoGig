/**
 * Sentry Instrumentation — EN ÜSTTE import edilmeli
 *
 * Bu dosya main.ts'de ilk import olarak çekilir:
 *   import './observability/instrument';
 *
 * Sentry SDK'yı başlatır, request context ile zenginleştirir.
 *
 * Env vars:
 *   SENTRY_DSN         — Sentry project DSN (yoksa init atlanır)
 *   NODE_ENV            — environment tag
 *   APP_VERSION         — release tag (optional)
 *   SENTRY_TRACES_RATE  — tracing sample rate (default: 0.1)
 */
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    // Prod'da düşük sampling → maliyet + gürültü kontrolü
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_RATE ?? (isProd ? '0.05' : '0.1'),
    ),

    // Hassas verileri Sentry'ye gönderme + expected error'ları drop
    beforeSend(event, hint) {
      // Headers'dan hassas verileri temizle
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['set-cookie'];
      }

      // Expected errors (401, 403, 404) → drop veya tag
      const statusCode = event.contexts?.response?.status_code;
      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        // Bu error'ları Sentry'ye göndermiyoruz (expected behavior)
        return null;
      }

      // Rate-limiting errors (429) → tag'le ama gönder
      if (statusCode === 429) {
        event.tags = { ...event.tags, expected_error: 'rate_limit' };
      }

      return event;
    },
  });

  // eslint-disable-next-line no-console
  console.log('[Sentry] Initialized', { environment: process.env.NODE_ENV });
} else {
  // eslint-disable-next-line no-console
  console.log('[Sentry] SENTRY_DSN not set — skipping init');
}
