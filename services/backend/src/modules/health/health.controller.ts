import { Controller, Get, Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('health')
export class HealthController {
  /**
   * GET /api/v1/health
   * Public health check — no auth required
   */
  @Get()
  health(@Req() req: any) {
    return {
      ok: true,
      version: process.env.APP_VERSION || 'dev',
      request_id: req.requestId || req.headers?.['x-request-id'] || 'unknown',
      ts: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/health/admin-ping
   * Admin-only health check
   */
  @Get('admin-ping')
  @UseGuards(AdminGuard)
  adminPing() {
    return { ok: true };
  }
}
