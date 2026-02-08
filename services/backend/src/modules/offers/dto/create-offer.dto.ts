import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOfferDto {
  @IsInt()
  announcement_id: number;

  @IsInt()
  company_id: number;

  @IsOptional()
  @IsInt()
  driver_id?: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  estimated_delivery?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
