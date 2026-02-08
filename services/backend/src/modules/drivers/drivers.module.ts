import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriversRepository } from './drivers.repository';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [DriversController],
  providers: [DriversService, DriversRepository],
  exports: [DriversService, DriversRepository],
})
export class DriversModule {}
