import { Injectable, Logger } from '@nestjs/common';
import { PushProvider } from './push-provider';

/**
 * Mock Push Provider (testing).
 * Always succeeds and logs messages without actually sending.
 */
@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async sendToTokens(
    tokens: string[],
    message: { title: string; body: string; data?: Record<string, any> },
  ): Promise<{
    ok: boolean;
    sent: number;
    failed: number;
    invalidTokens: string[];
  }> {
    this.logger.log(`[MockPushProvider] Sending to ${tokens.length} tokens`);
    this.logger.log(`[MockPushProvider] Title: ${message.title}`);
    this.logger.log(`[MockPushProvider] Body: ${message.body}`);
    this.logger.log(`[MockPushProvider] Data: ${JSON.stringify(message.data)}`);

    // Simulate validation: treat tokens not starting with "ExponentPushToken" as invalid
    const validTokens = tokens.filter((t) => t.startsWith('ExponentPushToken'));
    const invalidTokens = tokens.filter((t) => !t.startsWith('ExponentPushToken'));

    return {
      ok: true,
      sent: validTokens.length,
      failed: 0,
      invalidTokens,
    };
  }
}
