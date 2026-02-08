import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DeviceType {
  unknown = 'unknown',
  ios = 'ios',
  android = 'android',
  web = 'web',
}

export class GoOnlineDto {
  @IsOptional()
  @IsEnum(DeviceType)
  device_type?: DeviceType;

  @IsOptional()
  @IsString()
  device_token?: string;
}

export class GoOfflineDto {
  @IsOptional()
  @IsEnum(DeviceType)
  device_type?: DeviceType;
}
