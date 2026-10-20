import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { TypeStockage } from '../../generated/prisma/enums.js';

export class CreateStockageDto {
  @IsString() @Length(1, 32)
  code: string;

  @IsEnum(TypeStockage)
  type: TypeStockage;

  @IsInt() @Min(1)
  capaciteKg: number;

  @IsOptional() @IsString() @MaxLength(160)
  emplacement?: string;
}

export class UpdateStockageDto extends PartialType(CreateStockageDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
