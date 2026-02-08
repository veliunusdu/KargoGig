import { Controller, Param, Post, Query } from '@nestjs/common';
import { MatchingService } from './matching.service';

@Controller('announcements')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  /**
   * POST /api/v1/announcements/:id/match
   * (global prefix 'api/v1' + controller 'announcements')
   * Query params (optional):
   * - radius_meters (default 5000)
   * - limit (default 20)
   */
  @Post(':id/match')
  async matchAnnouncement(
    @Param('id') id: string,
    @Query('radius_meters') radiusMeters?: string,
    @Query('limit') limit?: string,
  ) {
    const announcementId = Number(id);
    if (!Number.isFinite(announcementId)) {
      return {
        ok: false,
        error: 'Invalid announcement id',
      };
    }

    const radius = radiusMeters ? Number(radiusMeters) : 5000;
    const lim = limit ? Number(limit) : 20;

    const result = await this.matchingService.matchAnnouncement(announcementId, {
      radius_meters: Number.isFinite(radius) ? radius : 5000,
      limit: Number.isFinite(lim) ? lim : 20,
    });

    return {
      ok: true,
      ...result,
    };
  }
}
