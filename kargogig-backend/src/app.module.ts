import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

import { SupabaseModule } from './supabase/supabase.module';
import { ProfilesModule } from './profiles/profiles.module';
import { CustomersModule } from './customers/customers.module';
import { CompaniesModule } from './companies/companies.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { OffersModule } from './offers/offers.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { HealthModule } from './health/health.module';
import { MapsModule } from './maps/maps.module';
import { RidesModule } from './rides/rides.module';
import { MatchingModule } from './matching/matching.module';


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
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
