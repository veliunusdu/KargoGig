import { IsString, IsIn, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * DTO for registering a push token.
 * POST /me/push-tokens
 */
export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';

  @IsString()
  @IsOptional()
  device_id?: string;
}
