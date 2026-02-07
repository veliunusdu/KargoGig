import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO for rating a ride.
 * POST /rides/:id/rate
 */
export class RateRideDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  driver_rating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  company_rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
