import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  LAT_MIN,
  LAT_MAX,
  LNG_MIN,
  LNG_MAX,
  NEARBY_DRIVERS_DEFAULT_RADIUS_M,
  NEARBY_DRIVERS_MIN_RADIUS_M,
  NEARBY_DRIVERS_MAX_RADIUS_M,
  NEARBY_DRIVERS_DEFAULT_LIMIT,
  NEARBY_DRIVERS_MIN_LIMIT,
  NEARBY_DRIVERS_MAX_LIMIT,
} from '../constants/drivers.constants';

/**
 * DTO for querying nearby drivers
 * Used with GET /drivers/nearby
 */
export class NearbyDriversQueryDto {
  @Transform(({ value }: TransformFnParams) => parseFloat(String(value)))
  @IsNumber({}, { message: 'lat must be a valid number' })
  @Min(LAT_MIN, { message: `lat must be at least ${LAT_MIN}` })
  @Max(LAT_MAX, { message: `lat must be at most ${LAT_MAX}` })
  lat!: number;

  @Transform(({ value }: TransformFnParams) => parseFloat(String(value)))
  @IsNumber({}, { message: 'lng must be a valid number' })
  @Min(LNG_MIN, { message: `lng must be at least ${LNG_MIN}` })
  @Max(LNG_MAX, { message: `lng must be at most ${LNG_MAX}` })
  lng!: number;

  @Transform(({ value }: TransformFnParams) =>
    value != null ? parseFloat(String(value)) : NEARBY_DRIVERS_DEFAULT_RADIUS_M,
  )
  @IsNumber({}, { message: 'radius must be a valid number' })
  @IsOptional()
  @Min(NEARBY_DRIVERS_MIN_RADIUS_M, { message: `radius must be at least ${NEARBY_DRIVERS_MIN_RADIUS_M}m` })
  @Max(NEARBY_DRIVERS_MAX_RADIUS_M, { message: `radius must be at most ${NEARBY_DRIVERS_MAX_RADIUS_M}m` })
  radius: number = NEARBY_DRIVERS_DEFAULT_RADIUS_M;

  @Transform(({ value }: TransformFnParams) =>
    value != null ? parseInt(String(value), 10) : NEARBY_DRIVERS_DEFAULT_LIMIT,
  )
  @IsNumber({}, { message: 'limit must be a valid number' })
  @IsOptional()
  @Min(NEARBY_DRIVERS_MIN_LIMIT, { message: `limit must be at least ${NEARBY_DRIVERS_MIN_LIMIT}` })
  @Max(NEARBY_DRIVERS_MAX_LIMIT, { message: `limit must be at most ${NEARBY_DRIVERS_MAX_LIMIT}` })
  limit: number = NEARBY_DRIVERS_DEFAULT_LIMIT;
}
