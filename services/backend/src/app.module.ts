import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import {
  RequestContextMiddleware,
  HttpLoggerMiddleware,
  SentryContextMiddleware,
  AllExceptionsFilter,
} from './modules/observability/index.js';

import { SupabaseModule } from './supabase/supabase.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { OffersModule } from './modules/offers/offers.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { HealthModule } from './modules/health/health.module';
import { MapsModule } from './modules/maps/maps.module';
import { RidesModule } from './modules/rides/rides.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // Rate limiting - brute force / spam koruması
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60_000, // 1 dakika
        limit: 60, // 60 istek/dk (genel)
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10, // 10 istek/dk (auth için sıkı)
      },
    ]),

    SupabaseModule,
    ProfilesModule,
    CustomersModule,
    CompaniesModule,
    AnnouncementsModule,
    OffersModule,
    DriversModule,
    VehiclesModule,
    ShipmentsModule,
    HealthModule,
    MapsModule,
    RidesModule,
    MatchingModule,
    PaymentsModule,
    RefundsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global exception filter — her error'a request_id + Sentry capture
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Sıralama önemli: requestContext → sentryContext → httpLogger
    consumer
      .apply(RequestContextMiddleware, SentryContextMiddleware, HttpLoggerMiddleware)
      .forRoutes('*');
  }
}
