import { IsNumber, Min, Max } from 'class-validator';
import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX } from '../constants/drivers.constants';

/**
 * DTO for updating driver's own location
 * Used with PATCH /drivers/location
 */
export class UpdateDriverLocationDto {
  @IsNumber({}, { message: 'lat must be a valid number' })
  @Min(LAT_MIN, { message: `lat must be at least ${LAT_MIN}` })
  @Max(LAT_MAX, { message: `lat must be at most ${LAT_MAX}` })
  lat!: number;

  @IsNumber({}, { message: 'lng must be a valid number' })
  @Min(LNG_MIN, { message: `lng must be at least ${LNG_MIN}` })
  @Max(LNG_MAX, { message: `lng must be at most ${LNG_MAX}` })
  lng!: number;
}
