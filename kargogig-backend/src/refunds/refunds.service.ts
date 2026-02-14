import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { RefundsRepository } from './refunds.repository';
import { RefundProvider } from './providers/refund-provider';
import { MockRefundProvider } from './providers/mock-refund.provider';
import { ShopierRefundProvider } from './providers/shopier-refund.provider';

/**
 * Service layer for refund business logic.
 * Flow: Validate → Provider refund API → RPC (wallet debit + refund row) → Audit
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private readonly refundProviderMap: Record<string, RefundProvider>;

  constructor(
    private readonly refundsRepository: RefundsRepository,
    private readonly mockRefundProvider: MockRefundProvider,
    private readonly shopierRefundProvider: ShopierRefundProvider,
  ) {
    this.refundProviderMap = {
      mock: mockRefundProvider,
      shopier: shopierRefundProvider,
    };
  }

  /**
   * Request full refund for a payment.
   */
  async requestFullRefund(
    paymentId: number,
    idempotencyKey: string,
    reason?: string,
  ): Promise<{
    ok: boolean;
    refund_id?: number;
    amount_gross?: number;
    company_debit?: number;
    new_wallet_balance?: number;
    already_refunded?: boolean;
    error?: string;
  }> {
    this.logger.log(
      `[requestFullRefund] payment_id=${paymentId}, idempotency_key=${idempotencyKey}`,
    );

    // 1) Find payment
    const { data: payment, error: findError } =
      await this.refundsRepository.findPaymentById(paymentId);

    if (findError || !payment) {
      this.logger.error(`[requestFullRefund] Payment not found: ${paymentId}`);
      throw new NotFoundException('Payment not found');
    }

    // 2) Verify payment is paid
    if (payment.status !== 'paid') {
      this.logger.warn(
        `[requestFullRefund] Payment not paid: status=${payment.status}`,
      );
      throw new ConflictException(
        `Payment not paid (status: ${payment.status})`,
      );
    }

    // 3) Verify provider_payment_id exists
    if (!payment.provider_payment_id) {
      this.logger.error(
        `[requestFullRefund] Missing provider_payment_id for payment ${paymentId}`,
      );
      throw new BadRequestException('Missing provider_payment_id');
    }

    // 4) Get refund provider
    const refundProvider = this.refundProviderMap[payment.provider];
    if (!refundProvider) {
      this.logger.error(
        `[requestFullRefund] Unknown provider: ${payment.provider}`,
      );
      throw new BadGatewayException(
        `Unknown payment provider: ${payment.provider}`,
      );
    }

    // 5) Call provider refund API
    const providerResult = await refundProvider.requestFullRefund({
      paymentId,
      providerPaymentId: payment.provider_payment_id,
      amount: payment.amount,
      currency: payment.currency,
      reason,
    });

    if (!providerResult.ok) {
      this.logger.error(
        `[requestFullRefund] Provider refund failed: ${providerResult.error}`,
      );

      await this.refundsRepository.insertAuditLog({
        action: 'REFUND_FAILED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          type: 'full',
          provider: payment.provider,
          error: providerResult.error,
          idempotency_key: idempotencyKey,
        },
      });

      throw new BadGatewayException(
        `Provider refund failed: ${providerResult.error}`,
      );
    }

    const providerRefundId = providerResult.providerRefundId!;

    // 6) Call RPC: refund_full_for_payment
    const { data: rpcResult, error: rpcError } =
      await this.refundsRepository.callRefundFullRpc({
        p_payment_id: paymentId,
        p_provider_refund_id: providerRefundId,
        p_idempotency_key: idempotencyKey,
        p_reason: reason,
      });

    if (rpcError) {
      this.logger.error(`[requestFullRefund] RPC error: ${rpcError.message}`);
      throw new BadGatewayException(`RPC error: ${rpcError.message}`);
    }

    if (!rpcResult.ok) {
      this.logger.error(`[requestFullRefund] RPC failed: ${rpcResult.error}`);

      await this.refundsRepository.insertAuditLog({
        action: 'REFUND_FAILED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          type: 'full',
          error: rpcResult.error,
          provider_refund_id: providerRefundId,
          idempotency_key: idempotencyKey,
        },
      });

      // Map RPC errors to HTTP errors
      if (rpcResult.error === 'already_fully_refunded') {
        throw new ConflictException('Payment already fully refunded');
      } else if (rpcResult.error === 'insufficient_wallet_balance') {
        throw new ConflictException('Insufficient wallet balance for refund');
      } else {
        throw new BadGatewayException(`Refund failed: ${rpcResult.error}`);
      }
    }

    // 7) Audit log: SUCCESS
    await this.refundsRepository.insertAuditLog({
      action: 'REFUND_SUCCEEDED',
      entity_type: 'payment',
      entity_id: paymentId,
      meta: {
        type: 'full',
        refund_id: rpcResult.refund_id,
        amount_gross: rpcResult.amount_gross,
        company_debit: rpcResult.company_debit,
        provider_refund_id: providerRefundId,
        idempotency_key: idempotencyKey,
        already_refunded: rpcResult.already_refunded || false,
      },
    });

    // 8) Audit log: WALLET_REFUND_DEBITED
    if (!rpcResult.already_refunded) {
      await this.refundsRepository.insertAuditLog({
        action: 'WALLET_REFUND_DEBITED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          refund_id: rpcResult.refund_id,
          company_debit: rpcResult.company_debit,
          new_wallet_balance: rpcResult.new_wallet_balance,
        },
      });
    }

    this.logger.log(
      `[requestFullRefund] Success: refund_id=${rpcResult.refund_id}, already_refunded=${rpcResult.already_refunded}`,
    );

    return {
      ok: true,
      refund_id: rpcResult.refund_id,
      amount_gross: rpcResult.amount_gross,
      company_debit: rpcResult.company_debit,
      new_wallet_balance: rpcResult.new_wallet_balance,
      already_refunded: rpcResult.already_refunded || false,
    };
  }

  /**
   * Request partial refund for a payment.
   */
  async requestPartialRefund(
    paymentId: number,
    amount: number,
    idempotencyKey: string,
    reason?: string,
  ): Promise<{
    ok: boolean;
    refund_id?: number;
    amount_gross?: number;
    company_debit?: number;
    new_wallet_balance?: number;
    remaining_refundable?: number;
    already_refunded?: boolean;
    error?: string;
  }> {
    this.logger.log(
      `[requestPartialRefund] payment_id=${paymentId}, amount=${amount}, idempotency_key=${idempotencyKey}`,
    );

    // 1) Find payment
    const { data: payment, error: findError } =
      await this.refundsRepository.findPaymentById(paymentId);

    if (findError || !payment) {
      this.logger.error(
        `[requestPartialRefund] Payment not found: ${paymentId}`,
      );
      throw new NotFoundException('Payment not found');
    }

    // 2) Verify payment is paid
    if (payment.status !== 'paid') {
      this.logger.warn(
        `[requestPartialRefund] Payment not paid: status=${payment.status}`,
      );
      throw new ConflictException(
        `Payment not paid (status: ${payment.status})`,
      );
    }

    // 3) Verify provider_payment_id exists
    if (!payment.provider_payment_id) {
      this.logger.error(
        `[requestPartialRefund] Missing provider_payment_id for payment ${paymentId}`,
      );
      throw new BadRequestException('Missing provider_payment_id');
    }

    // 4) Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    // 5) Get refund provider
    const refundProvider = this.refundProviderMap[payment.provider];
    if (!refundProvider) {
      this.logger.error(
        `[requestPartialRefund] Unknown provider: ${payment.provider}`,
      );
      throw new BadGatewayException(
        `Unknown payment provider: ${payment.provider}`,
      );
    }

    // 6) Call provider refund API
    const providerResult = await refundProvider.requestPartialRefund({
      paymentId,
      providerPaymentId: payment.provider_payment_id,
      amount,
      currency: payment.currency,
      reason,
    });

    if (!providerResult.ok) {
      this.logger.error(
        `[requestPartialRefund] Provider refund failed: ${providerResult.error}`,
      );

      await this.refundsRepository.insertAuditLog({
        action: 'REFUND_FAILED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          type: 'partial',
          amount,
          provider: payment.provider,
          error: providerResult.error,
          idempotency_key: idempotencyKey,
        },
      });

      throw new BadGatewayException(
        `Provider refund failed: ${providerResult.error}`,
      );
    }

    const providerRefundId = providerResult.providerRefundId!;

    // 7) Call RPC: refund_partial_for_payment
    const { data: rpcResult, error: rpcError } =
      await this.refundsRepository.callRefundPartialRpc({
        p_payment_id: paymentId,
        p_amount_gross: amount,
        p_provider_refund_id: providerRefundId,
        p_idempotency_key: idempotencyKey,
        p_reason: reason,
      });

    if (rpcError) {
      this.logger.error(
        `[requestPartialRefund] RPC error: ${rpcError.message}`,
      );
      throw new BadGatewayException(`RPC error: ${rpcError.message}`);
    }

    if (!rpcResult.ok) {
      this.logger.error(
        `[requestPartialRefund] RPC failed: ${rpcResult.error}`,
      );

      await this.refundsRepository.insertAuditLog({
        action: 'REFUND_FAILED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          type: 'partial',
          amount,
          error: rpcResult.error,
          provider_refund_id: providerRefundId,
          idempotency_key: idempotencyKey,
        },
      });

      // Map RPC errors to HTTP errors
      if (rpcResult.error === 'over_refund') {
        throw new ConflictException(
          `Over-refund: requested ${amount}, remaining ${rpcResult.remaining}`,
        );
      } else if (rpcResult.error === 'already_fully_refunded') {
        throw new ConflictException('Payment already fully refunded');
      } else if (rpcResult.error === 'insufficient_wallet_balance') {
        throw new ConflictException('Insufficient wallet balance for refund');
      } else {
        throw new BadGatewayException(`Refund failed: ${rpcResult.error}`);
      }
    }

    // 8) Audit log: SUCCESS
    await this.refundsRepository.insertAuditLog({
      action: 'REFUND_SUCCEEDED',
      entity_type: 'payment',
      entity_id: paymentId,
      meta: {
        type: 'partial',
        refund_id: rpcResult.refund_id,
        amount_gross: rpcResult.amount_gross,
        company_debit: rpcResult.company_debit,
        provider_refund_id: providerRefundId,
        idempotency_key: idempotencyKey,
        remaining_refundable: rpcResult.remaining_refundable,
        already_refunded: rpcResult.already_refunded || false,
      },
    });

    // 9) Audit log: WALLET_REFUND_DEBITED
    if (!rpcResult.already_refunded) {
      await this.refundsRepository.insertAuditLog({
        action: 'WALLET_REFUND_DEBITED',
        entity_type: 'payment',
        entity_id: paymentId,
        meta: {
          refund_id: rpcResult.refund_id,
          company_debit: rpcResult.company_debit,
          new_wallet_balance: rpcResult.new_wallet_balance,
        },
      });
    }

    this.logger.log(
      `[requestPartialRefund] Success: refund_id=${rpcResult.refund_id}, remaining=${rpcResult.remaining_refundable}`,
    );

    return {
      ok: true,
      refund_id: rpcResult.refund_id,
      amount_gross: rpcResult.amount_gross,
      company_debit: rpcResult.company_debit,
      new_wallet_balance: rpcResult.new_wallet_balance,
      remaining_refundable: rpcResult.remaining_refundable,
      already_refunded: rpcResult.already_refunded || false,
    };
  }
}
