import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateHuilerieDto {
  @IsString() @Length(1, 32)
  code: string;

  @IsString() @Length(1, 160)
  nom: string;

  @IsOptional() @IsString() @MaxLength(120)
  region?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresse?: string;

  @IsOptional() @IsString() @MaxLength(40)
  telephone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  agrement?: string;
}

export class UpdateHuilerieDto extends PartialType(CreateHuilerieDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
