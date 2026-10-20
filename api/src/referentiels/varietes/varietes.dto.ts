import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateVarieteDto {
  @IsString() @Length(1, 32)
  code: string;

  @IsString() @Length(1, 120)
  nom: string;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdateVarieteDto extends PartialType(CreateVarieteDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
