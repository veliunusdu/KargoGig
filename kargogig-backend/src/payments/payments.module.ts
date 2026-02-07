import { Module } from '@nestjs/common';
import { PaymentsController, MockPaymentController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { MockPaymentProvider } from './providers/mock.provider';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PaymentsController, MockPaymentController],
  providers: [PaymentsService, PaymentsRepository, MockPaymentProvider],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
