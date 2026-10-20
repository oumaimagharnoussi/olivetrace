import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Role } from '../generated/prisma/enums.js';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @Length(1, 120)
  nom: string;

  @IsEnum(Role)
  role: Role;

  @IsString() @MinLength(8)
  password: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional() @IsBoolean()
  actif?: boolean;
}
