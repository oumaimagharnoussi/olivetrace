import type { ConfigService } from '@nestjs/config';
import type { Exportateur } from '../export/documents.js';

/** Société qui édite les documents (en-tête et signature), lue dans api/.env. */
export function societe(config: ConfigService): Exportateur {
  const v = (cle: string) => (config.get<string>(cle) || null) as string | null;
  return {
    raisonSociale: v('EXPORTATEUR_RAISON_SOCIALE') ?? v('PASSEPORT_PRODUCTEUR') ?? 'OLIVED',
    adresse: v('EXPORTATEUR_ADRESSE'),
    pays: v('EXPORTATEUR_PAYS') ?? 'Tunisie',
    matriculeFiscal: v('EXPORTATEUR_MATRICULE_FISCAL'),
    codeDouane: v('EXPORTATEUR_CODE_DOUANE'),
    numeroExportateurAgree: v('EXPORTATEUR_AGREE'),
    telephone: v('EXPORTATEUR_TELEPHONE'),
    email: v('EXPORTATEUR_EMAIL'),
    signataire: v('EXPORTATEUR_SIGNATAIRE'),
    fonction: v('EXPORTATEUR_FONCTION'),
    lieu: v('EXPORTATEUR_LIEU'),
  };
}
