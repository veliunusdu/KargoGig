import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { ProfilesModule } from './profiles/profiles.module';
import { CustomersModule } from './customers/customers.module';
import { CompaniesModule } from './companies/companies.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { OffersModule } from './offers/offers.module';

// env okuyabilmek için (.env path'i rootta olduğu için ona göre eklendi)
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    SupabaseModule,
    ProfilesModule,
    CustomersModule,
    CompaniesModule,
    AnnouncementsModule,
    OffersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
