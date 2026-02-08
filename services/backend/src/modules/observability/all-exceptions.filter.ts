/**
 * Global Exception Filter — AllExceptionsFilter
 *
 * Tüm yakalanmamış hataları yakalar:
 * 1. Error response body'ye request_id ekler
 * 2. Sentry'ye bildirir (request context ile)
 * 3. Structured JSON log yazar
 *
 * Error response format:
 * {
 *   statusCode: 500,
 *   message: "Internal server error",
 *   request_id: "abc-123-...",
 *   timestamp: "2026-02-08T..."
 * }
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { logger } from './logger.js';
import { getCtx } from './request-context.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const httpCtx = host.switchToHttp();
    const response = httpCtx.getResponse<Response>();
    const request = httpCtx.getRequest<Request>();
    const ctx = getCtx();

    let status: number;
    let message: string | object;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as any).message ?? exResponse;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Structured error log
    logger.error(
      {
        err: exception instanceof Error ? exception : { raw: String(exception) },
        method: request.method,
        url: request.originalUrl,
        statusCode: status,
      },
      `Unhandled exception: ${status}`,
    );

    // Sentry capture (lazy import — Sentry opsiyonel)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/node');
      if (exception instanceof Error) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureMessage(String(exception), 'error');
      }
    } catch {
      // Sentry yüklü değilse sessizce devam et
    }

    const body = {
      statusCode: status,
      message,
      request_id: ctx.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(status).json(body);
  }
}
