import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class CreateVehicleDto {
  @IsUUID()
  @IsNotEmpty()
  company_id: string;

  @IsString()
  @IsNotEmpty()
  plate_number: string;

  @IsString()
  @IsNotEmpty()
  vehicle_type: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsNumber()
  @IsOptional()
  capacity_kg?: number;

  @IsNumber()
  @IsOptional()
  capacity_m3?: number;

  @IsUUID()
  @IsOptional()
  driver_id?: string;
}
