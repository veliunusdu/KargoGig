/**
 * Push notification provider interface.
 * Abstracts push notification delivery (Expo, FCM, etc.)
 */
export interface PushProvider {
  /**
   * Send push notification to multiple tokens.
   * @returns {ok, sent, failed, invalidTokens}
   */
  sendToTokens(
    tokens: string[],
    message: {
      title: string;
      body: string;
      data?: Record<string, any>;
    },
  ): Promise<{
    ok: boolean;
    sent: number;
    failed: number;
    invalidTokens: string[];
  }>;
}
