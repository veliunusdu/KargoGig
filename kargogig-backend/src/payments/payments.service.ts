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
import { ShopierProvider } from './providers/shopier.provider';
import { SupabaseService } from '../supabase/supabase.service';

/** Default pending payment timeout in minutes */
const PENDING_TIMEOUT_MINUTES = parseInt(
  process.env.PAYMENT_PENDING_TIMEOUT_MINUTES || '15',
  10,
);

/**
 * Service layer for payment business logic
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paymentProvider: PaymentProvider;
  private readonly providerMap: Record<string, PaymentProvider>;

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly supabaseService: SupabaseService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly shopierProvider: ShopierProvider,
  ) {
    // Build provider map for callback routing
    this.providerMap = {
      mock: mockProvider,
      shopier: shopierProvider,
    };

    // Select default provider based on ENV
    const providerName = process.env.PAYMENT_PROVIDER || 'mock';
    this.logger.log(`[constructor] Using payment provider: ${providerName}`);

    const provider = this.providerMap[providerName];
    if (!provider) {
      throw new Error(`Unknown payment provider: ${providerName}`);
    }
    this.paymentProvider = provider;
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
      throw new UnauthorizedException(
        'Authorization header eksik veya geçersiz',
      );
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
    const { data: existingPayment } =
      await this.paymentsRepository.findByShipmentId(dto.shipment_id);

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
    const expiresAt = new Date(
      Date.now() + PENDING_TIMEOUT_MINUTES * 60 * 1000,
    ).toISOString();
    const { data: payment, error: paymentError } =
      await this.paymentsRepository.createPayment({
        shipment_id: dto.shipment_id,
        customer_id: customerId,
        company_id: shipment.company_id,
        amount: shipment.final_price,
        currency: 'TRY',
        provider: this.paymentProvider.name,
        expires_at: expiresAt,
      });

    if (paymentError || !payment) {
      this.logger.error(
        `[createCheckout] Failed to create payment: ${paymentError?.message}`,
      );
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
   * Process payment callback from provider (mock or shopier).
   * Full flow: event insert → signature check → idempotency → status update → audit log.
   */
  async processCallback(
    providerName: string,
    payload: any,
  ): Promise<{ ok: boolean; status: string }> {
    this.logger.log(
      `[processCallback] provider=${providerName}, platform_order_id=${payload.platform_order_id}`,
    );

    // 1) Resolve the correct provider for verification
    const provider = this.providerMap[providerName];
    if (!provider) {
      this.logger.error(`[processCallback] Unknown provider: ${providerName}`);
      return { ok: false, status: 'unknown_provider' };
    }

    // 2) Verify callback (signature etc.)
    const verification = await provider.verifyCallback({ payload });

    const { platformOrderId, providerPaymentId, status, signatureValid } =
      verification;

    // 3) Record the event (audit + idempotency)
    const eventKey =
      providerPaymentId ||
      `${platformOrderId}-${payload.random_nr || Date.now()}`;

    const { error: eventError } =
      await this.paymentsRepository.insertProviderEvent({
        provider: providerName,
        event_key: eventKey,
        platform_order_id: platformOrderId,
        provider_payment_id: providerPaymentId,
        status_raw: payload.status || 'unknown',
        signature_valid: signatureValid ?? true,
        payload,
      });

    // If duplicate event (unique constraint), return early — idempotent
    if (eventError?.code === '23505') {
      this.logger.log(`[processCallback] Duplicate event — no-op`);

      await this.paymentsRepository.insertAuditLog({
        action: 'DUPLICATE_EVENT',
        entity_type: 'payment',
        entity_id: null,
        meta: {
          provider: providerName,
          event_key: eventKey,
          platform_order_id: platformOrderId,
        },
      });

      // Find current payment state to return
      const { data: existingPayment } =
        await this.paymentsRepository.findByPlatformOrderId(platformOrderId);

      return { ok: true, status: existingPayment?.status || 'duplicate' };
    }

    // 4) Signature invalid → audit log, don't touch payment, return 200
    if (!verification.ok || signatureValid === false) {
      this.logger.warn(
        `[processCallback] Signature invalid for ${platformOrderId}`,
      );

      await this.paymentsRepository.insertAuditLog({
        action: 'SIGNATURE_INVALID',
        entity_type: 'payment',
        entity_id: null,
        meta: {
          provider: providerName,
          platform_order_id: platformOrderId,
          provider_payment_id: providerPaymentId,
        },
      });

      // Return 200 to prevent retry spam from provider
      return { ok: false, status: 'signature_invalid' };
    }

    // 5) Find payment by platform_order_id
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

    // 6) Provider mismatch detection
    if (payment.provider !== providerName) {
      this.logger.warn(
        `[processCallback] Provider mismatch: row.provider=${payment.provider}, callback provider=${providerName}`,
      );
      throw new ConflictException(
        `Provider mismatch: payment was created with provider '${payment.provider}' but callback arrived for '${providerName}'`,
      );
    }

    // 7) Idempotent: if already paid/failed, don't change
    if (payment.status === 'paid' || payment.status === 'failed') {
      this.logger.log(
        `[processCallback] Payment already in terminal state: ${payment.status}`,
      );
      return { ok: true, status: payment.status };
    }

    // 8) Update payment status
    const updates: any = {
      status,
      callback_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
      updates.provider_payment_id = providerPaymentId || null;
      if (verification.installment) {
        updates.installment = verification.installment;
      }
    } else {
      updates.failure_message =
        payload.error_message || 'provider_status_not_success';
      updates.failed_reason =
        payload.error_message || 'provider_status_not_success';
    }

    const { error: updateError } =
      await this.paymentsRepository.updatePaymentStatus(payment.id, updates);

    if (updateError) {
      this.logger.error(
        `[processCallback] Failed to update payment: ${updateError.message}`,
      );
      throw new BadGatewayException('Failed to update payment');
    }

    // 9) Audit log
    const auditAction = status === 'paid' ? 'PAYMENT_PAID' : 'PAYMENT_FAILED';
    await this.paymentsRepository.insertAuditLog({
      action: auditAction,
      entity_type: 'payment',
      entity_id: payment.id,
      meta: {
        provider: providerName,
        provider_payment_id: providerPaymentId,
        platform_order_id: platformOrderId,
        amount: payment.amount,
        currency: payment.currency,
        installment: verification.installment,
      },
    });

    // 10) If paid, credit company wallet (automatic, immediate)
    if (status === 'paid') {
      try {
        const walletResult = await this.creditCompanyWallet(payment.id);
        if (!walletResult.ok) {
          this.logger.warn(
            `[processCallback] Wallet credit failed for payment_id=${payment.id}: ${walletResult.error}`,
          );

          await this.paymentsRepository.insertAuditLog({
            action: 'WALLET_CREDIT_FAILED',
            entity_type: 'payment',
            entity_id: payment.id,
            meta: {
              error: walletResult.error,
              already_credited: walletResult.already_credited,
            },
          });
        } else {
          this.logger.log(
            `[processCallback] Wallet credited: payment_id=${payment.id}, amount=${walletResult.amount}, new_balance=${walletResult.new_balance}`,
          );

          await this.paymentsRepository.insertAuditLog({
            action: 'WALLET_CREDITED',
            entity_type: 'payment',
            entity_id: payment.id,
            meta: {
              wallet_id: walletResult.wallet_id,
              amount: walletResult.amount,
              new_balance: walletResult.new_balance,
              already_credited: walletResult.already_credited,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `[processCallback] Exception during wallet credit: ${err}`,
        );
        // Don't throw — payment is already marked paid, we just log the wallet error
        await this.paymentsRepository.insertAuditLog({
          action: 'WALLET_CREDIT_EXCEPTION',
          entity_type: 'payment',
          entity_id: payment.id,
          meta: { error: String(err) },
        });
      }
    }

    this.logger.log(
      `[processCallback] Success: payment_id=${payment.id}, status=${status}`,
    );

    return { ok: true, status };
  }

  /**
   * Expire pending payments that have passed their timeout.
   * Called by cron job.
   */
  async expirePendingPayments(): Promise<number> {
    const { data: expired, error } =
      await this.paymentsRepository.findExpiredPendingPayments();

    if (error) {
      this.logger.error(`[expirePendingPayments] Error: ${error.message}`);
      return 0;
    }

    if (expired.length === 0) {
      return 0;
    }

    this.logger.log(
      `[expirePendingPayments] Found ${expired.length} expired payments`,
    );

    let count = 0;
    for (const payment of expired) {
      const { error: updateError } =
        await this.paymentsRepository.updatePaymentStatus(payment.id, {
          status: 'failed',
          failure_message: 'Payment timed out (pending too long)',
        });

      if (!updateError) {
        count++;
        await this.paymentsRepository.insertAuditLog({
          action: 'PAYMENT_FAILED',
          entity_type: 'payment',
          entity_id: payment.id,
          meta: {
            reason: 'timeout',
            provider: payment.provider,
            platform_order_id: payment.platform_order_id,
          },
        });
      }
    }

    this.logger.log(`[expirePendingPayments] Expired ${count} payments`);
    return count;
  }

  /**
   * Credit company wallet via RPC (called automatically on payment paid).
   * Idempotent — RPC checks if wallet_transaction already exists.
   */
  private async creditCompanyWallet(paymentId: number): Promise<{
    ok: boolean;
    wallet_id?: number;
    amount?: number;
    new_balance?: number;
    already_credited?: boolean;
    error?: string;
  }> {
    this.logger.log(`[creditCompanyWallet] payment_id=${paymentId}`);

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .rpc('credit_company_wallet_for_payment', { p_payment_id: paymentId });

      if (error) {
        this.logger.error(`[creditCompanyWallet] RPC error: ${error.message}`);
        return { ok: false, error: error.message };
      }

      if (!data || !data.ok) {
        return { ok: false, error: data?.error || 'unknown_error', ...data };
      }

      return data;
    } catch (err) {
      this.logger.error(`[creditCompanyWallet] Exception: ${err}`);
      return { ok: false, error: String(err) };
    }
  }
}
