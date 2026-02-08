import { Injectable, Logger } from '@nestjs/common';
import { RefundProvider } from './refund-provider';

/**
 * Mock refund provider for testing without real payment gateway.
 * Always succeeds, generates fake refund IDs.
 */
@Injectable()
export class MockRefundProvider implements RefundProvider {
  private readonly logger = new Logger(MockRefundProvider.name);
  readonly name = 'mock';

  async requestFullRefund(input: {
    paymentId: number;
    providerPaymentId: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<{
    ok: boolean;
    providerRefundId?: string;
    error?: string;
  }> {
    this.logger.log(
      `[requestFullRefund] payment_id=${input.paymentId}, provider_payment_id=${input.providerPaymentId}, amount=${input.amount}`,
    );

    // Mock: always succeed
    const providerRefundId = `MOCK-REFUND-FULL-${Date.now()}`;

    return {
      ok: true,
      providerRefundId,
    };
  }

  async requestPartialRefund(input: {
    paymentId: number;
    providerPaymentId: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<{
    ok: boolean;
    providerRefundId?: string;
    error?: string;
  }> {
    this.logger.log(
      `[requestPartialRefund] payment_id=${input.paymentId}, provider_payment_id=${input.providerPaymentId}, amount=${input.amount}`,
    );

    // Mock: always succeed
    const providerRefundId = `MOCK-REFUND-PARTIAL-${Date.now()}`;

    return {
      ok: true,
      providerRefundId,
    };
  }
}
