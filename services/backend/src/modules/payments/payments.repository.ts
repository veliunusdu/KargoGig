import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { getCtx } from '../observability/request-context.js';

export interface Payment {
  id: number;
  shipment_id: number;
  customer_id: number;
  company_id: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  platform_order_id: string;
  provider_payment_id: string | null;
  paid_at: string | null;
  failure_message: string | null;
  callback_payload: any;
  created_at: string;
  updated_at: string;
}

/**
 * Repository layer for payment-related database operations
 */
@Injectable()
export class PaymentsRepository {
  private readonly logger = new Logger(PaymentsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get service role client (RLS bypass)
   */
  private get serviceClient(): SupabaseClient {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Get user-scoped client (RLS enforced)
   */
  private getUserClient(token: string): SupabaseClient {
    return this.supabaseService.asUser(token);
  }

  /**
   * Create a new payment record
   */
  async createPayment(data: {
    shipment_id: number;
    customer_id: number;
    company_id: number;
    amount: number;
    currency: string;
    provider: string;
    expires_at?: string;
  }): Promise<{ data: Payment | null; error: Error | null }> {
    this.logger.log(
      `[createPayment] shipment_id=${data.shipment_id}, amount=${data.amount}`,
    );

    const { data: result, error } = await this.serviceClient
      .from('payments')
      .insert({
        ...data,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`[createPayment] Error: ${error.message}`);
    }

    return { data: result as Payment | null, error };
  }

  /**
   * Find payment by platform_order_id (for callback processing)
   */
  async findByPlatformOrderId(
    platformOrderId: string,
  ): Promise<{ data: Payment | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from('payments')
      .select('*')
      .eq('platform_order_id', platformOrderId)
      .single();

    return { data: data as Payment | null, error };
  }

  /**
   * Update payment status (idempotent)
   */
  async updatePaymentStatus(
    id: number,
    updates: {
      status: 'paid' | 'failed';
      provider_payment_id?: string;
      paid_at?: string;
      failure_message?: string;
      callback_payload?: any;
    },
  ): Promise<{ data: Payment | null; error: Error | null }> {
    this.logger.log(`[updatePaymentStatus] payment_id=${id}, status=${updates.status}`);

    const { data, error } = await this.serviceClient
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`[updatePaymentStatus] Error: ${error.message}`);
    }

    return { data: data as Payment | null, error };
  }

  /**
   * Find payment by shipment_id
   */
  async findByShipmentId(
    shipmentId: number,
  ): Promise<{ data: Payment | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from('payments')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return { data: data as Payment | null, error };
  }

  /**
   * Insert a payment_provider_events row (audit + idempotency).
   * Returns { data, error }. If unique constraint fires, error.code === '23505'.
   */
  async insertProviderEvent(event: {
    provider: string;
    event_key: string;
    platform_order_id: string;
    provider_payment_id?: string;
    status_raw: string;
    signature_valid: boolean;
    payload: any;
  }): Promise<{ data: any; error: any }> {
    this.logger.log(
      `[insertProviderEvent] provider=${event.provider}, event_key=${event.event_key}`,
    );

    const { data, error } = await this.serviceClient
      .from('payment_provider_events')
      .insert({
        ...event,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation → duplicate event, not a real error
      if (error.code === '23505') {
        this.logger.log(`[insertProviderEvent] Duplicate event_key=${event.event_key}`);
      } else {
        this.logger.error(`[insertProviderEvent] Error: ${error.message}`);
      }
    }

    return { data, error };
  }

  /**
   * Insert an audit_logs row for payment actions.
   * Automatically includes request_id from AsyncLocalStorage context.
   */
  async insertAuditLog(log: {
    action: string;
    entity_type: string;
    entity_id: number | null;
    meta?: any;
  }): Promise<void> {
    this.logger.log(`[insertAuditLog] action=${log.action}, entity_id=${log.entity_id}`);

    const ctx = getCtx();

    const { error } = await this.serviceClient.from('audit_logs').insert({
      action: log.action,
      table_name: log.entity_type,
      record_id: log.entity_id,
      new_data: log.meta || {},
      request_id: ctx.requestId,
      created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`[insertAuditLog] Error: ${error.message}`);
    }
  }

  /**
   * Find all pending payments whose expires_at has passed (for timeout cron).
   */
  async findExpiredPendingPayments(): Promise<{ data: Payment[]; error: any }> {
    const { data, error } = await this.serviceClient
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null);

    return { data: (data as Payment[]) || [], error };
  }
}
