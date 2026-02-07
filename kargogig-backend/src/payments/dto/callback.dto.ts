import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * DTO for payment callback from provider (mock, shopier, etc.)
 */
export class PaymentCallbackDto {
  @IsString()
  platform_order_id: string;

  @IsIn(['success', 'failed'])
  status: 'success' | 'failed';

  @IsOptional()
  @IsString()
  provider_payment_id?: string;

  @IsOptional()
  @IsString()
  error_message?: string;
}
