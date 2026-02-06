import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CustomerCancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class DriverCancelDto {
  @IsString()
  @MaxLength(255)
  reason!: string;
}
