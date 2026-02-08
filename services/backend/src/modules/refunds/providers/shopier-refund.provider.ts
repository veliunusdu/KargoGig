import { Injectable, Logger } from '@nestjs/common';
import { RefundProvider } from './refund-provider';

/**
 * Shopier refund provider.
 *
 * NOTE: Shopier refund API implementation pending.
 * See Shopier API docs for refund endpoint details.
 * For now, this is a stub that returns "not implemented" error.
 *
 * When implementing:
 * - Use Shopier API Key/Secret for auth
 * - POST to Shopier refund endpoint with payment_id + amount
 * - Handle response: success → refund_id, fail → error message
 */
@Injectable()
export class ShopierRefundProvider implements RefundProvider {
  private readonly logger = new Logger(ShopierRefundProvider.name);
  readonly name = 'shopier';

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
    this.logger.warn(
      `[requestFullRefund] Shopier refund API not yet implemented (payment_id=${input.paymentId})`,
    );

    // TODO: Implement Shopier refund API call
    // Example pseudo-code:
    // const response = await axios.post('https://shopier.com/api/refund', {
    //   api_key: this.apiKey,
    //   payment_id: input.providerPaymentId,
    //   amount: input.amount,
    //   signature: generateSignature(...)
    // });
    // if (response.data.status === 'success') {
    //   return { ok: true, providerRefundId: response.data.refund_id };
    // } else {
    //   return { ok: false, error: response.data.message };
    // }

    return {
      ok: false,
      error: 'shopier_refund_not_implemented',
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
    this.logger.warn(
      `[requestPartialRefund] Shopier refund API not yet implemented (payment_id=${input.paymentId})`,
    );

    // TODO: Implement Shopier partial refund API call

    return {
      ok: false,
      error: 'shopier_refund_not_implemented',
    };
  }
}
