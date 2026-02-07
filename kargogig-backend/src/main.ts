import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  // /health endpoint'i prefix'siz olsun (Kubernetes/Docker health check için)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  await app.listen(process.env.PORT ?? 3000);

  console.log(`🚀 Server running on port ${process.env.PORT ?? 3000}`);
}
void bootstrap();
