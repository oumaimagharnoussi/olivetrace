import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CategorieHuile, DecisionNonConformite, ParametreAnalyse, StatutNonConformite } from '../generated/prisma/enums.js';

export class AnalyseDto {
  @IsDateString()
  dateAnalyse: string;

  @IsOptional() @IsString() @MaxLength(160)
  laboratoire?: string;

  @IsOptional() @IsString() @MaxLength(64)
  reference?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  acidite?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000)
  peroxyde?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(10)
  k232?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(10)
  k270?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(-1) @Max(1)
  deltaK?: number;

  @IsOptional() @IsInt() @Min(0)
  polyphenols?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(10000)
  esterEthyliques?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(10)
  medianeDefaut?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(10)
  medianeFruite?: number;

  @IsOptional() @IsString()
  commentaire?: string;
}

export class CritereDto {
  @IsEnum(ParametreAnalyse)
  parametre: ParametreAnalyse;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 })
  min?: number | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 })
  max?: number | null;
}

/** Cahier des charges d'un client (les catégories réglementaires existent déjà). */
export class CreateSpecificationDto {
  @IsString() @MaxLength(32)
  code: string;

  @IsString() @MaxLength(160)
  nom: string;

  @IsInt()
  clientId: number;

  @ValidateNested({ each: true }) @Type(() => CritereDto) @ArrayMinSize(1)
  criteres: CritereDto[];
}

export class UpdateSpecificationDto {
  @IsOptional() @IsString() @MaxLength(160)
  nom?: string;

  @IsOptional() @IsBoolean()
  actif?: boolean;

  /** Remplace tous les critères. */
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CritereDto) @ArrayMinSize(1)
  criteres?: CritereDto[];
}

/** Non-conformité constatée hors analyse (odeur, contamination, cuve souillée…). */
export class CreateNonConformiteDto {
  @IsInt()
  lotId: number;

  @IsString() @MaxLength(2000)
  description: string;
}

export class UpdateNonConformiteDto {
  @IsOptional() @IsEnum(StatutNonConformite)
  statut?: StatutNonConformite;

  /** Obligatoire pour clôturer. */
  @IsOptional() @IsEnum(DecisionNonConformite)
  decision?: DecisionNonConformite;

  /** Pour un déclassement : nouvelle catégorie visée du lot (par défaut, celle atteinte par l'analyse). */
  @IsOptional() @IsEnum(CategorieHuile)
  nouvelleCategorie?: CategorieHuile;

  @IsOptional() @IsString() @MaxLength(2000)
  actionCorrective?: string;
}
