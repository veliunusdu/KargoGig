import { Module } from '@nestjs/common';
import { PaymentsController, MockPaymentController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { MockPaymentProvider } from './providers/mock.provider';
import { ShopierProvider } from './providers/shopier.provider';
import { PaymentTimeoutService } from './payment-timeout.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PaymentsController, MockPaymentController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    MockPaymentProvider,
    ShopierProvider,
    PaymentTimeoutService,
  ],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
