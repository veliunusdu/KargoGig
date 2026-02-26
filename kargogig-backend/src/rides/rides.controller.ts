import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { RidesService } from './rides.service';
import { EstimateRideDto } from './dto/estimate-ride.dto';
import { CustomerCancelDto, DriverCancelDto } from './dto/cancel-ride.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { CompleteRideDto } from './dto/complete-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';


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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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

  /**
   * POST /rides/:id/arrive
   * Driver marks arrival at the pickup location.
   * Sets status='arrived', records arrived_at & wait_started_at.
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/arrive')
  @UseGuards(JwtAuthGuard)
  async arrive(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.arrive(parseInt(id, 10), authHeader);
  }

  /**
   * POST /rides/:id/start
   * Driver starts the ride (pickup cargo).
   * Sets status='in_progress', records picked_up_at.
   * Validates geo-fence (driver must be near pickup location).
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  async start(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.start(parseInt(id, 10), authHeader);
  }

  /**
   * POST /rides/:id/location
   * Driver updates their location during an active ride.
   * Updates driver_locations and inserts into shipment_tracking (rate-limited).
   * Returns ETA and whether a new tracking point was inserted.
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/location')
  @UseGuards(JwtAuthGuard)
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.updateLocation(
      parseInt(id, 10),
      dto.lat,
      dto.lng,
      authHeader,
    );
  }

  /**
   * POST /rides/:id/complete
   * Driver completes the delivery at dropoff location.
   * Validates geo-fence (driver must be near dropoff), calculates final price.
   * Sets status='completed', records delivered_at, optionally stores POD.
   * Requires user's JWT token for auth.uid() to work in RPC.
   */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteRideDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.complete(parseInt(id, 10), dto, authHeader);
  }

  /**
   * POST /rides/:id/pay
   * Customer initiates payment for a completed ride.
   * Creates a checkout session via the payment provider.
   * Requires customer's JWT token.
   */
  @Post(':id/pay')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async pay(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.pay(parseInt(id, 10), authHeader);
  }

  /**
   * POST /rides/:id/rate
   * Customer rates a completed ride (driver + company).
   * Inserts into ride_ratings table, triggers update averages.
   * Idempotent: duplicate ratings (same customer, same target) are silently ignored.
   * Requires customer's JWT token.
   */
  @Post(':id/rate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async rate(
    @Param('id') id: string,
    @Body() dto: RateRideDto,
    @Headers('authorization') authHeader: string,
  ) {
    return this.ridesService.rate(parseInt(id, 10), dto, authHeader);
  }
}
