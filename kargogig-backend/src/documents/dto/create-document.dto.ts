import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { OwnerType } from './create-upload-url.dto';

export class CreateDocumentDto {
  @IsEnum(OwnerType)
  owner_type: OwnerType;

  @IsInt()
  owner_id: number;

  @IsString()
  @IsNotEmpty()
  document_type: string;

  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
