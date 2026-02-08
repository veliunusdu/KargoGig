import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';

export enum OwnerType {
  COMPANY = 'company',
  DRIVER = 'driver',
  VEHICLE = 'vehicle',
}

export enum FileExtension {
  PDF = 'pdf',
  JPG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
}

export class CreateUploadUrlDto {
  @IsEnum(OwnerType)
  ownerType: OwnerType;

  @IsInt()
  ownerId: number;

  @IsString()
  @IsNotEmpty()
  documentType: string;

  @IsEnum(FileExtension)
  ext: FileExtension;
}
