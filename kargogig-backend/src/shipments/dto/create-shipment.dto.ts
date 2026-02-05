import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsEnum, IsDateString } from 'class-validator';

export class CreateShipmentDto {
  @IsUUID()
  @IsNotEmpty()
  customer_id: string;

  @IsUUID()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsNotEmpty()
  pickup_address: string;

  @IsString()
  @IsNotEmpty()
  delivery_address: string;

  @IsNumber()
  @IsOptional()
  weight_kg?: number;

  @IsNumber()
  @IsOptional()
  volume_m3?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  pickup_date?: string;

  @IsDateString()
  @IsOptional()
  delivery_date?: string;

  @IsUUID()
  @IsOptional()
  driver_id?: string;

  @IsUUID()
  @IsOptional()
  vehicle_id?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
