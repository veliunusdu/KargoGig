import { IsIn, IsOptional, IsString } from 'class-validator';

export class ForceShipmentStatusDto {
  @IsIn([
    'pending',
    'assigned',
    'picked_up',
    'in_transit',
    'arrived',
    'delivered',
    'cancelled',
    'failed',
  ])
  status:
    | 'pending'
    | 'assigned'
    | 'picked_up'
    | 'in_transit'
    | 'arrived'
    | 'delivered'
    | 'cancelled'
    | 'failed';

  @IsOptional()
  @IsString()
  notes?: string;
}
