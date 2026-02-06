import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { RidesService } from './rides.service';
import { EstimateRideDto } from './dto/estimate-ride.dto';
import { CustomerCancelDto, DriverCancelDto } from './dto/cancel-ride.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post('estimate')
  estimate(@Body() dto: EstimateRideDto) {
    return this.ridesService.estimate(dto);
  }

  /**
   * POST /rides/:id/cancel
   * Customer cancels an announcement/ride.
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/cancel')
  async customerCancel(
    @Param('id') id: string,
    @Body() dto: CustomerCancelDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.customerCancel(
      parseInt(id, 10),
      dto.reason ?? null,
      authHeader,
    );
  }

  /**
   * POST /rides/:id/driver-cancel
   * Driver cancels their assignment for an announcement/ride.
   * Triggers unassign + potential rebroadcast.
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/driver-cancel')
  async driverCancel(
    @Param('id') id: string,
    @Body() dto: DriverCancelDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.driverCancel(
      parseInt(id, 10),
      dto.reason,
      authHeader,
    );
  }
}
