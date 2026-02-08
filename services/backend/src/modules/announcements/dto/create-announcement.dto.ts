import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnnouncementDto {
  // Client bunu SET ETMEMELİ. Customer auth context / DB default'tan gelsin.
  @IsOptional()
  @IsEmpty()
  customer_id?: number;

  @IsString()
  pickup_location: string;

  @Type(() => Number)
  @IsNumber()
  pickup_lat: number;

  @Type(() => Number)
  @IsNumber()
  pickup_lng: number;

  @IsOptional()
  @IsString()
  pickup_city?: string;

  @IsString()
  delivery_location: string;

  @Type(() => Number)
  @IsNumber()
  delivery_lat: number;

  @Type(() => Number)
  @IsNumber()
  delivery_lng: number;

  @IsOptional()
  @IsString()
  delivery_city?: string;

  @IsString()
  cargo_type: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cargo_weight?: number;

  @IsOptional()
  @IsString()
  cargo_volume?: string;

  @IsOptional()
  @IsObject()
  cargo_dimensions?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  scheduled_date?: string;

  @IsOptional()
  @IsDateString()
  pickup_date?: string;

  @IsOptional()
  @IsDateString()
  delivery_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  budget_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  budget_max?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
