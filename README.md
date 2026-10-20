# OliveTrace

Plateforme de traçabilité de l'huile d'olive pour OLIVED.

| Dossier | Rôle | Techno |
|---|---|---|
| `api/` | Backend (API REST) | NestJS 12, TypeScript, Prisma 7, MySQL 8 |
| `web/` | Frontend (back-office) | Next.js 16, React 19, Tailwind CSS 4 |

## Démarrer en local

Prérequis : Node.js 22+ et MySQL 8 installé sur le poste.

### 1. Créer la base MySQL

Dans MySQL Workbench ou en ligne de commande (`mysql -u root -p`), exécuter :

```sql
CREATE DATABASE olivetrace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'olivetrace'@'localhost' IDENTIFIED BY 'olivetrace';
-- Prisma Migrate crée une base temporaire (shadow database) en développement :
-- l'utilisateur doit donc pouvoir créer des bases.
GRANT ALL PRIVILEGES ON *.* TO 'olivetrace'@'localhost';
FLUSH PRIVILEGES;
```

Si vous gardez un autre utilisateur ou mot de passe, adaptez `DATABASE_URL` dans `api/.env`.

### 2. Backend (http://localhost:3001/api)

```bash
cd api
copy .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

`prisma migrate dev` crée les tables, `prisma db seed` ajoute le compte administrateur et quelques exemples. Sous macOS ou Linux, remplacer `copy` par `cp`.

Après avoir récupéré une nouvelle version du code (`git pull`), dans `api` :

```bash
npm install
npx prisma migrate dev
npx prisma generate
```

`migrate dev` applique les nouvelles tables à la base, `generate` met à jour le client Prisma utilisé par le code.

### 3. Frontend (http://localhost:3000)

Dans un second terminal :

```bash
cd web
copy .env.example .env.local
npm install
npm run dev
```

Ouvrir http://localhost:3000 et se connecter avec le compte créé par le seed : `admin@olived.tn` / `OliveTrace2026!` (à changer).

## Écrans du frontend

- `/login` : connexion
- `/register` : demande de compte (le compte reste « En attente » jusqu'à sa validation)
- `/forgot-password` et `/reset-password` : mot de passe oublié, par un lien envoyé par e-mail (valable 1 heure)
- `/` : accueil avec le nombre de référentiels actifs
- `/referentiels/huileries`, `/referentiels/varietes`, `/referentiels/stockages`, `/referentiels/clients` : liste, ajout, modification, désactivation
- `/utilisateurs` : gestion des comptes (administrateur seulement)
- `/stock` : état des cuves et citernes (lot contenu, remplissage, ancienneté) et alertes
- `/lots` : liste des lots et saisie d'une réception (huilerie, variété, date, quantité, mise en cuve, analyse de laboratoire)
- `/lots/{id}` : fiche d'un lot (cuves, analyses, généalogie des assemblages, mouvements)
- `/operations` : transferts, assemblages (avec contrôle avant validation), sorties de stock et journal des opérations
- `/livraisons` : suivi des transports sous-traités (planifiée, en cours, livrée)

Les boutons d'ajout et de modification n'apparaissent que pour les rôles autorisés à écrire (les mêmes que dans l'API). Les écrans sont décrits dans `web/src/lib/ressources.ts`.

## E-mails

Les inscriptions (prévenir les administrateurs) et le mot de passe oublié envoient des e-mails. Tant que `SMTP_HOST` est vide dans `api/.env`, ils ne partent pas : ils s'affichent dans le terminal de l'API, avec le lien à ouvrir. Pour un vrai envoi, renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM`.

## Ce que contient déjà l'API

- Connexion par email et mot de passe (JWT) : `POST /api/auth/login`, `GET /api/auth/me`
- Inscription : `POST /api/auth/register`. Le compte est créé sans rôle et inactif ; l'administrateur le valide dans l'écran Utilisateurs (bouton « Valider » : choisir un rôle et cocher « Compte actif »)
- Mot de passe oublié : `POST /api/auth/forgot-password` puis `POST /api/auth/reset-password`. Seul le hash du jeton est stocké ; un lien sert une seule fois
- Rôles : ADMIN, DIRECTION, STOCK, QUALITE, PRODUCTION, EXPORT
- Utilisateurs (ADMIN) : `/api/users`
- Référentiels : `/api/huileries`, `/api/varietes`, `/api/stockages` (cuves 24 t, citernes 30 t), `/api/clients`
- Journal d'audit de chaque modification : `/api/audit`
- Flux vrac (étape 2) :
  - `GET /api/stock` (état des cuves), `GET /api/stock/alertes`
  - `GET /api/lots`, `GET /api/lots/:id`, `POST /api/lots/reception`, `POST /api/lots/:id/analyses`
  - `GET /api/operations`, `POST /api/operations/transfert`, `POST /api/operations/assemblage/simulation`, `POST /api/operations/assemblage`, `POST /api/operations/sortie`
  - `GET /api/livraisons`, `PATCH /api/livraisons/:id`
- Santé : `GET /api/health`

Le schéma de données est dans `api/prisma/schema.prisma`.

## Règles du flux vrac

- Les quantités sont en kilogrammes. Le stock n'est jamais saisi à la main : c'est la somme des mouvements (réception, transfert, assemblage, sortie) par lot et par cuve.
- Une cuve ou citerne contient un seul lot à la fois et ne peut pas dépasser sa capacité. Une réception peut remplir plusieurs cuves.
- Mettre deux lots ensemble est un assemblage : il crée un nouveau lot relié à ses lots d'origine, ce qui permet de remonter jusqu'aux huileries. La cuve de l'assemblage doit être vide, ou se vider entièrement dans l'assemblage.
- Avant de confirmer un assemblage, l'application affiche l'acidité estimée (moyenne pondérée des dernières analyses) et des avertissements : variétés ou campagnes différentes, lots sans analyse, mélange avec une huile au-dessus de 0,8 % d'acidité.
- Alertes : lot stocké depuis plus de `ALERTE_DUREE_STOCKAGE_JOURS` jours (180 par défaut, dans `api/.env`), lot en stock sans analyse.
- Une sortie de type vente demande un client et peut avoir un transport sous-traité (transporteur, camion, chauffeur, bon de livraison), suivi dans `/livraisons`.
- Il faut au moins une huilerie dans les référentiels pour saisir une réception.
