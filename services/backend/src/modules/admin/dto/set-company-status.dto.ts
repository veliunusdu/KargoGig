import { IsIn, IsOptional, IsString } from 'class-validator';

export class SetCompanyStatusDto {
  @IsIn(['pending', 'approved', 'suspended', 'rejected'])
  status: 'pending' | 'approved' | 'suspended' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}
