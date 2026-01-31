import { Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [ShipmentsController],
    providers: [ShipmentsService],
    exports: [ShipmentsService],
})
export class ShipmentsModule { }
