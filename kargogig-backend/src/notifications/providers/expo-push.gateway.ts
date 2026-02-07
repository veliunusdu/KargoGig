import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PushProvider } from './push-provider';

/**
 * Expo Push Notification Gateway (production).
 * Uses expo-server-sdk to send push notifications via Expo's infrastructure.
 */
@Injectable()
export class ExpoPushGateway implements PushProvider {
  private readonly logger = new Logger(ExpoPushGateway.name);
  private readonly expo: Expo;

  constructor() {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    this.expo = new Expo({ accessToken });
    this.logger.log(`[ExpoPushGateway] Initialized (accessToken: ${accessToken ? 'set' : 'not set'})`);
  }

  async sendToTokens(
    tokens: string[],
    message: { title: string; body: string; data?: Record<string, any> },
  ): Promise<{
    ok: boolean;
    sent: number;
    failed: number;
    invalidTokens: string[];
  }> {
    this.logger.log(`[sendToTokens] Sending to ${tokens.length} tokens`);

    // Filter valid Expo push tokens
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    const invalidTokens: string[] = tokens.filter((t) => !Expo.isExpoPushToken(t));

    if (invalidTokens.length > 0) {
      this.logger.warn(`[sendToTokens] Invalid tokens: ${invalidTokens.join(', ')}`);
    }

    if (validTokens.length === 0) {
      this.logger.warn(`[sendToTokens] No valid tokens, skipping`);
      return { ok: true, sent: 0, failed: 0, invalidTokens };
    }

    // Build Expo push messages
    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));

    // Chunk messages (Expo API limit: 100 messages per request)
    const chunks = this.expo.chunkPushNotifications(messages);
    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);

        tickets.forEach((ticket, idx) => {
          if (ticket.status === 'ok') {
            sent++;
          } else {
            failed++;
            this.logger.error(
              `[sendToTokens] Ticket error for token ${chunk[idx].to}: ${ticket.message}`,
            );

            // Track as invalid if device token issue (e.g., DeviceNotRegistered)
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[idx].to as string);
            }
          }
        });

        // TODO (advanced): Store ticket.id in DB for receipt checking
        // Expo receipts: check if notification was actually delivered
      } catch (error: any) {
        this.logger.error(`[sendToTokens] Chunk failed: ${error.message}`);
        failed += chunk.length;
      }
    }

    this.logger.log(`[sendToTokens] Sent: ${sent}, Failed: ${failed}, Invalid: ${invalidTokens.length}`);

    return { ok: true, sent, failed, invalidTokens };
  }
}
