import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { MapsModule } from '../maps/maps.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MapsModule, SupabaseModule, PaymentsModule, NotificationsModule],
  controllers: [RidesController],
  providers: [RidesService],
})
export class RidesModule {}
