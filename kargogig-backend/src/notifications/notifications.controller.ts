import {
  Controller,
  Post,
  Body,
  Req,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

/**
 * Controller for push notification token registration.
 * Endpoint: POST /me/push-tokens
 */
@Controller('me')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * POST /me/push-tokens
   * Register or update a push token for the authenticated user.
   */
  @Post('push-tokens')
  async registerPushToken(@Body() body: RegisterPushTokenDto, @Req() req: any) {
    // TODO: Add JWT auth guard
    // @UseGuards(JwtAuthGuard)
    // const userId = req.user?.sub;

    // Temporary: Extract user ID from request (mock auth for testing)
    const userId = req.user?.sub || req.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('User ID not found');
    }

    this.logger.log(
      `[registerPushToken] user_id=${userId}, platform=${body.platform}, token=${body.token.slice(0, 20)}...`,
    );

    const result = await this.notificationsService.registerPushToken(
      userId,
      body.token,
      body.platform,
      body.device_id,
    );

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
      };
    }

    return {
      ok: true,
      message: 'Push token registered successfully',
    };
  }
}
