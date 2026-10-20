import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Réglages du passeport public d'un lot conditionné. */
export class PasseportDto {
  @IsOptional() @IsBoolean()
  publie?: boolean;

  /** Nom commercial affiché ; laissé vide : « Huile d'olive extra vierge ». */
  @IsOptional() @IsString() @MaxLength(160)
  nomProduit?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  /** Certifications affichées telles quelles (bio, IGP, normes de l'importateur…). */
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true })
  certifications?: string[];

  @IsOptional() @IsBoolean()
  afficherHuileries?: boolean;

  @IsOptional() @IsBoolean()
  afficherAnalyses?: boolean;

  @IsOptional() @IsBoolean()
  afficherProcede?: boolean;

  @IsOptional() @IsBoolean()
  afficherDestination?: boolean;
}
