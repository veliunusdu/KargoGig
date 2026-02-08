/**
 * Request Context via AsyncLocalStorage
 *
 * Her request için benzersiz bir context taşır (requestId, userId, role).
 * AsyncLocalStorage sayesinde herhangi bir yerden getCtx() ile erişilebilir —
 * "context passing" derdini bitirir.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

export interface RequestCtx {
  requestId: string;
  userId?: string;
  role?: string;
  /** Request start time (epoch ms) for duration calc */
  startTime: number;
}

export const als = new AsyncLocalStorage<RequestCtx>();

/**
 * Sanitize request ID — sadece safe karakterler [a-zA-Z0-9-_]
 * Log injection riskini azaltır.
 */
function sanitizeRequestId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

/**
 * Mevcut request context'ini döndürür.
 * AsyncLocalStorage store yoksa fallback döner.
 */
export function getCtx(): RequestCtx {
  return als.getStore() ?? { requestId: 'no-request-context', startTime: Date.now() };
}

/**
 * NestJS Middleware — her request için:
 * 1. x-request-id header'dan alır veya yeni UUID üretir
 * 2. Response header'a requestId yazar
 * 3. AsyncLocalStorage'a context koyar
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    // Gelen header varsa sanitize et (log injection prevention)
    const requestId = incoming
      ? sanitizeRequestId(incoming)
      : randomUUID();

    res.setHeader('x-request-id', requestId);

    // req objesine de ekle (legacy erişim için)
    (req as any).requestId = requestId;

    const ctx: RequestCtx = {
      requestId,
      startTime: Date.now(),
    };

    als.run(ctx, () => next());
  }
}
