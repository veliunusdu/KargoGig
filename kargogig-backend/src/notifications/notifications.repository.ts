import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserPushToken {
  id: number;
  user_id: string;
  token: string;
  platform: string;
  device_id?: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: number;
  is_read: boolean;
  created_at: string;
}

/**
 * Repository for notifications and push tokens.
 */
@Injectable()
export class NotificationsRepository {
  private readonly logger = new Logger(NotificationsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Upsert push token (token UNIQUE → update user_id + is_active=true + last_seen_at=now()).
   */
  async upsertPushToken(
    userId: string,
    token: string,
    platform: string,
    deviceId?: string,
  ): Promise<{ data: UserPushToken | null; error: any }> {
    this.logger.log(
      `[upsertPushToken] user_id=${userId}, token=${token.slice(0, 20)}...`,
    );

    const { data, error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          device_id: deviceId,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'token',
          ignoreDuplicates: false, // Always update
        },
      )
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get all active push tokens for a user.
   */
  async getActiveTokensByUserId(
    userId: string,
  ): Promise<{ data: string[]; error: any }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) return { data: [], error };

    return { data: data.map((row) => row.token), error: null };
  }

  /**
   * Mark tokens as inactive (e.g., after Expo returns "DeviceNotRegistered").
   */
  async markTokensInactive(tokens: string[]): Promise<{ error: any }> {
    if (tokens.length === 0) return { error: null };

    this.logger.warn(
      `[markTokensInactive] Marking ${tokens.length} tokens as inactive`,
    );

    const { error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .update({ is_active: false })
      .in('token', tokens);

    return { error };
  }

  /**
   * Insert notification row (audit trail).
   */
  async insertNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    reference_type?: string;
    reference_id?: number;
  }): Promise<{ data: Notification | null; error: any }> {
    this.logger.log(
      `[insertNotification] user_id=${data.user_id}, type=${data.type}`,
    );

    const { data: notification, error } = await this.supabase
      .getClient()
      .from('notifications')
      .insert(data)
      .select()
      .single();

    return { data: notification, error };
  }

  /**
   * Get user ID by customer ID (for notification targeting).
   */
  async getUserIdByCustomerId(
    customerId: number,
  ): Promise<{ data: string | null; error: any }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .single();

    return { data: data?.user_id ?? null, error };
  }

  /**
   * Get user ID by driver ID (for notification targeting).
   */
  async getUserIdByDriverId(
    driverId: number,
  ): Promise<{ data: string | null; error: any }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .select('user_id')
      .eq('id', driverId)
      .single();

    return { data: data?.user_id ?? null, error };
  }

  /**
   * Insert audit log for notification events.
   */
  async insertAuditLog(data: {
    action: string;
    entity_type: string;
    entity_id: number;
    meta?: Record<string, any>;
  }): Promise<void> {
    await this.supabase
      .getClient()
      .from('audit_logs')
      .insert({
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        meta: data.meta ?? {},
        created_at: new Date().toISOString(),
      });
  }
}
