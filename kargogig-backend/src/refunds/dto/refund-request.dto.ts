import { IsIn, IsOptional, IsPositive, IsString, Min, ValidateIf } from 'class-validator';

/**
 * DTO for payment refund request.
 */
export class RefundRequestDto {
  @IsIn(['full', 'partial'])
  type: 'full' | 'partial';

  @ValidateIf((o) => o.type === 'partial')
  @IsPositive()
  @Min(0.01)
  amount?: number;

  @IsString()
  idempotency_key: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
