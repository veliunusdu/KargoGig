/**
 * NestJS LoggerService adapter for pino
 *
 * NestJS'in kendi internal loglarını (bootstrap, lifecycle, errors)
 * pino üzerinden JSON formatında yazdırır.
 *
 * Kullanım (main.ts):
 *   app.useLogger(new PinoLoggerService());
 */
import { LoggerService } from '@nestjs/common';
import { logger } from './logger.js';

export class PinoLoggerService implements LoggerService {
  log(message: any, context?: string) {
    logger.info({ nestContext: context }, String(message));
  }

  error(message: any, trace?: string, context?: string) {
    logger.error({ nestContext: context, trace }, String(message));
  }

  warn(message: any, context?: string) {
    logger.warn({ nestContext: context }, String(message));
  }

  debug(message: any, context?: string) {
    logger.debug({ nestContext: context }, String(message));
  }

  verbose(message: any, context?: string) {
    logger.trace({ nestContext: context }, String(message));
  }
}
