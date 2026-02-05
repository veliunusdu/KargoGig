import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { MapsModule } from '../maps/maps.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [MapsModule, SupabaseModule],
  controllers: [RidesController],
  providers: [RidesService],
})
export class RidesModule {}
