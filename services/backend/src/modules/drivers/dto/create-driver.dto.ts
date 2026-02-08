import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';

/**
 * DTO for creating a new driver
 */
export class CreateDriverDto {
  @IsString()
  @IsNotEmpty({ message: 'user_id is required' })
  user_id!: string;

  @IsNumber()
  @IsOptional()
  company_id?: number;

  @IsString()
  @IsOptional()
  license_number?: string;
}
