import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import { TypeMouvementProduit } from '../generated/prisma/enums.js';

export class FiltrationDto {
  @IsInt()
  lotId: number;

  /** Cuve d'où part l'huile. */
  @IsInt()
  sourceId: number;

  /** Cuve qui reçoit l'huile filtrée (souvent une cuve tampon de l'atelier). */
  @IsInt()
  destinationId: number;

  @IsInt() @Min(1)
  quantiteEntreeKg: number;

  @IsInt() @Min(1)
  quantiteSortieKg: number;

  @IsString() @Length(1, 120)
  operateur: string;

  @IsOptional() @IsString() @MaxLength(80)
  typeFiltre?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0)
  porositeMicrons?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  pressionBar?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 })
  temperatureC?: number;

  @IsOptional() @IsInt() @Min(1)
  debitLh?: number;

  @IsOptional() @IsInt() @Min(1)
  dureeMinutes?: number;

  /** Code du lot filtré ; laissé vide, il est généré (L2026-0001). */
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ConditionnementDto {
  @IsInt()
  lotId: number;

  /** Cuve d'où part l'huile. */
  @IsInt()
  stockageId: number;

  @IsInt()
  formatId: number;

  @IsInt() @Min(1)
  nombreUnites: number;

  /** Huile prise dans la cuve ; laissée vide, elle est calculée à partir du nombre d'unités et de leur contenance. */
  @IsOptional() @IsInt() @Min(1)
  quantiteKg?: number;

  /** Numéro de lot final imprimé sur l'étiquette ; laissé vide, il est généré (C2026-0001). */
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;

  /** Date de durabilité minimale ; laissée vide, date de mise en bouteille + DLUO_MOIS. */
  @IsOptional() @IsDateString()
  dluo?: string;

  /** Client ou commande : son cahier des charges qualité est contrôlé. */
  @IsOptional() @IsInt()
  clientId?: number;

  @IsOptional() @Matches(/^[A-Z]{2}$/, { message: 'Le pays de destination doit être un code ISO à deux lettres (ex. FR)' })
  paysDestination?: string;

  @IsOptional() @IsString() @MaxLength(160)
  destination?: string;

  @IsOptional() @IsString() @MaxLength(120)
  operateur?: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class MouvementProduitDto {
  @IsInt()
  lotConditionneId: number;

  @IsEnum(TypeMouvementProduit)
  type: TypeMouvementProduit;

  /** Nombre d'unités : sorties pour une expédition ou une casse, + ou - pour un ajustement. */
  @IsInt()
  quantiteUnites: number;

  /** Obligatoire pour une expédition. */
  @IsOptional() @IsInt()
  clientId?: number;

  /** Bon de livraison, facture. */
  @IsOptional() @IsString() @MaxLength(64)
  reference?: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;
}
