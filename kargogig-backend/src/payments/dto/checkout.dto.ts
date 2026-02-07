import { IsInt, IsPositive } from 'class-validator';

/**
 * DTO for creating a payment checkout session
 */
export class CreateCheckoutDto {
  @IsInt()
  @IsPositive()
  shipment_id: number;
}
