import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { PaymentProvider } from './providers/payment-provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Service layer for payment business logic
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paymentProvider: PaymentProvider;

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly supabaseService: SupabaseService,
    private readonly mockProvider: MockPaymentProvider,
  ) {
    // Select provider based on ENV (future: PAYMENT_PROVIDER=shopier)
    const providerName = process.env.PAYMENT_PROVIDER || 'mock';
    this.logger.log(`[constructor] Using payment provider: ${providerName}`);

    if (providerName === 'mock') {
      this.paymentProvider = mockProvider;
    } else {
      // Future: shopierProvider
      throw new Error(`Unknown payment provider: ${providerName}`);
    }
  }

  /**
   * Create checkout session for shipment payment (called from /rides/:id/pay)
   * This is the main entry point — validates ownership, state, idempotency,
   * then delegates to createCheckout.
   */
  async createCheckoutForShipment(
    shipmentId: number,
    authHeader: string,
  ): Promise<{
    provider: string;
    platform_order_id: string;
    checkout_type: 'url' | 'form';
    checkout_url?: string;
    form?: { endpoint: string; fields: Record<string, string> };
  }> {
    return this.createCheckout(authHeader, { shipment_id: shipmentId });
  }

  /**
   * Create checkout session for shipment payment
   */
  async createCheckout(
    authHeader: string | undefined,
    dto: { shipment_id: number },
  ): Promise<{
    provider: string;
    platform_order_id: string;
    checkout_type: 'url' | 'form';
    checkout_url?: string;
    form?: { endpoint: string; fields: Record<string, string> };
  }> {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authorization header eksik veya geçersiz');
    }

    this.logger.log(`[createCheckout] shipment_id=${dto.shipment_id}`);

    // Get customer_id from auth token
    const userClient = this.supabaseService.asUser(token);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    const userId = user.id;

    // Get customer_id
    const { data: customer, error: customerError } = await this.supabaseService
      .getServiceClient()
      .from('customers')
      .select('id, user_id')
      .eq('user_id', userId)
      .single();

    if (customerError || !customer) {
      throw new NotFoundException('Customer not found');
    }

    const customerId = customer.id;
    const customerEmail = user.email;

    // Get shipment with final_price and delivered_at
    const { data: shipment, error: shipmentError } = await this.supabaseService
      .getServiceClient()
      .from('shipments')
      .select('id, customer_id, company_id, final_price, delivered_at')
      .eq('id', dto.shipment_id)
      .single();

    if (shipmentError || !shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Verify shipment belongs to customer
    if (shipment.customer_id !== customerId) {
      throw new UnauthorizedException('Shipment does not belong to customer');
    }

    // Verify ride is completed (delivered_at must exist)
    if (!shipment.delivered_at) {
      throw new ConflictException('Ride not completed yet');
    }

    // Verify final_price exists
    if (!shipment.final_price || shipment.final_price <= 0) {
      throw new ConflictException('Shipment price missing or invalid');
    }

    // Check if payment already exists
    const { data: existingPayment } = await this.paymentsRepository.findByShipmentId(
      dto.shipment_id,
    );

    if (existingPayment) {
      this.logger.log(
        `[createCheckout] Payment already exists: ${existingPayment.platform_order_id}`,
      );

      // If already paid, return existing checkout (idempotent)
      if (existingPayment.status === 'paid') {
        throw new ConflictException('Payment already completed');
      }

      // If pending, return existing platform_order_id
      const checkoutData = await this.paymentProvider.createCheckout({
        platformOrderId: existingPayment.platform_order_id,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        customer: { id: customerId, email: customerEmail },
      });

      return {
        provider: this.paymentProvider.name,
        platform_order_id: existingPayment.platform_order_id,
        checkout_type: checkoutData.checkoutType,
        checkout_url: checkoutData.checkoutUrl,
        form: checkoutData.form,
      };
    }

    // Create payment record (platform_order_id generated by DB default)
    const { data: payment, error: paymentError } = await this.paymentsRepository.createPayment({
      shipment_id: dto.shipment_id,
      customer_id: customerId,
      company_id: shipment.company_id,
      amount: shipment.final_price,
      currency: 'TRY',
      provider: this.paymentProvider.name,
    });

    if (paymentError || !payment) {
      this.logger.error(`[createCheckout] Failed to create payment: ${paymentError?.message}`);
      throw new BadGatewayException('Failed to create payment record');
    }

    // Create checkout with provider
    const checkoutData = await this.paymentProvider.createCheckout({
      platformOrderId: payment.platform_order_id,
      amount: shipment.final_price,
      currency: 'TRY',
      customer: { id: customerId, email: customerEmail },
    });

    this.logger.log(
      `[createCheckout] Success: platform_order_id=${payment.platform_order_id}, checkout_url=${checkoutData.checkoutUrl}`,
    );

    return {
      provider: this.paymentProvider.name,
      platform_order_id: payment.platform_order_id,
      checkout_type: checkoutData.checkoutType,
      checkout_url: checkoutData.checkoutUrl,
      form: checkoutData.form,
    };
  }

  /**
   * Process payment callback from provider
   */
  async processCallback(
    providerName: string,
    payload: { platform_order_id: string; status: string; provider_payment_id?: string; error_message?: string },
  ): Promise<{ ok: boolean; status: string }> {
    this.logger.log(`[processCallback] provider=${providerName}, platform_order_id=${payload.platform_order_id}`);

    // Verify callback with the active provider
    // NOTE: We no longer gate on providerName === this.paymentProvider.name here.
    // Instead we verify the callback, find the row, then check stored provider.
    const verification = await this.paymentProvider.verifyCallback({ payload });

    if (!verification.ok) {
      this.logger.error('[processCallback] Callback verification failed');
      throw new BadGatewayException('Callback verification failed');
    }

    const { platformOrderId, providerPaymentId, status } = verification;

    // Find payment by platform_order_id (no provider filter)
    const { data: payment, error: findError } =
      await this.paymentsRepository.findByPlatformOrderId(platformOrderId);

    if (findError || !payment) {
      this.logger.error(
        `[processCallback] Payment not found: platform_order_id=${platformOrderId}`,
      );
      throw new NotFoundException(
        `Payment not found for platform_order_id=${platformOrderId}`,
      );
    }

    // Provider mismatch detection: row.provider vs callback URL provider
    if (payment.provider !== providerName) {
      this.logger.warn(
        `[processCallback] Provider mismatch: row.provider=${payment.provider}, callback provider=${providerName}`,
      );
      throw new ConflictException(
        `Provider mismatch: payment was created with provider '${payment.provider}' but callback arrived for '${providerName}'`,
      );
    }

    // Idempotent update: if already paid/failed, don't change
    if (payment.status === 'paid' || payment.status === 'failed') {
      this.logger.log(
        `[processCallback] Payment already in terminal state: ${payment.status}`,
      );
      return { ok: true, status: payment.status };
    }

    // Update payment status
    const updates: any = {
      status,
      callback_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
      updates.provider_payment_id = providerPaymentId || payload.provider_payment_id || null;
    } else {
      updates.failure_message = payload.error_message || 'Payment failed';
    }

    const { error: updateError } = await this.paymentsRepository.updatePaymentStatus(
      payment.id,
      updates,
    );

    if (updateError) {
      this.logger.error(`[processCallback] Failed to update payment: ${updateError.message}`);
      throw new BadGatewayException('Failed to update payment');
    }

    this.logger.log(`[processCallback] Success: payment_id=${payment.id}, status=${status}`);

    return { ok: true, status };
  }
}
