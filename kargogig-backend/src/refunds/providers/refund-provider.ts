/**
 * Refund provider interface for provider-agnostic refund processing.
 * Today: mock, shopier. Future: any payment gateway with refund API.
 */
export interface RefundProvider {
  /**
   * Provider name (e.g., 'mock', 'shopier')
   */
  name: string;

  /**
   * Request full refund from provider.
   * @returns provider refund ID if successful
   */
  requestFullRefund(input: {
    paymentId: number;
    providerPaymentId: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<{
    ok: boolean;
    providerRefundId?: string;
    error?: string;
  }>;

  /**
   * Request partial refund from provider.
   * @returns provider refund ID if successful
   */
  requestPartialRefund(input: {
    paymentId: number;
    providerPaymentId: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<{
    ok: boolean;
    providerRefundId?: string;
    error?: string;
  }>;
}
