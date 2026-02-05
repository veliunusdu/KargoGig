import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class LatLngDto {
  @IsNumber()
  @IsNotEmpty()
  lat!: number;

  @IsNumber()
  @IsNotEmpty()
  lng!: number;
}

export class EstimateRideDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  @IsNotEmpty()
  origin!: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  @IsNotEmpty()
  destination!: LatLngDto;

  @IsNumber()
  @IsPositive()
  companyId!: number;
}
