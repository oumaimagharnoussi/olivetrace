import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsISO31661Alpha2, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString() @Length(1, 32)
  code: string;

  @IsString() @Length(1, 200)
  raisonSociale: string;

  @IsISO31661Alpha2()
  pays: string;

  @IsOptional() @IsString() @MaxLength(120)
  ville?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresse?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(40)
  telephone?: string;

  @IsOptional() @IsString() @MaxLength(40)
  numeroTva?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
