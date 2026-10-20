# OliveTrace

Plateforme de traçabilité de l'huile d'olive pour OLIVED.

| Dossier | Rôle | Techno |
|---|---|---|
| `api/` | Backend (API REST) | NestJS 12, TypeScript, Prisma 7, MySQL 8 |
| `web/` | Frontend (back-office) | Next.js 16, React 19, Tailwind CSS 4 |
| `docker-compose.yml` | Base MySQL locale | MySQL 8.4 |

## Démarrer en local

Prérequis : Node.js 22+, Docker.

```bash
# 1. Base de données
docker compose up -d mysql

# 2. Backend (http://localhost:3001/api)
cd api
cp .env.example .env
npm install
npx prisma migrate dev     # crée les tables
npx prisma db seed         # compte admin + exemples
npm run start:dev

# 3. Frontend (http://localhost:3000)
cd ../web
cp .env.example .env.local
npm install
npm run dev
```

Ouvrir http://localhost:3000 et se connecter avec le compte créé par le seed : `admin@olived.tn` / `OliveTrace2026!` (à changer).

## Écrans du frontend

- `/login` : connexion
- `/` : accueil avec le nombre de référentiels actifs
- `/referentiels/huileries`, `/referentiels/varietes`, `/referentiels/stockages`, `/referentiels/clients` : liste, ajout, modification, désactivation
- `/utilisateurs` : gestion des comptes (administrateur seulement)

Les boutons d'ajout et de modification n'apparaissent que pour les rôles autorisés à écrire (les mêmes que dans l'API). Les écrans sont décrits dans `web/src/lib/ressources.ts`.

## Ce que contient déjà l'API

- Connexion par email et mot de passe (JWT) : `POST /api/auth/login`, `GET /api/auth/me`
- Rôles : ADMIN, DIRECTION, STOCK, QUALITE, PRODUCTION, EXPORT
- Utilisateurs (ADMIN) : `/api/users`
- Référentiels : `/api/huileries`, `/api/varietes`, `/api/stockages` (cuves 24 t, citernes 30 t), `/api/clients`
- Journal d'audit de chaque modification : `/api/audit`
- Santé : `GET /api/health`

Le schéma de données est dans `api/prisma/schema.prisma`.
