/**
 * Payment provider interface for provider-agnostic payment processing.
 * Today: mock, Tomorrow: Shopier, Future: any payment gateway
 */
export interface PaymentProvider {
  /**
   * Provider name (e.g., 'mock', 'shopier')
   */
  name: string;

  /**
   * Create a checkout session/form for payment
   * @returns checkout details (URL redirect or form POST data)
   */
  createCheckout(input: {
    platformOrderId: string;
    amount: number;
    currency: string;
    customer: { id: number; email?: string | null };
  }): Promise<{
    checkoutType: 'url' | 'form';
    checkoutUrl?: string;
    form?: {
      endpoint: string;
      fields: Record<string, string>;
    };
  }>;

  /**
   * Verify payment callback/webhook from provider
   * @returns verification result with payment status
   */
  verifyCallback(input: { payload: any }): Promise<{
    ok: boolean;
    platformOrderId: string;
    providerPaymentId?: string;
    status: 'paid' | 'failed';
    signatureValid?: boolean;
    installment?: number;
  }>;
}
