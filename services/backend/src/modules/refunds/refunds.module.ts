import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundsRepository } from './refunds.repository';
import { MockRefundProvider } from './providers/mock-refund.provider';
import { ShopierRefundProvider } from './providers/shopier-refund.provider';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [RefundsController],
  providers: [
    RefundsService,
    RefundsRepository,
    MockRefundProvider,
    ShopierRefundProvider,
  ],
  exports: [RefundsService], // Export for other modules
})
export class RefundsModule {}
