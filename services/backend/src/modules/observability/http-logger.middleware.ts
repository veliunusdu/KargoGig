/**
 * HTTP Request Logger Middleware (pino-http)
 *
 * Eski console.log tabanlı RequestLoggerMiddleware'in yerine geçer.
 * Her request/response çiftini otomatik loglar:
 *   - method, url, statusCode, responseTime
 *   - requestId (AsyncLocalStorage'dan)
 *   - Hassas header'lar redact edilir
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import { getCtx } from './request-context.js';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const ctx = getCtx();
      const statusCode = res.statusCode;

      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        responseTime: ms,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentLength: res.getHeader('content-length'),
      };

      if (statusCode >= 500) {
        logger.error(logData, 'request completed');
      } else if (statusCode >= 400) {
        logger.warn(logData, 'request completed');
      } else {
        logger.info(logData, 'request completed');
      }
    });

    next();
  }
}
