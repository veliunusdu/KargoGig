import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { PushProvider } from './providers/push-provider';
import { ExpoPushGateway } from './providers/expo-push.gateway';
import { MockPushProvider } from './providers/mock-push.provider';

/**
 * Notification types for shipment lifecycle events.
 */
export enum NotificationType {
  SHIPMENT_ACCEPTED = 'shipment_accepted',
  SHIPMENT_ARRIVED = 'shipment_arrived',
  SHIPMENT_STARTED = 'shipment_started',
  SHIPMENT_COMPLETED = 'shipment_completed',
  SHIPMENT_CANCELLED = 'shipment_cancelled',
}

/**
 * Service for handling push notifications.
 * Flow: Insert notification row → Fetch user tokens → Send push → Mark invalid tokens.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pushProvider: PushProvider;

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly expoPushGateway: ExpoPushGateway,
    private readonly mockPushProvider: MockPushProvider,
  ) {
    // Use mock provider in test/dev, Expo in production
    const provider = process.env.PUSH_PROVIDER || 'mock';
    this.pushProvider = provider === 'expo' ? expoPushGateway : mockPushProvider;
    this.logger.log(`[NotificationsService] Using push provider: ${provider}`);
  }

  /**
   * Register or update a push token for a user.
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web',
    deviceId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    this.logger.log(`[registerPushToken] user_id=${userId}, platform=${platform}`);

    const { data, error } = await this.notificationsRepository.upsertPushToken(
      userId,
      token,
      platform,
      deviceId,
    );

    if (error) {
      this.logger.error(`[registerPushToken] Failed: ${error.message}`);
      return { ok: false, error: error.message };
    }

    this.logger.log(`[registerPushToken] Success: token_id=${data?.id}`);
    return { ok: true };
  }

  /**
   * Send notification to a customer (by customer_id).
   */
  async notifyCustomer(
    customerId: number,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<{ ok: boolean; sent: number }> {
    this.logger.log(`[notifyCustomer] customer_id=${customerId}, type=${type}`);

    // 1) Resolve user_id from customer_id
    const { data: userId, error: userError } =
      await this.notificationsRepository.getUserIdByCustomerId(customerId);

    if (userError || !userId) {
      this.logger.error(`[notifyCustomer] Customer not found: ${customerId}`);
      return { ok: false, sent: 0 };
    }

    // 2) Insert notification row (audit trail)
    const { error: notifError } = await this.notificationsRepository.insertNotification({
      user_id: userId,
      type,
      title,
      message,
      reference_type: data?.reference_type,
      reference_id: data?.reference_id,
    });

    if (notifError) {
      this.logger.error(`[notifyCustomer] Failed to insert notification: ${notifError.message}`);
    }

    // 3) Fetch active push tokens
    const { data: tokens, error: tokensError } =
      await this.notificationsRepository.getActiveTokensByUserId(userId);

    if (tokensError || tokens.length === 0) {
      this.logger.warn(`[notifyCustomer] No active tokens for user_id=${userId}`);
      return { ok: true, sent: 0 };
    }

    // 4) Send push notification
    const result = await this.pushProvider.sendToTokens(tokens, {
      title,
      body: message,
      data: data ?? {},
    });

    // 5) Mark invalid tokens as inactive
    if (result.invalidTokens.length > 0) {
      await this.notificationsRepository.markTokensInactive(result.invalidTokens);
    }

    // 6) Audit log
    await this.notificationsRepository.insertAuditLog({
      action: 'NOTIFICATION_SENT',
      entity_type: 'customer',
      entity_id: customerId,
      meta: {
        type,
        sent: result.sent,
        failed: result.failed,
        invalidTokens: result.invalidTokens.length,
      },
    });

    this.logger.log(
      `[notifyCustomer] Sent: ${result.sent}, Failed: ${result.failed}, Invalid: ${result.invalidTokens.length}`,
    );

    return { ok: true, sent: result.sent };
  }

  /**
   * Send notification to a driver (by driver_id).
   */
  async notifyDriver(
    driverId: number,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<{ ok: boolean; sent: number }> {
    this.logger.log(`[notifyDriver] driver_id=${driverId}, type=${type}`);

    // 1) Resolve user_id from driver_id
    const { data: userId, error: userError } =
      await this.notificationsRepository.getUserIdByDriverId(driverId);

    if (userError || !userId) {
      this.logger.error(`[notifyDriver] Driver not found: ${driverId}`);
      return { ok: false, sent: 0 };
    }

    // 2) Insert notification row
    const { error: notifError } = await this.notificationsRepository.insertNotification({
      user_id: userId,
      type,
      title,
      message,
      reference_type: data?.reference_type,
      reference_id: data?.reference_id,
    });

    if (notifError) {
      this.logger.error(`[notifyDriver] Failed to insert notification: ${notifError.message}`);
    }

    // 3) Fetch active push tokens
    const { data: tokens, error: tokensError } =
      await this.notificationsRepository.getActiveTokensByUserId(userId);

    if (tokensError || tokens.length === 0) {
      this.logger.warn(`[notifyDriver] No active tokens for user_id=${userId}`);
      return { ok: true, sent: 0 };
    }

    // 4) Send push notification
    const result = await this.pushProvider.sendToTokens(tokens, {
      title,
      body: message,
      data: data ?? {},
    });

    // 5) Mark invalid tokens as inactive
    if (result.invalidTokens.length > 0) {
      await this.notificationsRepository.markTokensInactive(result.invalidTokens);
    }

    // 6) Audit log
    await this.notificationsRepository.insertAuditLog({
      action: 'NOTIFICATION_SENT',
      entity_type: 'driver',
      entity_id: driverId,
      meta: {
        type,
        sent: result.sent,
        failed: result.failed,
        invalidTokens: result.invalidTokens.length,
      },
    });

    this.logger.log(
      `[notifyDriver] Sent: ${result.sent}, Failed: ${result.failed}, Invalid: ${result.invalidTokens.length}`,
    );

    return { ok: true, sent: result.sent };
  }

  /**
   * Shipment accepted hook (notifies customer + driver).
   */
  async onShipmentAccepted(shipmentId: number, customerId: number, driverId: number): Promise<void> {
    this.logger.log(`[onShipmentAccepted] shipment_id=${shipmentId}`);

    // Notify customer
    await this.notifyCustomer(
      customerId,
      NotificationType.SHIPMENT_ACCEPTED,
      'Shipment Accepted',
      'Your shipment has been accepted by a driver!',
      { reference_type: 'shipment', reference_id: shipmentId },
    );

    // Optional: Notify driver (if needed)
    // await this.notifyDriver(
    //   driverId,
    //   NotificationType.SHIPMENT_ACCEPTED,
    //   'New Shipment',
    //   'You have been assigned a new shipment.',
    //   { reference_type: 'shipment', reference_id: shipmentId },
    // );
  }

  /**
   * Shipment arrived hook (driver arrived at pickup).
   */
  async onShipmentArrived(shipmentId: number, customerId: number): Promise<void> {
    this.logger.log(`[onShipmentArrived] shipment_id=${shipmentId}`);

    await this.notifyCustomer(
      customerId,
      NotificationType.SHIPMENT_ARRIVED,
      'Driver Arrived',
      'Your driver has arrived at the pickup location.',
      { reference_type: 'shipment', reference_id: shipmentId },
    );
  }

  /**
   * Shipment started hook (cargo picked up).
   */
  async onShipmentStarted(shipmentId: number, customerId: number): Promise<void> {
    this.logger.log(`[onShipmentStarted] shipment_id=${shipmentId}`);

    await this.notifyCustomer(
      customerId,
      NotificationType.SHIPMENT_STARTED,
      'Shipment Started',
      'Your cargo has been picked up and is on the way!',
      { reference_type: 'shipment', reference_id: shipmentId },
    );
  }

  /**
   * Shipment completed hook (cargo delivered).
   */
  async onShipmentCompleted(shipmentId: number, customerId: number): Promise<void> {
    this.logger.log(`[onShipmentCompleted] shipment_id=${shipmentId}`);

    await this.notifyCustomer(
      customerId,
      NotificationType.SHIPMENT_COMPLETED,
      'Shipment Completed',
      'Your cargo has been delivered successfully!',
      { reference_type: 'shipment', reference_id: shipmentId },
    );
  }

  /**
   * Shipment cancelled hook (driver or customer cancelled).
   */
  async onShipmentCancelled(shipmentId: number, customerId: number, reason?: string): Promise<void> {
    this.logger.log(`[onShipmentCancelled] shipment_id=${shipmentId}, reason=${reason}`);

    await this.notifyCustomer(
      customerId,
      NotificationType.SHIPMENT_CANCELLED,
      'Shipment Cancelled',
      reason || 'Your shipment has been cancelled.',
      { reference_type: 'shipment', reference_id: shipmentId },
    );
  }
}
