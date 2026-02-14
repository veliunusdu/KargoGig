import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

export interface PaymentRefund {
  id: number;
  payment_id: number;
  refund_type: string;
  status: string;
  amount_gross: number;
  amount_company_debit: number;
  amount_platform_fee_reversed: number;
  commission_rate: number;
  currency: string;
  provider: string;
  provider_refund_id: string | null;
  idempotency_key: string | null;
  reason: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface Payment {
  id: number;
  shipment_id: number | null;
  customer_id: number | null;
  company_id: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  platform_order_id: string;
  paid_at: string | null;
}

/**
 * Repository for refund-related database operations.
 */
@Injectable()
export class RefundsRepository {
  private readonly logger = new Logger(RefundsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get serviceClient(): SupabaseClient {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Find payment by ID
   */
  async findPaymentById(
    paymentId: number,
  ): Promise<{ data: Payment | null; error: any }> {
    const { data, error } = await this.serviceClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    return { data: data as Payment | null, error };
  }

  /**
   * Get total refunded amount for a payment
   */
  async getTotalRefunded(
    paymentId: number,
  ): Promise<{ data: number; error: any }> {
    const { data, error } = await this.serviceClient
      .from('payment_refunds')
      .select('amount_gross')
      .eq('payment_id', paymentId)
      .eq('status', 'succeeded');

    if (error) return { data: 0, error };

    const total = (data || []).reduce(
      (sum, r: any) => sum + parseFloat(r.amount_gross),
      0,
    );
    return { data: total, error: null };
  }

  /**
   * Insert audit log
   */
  async insertAuditLog(log: {
    action: string;
    entity_type: string;
    entity_id: number | null;
    meta?: any;
  }): Promise<void> {
    this.logger.log(
      `[insertAuditLog] action=${log.action}, entity_id=${log.entity_id}`,
    );

    const { error } = await this.serviceClient.from('audit_logs').insert({
      action: log.action,
      table_name: log.entity_type,
      record_id: log.entity_id,
      new_data: log.meta || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`[insertAuditLog] Error: ${error.message}`);
    }
  }

  /**
   * Call RPC: refund_full_for_payment
   */
  async callRefundFullRpc(args: {
    p_payment_id: number;
    p_provider_refund_id: string;
    p_idempotency_key: string;
    p_reason?: string;
  }): Promise<{ data: any; error: any }> {
    this.logger.log(`[callRefundFullRpc] payment_id=${args.p_payment_id}`);

    const { data, error } = await this.serviceClient.rpc(
      'refund_full_for_payment',
      args,
    );

    return { data, error };
  }

  /**
   * Call RPC: refund_partial_for_payment
   */
  async callRefundPartialRpc(args: {
    p_payment_id: number;
    p_amount_gross: number;
    p_provider_refund_id: string;
    p_idempotency_key: string;
    p_reason?: string;
  }): Promise<{ data: any; error: any }> {
    this.logger.log(
      `[callRefundPartialRpc] payment_id=${args.p_payment_id}, amount=${args.p_amount_gross}`,
    );

    const { data, error } = await this.serviceClient.rpc(
      'refund_partial_for_payment',
      args,
    );

    return { data, error };
  }
}
