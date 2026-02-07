import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for Shopier callback (form-urlencoded POST).
 *
 * Shopier sends these fields via x-www-form-urlencoded.
 * We disable whitelist / forbidNonWhitelisted at the endpoint level
 * so extra fields from Shopier don't cause 400.
 */
export class ShopierCallbackDto {
  @IsString()
  platform_order_id: string;

  @IsString()
  status: string; // 'success' | anything else

  @IsString()
  payment_id: string; // Shopier's unique payment identifier

  @IsOptional()
  @IsString()
  installment?: string;

  @IsString()
  random_nr: string;

  @IsString()
  total_order_value: string; // e.g. "150.00"

  @IsString()
  currency: string; // e.g. "TRY"

  @IsString()
  signature: string; // base64-encoded HMAC-SHA256
}
