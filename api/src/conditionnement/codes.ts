import type { Prisma } from '../generated/prisma/client.js';

/** Code suivant pour l'année de la date, ex. F2026-0001 pour une filtration, C2026-0001 pour un lot conditionné, E2026-0001 pour une expédition. */
export async function prochainCode(tx: Prisma.TransactionClient, table: 'filtration' | 'lotConditionne' | 'expedition', lettre: string, date: Date) {
  const prefixe = `${lettre}${date.getFullYear()}-`;
  const args = { where: { code: { startsWith: prefixe } }, orderBy: { code: 'desc' as const }, select: { code: true } };
  const dernier =
    table === 'filtration'
      ? await tx.filtration.findFirst(args)
      : table === 'lotConditionne'
        ? await tx.lotConditionne.findFirst(args)
        : await tx.expedition.findFirst(args);
  const numero = dernier ? Number(dernier.code.slice(prefixe.length)) || 0 : 0;
  return `${prefixe}${String(numero + 1).padStart(4, '0')}`;
}
