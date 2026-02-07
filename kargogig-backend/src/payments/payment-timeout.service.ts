import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * Cron-like service that expires pending payments past their timeout.
 *
 * Runs every 60 seconds. In production consider @nestjs/schedule + @Cron,
 * but this zero-dependency approach works fine for single-instance deployments.
 */
@Injectable()
export class PaymentTimeoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentTimeoutService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  /** Check interval in milliseconds (default: 60s) */
  private readonly intervalMs = parseInt(process.env.PAYMENT_TIMEOUT_CHECK_INTERVAL_MS || '60000', 10);

  constructor(private readonly paymentsService: PaymentsService) {}

  onModuleInit() {
    this.logger.log(
      `[onModuleInit] Starting pending-payment timeout checker (interval=${this.intervalMs}ms)`,
    );

    this.intervalRef = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
      this.logger.log('[onModuleDestroy] Stopped pending-payment timeout checker');
    }
  }

  private async tick() {
    try {
      const count = await this.paymentsService.expirePendingPayments();
      if (count > 0) {
        this.logger.log(`[tick] Expired ${count} pending payments`);
      }
    } catch (err) {
      this.logger.error(`[tick] Error expiring payments: ${err}`);
    }
  }
}
