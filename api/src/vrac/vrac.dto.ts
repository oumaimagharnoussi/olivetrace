import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MotifSortie, StatutLivraison } from '../generated/prisma/enums.js';

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

  @IsOptional() @IsString()
  commentaire?: string;
}

/** Une part d'une quantité dans une cuve. */
export class RepartitionDto {
  @IsInt()
  stockageId: number;

  @IsInt() @Min(1)
  quantiteKg: number;
}

export class ReceptionDto {
  /** Laissé vide, le code est généré : L2026-0001. */
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;

  @IsInt()
  huilerieId: number;

  @IsInt()
  varieteId: number;

  @IsOptional() @Matches(/^\d{4}\/\d{4}$/, { message: 'La campagne doit être au format 2026/2027' })
  campagne?: string;

  @IsDateString()
  dateReception: string;

  @IsOptional() @IsString() @MaxLength(64)
  numeroBon?: string;

  @IsOptional() @IsString()
  notes?: string;

  /** Une réception peut remplir plusieurs cuves (ex. 40 t dans deux cuves de 24 t). */
  @ValidateNested({ each: true }) @Type(() => RepartitionDto) @ArrayMinSize(1)
  repartition: RepartitionDto[];

  @IsOptional() @ValidateNested() @Type(() => AnalyseDto)
  analyse?: AnalyseDto;
}

export class TransfertDto {
  @IsInt()
  lotId: number;

  @IsInt()
  sourceId: number;

  @IsInt()
  destinationId: number;

  @IsInt() @Min(1)
  quantiteKg: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class EntreeAssemblageDto {
  @IsInt()
  lotId: number;

  @IsInt()
  stockageId: number;

  @IsInt() @Min(1)
  quantiteKg: number;
}

export class AssemblageDto {
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;

  @ValidateNested({ each: true }) @Type(() => EntreeAssemblageDto) @ArrayMinSize(2)
  entrees: EntreeAssemblageDto[];

  @IsInt()
  destinationId: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class LivraisonDto {
  @IsString() @MaxLength(160)
  transporteur: string;

  @IsOptional() @IsString() @MaxLength(32)
  immatriculation?: string;

  @IsOptional() @IsString() @MaxLength(120)
  chauffeur?: string;

  @IsOptional() @IsString() @MaxLength(64)
  numeroBl?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresseLivraison?: string;

  @IsOptional() @IsDateString()
  dateEnlevement?: string;

  @IsOptional() @IsDateString()
  dateLivraisonPrevue?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class SortieDto {
  @IsInt()
  lotId: number;

  @IsInt()
  stockageId: number;

  @IsInt() @Min(1)
  quantiteKg: number;

  @IsEnum(MotifSortie)
  motif: MotifSortie;

  /** Obligatoire pour une vente. */
  @IsOptional() @IsInt()
  clientId?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @ValidateNested() @Type(() => LivraisonDto)
  livraison?: LivraisonDto;
}

export class UpdateLivraisonDto {
  @IsOptional() @IsEnum(StatutLivraison)
  statut?: StatutLivraison;

  @IsOptional() @IsString() @MaxLength(160)
  transporteur?: string;

  @IsOptional() @IsString() @MaxLength(32)
  immatriculation?: string;

  @IsOptional() @IsString() @MaxLength(120)
  chauffeur?: string;

  @IsOptional() @IsString() @MaxLength(64)
  numeroBl?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresseLivraison?: string;

  @IsOptional() @IsDateString()
  dateEnlevement?: string;

  @IsOptional() @IsDateString()
  dateLivraisonPrevue?: string;

  @IsOptional() @IsDateString()
  dateLivraison?: string;

  @IsOptional() @IsString()
  notes?: string;
}
