// Sentry MUST be initialized before anything else
import './observability/instrument.js';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { PinoLoggerService } from './observability/pino-logger.service.js';
import { flushAnalytics, logger } from './observability/index.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // NestJS internal logları da pino üzerinden JSON olarak yaz
    logger: new PinoLoggerService(),
  });

  // Proxy arkasında gerçek IP almak için (production'da önemli)
  // Nginx, Cloudflare vb. reverse proxy kullanıyorsan gerekli
  app.set('trust proxy', 1);

  // Shopier form-urlencoded callback desteği
  app.use(express.urlencoded({ extended: true }));

  // CORS etkinleştir
  app.enableCors();

  // Global ValidationPipe - DTO doğrulama için
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global API prefix
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 3000);

  logger.info(
    { port: process.env.PORT ?? 3000 },
    `Server running on port ${process.env.PORT ?? 3000}`,
  );

  // Graceful shutdown — analytics buffer'ını flush et
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => {
    await flushAnalytics();
  });
}
void bootstrap();
