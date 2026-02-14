import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentProvider } from './payment-provider';

/**
 * Shopier payment provider — form-based checkout + HMAC-SHA256 callback verification.
 *
 * Env vars required:
 *   SHOPIER_API_KEY    — Shopier API key (used as buyer ID in form)
 *   SHOPIER_SECRET     — Shopier API secret (HMAC key)
 *   BACKEND_BASE_URL   — e.g. https://api.kargogig.com (for callback URL)
 *   FRONTEND_BASE_URL  — e.g. https://app.kargogig.com (for return URLs)
 */
@Injectable()
export class ShopierProvider implements PaymentProvider {
  private readonly logger = new Logger(ShopierProvider.name);
  readonly name = 'shopier';

  private get apiKey(): string {
    return process.env.SHOPIER_API_KEY || '';
  }

  private get secret(): string {
    return process.env.SHOPIER_SECRET || '';
  }

  /**
   * Build checkout form data that the frontend POSTs to Shopier.
   * Returns form endpoint + hidden field values.
   */
  async createCheckout(input: {
    platformOrderId: string;
    amount: number;
    currency: string;
    customer: { id: number; email?: string | null };
  }): Promise<{
    checkoutType: 'url' | 'form';
    checkoutUrl?: string;
    form?: { endpoint: string; fields: Record<string, string> };
  }> {
    this.logger.log(
      `[createCheckout] platform_order_id=${input.platformOrderId}, amount=${input.amount} ${input.currency}`,
    );

    const backendBase = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
    const frontendBase =
      process.env.FRONTEND_BASE_URL || 'http://localhost:3001';

    // Generate random_nr for signature
    const randomNr = crypto.randomBytes(16).toString('hex');

    // Build the data string for signature
    const amountStr = input.amount.toFixed(2);
    const currencyCode = this.currencyToShopierCode(input.currency);

    const productInfo = Buffer.from(
      JSON.stringify([
        {
          name: `KargoGig Ödeme - ${input.platformOrderId}`,
          quantity: 1,
          totalPrice: amountStr,
        },
      ]),
    ).toString('base64');

    const orderBillingAddress = Buffer.from(
      JSON.stringify({
        full_name: `Customer ${input.customer.id}`,
        email: input.customer.email || '',
        address: '',
        city: '',
        country: '',
      }),
    ).toString('base64');

    const orderShippingAddress = orderBillingAddress;

    // Shopier signature: HMAC-SHA256(random_nr + platform_order_id + total_order_value + currency, secret)
    const dataStr = `${randomNr}${input.platformOrderId}${amountStr}${currencyCode}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(dataStr)
      .digest('base64');

    const callbackUrl = `${backendBase}/api/v1/payments/callback/shopier`;
    const successUrl = `${frontendBase}/payments/return/success?platform_order_id=${input.platformOrderId}`;
    const failUrl = `${frontendBase}/payments/return/fail?platform_order_id=${input.platformOrderId}`;

    const fields: Record<string, string> = {
      API_key: this.apiKey,
      website_index: '1',
      platform_order_id: input.platformOrderId,
      product_name: `KargoGig Ödeme`,
      product_type: '1', // digital/service
      product_info: productInfo,
      total_order_value: amountStr,
      currency: currencyCode.toString(),
      buyer_name: `Customer`,
      buyer_surname: `${input.customer.id}`,
      buyer_email: input.customer.email || '',
      buyer_account_age: '0',
      buyer_id_nr: input.customer.id.toString(),
      billing_address: orderBillingAddress,
      shipping_address: orderShippingAddress,
      random_nr: randomNr,
      signature,
      callback_url: callbackUrl,
      success_url: successUrl,
      fail_url: failUrl,
    };

    return {
      checkoutType: 'form',
      form: {
        endpoint: 'https://www.shopier.com/ShowProduct/api_pay4.php',
        fields,
      },
    };
  }

  /**
   * Verify HMAC-SHA256 signature from Shopier callback.
   */
  async verifyCallback(input: { payload: any }): Promise<{
    ok: boolean;
    platformOrderId: string;
    providerPaymentId?: string;
    status: 'paid' | 'failed';
    signatureValid: boolean;
    installment?: number;
  }> {
    const {
      platform_order_id,
      payment_id,
      status,
      installment,
      random_nr,
      total_order_value,
      currency,
      signature,
    } = input.payload;

    if (!platform_order_id || !payment_id || !signature || !random_nr) {
      this.logger.warn('[verifyCallback] Missing required fields');
      return {
        ok: false,
        platformOrderId: platform_order_id || '',
        status: 'failed',
        signatureValid: false,
      };
    }

    // Verify signature
    const signatureValid = this.verifySignature(
      random_nr,
      platform_order_id,
      total_order_value,
      currency,
      signature,
    );

    if (!signatureValid) {
      this.logger.warn(
        `[verifyCallback] Invalid signature for ${platform_order_id}`,
      );
      return {
        ok: false,
        platformOrderId: platform_order_id,
        providerPaymentId: payment_id,
        status: 'failed',
        signatureValid: false,
      };
    }

    const paymentStatus = status === 'success' ? 'paid' : 'failed';

    this.logger.log(
      `[verifyCallback] platform_order_id=${platform_order_id}, status=${paymentStatus}, signature=valid`,
    );

    return {
      ok: true,
      platformOrderId: platform_order_id,
      providerPaymentId: payment_id,
      status: paymentStatus,
      signatureValid: true,
      installment: installment ? parseInt(installment, 10) : undefined,
    };
  }

  /**
   * HMAC-SHA256 signature verification.
   * data = random_nr + platform_order_id + total_order_value + currency
   * expected = HMAC-SHA256(data, SHOPIER_SECRET) → raw bytes
   * incoming = base64 decode(signature) → raw bytes
   * Compare with timingSafeEqual
   */
  verifySignature(
    randomNr: string,
    platformOrderId: string,
    totalOrderValue: string,
    currency: string,
    signature: string,
  ): boolean {
    try {
      const data = `${randomNr}${platformOrderId}${totalOrderValue}${currency}`;
      const expectedSig = crypto
        .createHmac('sha256', this.secret)
        .update(data)
        .digest(); // Buffer

      const incomingSig = Buffer.from(signature, 'base64');

      if (expectedSig.length !== incomingSig.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedSig, incomingSig);
    } catch (err) {
      this.logger.error(`[verifySignature] Error: ${err}`);
      return false;
    }
  }

  /**
   * Map currency code to Shopier numeric code.
   * Shopier uses: 0 = TRY, 1 = USD, 2 = EUR
   */
  private currencyToShopierCode(currency: string): number {
    switch (currency.toUpperCase()) {
      case 'TRY':
        return 0;
      case 'USD':
        return 1;
      case 'EUR':
        return 2;
      default:
        return 0;
    }
  }
}
