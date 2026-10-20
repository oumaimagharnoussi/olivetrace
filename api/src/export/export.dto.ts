import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { ModeTransport, StatutExpedition } from '../generated/prisma/enums.js';
import { INCOTERMS } from './regles.js';

export class LigneExpeditionDto {
  @IsInt()
  lotConditionneId: number;

  @IsInt() @Min(1)
  quantiteUnites: number;
}

export class CreateExpeditionDto {
  @IsInt()
  clientId: number;

  /** Laissé vide : le pays du client. */
  @IsOptional() @Matches(/^[A-Z]{2}$/, { message: 'Le pays de destination doit être un code ISO à deux lettres (ex. FR)' })
  paysDestination?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresseLivraison?: string;

  @IsDateString()
  datePrevue: string;

  @IsOptional() @IsIn(INCOTERMS, { message: `L'incoterm doit être l'un de : ${INCOTERMS.join(', ')}` })
  incoterm?: string;

  @IsOptional() @IsString() @MaxLength(120)
  lieuIncoterm?: string;

  @IsOptional() @IsEnum(ModeTransport)
  modeTransport?: ModeTransport;

  @IsOptional() @IsString() @MaxLength(160)
  transporteur?: string;

  @IsOptional() @IsString() @MaxLength(120)
  navire?: string;

  @IsOptional() @IsString() @MaxLength(120)
  portChargement?: string;

  @IsOptional() @IsString() @MaxLength(120)
  portDechargement?: string;

  @IsOptional() @IsString() @MaxLength(32)
  numeroConteneur?: string;

  @IsOptional() @IsString() @MaxLength(32)
  numeroPlomb?: string;

  /** Connaissement (B/L), lettre de voiture CMR ou LTA. */
  @IsOptional() @IsString() @MaxLength(64)
  numeroConnaissement?: string;

  @IsOptional() @IsString() @MaxLength(64)
  numeroCommande?: string;

  @IsOptional() @IsString() @MaxLength(64)
  numeroFacture?: string;

  @IsOptional() @IsInt() @Min(1)
  nombrePalettes?: number;

  @IsOptional() @IsInt() @Min(1)
  poidsBrutKg?: number;

  @IsOptional() @IsString()
  notes?: string;

  @ValidateNested({ each: true }) @Type(() => LigneExpeditionDto) @ArrayMinSize(1)
  lignes: LigneExpeditionDto[];
}

/** Client et lignes ne changent que tant que l'expédition est préparée. */
export class UpdateExpeditionDto extends PartialType(CreateExpeditionDto) {}

export class StatutExpeditionDto {
  @IsEnum(StatutExpedition)
  statut: StatutExpedition;

  /** Date de départ ou de livraison ; laissée vide, aujourd'hui. */
  @IsOptional() @IsDateString()
  date?: string;
}
