import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentStatusDto {
  @IsIn(['verified', 'rejected'])
  status: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
