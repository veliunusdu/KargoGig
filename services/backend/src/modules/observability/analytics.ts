/**
 * Analytics Helper — PostHog + DB dual-write
 *
 * track() çağrısı:
 * 1. PostHog'a event gönderir (POSTHOG_KEY varsa)
 * 2. Supabase analytics_events tablosuna yazar (opsiyonel)
 *
 * Analytics ASLA request'i bloklamaz veya bozamaz — tüm hatalar yutulur.
 *
 * Kullanım:
 *   import { track } from '../observability/analytics';
 *   track('offer_submitted', { offer_id: 42, company_id: 7 });
 */
import { PostHog } from 'posthog-node';
import { getCtx } from './request-context.js';
import { logger } from './logger.js';

// PostHog client (key yoksa null — event'ler sadece loglanır)
let posthog: PostHog | null = null;

// Memory queue — PostHog yavaşsa/offline bile event kaybı olmasın
interface QueuedEvent {
  distinctId: string;
  event: string;
  properties: Record<string, any>;
  timestamp: number;
}

const eventQueue: QueuedEvent[] = [];
const MAX_QUEUE_SIZE = 10000; // Queue size limiti — memory patlamasın
const FLUSH_INTERVAL_MS = 5000; // 5 saniyede bir flush
let flushTimer: NodeJS.Timeout | null = null;

if (process.env.POSTHOG_KEY) {
  posthog = new PostHog(process.env.POSTHOG_KEY, {
    host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
    // Flush interval 30s (default)
  });

  // Periodic flush (fire & forget)
  flushTimer = setInterval(() => {
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Queue'daki event'leri PostHog'a gönder
 */
async function flushQueue(): Promise<void> {
  if (!posthog || eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, 100); // 100'er 100'er gönder
  logger.debug({ queueSize: eventQueue.length, batchSize: batch.length }, 'Flushing analytics queue');

  for (const evt of batch) {
    try {
      posthog.capture({
        distinctId: evt.distinctId,
        event: evt.event,
        properties: evt.properties,
        timestamp: new Date(evt.timestamp),
      });
    } catch (err) {
      logger.warn({ err, event: evt.event }, 'PostHog capture failed in flush');
    }
  }
}

export interface TrackOptions {
  /** Entity type (announcement, offer, shipment, payment...) */
  entityType?: string;
  /** Entity primary key */
  entityId?: number;
  /** Extra properties */
  [key: string]: any;
}

/**
 * Analytics event gönder.
 *
 * @param event - Event adı (snake_case: 'offer_submitted', 'payment_succeeded')
 * @param properties - Ek veriler (entity_id, company_id vs.)
 * @param distinctId - PostHog distinct_id (yoksa ctx.userId veya 'anonymous')
 */
export function track(
  event: string,
  properties: TrackOptions = {},
  distinctId?: string,
): void {
  const ctx = getCtx();
  const userId = distinctId ?? ctx.userId ?? 'anonymous';

  const enrichedProps = {
    ...properties,
    request_id: ctx.requestId,
  };

  // PostHog queue'ya ekle (async, non-blocking)
  if (posthog) {
    // Queue overflow kontrolü
    if (eventQueue.length < MAX_QUEUE_SIZE) {
      eventQueue.push({
        distinctId: userId,
        event,
        properties: enrichedProps,
        timestamp: Date.now(),
      });
    } else {
      logger.warn({ event, queueSize: eventQueue.length }, 'Analytics queue full — dropping event');
    }
  }

  // Structured log (her zaman — PostHog yoksa bile takip edilebilir)
  logger.info({ analytics: true, event, ...enrichedProps }, `analytics: ${event}`);
}

/**
 * Graceful shutdown — PostHog buffer'ını flush et + queue'yu boşalt.
 * main.ts'de app.enableShutdownHooks() ile birlikte çağrılabilir.
 */
export async function flushAnalytics(): Promise<void> {
  // Flush timer'ı durdur
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Kalan queue'yu flush et
  await flushQueue();

  if (posthog) {
    try {
      await posthog.shutdown();
    } catch {
      // Shutdown hatasını yut
    }
  }
}
