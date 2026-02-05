import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 * 
 * Her isteği loglar: kim, ne zaman, hangi endpoint, kaç ms, status ne?
 * JSON formatında structured logging - ELK/Sentry/DataDog uyumlu
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();

    // Response header'a request ID'yi ekle (tracing için)
    res.setHeader('x-request-id', requestId);
    // Request objesine de ekle (controller'larda erişmek için)
    (req as any).requestId = requestId;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const log = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };
      
      // Structured JSON log - sonra pino/winston ile değiştirilebilir
      console.log(JSON.stringify(log));
    });

    next();
  }
}
