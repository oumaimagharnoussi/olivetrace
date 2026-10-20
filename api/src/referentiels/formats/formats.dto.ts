import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class CreateFormatDto {
  @IsString() @Length(1, 32)
  code: string;

  @IsString() @Length(1, 120)
  nom: string;

  @IsInt() @Min(1)
  contenanceMl: number;

  @IsOptional() @IsString() @MaxLength(60)
  materiau?: string;

  @IsOptional() @IsInt() @Min(1)
  unitesParCarton?: number;
}

export class UpdateFormatDto extends PartialType(CreateFormatDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
