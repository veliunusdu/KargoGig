import {
  Controller,
  Post,
  Body,
  Req,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  async registerPushToken(@Body() body: RegisterPushTokenDto, @Req() req: any) {
    const userId = req.user.sub;

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
