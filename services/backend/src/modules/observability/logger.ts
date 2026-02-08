/**
 * Structured JSON Logger (pino)
 *
 * Her log satırı otomatik olarak requestId içerir (AsyncLocalStorage'dan).
 * Hassas alanlar (authorization, cookie, password) redact edilir.
 *
 * Kullanım:
 *   import { logger } from '../observability/logger';
 *   logger.info({ route: '/health' }, 'health check ok');
 *   logger.error({ err, shipmentId: 42 }, 'shipment update failed');
 */
import pino from 'pino';
import { getCtx } from './request-context.js';

const base = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Production'da JSON, dev'de okunabilir format
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
  redact: {
    paths: [
      // Auth / security
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["set-cookie"]',
      'authorization',
      'password',
      '*.password',
      'token',
      '*.token',
      'access_token',
      '*.access_token',
      'refresh_token',
      '*.refresh_token',

      // Payment provider data
      'callback_payload',
      '*.callback_payload',
      'payload.card_number',
      'payload.cvv',
      'payload.card_holder',
      'provider_payload',
      '*.provider_payload',

      // PII
      'email',
      '*.email',
      'phone',
      '*.phone',
      'tax_number',
      '*.tax_number',
      'iban',
      '*.iban',
      'ssn',
      '*.ssn',

      // Request body fields
      'body.password',
      'body.token',
      'body.card_number',
    ],
    remove: true,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Wrapper logger — her çağrıda requestId (ve varsa userId, role) otomatik eklenir.
 */
export const logger = {
  trace: (obj: Record<string, any>, msg?: string) =>
    base.trace({ ...obj, ...getCtx() }, msg),
  debug: (obj: Record<string, any>, msg?: string) =>
    base.debug({ ...obj, ...getCtx() }, msg),
  info: (obj: Record<string, any>, msg?: string) =>
    base.info({ ...obj, ...getCtx() }, msg),
  warn: (obj: Record<string, any>, msg?: string) =>
    base.warn({ ...obj, ...getCtx() }, msg),
  error: (obj: Record<string, any>, msg?: string) =>
    base.error({ ...obj, ...getCtx() }, msg),
  fatal: (obj: Record<string, any>, msg?: string) =>
    base.fatal({ ...obj, ...getCtx() }, msg),

  /** Raw pino instance (NestJS LoggerService adapter vs. için) */
  raw: base,
};
