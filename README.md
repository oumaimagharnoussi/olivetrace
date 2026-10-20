# OliveTrace

Plateforme de traçabilité de l'huile d'olive pour OLIVED.

| Dossier | Rôle | Techno |
|---|---|---|
| `api/` | Backend (API REST) | NestJS 12, TypeScript, Prisma 7, MySQL 8 |
| `web/` | Frontend (back-office) | Next.js 16, React 19, Tailwind CSS 4 |

## Démarrer en local

Prérequis : Node.js 22.12 ou plus récent et MySQL 8 installé sur le poste.

### 1. Backend (http://localhost:3001/api)

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

### 2. Frontend (http://localhost:3000)

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
- `/` : tableau de bord (mis à jour chaque minute) : lots actifs, stock par cuve et en produits finis, alertes qualité et non-conformités ouvertes, expéditions en cours par destination
- `/rapports` : rapports sur une période (campagne par défaut) avec graphiques et export CSV : réceptions par huilerie, variété et mois, ventes en vrac, mise en bouteille, exports par pays, client et mois (direction et administrateurs)
- `/ia` : intelligence artificielle : qualité prévue du prochain lot de chaque huilerie, évolution de l'acidité et du peroxyde des lots en stock (délai avant la limite extra vierge), lots et formats recommandés pour un client, anomalies (analyses inhabituelles, quantités et dates incohérentes) ; la prévision s'affiche aussi dans le formulaire de réception
- `/blockchain` : ancrage du journal d'audit (direction et administrateurs) : ancrages et transactions, vérification d'intégrité, preuve d'un événement
- `/referentiels/huileries`, `/referentiels/varietes`, `/referentiels/stockages`, `/referentiels/clients` : liste, ajout, modification, désactivation
- `/utilisateurs` : gestion des comptes (administrateur seulement)
- `/stock` : état des cuves et citernes (lot contenu, remplissage, ancienneté) et alertes
- `/lots` : liste des lots et saisie d'une réception (huilerie, variété, date, quantité, mise en cuve, analyse de laboratoire)
- `/lots/{id}` : fiche d'un lot (cuves, analyses, généalogie des assemblages, mouvements)
- `/operations` : transferts, assemblages (avec contrôle avant validation), sorties de stock et journal des opérations
- `/livraisons` : suivi des transports sous-traités (planifiée, en cours, livrée)
- `/qualite` : tableau de bord qualité (lots conformes, non conformes, bloqués), alertes et non-conformités à traiter
- `/qualite/criteres` : critères des catégories extra vierge et vierge, cahiers des charges des clients
- `/filtration` : filtrations (cuve de départ et d'arrivée, paramètres techniques, opérateur, perte) ; l'huile filtrée forme un nouveau lot
- `/conditionnement` : mises en bouteille (format, nombre d'unités, numéro de lot final, DLUO, client et destination)
- `/conditionnement/{id}` : fiche d'un lot conditionné, avec la remontée jusqu'aux lots reçus des huileries
- `/produits-finis` : stock de bouteilles par format et par lot, expéditions, casse et ajustements
- `/referentiels/formats` : formats de bouteille et de bidon
- `/conditionnement/{id}/etiquettes` : impression du QR code du lot ou d'une planche d'étiquettes, une par bouteille
- `/p/{jeton}` : passeport produit public, ouvert en scannant le QR code (sans connexion) ; il montre aussi la preuve d'ancrage blockchain de chaque étape (réception, filtration, analyses, mise en bouteille), sans leur contenu
- `/expeditions` : expéditions export (client, pays de destination, incoterm, transport, lots conditionnés)
- `/expeditions/{id}` : fiche d'une expédition, départ et livraison, téléchargement du dossier export en PDF

Seul un lot analysé, conforme et non bloqué peut être filtré ou mis en bouteille. Un lot filtré reprend la qualité du lot d'origine tant qu'il n'a pas sa propre analyse.

Les boutons d'ajout et de modification n'apparaissent que pour les rôles autorisés à écrire (les mêmes que dans l'API). Les écrans sont décrits dans `web/src/lib/ressources.ts`.

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
- Contrôle qualité (étape 3) :
  - `GET /api/qualite/alertes`, `GET /api/qualite/controle-expedition?lotId=&clientId=`
  - `GET /api/qualite/specifications`, `POST /api/qualite/specifications`, `PATCH /api/qualite/specifications/:id`
  - `GET /api/qualite/non-conformites`, `POST /api/qualite/non-conformites`, `PATCH /api/qualite/non-conformites/:id`
- Passeport produit (étape 5) :
  - `GET /api/conditionnements/:id/passeport`, `PATCH /api/conditionnements/:id/passeport`, `POST /api/conditionnements/:id/passeport/renouveler`
  - `GET /api/conditionnements/:id/passeport/qr.png`, `GET /api/conditionnements/:id/passeport/qr.svg` (QR code du lot, ou d'une bouteille avec `?unite=12`)
  - `GET /api/conditionnements/:id/passeport/etiquettes?de=1&a=100` (500 au plus)
  - `GET /api/public/passeports/:jeton` : sans connexion, les seules informations publiées
- Export (étape 6) :
  - `GET /api/expeditions?statut=`, `GET /api/expeditions/:id`, `POST /api/expeditions`, `PATCH /api/expeditions/:id`
  - `POST /api/expeditions/:id/statut` (`EXPEDIEE` : le stock sort ; `LIVREE` ; `ANNULEE` avant le départ)
  - `GET /api/expeditions/:id/documents/:type` en PDF, avec `type` = `colisage`, `origine`, `analyses`, `conformite`, `fiches` ou `dossier` (tous à la suite)
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

## Règles du contrôle qualité

- Chaque lot a une catégorie visée (extra vierge par défaut, choisie à la réception). Un assemblage prend la moins bonne catégorie visée de ses lots d'origine.
- Chaque analyse est comparée aux critères du règlement délégué UE 2022/2104 (acidité, peroxyde, K232, K270, ΔK, esters éthyliques, médianes du défaut et du fruité). L'application garde la catégorie atteinte (extra vierge, vierge ou lampante), le résultat et les écarts tels qu'ils ont été calculés ce jour-là.
- Résultat : conforme, analyse partielle (aucun écart mais des paramètres de la catégorie ne sont pas mesurés) ou non conforme. Le statut qualité du lot est celui de sa dernière analyse.
- Une analyse non conforme ouvre automatiquement une non-conformité et bloque le lot : plus de vente ni d'envoi au conditionnement. Les transferts, assemblages et pertes restent possibles. Une non-conformité peut aussi être déclarée à la main depuis la fiche du lot (odeur, contamination…).
- Pour débloquer le lot, la qualité clôture la non-conformité avec une décision : contre-analyse conforme, déclassement (le lot change de catégorie visée), assemblage correctif, dérogation, destruction.
- Avant une vente, le lot est aussi comparé au cahier des charges du client s'il en a un (ex. polyphénols ≥ 250 mg/kg) : un écart empêche la vente. Un lot sans analyse, une analyse partielle ou une analyse de plus de `ALERTE_AGE_ANALYSE_JOURS` jours (90 par défaut) donnent un avertissement sans bloquer.
- Les critères des catégories sont modifiables dans `/qualite/criteres` ; le statut des lots analysés est alors recalculé. Critères et non-conformités : rôles Qualité et Direction.

## Passeport produit (QR code)

- Chaque lot conditionné a un passeport, visible sur sa fiche (`/conditionnement/{id}`) : QR code, téléchargement en PNG (1024 px, pour l'imprimeur) ou SVG, impression.
- Le QR code mène à la page publique `/p/{jeton}`, sans connexion. Le jeton est tiré au hasard : on ne peut pas trouver le passeport d'un autre lot en changeant un numéro.
- La page publique montre : produit et catégorie, dates de mise en bouteille et DLUO, origine (Tunisie, huileries et régions, variétés, campagne), dernière analyse avec les limites UE, filtration et mise en bouteille, certifications, destination. Elle ne montre jamais le client, les quantités, les opérateurs ni les notes internes.
- La mention « Conforme au règlement délégué (UE) 2022/2104 » est ajoutée d'office tant que le lot vrac est conforme et non bloqué. Les autres certifications (bio, IGP…) se saisissent dans « Choisir ce qui est affiché », qui permet aussi de masquer les huileries, les analyses, le procédé ou la destination, ou de dépublier le passeport (rôles Direction, Qualité, Export).
- Étiquettes de bouteille : chaque QR code porte le numéro de la bouteille (1 à nombre d'unités) et une signature. Au scan, la page affiche « Bouteille n° 12 sur 1 200 : numéro authentifié », ou prévient si le numéro a été modifié. La signature utilise `PASSEPORT_SECRET` (à défaut `JWT_SECRET`) : ne plus la changer une fois des étiquettes imprimées.
- « Renouveler le QR code » change le jeton : les QR codes déjà imprimés ne fonctionnent plus (étiquettes copiées ou perdues).
- L'adresse dans le QR code est `PASSEPORT_WEB_URL` (à défaut `WEB_URL`) dans `api/.env`. Pour scanner avec un téléphone sur le même Wi-Fi, y mettre l'adresse IP du PC (ex. `http://192.168.1.20:3000`, voir `ipconfig`) puis redémarrer l'API, et lancer le frontend avec `npm run dev -- -H 0.0.0.0`. Windows peut demander d'autoriser Node.js dans le pare-feu.

## Export et dossier PDF

- Une expédition regroupe un ou plusieurs lots conditionnés pour un client. Le pays de destination est celui du client par défaut ; les pays de l'Union européenne sont signalés.
- Préparée, elle ne touche pas au stock : on peut éditer le dossier et l'envoyer au transitaire. « Valider le départ » sort les unités du stock de produits finis (mouvements « Expédition » avec le numéro E2026-0001 en référence). Une expédition partie ne s'annule plus : un retour se saisit par un ajustement d'inventaire.
- Contrôle qualité (étapes 3 et 4) : un lot bloqué par une non-conformité ou hors cahier des charges du client ne peut pas être ajouté ni partir. La déclaration de conformité UE, et donc le dossier complet, demande en plus que chaque lot soit analysé et conforme.
- Documents PDF, générés à la demande avec les données du jour :
  - liste de colisage : lots, codes NC (1509 20 00 extra vierge, 1509 30 00 vierge), unités, cartons, volume, poids net, transport ;
  - certificat d'origine : huileries, variétés et campagnes de chaque lot, déclaration d'origine préférentielle Tunisie (convention paneuroméditerranéenne). Sans numéro d'exportateur agréé (`EXPORTATEUR_AGREE`), elle ne vaut que jusqu'à 6 000 € ; au-delà, l'EUR.1 visé par la douane reste nécessaire ;
  - bulletins d'analyse : dernière analyse de chaque lot comparée aux limites UE (un lot filtré reprend l'analyse de son lot d'origine) ;
  - déclaration de conformité UE : règlements (UE) 2022/2104 et 2022/2105, 1169/2011, 1935/2004 ;
  - fiches techniques produit : une par lot (origine, procédé, format, DLUO, conservation, analyse).
- L'exportateur imprimé sur les documents (adresse, matricule fiscal, signataire…) se règle dans `api/.env` (`EXPORTATEUR_…`). Les textes réglementaires sont à faire valider par le service qualité ou le transitaire avant le premier envoi.
- L'empreinte SHA-256 de chaque PDF téléchargé est gardée dans le journal d'audit.
- Création, modification et départ : rôles Direction et Export. Téléchargement des PDF : tout utilisateur connecté.

### PDF sous Windows (Puppeteer)

Les PDF sont imprimés par un Chrome sans fenêtre (Puppeteer). `npm install` dans `api` télécharge ce Chrome une fois (environ 170 Mo, dans `%USERPROFILE%\.cache\puppeteer`). S'il manque (installation hors ligne, proxy), l'API prend Microsoft Edge, présent sur Windows 10 et 11, ou Chrome s'il est installé. En cas d'erreur « Aucun navigateur pour générer les PDF » :

```bash
cd api
npx puppeteer browsers install chrome
```

ou indiquer le navigateur dans `api/.env`, par exemple `CHROME_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'`, puis redémarrer l'API.

## Intelligence artificielle

Les modèles sont calculés par l'API (module `api/src/ia`), sans service à installer : ils apprennent à chaque réception et à chaque analyse saisies. Ce sont des statistiques robustes adaptées à un historique court (une campagne) : moyenne de l'huilerie rapprochée de la moyenne générale quand elle a peu de lots, écart absolu médian pour repérer les valeurs inhabituelles, tendance linéaire pour l'évolution en cuve. Chaque résultat indique sur combien de lots il repose. Avec plusieurs campagnes d'historique, un service Python (scikit-learn) pourra prendre le relais sans changer les écrans.

## Blockchain (option)

Le journal d'audit est scellé par lots (« ancrages ») : chaque événement reçoit une empreinte SHA-256, les empreintes forment un arbre de Merkle, et l'empreinte de l'ancrage (reliée à l'ancrage précédent) est inscrite dans une transaction sur Polygon. Les données ne quittent jamais la base : seule l'empreinte est publique. Le bouton « Vérifier l'intégrité » de la page `/blockchain` recalcule tout et signale un événement modifié ou supprimé après coup.

Sans configuration, les ancrages sont seulement scellés dans la base. Pour la preuve publique, dans `api/.env` :

1. Créer un portefeuille dédié (par exemple avec MetaMask) et copier sa clé privée dans `BLOCKCHAIN_CLE_PRIVEE`.
2. Pour essayer gratuitement : `BLOCKCHAIN_RPC_URL="https://rpc-amoy.polygon.technology"` (réseau de test Polygon Amoy) et des jetons de test sur https://faucet.polygon.technology.
3. En production : une adresse RPC du réseau Polygon (ex. `https://polygon-rpc.com`) et quelques POL sur le portefeuille ; chaque ancrage coûte une fraction de centime.

Les ancrages déjà scellés sont envoyés au premier passage après la configuration. `BLOCKCHAIN_INTERVALLE_MINUTES` règle la fréquence (60 par défaut).
