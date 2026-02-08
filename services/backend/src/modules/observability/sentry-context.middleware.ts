/**
 * Sentry Context Middleware
 *
 * Auth middleware'den sonra çalışır, Sentry'ye user ve request_id bağlamı ekler.
 * Bu sayede Sentry dashboard'da her error hangi user'a ve request'e ait olduğu görülür.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { als, getCtx } from './request-context.js';

@Injectable()
export class SentryContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const store = als.getStore();
    if (!store) {
      next();
      return;
    }

    // Auth header'dan basit user id çıkarımı (Supabase JWT)
    // Not: full JWT decode gerektirmez, Sentry scope opsiyonel
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        // JWT payload kısmını decode et (signature check yapmıyoruz, sadece context)
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1] ?? '', 'base64').toString(),
        );
        if (payload.sub) {
          store.userId = payload.sub;
          store.role = payload.role;
        }
      } catch {
        // JWT parse edilemezse sessizce devam et
      }
    }

    // Sentry scope'u zenginleştir
    Sentry.setUser(store.userId ? { id: store.userId } : null);
    Sentry.setTag('request_id', store.requestId);
    if (store.role) {
      Sentry.setTag('user_role', store.role);
    }

    next();
  }
}
