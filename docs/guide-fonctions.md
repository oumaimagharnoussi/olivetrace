# OliveTrace : guide complet des fonctions

Ce guide décrit, écran par écran, tout ce que fait l'application OliveTrace telle qu'elle est dans le code (branche `main`).
Pour chaque menu : à quoi il sert, ce qu'on peut y faire, les règles automatiques (contrôles, blocages, alertes, PDF) et les rôles qui y ont accès.

## Les rôles

| Rôle | Ce qu'il peut faire en plus de la lecture |
|---|---|
| **Administrateur** | Tout. Il passe tous les contrôles de rôle, gère les utilisateurs et valide les inscriptions. |
| **Direction** | Presque tout : toutes les saisies métier, les rapports et la blockchain. Pas la gestion des utilisateurs. |
| **Stock** | Réceptions, transport des réceptions, analyses, transferts, assemblages, sorties, livraisons vrac, mouvements de produits finis, huileries, cuves et citernes. |
| **Qualité** | Analyses, non-conformités, critères de qualité et cahiers des charges, variétés, réglages du passeport QR. |
| **Production** | Filtrations, mises en bouteille, mouvements de produits finis, formats de bouteille. |
| **Export** | Expéditions export et dossier PDF, livraisons vrac, mouvements de produits finis, clients, réglages du passeport QR. |

Règles générales :

- Tout utilisateur connecté peut **consulter** tous les écrans du menu, sauf **Rapports** et **Blockchain** (Direction et Administrateur) et **Utilisateurs** (Administrateur seul). Les boutons de saisie n'apparaissent que pour les rôles autorisés, et l'API refuse aussi l'action (« Votre rôle ne permet pas cette action »).
- La session dure 8 heures (réglable par `JWT_EXPIRES_IN`). Un compte désactivé ou sans rôle ne peut rien faire, même avec une session ouverte.
- **Journal d'audit** : chaque création, modification, connexion, inscription, changement de mot de passe et chaque PDF d'export est enregistré (qui, quand, quoi). Ce journal est celui que la blockchain scelle.
- **Numérotation automatique** : lots vrac `L2026-0001`, bons de réception `BR2026-0001`, non-conformités `NC2026-0001`, filtrations `F2026-0001`, lots conditionnés `C2026-0001`, expéditions `E2026-0001`. L'année est celle de la date de l'opération. Pour les lots, on peut saisir son propre code.
- Rien n'est supprimé : les éléments des référentiels sont **désactivés**, et le stock est toujours calculé à partir des mouvements, jamais saisi à la main.

---

## Connexion, inscription, mot de passe

