import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompleteRideDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsString()
  pod_signature?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pod_photos?: string[];
}
