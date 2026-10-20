// Données de départ : un compte administrateur et quelques référentiels d'exemple.
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@olived.tn';
  const password = process.env.ADMIN_PASSWORD ?? 'OliveTrace2026!';
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, nom: 'Administrateur', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
  });

  for (const v of [
    { code: 'CHEM', nom: 'Chemlali' },
    { code: 'CHET', nom: 'Chétoui' },
    { code: 'OUES', nom: 'Oueslati' },
  ]) {
    await prisma.variete.upsert({ where: { code: v.code }, update: {}, create: v });
  }

  for (let i = 1; i <= 3; i++) {
    const code = `CS-${String(i).padStart(2, '0')}`;
    await prisma.stockage.upsert({ where: { code }, update: {}, create: { code, type: 'CUVE_SOUTERRAINE', capaciteKg: 24000 } });
  }
  for (let i = 1; i <= 2; i++) {
    const code = `CT-${String(i).padStart(2, '0')}`;
    await prisma.stockage.upsert({ where: { code }, update: {}, create: { code, type: 'CITERNE', capaciteKg: 30000 } });
  }

  console.log(`Seed terminé. Connexion : ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