### Connexion (`/login`)
- Email et mot de passe, avec un bouton œil pour afficher ou masquer le mot de passe (aussi sur l'inscription, le nouveau mot de passe et la fiche utilisateur).
- Messages précis quand le mot de passe est juste : « compte en attente de validation par un administrateur » ou « compte désactivé ». Sinon : « Email ou mot de passe incorrect ».
- Liens vers « Créer un compte » et « Mot de passe oublié ? ».
- Toutes les pages de l'application renvoient vers la connexion si l'on n'est pas connecté. Le bouton **Se déconnecter** est en haut à droite, à côté du nom et du rôle.
- Compte créé à l'installation : `admin@olived.tn` (mot de passe défini par `ADMIN_PASSWORD`, par défaut `OliveTrace2026!`).

### Inscription (`/register`)
- Nom complet, email, mot de passe (8 caractères minimum) et confirmation.
- Le compte est créé **inactif et sans rôle**. Chaque administrateur actif reçoit un e-mail avec le lien vers l'écran Utilisateurs.
- Refus si un compte existe déjà avec cet email.

### Mot de passe oublié (`/forgot-password`) et nouveau mot de passe (`/reset-password`)
- On saisit son email, on reçoit un lien valable **1 heure**. La réponse est la même que l'email existe ou non (on ne révèle pas quels comptes existent).
- Le lien ouvre la page « Nouveau mot de passe » (8 caractères minimum, avec confirmation). Une fois utilisé, ce lien et toutes les autres demandes en cours du compte deviennent inutilisables.
- Sans serveur SMTP configuré, les e-mails sont affichés dans la console de l'API.

---

## Tableau de bord (`/`)
**Accès** : tous les rôles.

**À quoi il sert** : voir la situation en temps réel. Il se met à jour tout seul chaque minute (bouton **Actualiser** pour le faire tout de suite).

**Contenu** :
- **Bandeaux** : pour l'administrateur, le nombre d'inscriptions en attente (lien vers Utilisateurs). Pour tous, un bandeau IA si des anomalies ont été détectées sur 30 jours ou si des lots risquent de dépasser la limite extra vierge dans les 90 jours.
- **Indicateurs** : lots vrac actifs (et cuves occupées), stock en cuves (kg et taux de remplissage de la capacité totale), produits finis (unités, litres, nombre de lots), non-conformités ouvertes (et lots bloqués, en rouge s'il y en a), expéditions en cours (préparées ou parties). Chaque indicateur mène à l'écran détaillé.
- **Stock par cuve et citerne** : jauge de remplissage, lot contenu, variété, nombre de jours en stock.
- **Produits finis par format** (barres) et **qualité des lots en stock** (conformes, non conformes, incomplets, sans analyse).
- **Alertes** : alertes qualité et alertes de stock réunies, les plus graves en premier (voir la liste des alertes dans Stock en cuves et Qualité). Chaque alerte mène au lot concerné.
- **Non-conformités ouvertes** (les 10 plus anciennes) avec un lien « Traiter ».
- **Expéditions en cours** (client, destination, statut, départ, unités, volume) et **en cours par destination** (litres par pays).

---

## Rapports (`/rapports`)
**Accès** : Direction et Administrateur (les autres voient un message de refus).

**À quoi il sert** : les chiffres d'une période, à imprimer ou à exporter.

**Ce qu'on peut faire** :
- Choisir la période (du / au), ou un raccourci : **campagne en cours**, **campagne précédente** (une campagne va du 1er octobre au 30 septembre), **mois en cours**. Par défaut : la campagne en cours.
- **Imprimer** la page, et télécharger chaque tableau en **CSV** (séparateur « ; », lisible directement dans Excel).

**Chiffres affichés** :
- Huile reçue (kg, nombre de lots), vendu en vrac (kg), mis en bouteille (kg, unités, kg filtrés), exporté (litres, unités, nombre d'expéditions), pertes (sorties au motif perte + pertes de filtration).
- Réceptions par huilerie, par mois et par variété ; ventes vrac par client ; mise en bouteille par format et par mois ; exports par pays, par mois et par client.
- Règles de calcul : les exports comptent les expéditions **parties** (expédiées ou livrées) dont la date de départ est dans la période ; les ventes vrac comptent les sorties au motif « Vente en vrac ».

---

## Stock en cuves (`/stock`)
**Accès** : tous les rôles (lecture seule).

**À quoi il sert** : voir le contenu de chaque cuve et citerne active.

**Contenu** :
- En tête : stock total, capacité totale et nombre de cuves vides.
- Une carte par cuve : code, type (cuve souterraine, citerne, cuve tampon), jauge, quantité et taux de remplissage, lot contenu (lien), variété (ou « Assemblage »), huilerie (ou « plusieurs huileries »), date de réception et nombre de jours en stock. « Vide » sinon.

**Alertes de stock** (calculées automatiquement sur les lots en stock) :
- **Durée de stockage** : lot en stock depuis plus de 180 jours (réglable par `ALERTE_DUREE_STOCKAGE_JOURS`). Niveau Alerte.
- **Sans analyse** : lot en stock sans analyse de laboratoire. Niveau À faire.
- **Réserves à la réception** : écart de poids, température, citerne ou plombs (voir Lots). Niveau À faire.
- **Incompatibilité de lots** : un assemblage mélange des variétés, des campagnes ou des qualités différentes. Niveau Alerte si la qualité est en risque (mélange d'extra vierge avec une huile au-dessus de 0,8 % d'acidité, ou acidité estimée au-dessus de 0,8 %), sinon À faire.
- **Incompatibilité client** : un lot conditionné préparé pour un client, encore en stock, ne respecte plus le cahier des charges de ce client (ou son lot vrac a été bloqué depuis). Niveau Alerte, lien vers le lot conditionné.

**Règles des cuves** (appliquées à toute opération qui touche une cuve) :
- Une cuve ne contient **qu'un seul lot** à la fois. Pour mélanger, il faut faire un assemblage.
- On ne peut pas dépasser la **capacité** de la cuve, ni sortir plus que ce que la cuve contient du lot.
- On ne peut pas faire entrer d'huile dans une cuve **désactivée**.
- Deux opérations simultanées sur une même cuve sont traitées l'une après l'autre (verrou), pour que le stock reste juste.

---

## Lots (`/lots` et fiche `/lots/{id}`)
**Accès** : lecture pour tous. Nouvelle réception et transport : Direction, Stock. Analyse : Direction, Stock, Qualité. Non-conformité : Direction, Qualité.

### Liste des lots
- Tableau : code, origine (réception, assemblage, filtration), huilerie, variété, campagne, date, quantité reçue, stock actuel (ou « Épuisé »), acidité de la dernière analyse, badge qualité.
- Par défaut, seuls les lots en stock sont affichés ; la case **Afficher les lots épuisés** montre tout.

### Nouvelle réception (bouton sur la liste)
On enregistre l'huile livrée par une huilerie. Cela crée un nouveau lot.
- **Champs** : huilerie et variété (obligatoires), date de réception, campagne (format `2026/2027`, proposée automatiquement), numéro de bon de l'huilerie, code du lot (généré si vide), **catégorie visée** (extra vierge par défaut, ou vierge, ou lampante), notes.
- **Mise en cuve** : une ou plusieurs cuves avec la quantité dans chacune (par exemple 40 t dans deux cuves de 24 t). Seules les cuves vides sont proposées ; le total s'affiche.
- **Prévision IA** : dès que l'huilerie est choisie, un encadré donne la qualité attendue (acidité, peroxyde, K232, K270, polyphénols), la fiabilité de la prévision et le risque que l'huile ne soit pas extra vierge. Au-delà de 30 % de risque, il conseille de faire analyser le lot avant de le mélanger ou de le vendre.
- **Transport sous-traité** (case à cocher) : transporteur, immatriculation, chauffeur, numéro de bon de livraison, conditions de livraison, dates d'enlèvement et d'arrivée, poids annoncé, température de l'huile, citerne conforme (oui/non), plombs intacts et numéro de plomb, réceptionné par, observations. L'écart avec le poids annoncé s'affiche pendant la saisie. Un **numéro de bon de réception** `BR2026-0001` est attribué.
- **Analyse de laboratoire** (case à cocher) : on peut saisir l'analyse en même temps (voir plus bas).
- **Règles** : les règles des cuves s'appliquent. Si l'analyse saisie n'est pas conforme, le lot est quand même reçu mais **bloqué**, et une non-conformité est ouverte automatiquement (le message l'indique).

### Fiche d'un lot
- **Bandeaux** : lot bloqué (par quelle non-conformité, ou parce que le lot qu'il a filtré est bloqué) ; lot filtré sans analyse propre qui reprend la qualité du lot d'origine.
- **Informations** : origine, huilerie, variété, campagne, date, quantité initiale, stock, cuves et quantités, numéro de bon, catégorie visée, qualité.
- **Généalogie** : lots d'origine (pour un assemblage ou une filtration) et lots dans lesquels ce lot a été utilisé, avec les quantités.
- **Transport et bon de réception** (lots reçus seulement) : saisie ou modification du transport après coup (le numéro de bon est conservé), affichage des contrôles à l'arrivée, et bouton **Bon de réception (PDF)**.
- **Mises en bouteille** faites à partir de ce lot.
- **Analyses de laboratoire** : historique complet (acidité, peroxyde, K232, K270, ΔK, polyphénols, esters éthyliques, médianes du défaut et du fruité, catégorie atteinte, résultat, écarts, commentaire) et bouton **Ajouter une analyse**.
- **Non-conformités** du lot, avec **Déclarer une non-conformité** et **Traiter**.
- **Mouvements** : toutes les entrées et sorties du lot, cuve par cuve, avec le motif, le client, le transport et les notes.

### Contrôles à l'arrivée (réserves du bon de réception)
Chaque problème devient une **réserve** imprimée sur le bon et une alerte de stock :
- Écart entre le poids annoncé et le poids reçu supérieur à **0,5 %** (manquant ou excédent).
- Température de l'huile hors de **5 à 30 °C**.
- Citerne non conforme (propreté, usage alimentaire, odeur).
- Plombs absents ou rompus.

### Bon de réception (PDF)
Disponible quand le transport est saisi. Il contient : la société, le numéro du bon, le lot, l'huilerie (région, agrément), la variété, la campagne, la catégorie visée, les quantités par cuve, le transport, les contrôles à l'arrivée et les réserves, et la première analyse du lot si elle existe.

### Analyse de laboratoire
- **Champs** : date, laboratoire, numéro de bulletin, acidité, indice de peroxyde, K232, K270, ΔK, polyphénols, esters éthyliques, médiane du défaut, médiane du fruité, commentaire. Tout est facultatif sauf la date.
- **Calcul automatique** :
  - la **catégorie atteinte** : la meilleure catégorie (extra vierge, puis vierge) dont aucune limite mesurée n'est dépassée, sinon lampante ;
  - le **résultat** face à la catégorie visée du lot : **conforme**, **incomplet** (aucun écart mais des paramètres demandés n'ont pas été mesurés) ou **non conforme** (une limite dépassée, ou une huile classée en dessous de la catégorie visée) ;
  - les **écarts** en clair, par exemple « Acidité 1,2 % (maximum 0,8 %) ».
- **Si non conforme** : une non-conformité est ouverte automatiquement et le lot est **bloqué**.
- Le statut qualité du lot suit toujours sa **dernière** analyse. Un lot filtré sans analyse propre prend celle du lot dont il vient, et il est bloqué si ce lot l'est.

---

## Opérations (`/operations`)
**Accès** : lecture pour tous. Transfert, assemblage, sortie : Direction, Stock (la vérification d'un assemblage est aussi ouverte à Qualité côté API).

**Journal des opérations** : les 200 dernières opérations de stock (réception, transfert, assemblage, sortie, filtration, mise en bouteille) avec les mouvements lot par lot et cuve par cuve, le détail et l'auteur.

### Transfert
Déplacer une quantité d'un lot d'une cuve vers une autre.
- Cuve de départ (cuves pleines), cuve d'arrivée, quantité (au plus le contenu), date, notes.
- **Règles** : la cuve d'arrivée doit être différente, et vide ou contenant déjà le même lot ; capacité et stock vérifiés.

### Assemblage
Mélanger plusieurs lots dans une cuve pour former un **nouveau lot**.
- On choisit au moins deux lots (cuve et quantité pour chacun), la cuve de l'assemblage, le code du nouveau lot (généré si vide), la date et les notes.
- En deux temps : **Vérifier l'assemblage**, puis **Confirmer l'assemblage**. Toute modification oblige à vérifier de nouveau.
- **La vérification calcule** l'acidité estimée (moyenne pondérée par les quantités) et donne des **avertissements** : plusieurs variétés (le lot ne sera plus monovariétal), plusieurs campagnes, lots sans analyse (qualité non estimable), mélange d'extra vierge avec une huile au-dessus de 0,8 %, acidité estimée au-dessus de 0,8 % (l'assemblage ne serait pas extra vierge), lots bloqués par une non-conformité (penser à la clôturer avec la décision « assemblage correctif » et à analyser le nouveau lot). Les avertissements n'empêchent pas l'assemblage.
- **Le nouveau lot** garde la variété, la campagne et l'huilerie seulement si tous les lots d'origine les partagent ; sa catégorie visée est la moins bonne des lots d'origine ; sa généalogie garde les quantités de chaque lot. Il devra être analysé.

### Sortie de stock
- Cuve, quantité, **motif** : vente en vrac, perte / écart, autre ; date, notes. Le client est obligatoire pour une vente.
- **Transport** (case à cocher, pour une vente) : transporteur, immatriculation, chauffeur, numéro de bon de livraison, date d'enlèvement, livraison prévue, adresse. Il crée une livraison suivie dans **Livraisons**.
- **Contrôle qualité avant une vente** : le lot ne doit pas être bloqué et doit respecter le **cahier des charges du client**. Le résultat s'affiche pendant la saisie et le bouton est désactivé si la vente est refusée. Avertissements possibles : lot sans analyse, dernière analyse non conforme ou incomplète, analyse de plus de 90 jours (`ALERTE_AGE_ANALYSE_JOURS`).
- L'envoi au conditionnement n'est plus une sortie : il passe par **Filtration** ou **Mise en bouteille**.

---

## Livraisons (`/livraisons`)
**Accès** : lecture pour tous. Changement de statut : Direction, Stock, Export.

**À quoi il sert** : suivre les transports sous-traités des ventes en vrac.
- Tableau : sortie, client, lot, quantité, transporteur, enlèvement, livraison, statut. Filtre par statut.
- Statuts : **Planifiée → En cours** (bouton « Marquer enlevée ») **→ Livrée** (bouton « Marquer livrée »), ou **Annulée**. Marquée livrée sans date, la date du jour est prise.

---

## Qualité (`/qualite`) et Critères de qualité (`/qualite/criteres`)
**Accès** : lecture pour tous. Non-conformités et critères : Direction, Qualité.

### Contrôle qualité
- **Compteurs** des lots en stock : lots en stock, conformes, analyse partielle, non conformes, sans analyse, lots bloqués, non-conformités ouvertes.
- **Alertes qualité** : lot bloqué par une non-conformité ouverte, dernière analyse non conforme, lot sans analyse, analyse partielle, dernière analyse de plus de 90 jours.
- **Non-conformités** : les ouvertes par défaut, ou toutes (case à cocher). Pour chacune : numéro, lot, date, description, statut, décision, action corrective, et bouton **Traiter**.

### Traiter une non-conformité
- Statuts : **Ouverte → En traitement → Clôturée**. Une non-conformité clôturée ne se modifie plus.
- **Décisions** : contre-analyse conforme, déclassement, assemblage correctif, dérogation (accord du client ou de la direction), destruction, autre. Champ action corrective.
- **Règles** : la clôture exige une décision. Un **déclassement** change la catégorie visée du lot (par défaut celle atteinte par l'analyse). Le lot est **débloqué** quand il n'a plus de non-conformité ouverte.
- On peut aussi **déclarer une non-conformité à la main** depuis la fiche d'un lot (description) : le lot est bloqué jusqu'à la clôture.
- **Effet d'un blocage** : vente en vrac, filtration, mise en bouteille, mouvement d'expédition de produits finis et départ d'une expédition export sont refusés.

### Critères de qualité
- **Catégories réglementaires** (règlement délégué UE 2022/2104), installées d'office :
  - Extra vierge : acidité ≤ 0,8 %, peroxyde ≤ 20 meq O2/kg, K232 ≤ 2,5, K270 ≤ 0,22, ΔK ≤ 0,01, esters éthyliques ≤ 35 mg/kg, médiane du défaut = 0, médiane du fruité > 0.
  - Vierge : acidité ≤ 2 %, peroxyde ≤ 20, K232 ≤ 2,6, K270 ≤ 0,25, ΔK ≤ 0,01, médiane du défaut ≤ 3,5, médiane du fruité > 0.
  - Leurs limites se modifient mais elles ne se désactivent pas. Les modifier **recalcule le statut qualité de tous les lots analysés**.
- **Cahiers des charges clients** : bouton pour en créer un (client, code, nom, critères avec minimum et/ou maximum, bornes comprises), modification et désactivation. Refus si un paramètre apparaît deux fois, si aucune borne n'est donnée ou si le minimum dépasse le maximum.
- Un cahier des charges client est contrôlé à la vente en vrac, à la mise en bouteille pour ce client, aux mouvements d'expédition, à la création, à la modification et au départ des expéditions export, et dans les recommandations IA.

---

## Filtration (`/filtration`)
**Accès** : lecture pour tous. Nouvelle filtration : Direction, Production.

**À quoi il sert** : enregistrer le passage d'un lot dans le filtre. L'huile filtrée forme un **nouveau lot** relié au lot filtré.
- **Champs** : cuve de départ (lot à filtrer), cuve d'arrivée (vide, souvent une cuve tampon de l'atelier), date, huile mise en filtration (kg), huile filtrée obtenue (kg), opérateur (obligatoire), type de filtre, porosité (µm), pression (bar), température (°C), débit (L/h), durée (minutes), code du lot filtré (généré si vide), notes.
- **Règles** :
  - seul un lot **analysé, conforme et non bloqué** peut être filtré (contrôle affiché pendant la saisie, bouton désactivé sinon) ;
  - l'huile filtrée ne peut pas dépasser l'huile mise en filtration ;
  - une perte de plus de **3 %** est signalée (sans être refusée) ;
  - le lot filtré reprend l'huilerie, la variété, la campagne, la catégorie et la qualité du lot d'entrée, tant qu'il n'a pas sa propre analyse.
- **Liste** : date, numéro F2026-…, lot filtré, cuves, entrée, sortie, perte, paramètres, opérateur, lot obtenu.

---

## Mise en bouteille (`/conditionnement` et fiche `/conditionnement/{id}`)
**Accès** : lecture pour tous. Nouvelle mise en bouteille : Direction, Production. Réglages du passeport : Direction, Qualité, Export. Mouvement de produits finis : Direction, Production, Stock, Export.

### Nouvelle mise en bouteille
Chaque mise en bouteille crée un **lot conditionné** (le numéro imprimé sur l'étiquette) qui entre dans le stock de produits finis.
- **Champs** : cuve (lot à mettre en bouteille), format, nombre d'unités, huile prise dans la cuve (calculée si vide), numéro de lot final (généré si vide, `C2026-0001`), DLUO, client (ou « Aucun (stock) »), pays de destination (code ISO), destination / commande, opérateur, date, notes.
- **Calculs automatiques** : huile utilisée = unités × contenance × 0,916 kg/L (`DENSITE_HUILE_KG_L`) ; DLUO par défaut = date + 18 mois (`DLUO_MOIS`).
- **Règles** : le lot doit être **analysé, conforme et non bloqué**, et conforme au cahier des charges du client s'il y en a un (contrôle affiché, bouton désactivé sinon). Le format doit être actif. Les règles des cuves s'appliquent.

### Liste des lots conditionnés
Date, numéro, lot vrac, format, unités, volume, huile, DLUO, destination, unités en stock.

### Fiche d'un lot conditionné
- **Informations** : format, unités et litres, stock, huile utilisée et cuve, date, DLUO, lot vrac, catégorie, qualité du lot vrac, client, destination, opérateur.
- **Mouvement de produits finis** (expédition, casse, ajustement) directement depuis la fiche.
- **Expéditions** qui contiennent ce lot.
- **Traçabilité** : tous les lots vrac d'origine, de proche en proche (filtrations, assemblages) jusqu'aux réceptions, avec huilerie, variété et campagne.
- **Mouvements de stock** du lot.
- **Passeport produit (QR code)** : voir ci-dessous.

### Passeport produit (QR code)
- Créé automatiquement à la première ouverture, avec une adresse publique impossible à deviner.
- On voit le QR code, l'adresse, si le passeport est publié, et le **nombre de consultations**.
- Boutons : télécharger le QR code en **PNG** (1024 px pour l'imprimeur) ou en **SVG**, **Imprimer les étiquettes**, **Choisir ce qui est affiché** (réglages), **Renouveler le QR code**.
- **Réglages** : publié ou non (non publié, la page publique répond « passeport indisponible »), nom du produit (par défaut « Huile d'olive extra vierge »), description, certifications (une par ligne), et rubriques affichées : huileries d'origine, résultats d'analyse, filtration et mise en bouteille, pays et marché de destination, preuves blockchain.
- **Renouveler** donne une nouvelle adresse : les QR codes déjà imprimés ne fonctionnent plus (en cas de QR code perdu ou copié). Une confirmation est demandée.

### Étiquettes (`/conditionnement/{id}/etiquettes`)
- **QR code du lot** : une grande étiquette pour les cartons ou les documents d'export.
- **Étiquettes de bouteille** : une planche de QR codes numérotés (de la bouteille n° … à n° …, **500 au plus** par planche). Chaque bouteille a un **numéro signé** : un numéro inventé est détecté comme non reconnu sur la page publique.
- Bouton **Imprimer**. Mention sous chaque QR code : « Scannez pour voir l'origine et les analyses ».

---

## Produits finis (`/produits-finis`)
**Accès** : lecture pour tous. Mouvements : Direction, Production, Stock, Export.

- **Stock par format** : unités, litres et nombre de lots.
- **Lots en stock** : numéro, format, lot vrac, date de mise en bouteille, DLUO, destination, unités, volume.
- **Journal des mouvements** : entrées par mise en bouteille, expéditions, casses, ajustements.
- **Mouvement de produits finis** : lot conditionné, type (**expédition**, **casse**, **ajustement**), unités (+ ou − pour un ajustement), client (obligatoire pour une expédition), référence (BL, facture), date, notes.
- **Règles** : les entrées se font uniquement par une mise en bouteille ; le stock ne peut pas devenir négatif ; une quantité nulle est refusée ; avant une expédition, le lot vrac d'origine ne doit pas avoir été bloqué depuis et le cahier des charges du client est vérifié.

---

## Expéditions export (`/expeditions` et fiche `/expeditions/{id}`)
**Accès** : lecture et PDF pour tous. Création, modification et changement de statut : Direction, Export.

### Liste
- **Suivi par destination** : pour chaque pays, nombre d'expéditions préparées, expédiées et livrées, volume parti, date du dernier départ, lots expédiés. Cliquer sur un pays filtre la liste.
- **Expéditions** : numéro, client, destination, départ, lots, unités, transport, statut. Filtres par numéro de lot (conditionné ou vrac), destination et statut.

### Nouvelle expédition / modification
- **Champs** : client (obligatoire, actif), pays de destination (par défaut celui du client, avec l'indication Union européenne ou non), départ prévu, adresse de livraison (par défaut celle du client), mode de transport (maritime, routier, aérien, ferroviaire), incoterm (EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP) et lieu, transporteur ou transitaire, navire / voyage ou vol, ports de chargement et de déchargement, numéro de conteneur, numéro de plomb, connaissement (B/L, CMR ou LTA), commande du client, facture, palettes, poids brut pesé, notes.
- **Lots à expédier** : un ou plusieurs lots conditionnés avec le nombre d'unités.
- **Règles** : au moins un lot, chaque lot une seule fois, assez d'unités en stock ; contrôle qualité de chaque lot pour ce client (blocage, cahier des charges). Le client et les lots ne se modifient plus après le départ ; une expédition annulée ne se modifie plus.

### Statuts
- **Préparée** (le stock n'est pas encore sorti) **→ Expédiée** (bouton « Valider le départ », avec date) **→ Livrée** (« Marquer livrée »). **Annulée** seulement avant le départ.
- **Au départ** : le contrôle qualité et le stock sont vérifiés à nouveau, puis chaque ligne sort du stock de produits finis (référence : le numéro de l'expédition). Le bouton est désactivé si le contrôle refuse le départ. Une expédition partie ne peut plus être annulée : un retour se fait par un ajustement d'inventaire.

### Fiche d'une expédition
- Toutes les informations (client, destination, incoterm, transport, ports, conteneur, plomb, connaissement, commande, facture, palettes, poids, auteur).
- **Contrôle qualité actuel** des lots (blocages et avertissements) tant qu'elle est préparée.
- **Lots expédiés** : format, lot vrac, qualité, unités, **cartons** (avec la mention « dernier carton incomplet »), volume, **poids net** calculé, DLUO, stock restant.

### Dossier export (PDF)
Cinq documents, ou le **dossier complet** (tous à la suite) :
1. **Liste de colisage** (packing list) : exportateur, destinataire, marchandises, poids net total, poids brut, palettes, transport.
2. **Certificat d'origine** (déclaration d'origine de l'exportateur) : pays d'origine, huileries, variétés, campagnes, destination, et le texte de la déclaration d'origine préférentielle UE-Tunisie (avec le numéro d'exportateur agréé s'il est configuré ; sans lui, valable jusqu'à 6 000 €, au-delà il faut l'EUR.1).
3. **Bulletins d'analyse** : pour chaque lot, laboratoire, bulletin, date, catégorie atteinte, résultat, et chaque paramètre comparé à la limite UE (conforme ou hors limite).
4. **Déclaration de conformité UE** : produits (lot, désignation, **code NC** 1509 20 00 / 1509 30 00 / 1509 40 00, format, unités, analyse, DLUO) et déclaration du producteur (règlements UE 2022/2104, 2022/2105, 1169/2011, 1935/2004).
5. **Fiches techniques produit** : une par lot (dénomination, code NC, origine, variétés, huileries, campagne, composition, procédé et filtrations, format, unités par carton, dates, conservation, allergènes, caractéristiques analytiques).

**Règles** : pas de document pour une expédition annulée. La déclaration de conformité et le dossier complet sont **refusés** si un lot n'est pas analysé, conforme et non bloqué, ou sort du cahier des charges du client (la raison s'affiche). L'**empreinte SHA-256** de chaque PDF remis est gardée dans le journal d'audit, comme preuve du document envoyé. Les informations de l'exportateur viennent des réglages `EXPORTATEUR_*`.

---

## Intelligence artificielle (`/ia`)
**Accès** : tous les rôles (lecture seule).

Des statistiques simples et explicables, recalculées à chaque ouverture sur tout l'historique : elles s'améliorent au fil des saisies. Quatre onglets :

### Prévision par huilerie
- Pour chaque huilerie active : nombre de lots analysés, taux de conformité, **risque de livrer une huile non extra vierge**, et la valeur prévue de chaque paramètre (acidité, peroxyde, K232, K270, polyphénols).
- Calcul : première analyse de chaque lot reçu ; l'historique de l'huilerie est mélangé avec la moyenne de toutes les huileries tant qu'il est court ; intervalle où la valeur tombe 8 fois sur 10 ; fiabilité **faible** (moins de 3 lots), **moyenne** (3 à 7) ou **bonne** (8 et plus).
- La même prévision apparaît dans le formulaire de réception.

### Évolution en stock
- Vitesse d'évolution par mois de l'acidité, du peroxyde et du K270 pendant le stockage, apprise sur les lots analysés au moins deux fois à 7 jours d'écart (il faut au moins 3 lots).
- Pour chaque lot en stock : dernière analyse, valeur estimée aujourd'hui et date à laquelle la **limite extra vierge** serait atteinte. Alerte si c'est dans les **90 jours** (reprise dans le bandeau du tableau de bord).

### Recommandations
- Pour **un client** ou **un marché** (un pays ou toute l'Union européenne).
- **Lots recommandés** : lots vrac en stock qui passent le contrôle qualité et les cahiers des charges (du client, ou de tous les clients du marché), classés par **score sur 100** : 60 points pour la marge de qualité par rapport aux limites, 40 points pour l'ancienneté (premier entré, premier sorti ; 180 jours donnent les 40 points). Avec la raison du classement.
- **Formats conseillés** : les formats les plus expédiés à ce client, sinon vers ce marché, sinon tous marchés confondus, avec leur part.

### Anomalies
- Période : 30 jours, 90 jours, 12 mois ou tout l'historique.
- Détecte : valeur d'analyse inhabituelle (score robuste ≥ 3,5, avec au moins 8 valeurs d'historique) ; analyse datée dans le futur ou faite plus de 30 jours avant la réception ; réception de quantité inhabituelle pour l'huilerie ; perte de filtration inhabituelle ; mise en bouteille dont l'huile sortie s'écarte de plus de 2 % de la quantité théorique (Alerte au-delà de 5 %). Chaque anomalie mène au lot concerné.

---

## Blockchain (`/blockchain`)
**Accès** : Direction et Administrateur.

**À quoi il sert** : prouver que le journal d'audit n'a pas été modifié.
- **Principe** : les événements du journal sont **scellés** par paquets (ancrages) : empreinte SHA-256 de chaque événement, racine de Merkle, et empreinte chaînée à l'ancrage précédent. Si un portefeuille est configuré, l'empreinte est inscrite dans une transaction sur **Polygon** (statuts : scellé, envoyé, confirmé, erreur avec nouvel essai). Sans configuration, les ancrages sont seulement scellés dans la base et la vérification marche quand même.
- **État** : réseau, portefeuille et solde en POL (ou « Non configuré » / « Blockchain injoignable »), nombre d'événements scellés, fréquence de l'ancrage automatique (toutes les 60 minutes par défaut, `BLOCKCHAIN_INTERVALLE_MINUTES`).
- **Ancrer maintenant** : scelle tout de suite les nouveaux événements.
- **Vérifier l'intégrité** : recalcule chaque empreinte, chaque racine et chaque chaînage, et relit les transactions sur la blockchain. Affiche « Intégrité vérifiée » ou la liste des problèmes (données modifiées ou supprimées après scellement).
- **Ancrages** : numéro, date, nombre d'événements, statut, empreinte ancrée, transaction, bloc.
- **Derniers événements du journal** (30) et **Preuve d'un événement** : empreinte, chemin de Merkle jusqu'à la racine, ancrage et données de l'événement.

---

## Référentiels
**Accès** : lecture pour tous. Chaque écran a ses rôles d'écriture (ci-dessous). Fonctionnement commun : tableau, bouton d'ajout, **Modifier**, **Désactiver / Réactiver**, case **Afficher les désactivés**. Un élément désactivé n'est plus proposé dans les formulaires mais reste lié à l'historique.

| Écran | Champs | Écriture |
|---|---|---|
| **Huileries** | code, nom, région, adresse, téléphone, n° d'agrément | Direction, Stock |
| **Variétés** | code, nom, description (installées : Chemlali, Chétoui, Oueslati) | Direction, Qualité |
| **Cuves et citernes** | code, type (cuve souterraine, citerne, cuve tampon de conditionnement), capacité (kg), emplacement (installées : CS-01 à CS-03 de 24 t, CT-01 et CT-02 de 30 t) | Direction, Stock |
| **Clients** | code, raison sociale, pays (code ISO, ex. FR), ville, adresse, email, téléphone, n° de TVA | Direction, Export |
| **Formats de bouteille** | code, nom, contenance (ml), matériau, unités par carton | Direction, Production |

Les cahiers des charges qualité des clients se gèrent dans **Qualité > Critères de qualité**. Le nombre d'unités par carton sert au calcul des cartons dans les expéditions.

---

## Utilisateurs (`/utilisateurs`)
**Accès** : Administrateur seul.

- Tableau : nom, email, rôle, statut (**Actif**, **En attente**, **Désactivé**). Les inscriptions en attente sont toujours affichées.
- **Ajouter un utilisateur** : nom, email, rôle, mot de passe (8 caractères minimum), compte actif.
- **Valider** une inscription : choisir un rôle et cocher « Compte actif ». Activer un compte sans rôle est refusé.
- **Modifier** : nom, email, rôle, mot de passe (laisser vide pour ne pas le changer). **Désactiver / Réactiver**.

---

## Page publique du QR code (`/p/{jeton}`)
**Accès** : tout le monde, sans connexion (importateur, client, consommateur qui scanne le QR code).

- **Bouteille** : si le QR code vient d'une étiquette de bouteille, « Bouteille n° X sur N : numéro authentifié par OLIVED », ou un avertissement « numéro de bouteille non reconnu ».
- **Produit** : nom, description, catégorie, contenant, date de mise en bouteille, DLUO.
- **Origine** : pays (Tunisie), huileries (si affichées), variétés, campagne, assemblage éventuel.
- **Analyses de laboratoire** (si affichées) : chaque paramètre avec la limite UE.
- **Procédé** (si affiché) : filtrations (date, filtre, porosité) et mise en bouteille.
- **Certifications et conformité** : la mention « Conforme au règlement délégué (UE) 2022/2104 » n'apparaît que si le lot vrac est conforme aujourd'hui et non bloqué ; plus les certifications saisies. Bouton de téléchargement de la **déclaration de conformité UE en PDF** du lot (seulement si le lot est conforme et les analyses affichées), sans nom de client ni quantités.
- **Expédition** (si affichée) : numéro de lot, pays et marché de destination, dates de départ et de livraison. Jamais le client, la commande ni les quantités.
- **Preuve blockchain** (si affichée) : chaque étape (réception, assemblage, filtration, analyse, mise en bouteille) marquée « ancrée » avec sa transaction, « en cours » si elle n'est pas encore horodatée, ou « modifiée » si un enregistrement a changé après son scellement. Le contenu des événements n'est jamais publié.
- Passeport non publié ou adresse inconnue : « Passeport indisponible ».
- Chaque ouverture augmente le compteur de consultations visible dans l'application.

---

## Réglages utiles (`api/.env`)

| Réglage | Effet | Défaut |
|---|---|---|
| `ALERTE_DUREE_STOCKAGE_JOURS` | alerte de durée de stockage | 180 |
| `ALERTE_AGE_ANALYSE_JOURS` | analyse jugée ancienne | 90 |
| `DENSITE_HUILE_KG_L` | kg d'huile par litre (mise en bouteille, poids net) | 0,916 |
| `DLUO_MOIS` | DLUO par défaut | 18 |
| `WEB_URL`, `PASSEPORT_WEB_URL` | adresse des liens d'e-mail et des QR codes | localhost:3000 |
| `PASSEPORT_PRODUCTEUR` | nom du producteur sur la page publique | OLIVED |
| `EXPORTATEUR_*` | informations imprimées sur les PDF | OLIVED, Tunisie |
| `SMTP_*` | envoi des e-mails | console |
| `BLOCKCHAIN_*` | réseau, clé, fréquence et confirmations de l'ancrage | scellement en base seulement, 60 min |
