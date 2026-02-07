import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from './payment-provider';

/**
 * Mock payment provider for testing without real payment gateway.
 * Generates simple checkout URLs and accepts test callbacks.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly name = 'mock';

  /**
   * Create mock checkout URL
   * In real app, customer opens this URL in webview/browser
   */
  async createCheckout(input: {
    platformOrderId: string;
    amount: number;
    currency: string;
    customer: { id: number; email?: string | null };
  }): Promise<{
    checkoutType: 'url' | 'form';
    checkoutUrl?: string;
  }> {
    this.logger.log(
      `[createCheckout] platform_order_id=${input.platformOrderId}, amount=${input.amount} ${input.currency}`,
    );

    // Mock checkout page (served by our own backend for testing)
    const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
    const checkoutUrl = `${baseUrl}/mock-pay/${input.platformOrderId}`;

    return {
      checkoutType: 'url',
      checkoutUrl,
    };
  }

  /**
   * Verify mock callback (no real signature verification needed)
   */
  async verifyCallback(input: { payload: any }): Promise<{
    ok: boolean;
    platformOrderId: string;
    providerPaymentId?: string;
    status: 'paid' | 'failed';
  }> {
    const { platform_order_id, status, provider_payment_id } = input.payload;

    if (!platform_order_id) {
      this.logger.warn('[verifyCallback] Missing platform_order_id');
      return {
        ok: false,
        platformOrderId: '',
        status: 'failed',
      };
    }

    const paymentStatus = status === 'success' ? 'paid' : 'failed';

    this.logger.log(
      `[verifyCallback] platform_order_id=${platform_order_id}, status=${paymentStatus}`,
    );

    return {
      ok: true,
      platformOrderId: platform_order_id,
      providerPaymentId: provider_payment_id || `MOCK-${Date.now()}`,
      status: paymentStatus,
    };
  }
}
