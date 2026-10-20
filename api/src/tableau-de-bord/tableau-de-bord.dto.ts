import { IsISO8601, IsOptional } from 'class-validator';

export class RapportsQueryDto {
  @IsOptional()
  @IsISO8601()
  du?: string;

  @IsOptional()
  @IsISO8601()
  au?: string;
}
