import { Body, Controller, Post } from '@nestjs/common';
import { RidesService } from './rides.service';
import { EstimateRideDto } from './dto/estimate-ride.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post('estimate')
  estimate(@Body() dto: EstimateRideDto) {
    return this.ridesService.estimate(dto);
  }
}
