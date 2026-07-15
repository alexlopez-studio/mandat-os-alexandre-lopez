# Suivi Projet - Mandat OS

## État actuel - 12/07/2026

Le repo `mandat-os-alexandre-lopez` est maintenant le projet autonome dédié à Mandat OS.

- Repo : `alexlopez-studio/mandat-os-alexandre-lopez`
- Branche de travail locale : `preview`
- Branche de livraison : `main`
- Domaine production : `https://app.alexandrelopez.fr`
- Projet Vercel : `mandat-os-alexandre-lopez`
- Rôle produit : cockpit interne, affaires, opportunités, radar, clients, IA, jobs et automatisations métier.
- Site public séparé : `site-alex-lopez-provence` sur `https://alexandrelopez.fr`
- Portail client séparé : `espace-client-alexandre-lopez` sur `https://espace.alexandrelopez.fr`

### Avancement

- Extraction depuis l’état local du site source effectuée.
- Nouveau repo GitHub créé et poussé.
- Projet Vercel créé, configuré en Next.js et déployé.
- Domaine `app.alexandrelopez.fr` configuré, SSL actif et routage vérifié.
- Auth admin réactivée :
  - `/admin/*`, `/app/*`, `/dashboard/*` exigent une session.
  - API internes sensibles protégées par middleware avec `401` sans session.
- Protection SSO Vercel réactivée sur les URLs techniques `*.vercel.app`.

### Vérifications du 12/07/2026

- `npm run lint` OK.
- `npm run build` OK.
- Production Vercel `READY`.
- `https://app.alexandrelopez.fr/admin/login` répond `200`.
- `https://app.alexandrelopez.fr/app/dashboard` redirige vers le login sans session.
- `https://app.alexandrelopez.fr/api/market/dashboard` répond `401` sans session.

### Points de vigilance

- Les variables production ont été copiées depuis le projet Vercel source sans affichage dans les logs.
- Les warnings historiques d’imports inutilisés restent à nettoyer.
- `npm audit` signale encore des vulnérabilités dans l’arbre npm ; ne pas lancer `npm audit fix --force` sans passe dédiée.
- Le portail client public ne doit pas dépendre des routes Mandat OS.

### Prochaines étapes

1. Faire une passe de nettoyage pour retirer les routes publiques marketing encore présentes mais inutiles côté Mandat OS.
2. Tester une connexion admin réelle Supabase sur `app.alexandrelopez.fr`.
3. Vérifier la présence et l’exécution du cron Vercel `/api/jobs/sync-zones`.
4. Stabiliser les variables Preview/Development si besoin.
5. Continuer les développements Mandat OS uniquement dans ce repo.

### 15/07/2026 - Reprise locale des deux applications

- Base/branche : `preview`, alignée avec `origin/preview`.
- Type : reprise / environnement local.
- Statut : fait.
- Résumé : redémarrage des serveurs de l’espace client autonome et de Mandat OS. Les changements locaux préexistants sont conservés (`../espace-client-alexandre-lopez/src/App.tsx` et le workspace local non suivi de Mandat OS).
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualité : `GET http://localhost:3000/` → `200` ; `GET http://localhost:3002/app/dashboard` → `200`.
- Suite : reprendre le chantier prioritaire depuis l’état actuel de l’espace client et de Mandat OS, sans push.

### 12/07/2026 - Réorganisation opportunité et suivi client

- Fiche opportunité simplifiée : onglets `Vue d’ensemble`, `Estimation`, `Suivi client`, `Historique`.
- Suppression du bloc `Préparation mandat & portail` dans la vue d’ensemble.
- Fusion de `Bien & technique` dans `Estimation`, sans retrait de champ.
- Renommage des surfaces d’administration client en `Suivi client`.
- Ajout d’un lien client stable et sécurisé via `client_dossiers.public_token`.
- Création du suivi client désormais vide : plus de documents ni jalons générés automatiquement.
- Ajout de l’onglet interne `Diffusion & statistiques` dans le workspace `Suivi client`.
- Migration Supabase `028_client_dossiers_public_token.sql` appliquée sur la base distante et marquée appliquée dans l’historique.
- Contrôle base : 7 dossiers existants, 7 tokens présents, 7 tokens uniques.
- Vérification technique : `npx tsc --noEmit` OK.

### 12/07/2026 - Cohérence URLs et indexation

- Domaine canonique confirmé : `https://app.alexandrelopez.fr`.
- Correction du fallback `env.app.siteUrl` vers `https://app.alexandrelopez.fr`.
- Ajout de `src/app/robots.ts` avec `Disallow: /` : Mandat OS ne doit pas être indexé.
- Pas de sitemap SEO exposé pour Mandat OS, afin de ne pas publier de routes internes.
- Les liens web visibles dans les templates email hérités pointent désormais vers `https://alexandrelopez.fr`.
- Vérification : `npm run lint` OK.

### 12/07/2026 - Passerelle vers le portail client autonome

- Ajout d’un helper `client-portal-url` pour centraliser l’URL cible du portail client.
- Les liens magiques client générés par Mandat OS redirigent désormais vers `https://espace.alexandrelopez.fr/auth/callback`.
- Le dossier client est transmis en paramètre `dossier` lorsque la route dispose de l’identifiant.
- Ajout de `CLIENT_PORTAL_URL` dans `.env.example`.
- Variable Vercel `CLIENT_PORTAL_URL` ajoutée en Production et Development ; Preview utilisera le fallback codé tant que la branche `preview` Mandat OS n’existe pas côté remote.
- Vérification : `npm run lint` OK et `npm run build` OK, avec warnings historiques d’imports inutilisés.

### 12/07/2026 - Mandat OS pilote le portail client lecture seule

- Ajout d’une API publique contrôlée `/api/client-portal/dossier` retournant une projection client publiable et `readOnly`.
- Ajout d’un token d’aperçu signé temporaire et d’un endpoint admin `/api/market/clients/[id]/preview-link`.
- Les boutons Mandat OS ouvrent désormais `https://espace.alexandrelopez.fr/preview?token=...` pour prévisualiser le même portail que le client.
- Les actions d’invitation sont renommées “Donner accès au client”.
- Le portail devient éligible à partir de “Remise de l’estimation”, puis reste disponible après “Mandat signé”.
- Ajout de `CLIENT_PORTAL_PREVIEW_SECRET` dans `.env.example` avec fallback serveur sur les secrets Supabase existants.

### 14/07/2026 - Projection client : contexte bien et statut suivi de vente

- La projection `/api/client-portal/dossier` expose désormais `property_context.type` et `property_context.commune`.
- Ajout de `sales_follow_up.status` pour piloter l’Espace Client :
  - `active` si l’opportunité liée est en `Mandat signé` ou `Vendu` ;
  - `teaser` dans tous les autres cas.
- Aucune donnée admin supplémentaire ni secret n’est exposé au portail client.
- Ajout de l’endpoint dev-only `/api/dev/client-portal-test-dossiers`.
- Cet endpoint est indisponible en production et sert uniquement à ouvrir des aperçus locaux sans login client.

### Règle de suivi

- Ajouter une entrée datée à ce fichier après chaque décision structurante, livraison ou audit.
- Travailler localement sur `preview`.
- Ne rien pousser sans demande explicite d’Alexandre.
- Quand Alexandre demande explicitement une livraison, intégrer `preview` vers `main` puis pousser `origin/main`.
- Conserver les notes historiques ci-dessous comme mémoire des travaux dont Mandat OS est issu.

## Regle actuelle - 17/06/2026

Decision : Codex reprend seul le developpement et le design pour le moment.

- Branche de travail unique : `preview`.
- Source de verite GitHub : `origin/preview`.
- Travail local par defaut.
- Aucun push sans validation explicite d'Alexandre.
- Si Alexandre valide un push, pousser `preview` vers `origin/preview`.
- Ne plus utiliser les branches `design/*` et `feat/*` pour le flux courant, sauf demande explicite.
- Les branches de sauvegarde locales servent uniquement de filet de securite, pas de base de travail.
- A chaque fin de tache, mettre a jour ce fichier avant de conclure.
- Apres chaque modification, audit ou decision structurante, ajouter une entree horodatee dans ce fichier.
- Apres un changement significatif, lancer l'audit Playwright adapte et tracer le resultat.

Note : les lots Linear ci-dessous sont historiques et ne refletent plus l'etat reel du code. La memoire courante est dans `docs/MEMOIRE_SESSION.md`.

### 11/07/2026 21:59 CEST - Animations et micro-interactions du portail vendeur
- Base/branche : `preview`, changements locaux preexistants conserves ; aucun push.
- Source d'inspiration : animations `motion/react` du prototype `outil-estimation-portail-client`, transposees avec `framer-motion` deja installe dans le projet.
- Type : UX motion / feedback interaction / accessibilite.
- Statut : **fait**.
- Travail :
  1. Transition entree/sortie entre Tableau de bord, Estimation, Documents et Suivi de vente avec `AnimatePresence`.
  2. Retour fluide en haut de page lors d'un changement de rubrique.
  3. Feedback `whileTap` sur la navigation mobile, deplacement horizontal discret au survol de la sidebar et feedback actif sur les boutons/liens.
  4. Apparition progressive au scroll des groupes du tableau de bord, une seule fois par session d'affichage.
  5. Animation de la couverture et zoom tres leger de la photo au survol desktop.
  6. Transition animee entre `Avis de valeur Conseiller` et `Estimation Express iAD`.
  7. Respect de `prefers-reduced-motion` dans les animations JS et CSS.
  8. Correction d'une course de nettoyage Leaflet : annulation du timer `invalidateSize` lors du demontage rapide de la carte.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`, `src/app/espace-client/comparable-leaflet-map.tsx`, `src/app/globals.css`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK avec warnings historiques ; `git diff --check` OK ; audit Chromium en mouvement normal et reduit, transitions estimation conseiller/express + changement de rubrique + scroll bas de page sans erreur console ni debordement horizontal.
- Suite : build Next final puis revue visuelle Alexandre ; aucun commit/push sans demande explicite.

### 11/07/2026 21:51 CEST - Main group et hierarchie visuelle du portail vendeur
- Base/branche : `preview`, changements locaux preexistants (redirection estimation iad + redesign portail) conserves ; aucun push.
- Type : design produit / accueil portail / hierarchie des contenus.
- Statut : **fait** selon le plan valide.
- Travail :
  1. Ajout en tete du tableau de bord d'une couverture complete du dossier : photo, type de bien, secteur, titre, adresse, reference, client, caracteristiques, date d'actualisation, statut et actions estimation/appel.
  2. Source image : `property_snapshot.hero_image_url`, puis `property_snapshot.image_url`, puis fallback local `/maison-bleue-cotignac.jpg`, sans migration ni nouveau store.
  3. Reorganisation de l'accueil selon l'ordre couverture, KPI, prochaines etapes, accompagnement/audience, synthese du bien, message conseiller et CTA final.
  4. Ajout d'un en-tete de page commun au langage du prototype pour Estimation, Documents et Suivi de vente : eyebrow bleu, icone, titre fort et description courte.
  5. Main group limite a 1280 px avec rythme vertical de 24 px ; onglet interne conseiller/express repris en conteneur blanc/slate et boutons actifs rectangulaires.
  6. Les quatre espaces et toutes les donnees Supabase existantes restent inchanges fonctionnellement.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`, `src/app/espace-client/test/page.tsx`, `src/app/globals.css`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK avec warnings historiques et warning `<img>` attendu pour supporter les URLs libres ; `git diff --check` OK ; `npm run build` OK avec warnings historiques ; audit Chromium desktop 1440 px et mobile 390 px sur Verger sans debordement ; navigation et donnees controlees dans les quatre espaces (prix 400 000 EUR, titre de propriete, diffusion/statistiques) ; dossier sans photo affiche le fallback ; URL volontairement invalide dans `/espace-client/test` retombe correctement sur le fallback.
- Suite : revue Alexandre sur localhost 3002 ; aucun commit/push sans demande explicite.

### 11/07/2026 19:00 CEST - Alignement visuel portail sur l'app outil estimation
- Base/branche : `preview`, changements locaux preexistants conserves ; aucun push.
- Source de design : `/Users/AlexandreLopez/Documents/GitHub/outil-estimation-portail-client`.
- Type : design system / sidebar / boutons / cards / onglets portail vendeur.
- Statut : **fait**.
- Travail :
  1. Sidebar desktop reprise fidelement du prototype : fond `slate-900`, header iad, separation dossier/navigation, navigation active bleu iad, pictogrammes encadres et carte conseiller sombre persistante.
  2. Accent portail aligne sur le bleu lumineux `#00A0E2` de l'app outil estimation.
  3. Boutons shadcn et boutons `rounded-full` du portail ramenes vers un rayon de 12 px, graisse 700, hauteur minimale 40 px et ombre discrete.
  4. Cards/KPI renforcees avec bordure slate legere et ombre multicouche tres douce, sans modifier la structure des donnees ni les interactions.
  5. Badges et indicateurs de statut restent en pills afin de conserver leur semantique distincte des actions.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`, `src/app/globals.css`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK avec warnings historiques ; `git diff --check` OK ; audit visuel Chromium desktop 1440 px et mobile 390 px sur le dossier Verger, aucun debordement horizontal et navigation conservee.
- Suite : revue visuelle Alexandre, puis commit/push uniquement sur demande explicite.

### 11/07/2026 18:50 CEST - Reprise de l'interface du nouveau prototype dans le portail client
- Base/branche : `preview`, modifications locales preexistantes sur la redirection estimation conservees ; travail local non pousse.
- Source de design exploree : `/Users/AlexandreLopez/Documents/GitHub/outil-estimation-portail-client` (prototype Vite/React cree le 11/07).
- Type : design produit / UX portail vendeur / responsive.
- Statut : **fait** pour le nouveau shell de navigation V1.
- Direction reprise : hierarchie en trois espaces (identite dossier, navigation metier, conseiller permanent), separation claire Accueil / Estimation / Documents / Suivi de vente et densite plus proche d'un portail de suivi que d'une landing page.
- Adaptation a la charte : sidebar desktop claire plutot que sombre, accent bleu iad, fonds `surface`, logo iad officiel, aucune grande section sombre ajoutee, telephone `06 13 18 01 68` conserve en HTML.
- Travail :
  1. Remplacement de la navigation desktop en header par une sidebar fixe de 288 px avec logo iad, identite du dossier actif et quatre destinations metier.
  2. Ajout d'une carte conseiller persistante avec portrait et contact direct.
  3. Conservation d'un header compact et de la navigation basse sur mobile.
  4. Elargissement controle du contenu a 1320 px pour mieux exploiter les tableaux, graphiques et rapports sans perdre la lisibilite.
  5. Aucune duplication du store local du prototype : tous les contenus restent alimentes par le ViewModel et les donnees Supabase du portail reel.
- Fichier principal : `src/app/espace-client/portal-view.tsx`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK avec cinq warnings historiques de composants inutilises ; `git diff --check` OK ; audit visuel Chromium sur le vrai dossier Verger en 1440 x 1000 et 390 x 844 ; aucun debordement horizontal ; navigation fonctionnelle vers `Mon estimation`, `Mes documents`, `Suivi de vente` et retour `Tableau de bord`.
- Suite possible : reprendre dans un second lot la couverture editoriale du prototype (hero photo du bien) et enrichir les statistiques avec les metriques `consultations detaillees` / `clics telephone` lorsque ces donnees seront disponibles.
- Push : aucun sans demande explicite.

### 11/07/2026 16:16 CEST - Bascule temporaire de l'estimation en ligne vers iad
- Base/branche : `preview`, alignee avec `origin/preview` au depart ; travail local non pousse.
- Type : parcours public / conversion estimation / redirection externe.
- Statut : **fait**.
- Decision Alexandre : l'outil d'estimation interne n'etant pas encore finalise, tous les CTA directs d'estimation en ligne doivent pointer temporairement vers `https://www.iadfrance.fr/conseiller-immobilier/alexandre.lopez/estimation`.
- Travail :
  1. Centralisation de la destination dans `ESTIMATION_URL` (`src/lib/env.ts`).
  2. Remplacement des liens directs vers `/outils/vendre` sur le CTA du header public (desktop et menu mobile), la homepage, la page vendre, le hub outils, la page avis de valeur, les pages marche locales, les resultats d'estimation et les onglets services.
  3. Ajout d'une redirection temporaire HTTP depuis `/outils/vendre` pour couvrir les anciens liens, favoris et URLs deja diffusees.
  4. Retrait de `/outils/vendre` du sitemap et maintien du tracking `seller_estimation_tool` sur la destination iad.
  5. Les pages editoriales `/vendre` et `/avis-de-valeur-immobilier` restent accessibles ; seuls leurs CTA d'estimation basculent vers iad.
- Fichiers principaux : `src/lib/env.ts`, `next.config.ts`, `src/components/layout/Header.tsx`, `src/components/home/HomepageContent.tsx`, `src/components/outils/OutilsContent.tsx`, `src/components/sections/ServicesTabs.tsx`, `src/app/vendre/page.tsx`, `src/app/avis-de-valeur-immobilier/page.tsx`, `src/app/marche/[commune]/page.tsx`, `src/app/resultats/[token]/resultats-client.tsx`, `src/app/sitemap.ts`, `src/lib/analytics.ts`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK avec un warning image historique ; `git diff --check` OK ; `npm run build` OK avec warnings historiques ; `/outils/vendre` retourne `307` vers l'URL iad exacte ; HTML local controle avec 5 occurrences du lien sur la homepage et 3 sur `/vendre`.
- Suite : remettre `ESTIMATION_URL` sur l'outil interne et retirer la redirection lorsque l'outil sera finalise ; aucun push sans demande explicite.

### 11/07/2026 15:58 CEST - Validation de promotion preview vers main
- Base/branche : `preview`, `origin/main` confirme ancetre direct, sans divergence ; 66 commits de retard avant promotion.
- Type : livraison Git / production.
- Statut : **valide pour push** a la demande explicite d'Alexandre.
- Perimetre final controle : harmonisation des onglets de fiche affaire et statistiques de diffusion historisees, avec migration Supabase `027` deja appliquee.
- Verification avant livraison : working tree attendu uniquement sur les fichiers du chantier ; `git diff --check` OK ; TypeScript, lint cible, build et audits desktop/mobile deja valides dans les entrees precedentes.
- Action autorisee : commit sur `preview`, push vers `origin/preview`, puis fast-forward de `origin/main` sur le meme commit.

### 11/07/2026 12:58 CEST - Statistiques de diffusion historisees par affaire
- Base/branche : `preview`, travail local non pousse ; migration ciblee appliquee au projet Supabase lie `byrsmbgfkvgxdtdyhrro`.
- Type : fonctionnalite produit / affaire / portail vendeur / statistiques.
- Statut : **fait** pour la saisie manuelle et le suivi temporel V1.
- Travail :
  1. Ajout de la table `opportunity_audience_snapshots` : un releve cumulatif par affaire, portail et date, avec vues, contacts, favoris, visites et note interne ; correction d'un releve par upsert sur la meme date.
  2. Ajout de `GET/POST /api/market/opportunities/[id]/audience` avec validation, calcul des derniers totaux par portail, chronologie consolidee et variations par rapport au point precedent.
  3. Ajout dans l'onglet `Portail client` de la fiche affaire du bloc `Diffusion & statistiques` : formulaire de saisie, KPI, courbe vues/contacts et liste des derniers releves.
  4. Projection automatique du dernier etat dans `professional_opinion.audience` pour conserver l'affichage `Diffusion & Statistiques` du portail vendeur ; lecture portail etendue aux supports additionnels.
  5. Migration `027_opportunity_audience_snapshots.sql` executee de facon ciblee puis marquee appliquee ; aucune ancienne migration divergente rejouee.
- Fichiers principaux : `supabase/migrations/027_opportunity_audience_snapshots.sql`, `src/app/api/market/opportunities/[id]/audience/route.ts`, `src/app/admin/market/opportunities/[id]/AudienceTrackingPanel.tsx`, `src/app/admin/market/opportunities/[id]/page.tsx`, `src/app/espace-client/portal-view.tsx`, `src/types/supabase.ts`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK (seulement warnings historiques dans `portal-view.tsx`) ; `npm run build` OK avec warnings historiques ; API GET vide 200 et validation 400 ; test fonctionnel temporaire de 3 releves sur 2 dates/2 portails OK (totaux 350 vues, 14 contacts, chronologie 100 -> 350, projection SeLoger/Leboncoin correcte), puis suppression confirmee des donnees temporaires ; audit Chromium desktop 1440 px et mobile 390 px sans debordement horizontal, formulaire utilisable dans les deux formats.
- Utilisation : affaire > onglet `Portail client` > `Diffusion & statistiques` > `Nouveau releve`.
- Suite possible : import automatique depuis les portails si une source/API exploitable est disponible ; aucun push sans demande explicite.

### 11/07/2026 12:34 CEST - Harmonisation des onglets de la fiche affaire
- Base/branche : `preview`, alignee avec `origin/preview` au depart ; travail local non pousse.
- Type : design UI / navigation affaire.
- Statut : **fait**.
- Travail : remplacement du style encadre a soulignement noir des onglets de `/app/opportunities/[id]` par une navigation segmentee conforme a la charte : fond surface, bordure legere, onglet actif blanc avec accent bleu iad, rayons coherents et defilement horizontal utilisable sur mobile.
- Fichier principal : `src/app/admin/market/opportunities/[id]/page.tsx`.
- Verification : `npx tsc --noEmit` OK ; lint cible OK sans avertissement ; `git diff --check` OK ; audit visuel Chromium desktop 1440 px et mobile 390 px sur l'affaire Verger, avec repartition reguliere sur desktop et defilement horizontal sans compression des libelles sur mobile.
- Suite : recueillir le retour visuel d'Alexandre ; aucun push sans demande explicite.

### 11/07/2026 00:17 CEST - Avis de valeur iad/Yanport : reprise exhaustive des rubriques PDF
- Base/branche : `preview`, alignee avec `origin/preview` au depart ; travail local non pousse.
- Type : fonctionnalite produit / avis de valeur / portail client.
- Statut : **fait** pour la structure applicative complete et la retranscription Verger dans l'app ; portail client en attente d'email client.
- Source analysee : `/Users/AlexandreLopez/Downloads/Votre estimation Alain et Yvette VERGER.pdf` (12 pages).
- Travail :
  1. Extraction du PDF et inventaire des rubriques : couverture, plan de situation, informations cadastrales, presentation du bien, points forts, points a defendre, tendance du marche local, analyse de la concurrence, methodologie iad, comparables vendus, positionnement du bien, recommandations/conclusion, nos biens vendus, avis clients, les + iad, services iad.
  2. Extension de l'onglet `Estimation` de `/app/opportunities/[id]` avec un editeur `Avis de valeur complet iad` couvrant toutes ces rubriques, stockees dans `opportunities.professional_opinion.iad_report`.
  3. Conservation des champs existants `price`, `price_low`, `price_high`, `summary`, `arguments`, `comparables` pour compatibilite avec le portail actuel et la source unique Affaire.
  4. Ajout du rendu portail client des rubriques completes quand `iad_report` est renseigne : blocs plan/cadastre, presentation, marche, concurrence, comparables, positionnement, conclusion, preuves iad et services.
  5. Creation/renseignement de l'affaire Verger dans Supabase via l'API locale : `116b26d6-c024-43d5-ab0b-2dcd2032b9a1`, titre `Alain et Yvette Verger - maison Marseille 11e`, stade `Remise de l'estimation`, avis iad complet renseigne.
- Fichiers principaux : `src/app/admin/market/opportunities/[id]/page.tsx`, `src/app/espace-client/portal-view.tsx`, `docs/SUIVI_PROJET.md`.
- Verification :
  - Extraction PDF via `pypdf`/`pdfplumber` apres installation utilisateur des dependances Python.
  - Controle d'exhaustivite : toutes les rubriques ci-dessus sont retrouvees dans le PDF et ont une correspondance dans le modele app.
  - `npx tsc --noEmit` OK.
  - `npm run lint` OK avec warnings historiques/non bloquants.
  - `npm run build` OK avec warnings historiques/non bloquants.
  - Audit Playwright desktop/mobile sur `/app/opportunities/4958c8c2-46b0-411e-adfb-1fa04985ef11`, onglet `Estimation` : 10 sections visibles, aucun debordement horizontal detecte.
  - Verification API sur l'affaire Verger : `iad_report` present, 11 sections stockees, 6 comparables vendus, 9 biens vendus iad, 6 avis clients, 2 lignes cadastrales.
  - Verification Playwright sur `/app/opportunities/116b26d6-c024-43d5-ab0b-2dcd2032b9a1`, onglet `Estimation` : valeurs Verger presentes dans les inputs/textareas, aucun debordement horizontal desktop.
- Point d'attention : la creation du portail client Verger echoue correctement avec `Ce lead ne contient pas d’email client`, car le PDF ne fournit pas d'email Verger. Ajouter un email client permettra d'ouvrir le portail.
- Suite : renseigner l'email client Verger, ouvrir le portail client, puis verifier le rendu public des rubriques `iad_report`.

### 10/07/2026 15:19 CEST - Lot Affaire : cockpit mandat et portail client integre
- Base/branche : `preview`, alignee avec `origin/preview` au depart ; travail local non pousse.
- Type : fonctionnalite produit / opportunites / mandats / portail client.
- Statut : **fait** pour cet increment UI.
- Travail :
  1. Ajout sur `/app/opportunities/[id]` d'un panneau `Preparation mandat & portail` qui resume les points prets ou manquants : stade portail, contact vendeur, bien cadre, avis de valeur, portail ouvert, documents suivis, prochaine action.
  2. Ajout d'actions portail directement dans la fiche affaire : ouvrir le portail quand le stade le permet, inviter le client, ouvrir/copier l'acces presentation client.
  3. Renforcement du `DossierWorkspace` embarque avec 4 KPI immediats : documents valides, plan publie, visites, offres.
  4. Ajustement mobile des onglets de fiche affaire pour eviter les libelles tronques sur petit ecran.
- Fichiers principaux : `src/app/admin/market/opportunities/[id]/page.tsx`, `src/app/admin/market/clients/DossierWorkspace.tsx`, `docs/SUIVI_PROJET.md`.
- Verification :
  - `npx tsc --noEmit` OK.
  - `npm run lint` OK avec warnings historiques hors fichiers modifies.
  - `npm run build` OK avec warnings preexistants/non bloquants.
  - Smoke HTTP local sur `http://localhost:3005` : `/app/opportunities`, `/app/opportunities/4958c8c2-46b0-411e-adfb-1fa04985ef11`, `/api/market/opportunities/4958c8c2-46b0-411e-adfb-1fa04985ef11`, `/espace-client/test` OK.
  - Audit Playwright desktop/mobile : fiche affaire et onglet `Portail client` charges en 200, nouveaux blocs visibles, aucun debordement horizontal detecte.
- Point d'attention : une ancienne activite systeme visible dans la timeline indique une erreur Supabase historique `client_type` manquant ; elle n'est pas creee par cet increment mais merite nettoyage/backfill plus tard.
- Suite : poursuivre le coeur mandat avec une vraie timeline affaire unifiee (opportunite + events portail) et des actions rapides pour documents manquants / compte rendu vendeur.

### 10/07/2026 15:19 CEST - Regularisation suivi : migration Supabase assistant IA appliquee
- Base/branche : `preview`, sans modification code.
- Type : operation base de donnees / Supabase.
- Statut : **fait**.
- Travail : application ciblee de `supabase/migrations/026_ai_assistant_integrations.sql` sur le projet Supabase lie `byrsmbgfkvgxdtdyhrro`, puis marquage de la version `026` comme appliquee dans l'historique Supabase.
- Verification : 9 tables IA/integrations presentes, 12 fournisseurs IA inseres dont `openrouter`, RLS active sur les 9 tables, `supabase migration list` affiche `026` en local et remote.
- Point d'attention : les divergences historiques entre anciennes migrations locales et migrations distantes timestampées preexistaient ; seule `026` a ete reparee/appliquee.

### 10/07/2026 12:26 CEST - Assistant IA plug-and-play Mandat OS
- Base/branche : `preview`, travail local non pousse, avec modifications locales preexistantes conservees.
- Type : fonctionnalite produit / IA / integrations.
- Statut : **fait** pour le socle V1, schema applique ensuite a Supabase distante.
- Travail :
  1. Ajout du cockpit admin `/app/assistant` : conversation, choix fournisseur/modele, contexte dossier client, file d'actions a valider.
  2. Ajout de la section `/app/settings?section=ia` : catalogue IA hybride, ajout/revocation de cle API, fournisseur par defaut, connexion Google Workspace, sync Granola.
  3. Ajout de la passerelle serveur `src/lib/ai/*` : catalogue fournisseurs directs + OpenRouter, chiffrement AES-GCM des secrets, routage chat, contexte dossier, file d'actions.
  4. Ajout des routes `/api/ai/providers`, `/api/ai/credentials`, `/api/ai/chat`, `/api/ai/actions`, `/api/market/clients/[id]/ai-context`, `/api/integrations/google/oauth/*`, `/api/integrations/granola/sync`.
  5. Ajout de la migration `026_ai_assistant_integrations.sql` pour `ai_credentials`, `ai_threads`, `ai_messages`, `ai_action_queue`, connexions Google/Granola, transcripts externes et insights dossier.
  6. Granola importe les notes recentes, classe par heuristique vers `client_dossiers`, puis cree une action a valider avant insertion dans la timeline dossier.
- Fichiers principaux : `supabase/migrations/026_ai_assistant_integrations.sql`, `src/lib/ai/*`, `src/lib/integrations/granola.ts`, `src/app/api/ai/*`, `src/app/api/integrations/*`, `src/app/admin/market/assistant/*`, `src/app/admin/market/settings/AiIntegrationsSettings.tsx`, `src/components/app-sidebar.tsx`, `.env.example`.
- Verification :
  - `npx vitest run src/lib/__tests__/ai-crypto.test.ts src/lib/__tests__/ai-actions.test.ts` OK (4/4).
  - `npx tsc --noEmit` OK.
  - `npm run build` OK avec warnings preexistants/non bloquants.
  - HTTP local sur serveur frais `http://localhost:3004` : `/app/assistant` OK (200), `/app/settings?section=ia` OK (200), `/api/ai/providers` OK avant migration, `/api/ai/actions?status=proposed` OK avant migration.
  - Smoke Playwright headless : pages `/app/assistant` et `/app/settings?section=ia` chargees en 200 ; warnings console preexistants observes sur layout global (Radix hydration IDs + ressource 404 locale), sans blocage de rendu.
- Point d'attention : renseigner les variables serveur (`AI_CREDENTIALS_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) avant d'enregistrer des cles, lancer des chats persistants, synchroniser Granola ou executer les actions IA.
- Serveur local : instance propre active sur `http://localhost:3004/app/assistant`.
- Suite : appliquer la migration en environnement cible, renseigner `AI_CREDENTIALS_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, puis tester une cle OpenRouter et un transcript Granola reel.

### 10/07/2026 11:31 CEST - Harmonisation shadcn Mandat OS + portail client
- Base/branche : `preview`, alignee avec `origin/preview` au depart ; travail local non pousse.
- Type : design system / harmonisation UI.
- Statut : **fait** pour le lot d'harmonisation demande.
- Travail :
  1. Initialisation shadcn controlee via `npx shadcn@latest init` ; refus de l'ecrasement de `components.json`, donc aucun reset des alias ni des tokens existants.
  2. Consolidation des tokens `.app-product` et `.client-portal` dans `src/app/globals.css` autour de la charte `#0077B6`, `#005F96`, `#E0F0FA`, `#0F172A`, `#64748B`, `#E2E8F0`, `#F8FAFC`.
  3. Alignement des composants shadcn de base (`Button`, `Card`, `Badge`, `Input`, `Textarea`, `Tabs`, `Select`) et des composants pro (`PageHeader`, `DataToolbar`, `MetricCard`, `StatusPill`, `EmptyState`) sur des rayons, bordures, focus states et densites coherents.
  4. Harmonisation des surfaces Mandat OS dans `/admin/market/*`, la sidebar/header, dashboard, opportunites, leads, biens, zones, settings, notifications et composants admin concernes.
  5. Harmonisation du portail client `/espace-client/*` : conservation d'une identite plus douce, remplacement des hex repetes par tokens, stabilisation cards/boutons/badges/etats vides et microcopy UI.
  6. Aucun changement backend ni schema Supabase ; site vitrine public non refondu.
- Fichiers principaux : `src/app/globals.css`, `src/components/ui/*`, `src/components/pro/*`, `src/components/app-sidebar.tsx`, `src/components/nav-main.tsx`, `src/app/admin/market/*`, `src/components/admin/*`, `src/app/espace-client/*`.
- Verification :
  - `npx tsc --noEmit` OK.
  - `npx vitest run src/lib/__tests__/client-dossier-projection.test.ts src/app/api/market/clients/__tests__/route.test.ts` OK (6/6).
  - `git diff --check` OK.
  - `npm run lint` OK avec warnings existants/non bloquants.
  - `npm run build` OK avec warnings existants/non bloquants.
  - Smoke HTTP local apres redemarrage serveur : `/app/dashboard`, `/app/opportunities?tab=vendeurs&view=kanban`, `/espace-client/test` OK (200).
  - Audit Playwright desktop/mobile : dashboard et portail sans debordement document ; opportunites avec scroll horizontal interne attendu du kanban ; seul 404 local observe : `/_vercel/insights/script.js`.
- Serveur local : relance finale sur `http://localhost:3002`.
- Prochain point de reprise : revue visuelle utilisateur sur `localhost:3002`, puis commit/push uniquement apres validation explicite.

### 10/07/2026 08:51 CEST - Reprise apres push source unique Affaire
- Base/branche : `preview`, alignee avec `origin/preview` sur `adee66a`.
- Type : reprise / verification environnement local.
- Statut : **fait**.
- Travail :
  1. `git fetch --all --prune` execute ; aucune divergence locale/distance.
  2. Serveur Next local lance via `npm run dev -- --port 3002`.
  3. Dernier commit confirme : `adee66a feat(affaire): cadrer la source unique
     et projeter le portail`.
- Verification : `http://localhost:3002/app/dashboard` OK (200) ;
  `http://localhost:3002/espace-client/test` OK (200 apres compilation initiale).
- Prochain point de reprise : poursuivre le Lot 2 avec un test dedie au `PATCH
  /api/market/clients/[id]`, puis smoke navigateur sur une vraie affaire avec
  portail ouvert.

### 09/07/2026 20:32 CEST - Lot 2 source unique : premiere resorption des ecritures concurrentes
- Base/branche : `preview`, travail local non pousse.
- Type : architecture API / source unique Affaire.
- Statut : **fait** pour le premier correctif Lot 2.
- Constat : l'ecriture concurrente restante sur bien/estimation etait
  concentree dans `PATCH /api/market/clients/[id]`, capable d'ecrire directement
  `client_dossiers.property_snapshot` et `professional_opinion`.
- Travail :
  1. Si le dossier client est rattache a une opportunite, les patches
     `property_snapshot` / `professional_opinion` sont desormais fusionnes dans
     `opportunities.property_snapshot` / `opportunities.professional_opinion`.
  2. Le fallback sur `client_dossiers` est conserve pour les dossiers sans
     opportunite, afin de ne pas casser les anciens dossiers ou demos isoles.
  3. `docs/AFFAIRE_SOURCE_UNIQUE_LOTS.md` mis a jour avec ce premier correctif.
- Fichiers principaux : `src/app/api/market/clients/[id]/route.ts`,
  `docs/AFFAIRE_SOURCE_UNIQUE_LOTS.md`, `docs/SUIVI_PROJET.md`.
- Verification : `npx tsc --noEmit` OK ;
  `npx vitest run src/lib/__tests__/client-dossier-projection.test.ts src/app/api/market/clients/__tests__/route.test.ts`
  OK (6/6) ; smoke HTTP local OK sur `/app/dashboard` et
  `/espace-client/test` (200).
- Prochain point de reprise : ajouter un test dedie au `PATCH
  /api/market/clients/[id]` ou faire un smoke navigateur sur une vraie affaire
  avec portail ouvert pour confirmer l'aller-retour UI.

### 09/07/2026 20:30 CEST - Cadrage lots Affaire + Lot 1 projection vivante
- Base/branche : `preview`, travail local non pousse.
- Type : cadrage produit / architecture portail / source unique Affaire.
- Statut : **fait** pour le cadrage et le premier incrément du Lot 1.
- Travail :
  1. Creation de `docs/AFFAIRE_SOURCE_UNIQUE_LOTS.md` avec le decoupage en
     lots : cadrage, projection vivante, nettoyage ecritures concurrentes,
     multi-projets client, experience Affaire unifiee, backfill/schema.
  2. Alignement de `docs/SMQ_PROCESSUS_VENDEUR.md` avec la regle actuelle :
     portail client ouvrable des la `Visite d'estimation`, auto-ouverture au
     `Mandat signe` conservee comme filet de securite.
  3. Ajout du helper pur `projectClientDossierFromOpportunity()` pour fusionner
     la projection `client_dossiers` avec les donnees vivantes de
     `opportunities` (`property_snapshot`, `professional_opinion`).
  4. Branchement du helper dans `getCurrentClientDossier()` et
     `loadAdminClientDossier()`, afin que le portail connecte et les previews
     admin/test affichent les donnees d'opportunite quand elles existent.
  5. Ajout du test unitaire `client-dossier-projection.test.ts`.
- Fichiers principaux : `docs/AFFAIRE_SOURCE_UNIQUE_LOTS.md`,
  `docs/SMQ_PROCESSUS_VENDEUR.md`, `src/lib/client-dossier-projection.ts`,
  `src/lib/client-portal.ts`, `src/lib/market/client-admin.ts`,
  `src/lib/__tests__/client-dossier-projection.test.ts`.
- Verification : `npx vitest run src/lib/__tests__/client-dossier-projection.test.ts`
  OK (2/2) ; `npx tsc --noEmit` OK ; smoke HTTP local OK sur
  `http://localhost:3002/app/dashboard` et
  `http://localhost:3002/espace-client/test` (200).
- Prochain point de reprise : Lot 2, auditer et resorber les ecritures admin qui
  peuvent encore modifier directement les champs bien/estimation de
  `client_dossiers`.

### 09/07/2026 16:03 CEST - Reprise de session Mandat OS
- Base/branche : `preview`, alignee avec `origin/preview` sur `d7cf637`.
- Type : reprise / verification environnement local.
- Statut : **fait**.
- Travail :
  1. Lecture de `docs/MEMOIRE_SESSION.md`, `docs/START.md`,
     `docs/BACKLOG.md` et `docs/SUIVI_PROJET.md`.
  2. `git fetch --all --prune` execute ; aucune divergence locale/distance
     sur `preview`.
  3. Serveur Next local lance via `npm run dev -- --port 3002`.
- Verification : `GET /app/dashboard` et `HEAD /app/dashboard` retournent
  `200` sur `http://localhost:3002/app/dashboard`.
- Point a verifier : le HTML de dev contient aussi un fragment Next `404`
  interne/notFound ; a recontroler au navigateur si un ecran ou une ressource
  manque visiblement.
- Prochain point de reprise propose : poursuivre le chantier source unique
  Affaire / portail client, notamment la bascule bien + estimation vers une
  source vivante partagee.

### 05/07/2026 18:20 CEST - Lien bidirectionnel opportunite <-> dossier client
- Base/branche : `preview`, modifications locales non poussees.
- Type : navigation / continuite affaire / anti-perte de fil.
- Statut : **fait**.
- Contexte : une affaire = opportunite (pilotage CRM, du 1er contact a Vendu)
  + dossier client (espace partage avec le client). Objectif : ne jamais perdre
  l'opportunite une fois le dossier client cree.
- Travail :
  1. Fiche dossier client (`/app/clients/[id]`) : bouton `Voir l'opportunite`
     (avec l'etape en cours) quand `opportunity` est rattachee.
  2. Fiche opportunite (`/app/opportunities/[id]`) : carte `Dossier client` en
     tete de colonne laterale, avec statut, avancement documents
     (X/Y valides, Z a traiter) et bouton `Ouvrir`. Si mandat signe sans
     dossier : incitation a le creer ; sinon message d'attente.
  3. API `GET/PATCH /api/market/opportunities/[id]` : `enrichOpportunity`
     renvoie desormais `client_dossier` (lookup par `opportunity_id`, repli
     `lead_id`) avec les stats documents.
- Verification : `npx tsc --noEmit` OK ; controle donnees reelles OK (dossier
  rattache a l'opportunite `8c93d418...`, 4 documents ; dossier orphelin sans
  opportunite -> pas de lien, gere par le conditionnel).

### 06/07/2026 00:50 CEST - Un client, plusieurs opportunites : "Nouveau projet pour ce contact"
- Base/branche : `preview`, modifications locales non poussees.
- Type : CRM contacts / rattachement / anti-blocage.
- Statut : **fait** (vendeur).
- Constat : le dialogue "Ajouter un contact" bloquait tout contact deja lie a une
  opportunite ("deja lie"), alors qu'une meme personne peut avoir plusieurs
  affaires. Contrainte a respecter : `client_dossiers.lead_id` est UNIQUE ->
  un lead = un portail ; il ne faut donc PAS partager un lead entre opportunites.
- Decision : meme personne (prospect), projet distinct = lead distinct. Bouton
  "Nouveau projet pour ce contact" qui cree un lead dedie (meme prospect) et le
  rattache a l'opportunite courante ; chaque opportunite garde son portail.
- Travail :
  1. API `PATCH /api/market/opportunities/[id]` : nouveau param `clone_lead_from`
     -> helper `cloneLeadForNewProject` (cree un lead `vendre` sur le meme
     `prospect_id`, sans bien, via `createLead`) puis rattache comme `lead_id`.
  2. Fiche opportunite : handler `attachAsNewProject` + bouton "Nouveau projet"
     dans `LeadAttachDialog` a cote de "Voir l'opportunite" pour les contacts
     deja lies.
- Verification : `npx tsc --noEmit` OK ; `next lint` OK. Test end-to-end reel
  (env dev, middleware desactive) : clone du lead `ef53fad8` sur une opp jetable
  -> nouveau lead pointant le MEME prospect `8024f613`, rattache ; donnees de
  test supprimees ensuite (0 residu).
- NB : le "Nouveau vendeur" reutilise deja le prospect par email
  (`upsertCrmProspect`) -> ce flux creait deja des opportunites distinctes pour
  une meme personne ; le bouton comble le cas du rattachement depuis une opp
  existante.

### 06/07/2026 00:30 CEST - Portail client ouvrable des la visite d'estimation
- Base/branche : `preview`, modifications locales non poussees.
- Type : logique metier portail / gate stages / synchro.
- Statut : **fait** (vendeur ; portail non re-architecture, pont pragmatique).
- Besoin : ouvrir le portail des la remise de l'estimation pour presenter le
  rapport au client (avant, il ne naissait qu'au "Mandat signe").
- Decisions : declencheur = "Visite d'estimation" (ajuste depuis "Remise de
  l'estimation" apres test d'Alexandre : le portail doit etre pret quand il va
  voir le client) ; ouverture manuelle (bouton) des ce stade + auto-creation au
  "Mandat signe" conservee ; synchro auto de l'estimation/bien vers le portail.
  Seuil centralise dans `PORTAL_OPENING_STAGE` (seller-stages.ts).
- Travail :
  1. Nouveau module pur `src/lib/market/seller-stages.ts` : ordre des stades +
     `ESTIMATION_DELIVERED_STAGE` + `isPortalEligibleStage()`. `seller-opportunity.ts`
     reexporte depuis ce module.
  2. Gate `POST /api/market/clients` (seller) : `isPortalEligibleStage(stage)`
     au lieu de `=== 'Mandat signe'` (409 avant la remise de l'estimation).
  3. Fiche opportunite : bouton "Ouvrir le portail client" des le stade eligible ;
     onglet renomme "Suivi mandat" -> "Portail client" ; carte laterale idem
     (et correction d'un 2e lien mort vers `/app/clients`). En-tete DossierWorkspace
     -> "Portail client".
  4. Synchro `PATCH /api/market/opportunities/[id]` : nouveau helper
     `syncDossierFromOpportunity` (merge `property_snapshot`/`professional_opinion`
     dans le dossier rattache a chaque sauvegarde bien/estimation).
- Verification : `npx tsc --noEmit` OK ; `next lint` OK (rien de nouveau) ;
  tests routes market OK, dont 3 nouveaux cas de seuil (Nouveau contact 409,
  Visite d'estimation 409, Remise de l'estimation 200) ; smoke dev : page + API
  opportunite 200, 0 erreur.
- Ajout infra : `vitest.config.ts` (alias `@` -> `src`) necessaire pour resoudre
  l'import reel `seller-stages`. NB : cet alias rend chargeable `ademe.test.ts`
  qui echouait deja (imports non resolus) et revele ses echecs preexistants
  (mocks API externes) ; + 1 echec preexistant `magic-link-template.test.ts`.
  Ces echecs sont HORS scope de cette feature.

### 06/07/2026 00:10 CEST - Fusion Affaire etape 2 : Suivi mandat autonome + retrait rubrique Clients
- Base/branche : `preview`, modifications locales non poussees.
- Type : fusion opportunite/dossier / correction bug / suppression doublon.
- Statut : **fait** (cote admin ; portail client non touche).
- Bug corrige : le bouton "Creer le dossier" de l'onglet Suivi mandat etait un
  simple lien mort vers `/app/clients` (ne creait rien). Remplace par une
  creation SUR PLACE (`POST /api/market/clients` avec `opportunity_id`, puis
  refetch) cote vendeur, et l'equivalent cote acquereur (`buyer_lead_id`).
- Travail :
  1. Fiche vendeur (`opportunities/[id]/page.tsx`) : handler `createDossier()`
     sur place ; retrait du bouton "Ouvrir la fiche client".
  2. `DossierWorkspace` : en-tete avec actions client rapatriees
     (Inviter / Apercu client / Acces direct client).
  3. Miroir acquereur : `GET /api/market/buyers/[id]` renvoie desormais
     `client_dossier` (nouveau helper `loadBuyerClientDossierLink`) ; section
     "Suivi mandat" ajoutee sur `acheteurs/[id]/page.tsx` (DossierWorkspace +
     creation sur place si mandat de recherche signe).
  4. Retrait rubrique "Clients" : entree supprimee de `app-sidebar.tsx` ;
     `/app/clients` (liste) et `/app/clients/[id]` (fiche) remplaces par des
     server components `redirect` (liste -> Opportunites ; fiche -> l'affaire
     rattachee : opportunite vendeur ou fiche acquereur). Page `/preview`
     conservee. Fin de la duplication du code des 4 panneaux + editeurs
     Mandat/Estimation.
- Verification : `npx tsc --noEmit` OK ; `next lint` OK (warnings preexistants
  seulement) ; tests routes clients+buyers OK (5/5). Smoke serveur dev :
  `/app/clients` -> 307 `/app/opportunities` ; `/app/clients/43c0782c...` -> 307
  `/app/opportunities/8c93d418...` ; fiches vendeur/acquereur/dashboard 200,
  0 erreur de compilation.
  LIMITE : interactions authentifiees (clic "Creer le dossier", actions client,
  rendu du workspace) a valider dans le navigateur connecte d'Alexandre.

### 05/07/2026 18:52 CEST - Fusion Affaire etape 1 : renommage + onglet Suivi mandat
- Base/branche : `preview`, modifications locales non poussees.
- Type : fusion opportunite/dossier (cote admin) / nommage.
- Statut : **fait** (etape 1/2, cote admin uniquement ; portail non touche).
- Travail :
  1. Renommage : nav `Opportunites` -> `Opportunites / Mandats`
     (`app-sidebar.tsx`) + titre de page `/app/opportunities`.
  2. Nouveau composant autonome `DossierWorkspace`
     (`admin/market/clients/DossierWorkspace.tsx`) : panneaux Documents /
     Plan de vente / Visites / Offres, qui chargent leurs donnees via l'API
     dossier existante (`/api/market/clients/[id]` + documents/events) a partir
     d'un `dossierId`.
  3. Fiche opportunite : nouvel onglet `Suivi mandat` montant `DossierWorkspace`
     quand un dossier existe ; sinon etat verrouille ("disponible apres mandat").
  4. Page `Clients` laissee INTACTE (filet de securite) -> duplication
     temporaire assumee du code des panneaux, a resorber a l'etape 2.
- Verification : `npx tsc --noEmit` OK ; `next lint` OK (seulement des warnings
  preexistants, aucun nouveau) ; tests route clients OK (3/3).
  LIMITE : pas de clic reel possible (pages admin authentifiees) -> a smoke-tester
  manuellement sur l'opportunite `8c93d418...` (dossier `43c0782c...`, 4 docs)
  avant de pousser.
- Reste a faire (etape 2) : brancher le portail client sur la source unique
  (opportunite, RLS `opportunities_client_portal_select` deja en place) +
  backfill, puis retirer la page `Clients` et la duplication.

### DECISION STRUCTURANTE 05/07/2026 - Cap "fiche Affaire" a source unique
- Constat : les ecrans opportunite et dossier client editent DEJA les memes
  donnees (`property_snapshot` = onglets Bien & technique / Mandat & Technical ;
  `professional_opinion` = Estimation & avis / Estimation DVF), mais sur DEUX
  copies independantes -> risque de double-saisie et de divergence.
- Decision (validee par Alexandre) :
  1. Cible = une seule fiche `Affaire` cote admin (l'opportunite vit du 1er
     contact a Vendu ; les onglets Documents / Plan de vente / Visites / Offres /
     Preview client se debloquent au mandat signe, sur la meme page).
  2. Bien + estimation = **source unique vivante** (plus de snapshot fige),
     lus par l'affaire et par le portail client.
  3. `client_dossiers` reste la **projection cote client** (portail, RLS,
     documents, evenements visibles client), nourrie depuis l'affaire.
  4. Rythme choisi = petit pas d'abord (lien bidirectionnel livre ci-dessus),
     puis la fusion `Affaire` comme chantier suivant a cadrer.
- A faire (chantier suivant) : cadrer la migration vers la source unique
  (ou stocker bien+estimation, comment le portail client les lit sans acces
  aux opportunites, plan de bascule sans casser les dossiers existants).

### 05/07/2026 18:07 CEST - Correction erreur creation client (migrations manquantes)
- Base/branche : `preview`, modifications locales non poussees.
- Type : correctif base de donnees / clients / opportunites.
- Statut : **fait**.
- Symptome : clic sur `Creer le client` dans la modale -> toast `Creation
  impossible`. La liste `GET /api/market/clients` renvoyait aussi `500`.
- Cause racine : base `byrsmbgfkvgxdtdyhrro` appliquee jusqu'a la migration
  `022` seulement. Les migrations `023`, `024`, `025` etaient presentes dans le
  repo mais **non appliquees**. Le code insere/lit `client_dossiers.client_type`
  et `client_dossiers.buyer_lead_id` (inexistants) -> l'INSERT et le SELECT
  echouaient.
- Correctif : application des 3 migrations manquantes sur la base en ligne
  (additives et idempotentes, `add column if not exists`, aucune perte de
  donnees), avec accord explicite d'Alexandre :
  1. `023_opportunity_pre_mandate_workspace` : `opportunities.property_snapshot`
     et `professional_opinion`.
  2. `024_buyer_criteria_pipeline_stage` : `buyer_criteria.stage`,
     `next_action`, `due_date` (+ index).
  3. `025_client_dossiers_buyer_scope` : `client_dossiers.client_type`,
     `buyer_lead_id`, contraintes `client_type_check` / `scope_check` et index
     d'unicite acquereur.
- Verification : colonnes presentes confirmees en base ; lecture
  `client_type='seller'` OK (2 dossiers) ; `npx tsc --noEmit` OK ;
  `npx vitest run src/app/api/market/clients/__tests__/route.test.ts` OK (3/3).
- A faire cote repo : aucune modification de code necessaire. Les migrations
  023/024/025 restent versionnees ; l'historique Supabase distant est
  desormais aligne.

### 05/07/2026 17:58 CEST - Creation client depuis opportunite signee
- Base/branche : `preview`, modifications locales non poussees.
- Type : clients / opportunites / anti-doublon.
- Statut : **fait**.
- Travail :
  1. Page Clients : remplacement de la creation manuelle par une modale de
     selection d'opportunite signee.
  2. Boutons visibles : `Nouveau client vendeur` ou `Nouveau client acquereur`
     selon l'onglet actif.
  3. Vendeurs : selection uniquement depuis les opportunites `Mandat signe`.
  4. Acquereurs : selection uniquement depuis les recherches `Mandat de
     recherche signe`.
  5. API `POST /api/market/clients` : creation/rattachement depuis
     `opportunity_id` ou `buyer_lead_id`, avec refus `409` hors mandat signe.
  6. Helper vendeur etendu pour rattacher le client a l'opportunite precise
     selectionnee, pas seulement au lead.
- Audit qualite : `npx vitest run src/app/api/market/clients/__tests__/route.test.ts`
  OK ; `npx tsc --noEmit` OK ; `git diff --check` OK.
- Audit UI : smoke Playwright OK sur chargement `/app/clients` et detection du
  bouton `Nouveau client`. Limite observee : `GET /api/market/clients` renvoie
  `500 Erreur lecture clients` en local, deja sur la lecture liste et hors
  modification du flux de creation.

### 05/07/2026 17:45 CEST - Commandes opportunites compactees
- Base/branche : `preview`, modifications locales non poussees.
- Type : UX opportunites / densite verticale.
- Statut : **fait**.
- Travail :
  1. Selecteur de vue `Kanban` / `Tableau` place sur la meme ligne que le
     bouton `Nouveau vendeur` / `Nouvel acquereur`.
  2. Vues alignees a gauche, action de creation alignee a droite.
  3. Barre recherche/filtres conservee seule sur la ligne suivante.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:42 CEST - Bandeau opportunites clarifie
- Base/branche : `preview`, modifications locales non poussees.
- Type : UX opportunites / organisation des controles.
- Statut : **fait**.
- Travail :
  1. Bouton `Nouveau vendeur` / `Nouvel acquereur` isole en haut a droite.
  2. Barre recherche/filtres reservee uniquement aux criteres de recherche.
  3. Selecteur `Kanban` / `Tableau` replace en dessous, aligne a gauche.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:35 CEST - Bandeau opportunites reordonne
- Base/branche : `preview`, modifications locales non poussees.
- Type : UX opportunites / hiérarchie des controles.
- Statut : **fait**.
- Travail :
  1. Bandeau `Opportunités` reorganise dans l'ordre voulu : bouton
     `Nouveau vendeur` / `Nouvel acquéreur`, puis recherche et filtres,
     puis bascule `Kanban` / `Tableau`.
  2. Les filtres et la recherche sont remontes au niveau du workspace pour
     ne plus etre disperses dans les vues.
  3. Les vues Kanban et Tableau restent synchronisees sur les memes criteres.
- Audit qualite : `npm exec tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:55 CEST - Tableaux opportunites premium et ajout centralise
- Base/branche : `preview`, modifications locales non poussees.
- Type : UX opportunites / lisibilite tableau / filtres.
- Statut : **fait**.
- Travail :
  1. Bouton d'ajout vendeur/acquereur remonte dans l'entete de
     `/app/opportunities`, au-dessus du selecteur `Kanban` / `Tableau`.
  2. Suppression des boutons d'ajout redondants dans les Kanbans et tableaux.
  3. Tableaux vendeurs/acquereurs : ajout de filtres indispensables
     (recherche, statut, echeance; activite en plus cote acquereur).
  4. Tableaux rendus plus premium : conteneur encadre, header de tableau
     contraste, lignes plus aerées, badges plus lisibles.
  5. Ouverture de fiche par clic sur la ligne; suppression de la colonne
     bouton `Action`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; smoke
  Playwright headless OK sur les vues tableau vendeurs/acquereurs desktop et
  tableau vendeurs mobile. Une 404 parasite de ressource statique reste
  observee, sans bloquer le rendu.

### 05/07/2026 17:45 CEST - Opportunites en vues Kanban/Tableau et archivage page acheteurs
- Base/branche : `preview`, modifications locales non poussees.
- Type : simplification navigation / vue operationnelle opportunites.
- Statut : **fait**.
- Travail :
  1. Page liste `/app/acheteurs` archivee par redirection vers
     `/app/opportunities?tab=acquereurs`.
  2. Page `/app/opportunities` enrichie avec une bascule `Kanban` / `Tableau`
     partagee par les onglets `Vendeurs` et `Acquereurs`.
  3. Ajout d'une vue tableau vendeurs : recherche, statut, contact, bien,
     prochaine action, echeance et ouverture de fiche.
  4. Ajout d'une vue tableau acquereurs : recherche, statut, communes, budget,
     criteres, prochaine action, echeance et ouverture de fiche.
  5. Les retours de creation/edition acquereur pointent vers l'onglet
     acquereurs des opportunites.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; smoke
  Playwright headless OK sur `/app/acheteurs`,
  `/app/opportunities?tab=vendeurs&view=table` et
  `/app/opportunities?tab=acquereurs&view=table`. Une 404 parasite de ressource
  statique reste observee, sans bloquer le rendu.

### 05/07/2026 17:35 CEST - Suppression opportunite depuis la fiche
- Base/branche : `preview`, modifications locales non poussees.
- Type : action destructive / gestion fiche opportunite.
- Statut : **fait**.
- Travail :
  1. Ajout d'un bouton `Supprimer` sur la fiche opportunite vendeur.
  2. Confirmation explicite avant suppression.
  3. Appel `DELETE /api/market/opportunities/[id]` deja disponible,
     puis retour vers `/app/opportunities`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:25 CEST - Clarification retour et entete des fiches
- Base/branche : `preview`, modifications locales non poussees.
- Type : micro-ajustement UX / lisibilite des fiches.
- Statut : **fait**.
- Travail :
  1. Fiche vendeur : libelle de retour clarifie en `Retour aux vendeurs`.
  2. Fiche acquereur : libelle de retour clarifie en `Retour aux acquereurs`.
  3. Entete allégé : suppression du tag de priorite, conservation du type
     metier et du statut uniquement.
  4. Les tags restent places a droite du titre pour garder la lecture rapide.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:20 CEST - Typage visible des fiches opportunite
- Base/branche : `preview`, modifications locales non poussees.
- Type : lisibilite UX / distinction vendeur-acquereur.
- Statut : **fait**.
- Travail :
  1. Fiche vendeur `/app/opportunities/[id]` : ajout d'un badge visible
     `Opportunite vendeur` en haut de page.
  2. Fiche acquereur `/app/acheteurs/[id]` : ajout d'un badge
     `Opportunite acquereur` et remplacement du titre generique
     `Modifier l'acquereur` par `Opportunite acquereur`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 17:10 CEST - Preparation commit et push preview
- Base/branche : `preview`, cible `origin/preview`.
- Type : checkpoint livraison.
- Statut : **pret a pousser**.
- Perimetre inclus : SMQ vendeur v1, cockpit pre-mandat opportunite, renommage
  Leads en Contacts, rubrique Affaires, pipelines vendeurs/acquereurs, clients
  vendeurs/acquereurs, reseau relationnel, dashboard oriente actions, Data & BI
  marche, pages dediees de creation vendeur/acquereur.
- Verifications de session : `npx tsc --noEmit` OK ; tests API cibles OK selon
  les lots ; `git diff --check` OK ; audits Playwright headless OK sur les
  pages cles indiquees dans les entrees precedentes.

### 05/07/2026 17:05 CEST - Creation vendeur/acquereur harmonisee en pages dediees
- Base/branche : `preview`, modifications locales non poussees.
- Type : UX creation affaires / anti-doublon / harmonisation vendeurs-acquereurs.
- Statut : **fait**.
- Decision : les creations vendeur et acquereur passent par une page dediee,
  plus adaptee qu'une pop-up pour une creation structurante.
- Travail :
  1. Nouvelle page `/app/opportunities/nouveau` pour creer un vendeur avec le
     meme socle que l'acquereur : `Contact existant` / `Nouveau contact`, puis
     projet commercial.
  2. Cote vendeur uniquement : rattachement possible a un bien deja importe/en
     annonce, avec blocage visuel des biens deja lies.
  3. Page `/app/acheteurs/nouveau` refondue sur le meme modele : contact
     existant ou nouveau contact, puis criteres/prochaine action, sans
     rattachement bien.
  4. API `POST /api/market/buyers` etendue pour accepter un `lead_id` /
     `prospect_id` existant et renvoyer un acquereur existant si le contact est
     deja rattache, afin d'eviter les doublons.
  5. Kanban vendeur : bouton `Nouveau vendeur` et boutons `+` de colonnes
     ouvrent la page dediee au lieu de lancer la pop-up.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; smoke
  Playwright headless OK sur `/app/opportunities/nouveau` et
  `/app/acheteurs/nouveau` (titres et sections contact/projet detectes). Une
  404 parasite de ressource statique reste observee, sans bloquer le rendu.

### 05/07/2026 16:45 CEST - Renommage DVF en Data & BI marche
- Base/branche : `preview`, modifications locales non poussees.
- Type : vocabulaire UX / trajectoire BI.
- Statut : **fait**.
- Decision : la route technique `/app/dvf` reste conservee, mais le libelle
  visible devient `Data & BI` dans la sidebar et `Data & BI marche` sur la page.
  `DVF` reste mentionne comme source de donnees, pas comme nom de rubrique.
- Travail :
  1. Sidebar `Marche` : entree `DVF` renommee `Data & BI`.
  2. Page `/app/dvf` : titre `Data & BI marche`, description orientee analyse
     des mutations, prix medians et tendances locales.
  3. Bloc lateral `Communes DVF` renomme `Communes analysees`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK.

### 05/07/2026 16:30 CEST - Dashboard Mandat OS oriente actions
- Base/branche : `preview`, modifications locales non poussees.
- Type : refonte dashboard / pilotage transverse / actions prioritaires.
- Statut : **fait**.
- Demande (Alexandre) : reprendre un design dense inspire de la capture et donner
  de la visibilite sur les actions a venir, en cours et en retard, sans creer de
  table `tasks` en v1.
- Travail :
  1. Nouvelle API `GET /api/market/dashboard` agregant les actions existantes
     depuis `opportunities`, `buyer_criteria`, `opportunity_events`,
     `client_dossier_events`, `leads` et `warm_contacts`.
  2. Nouvelle API `PATCH /api/market/dashboard/actions` pour `complete` ou
     `postpone` quand la source le supporte deja.
  3. Refonte de `/app/dashboard` : header compact, recherche visuelle,
     raccourcis `Nouvelle opportunite` et `Ajouter un contact`, KPI, graphiques
     30 jours / pipeline, liste `Actions prioritaires`, panneau `Qualite du
     suivi`.
  4. Tri actions : retard, aujourd'hui, cette semaine, plus tard, sans echeance.
  5. Actions rapides : `Ouvrir`, `Fait` pour les evenements completable,
     `+7j` pour reporter la date source existante.
- Fichiers principaux : `src/app/admin/market/DashboardCockpit.tsx`,
  `src/app/admin/market/page.tsx`, `src/app/api/market/dashboard/route.ts`,
  `src/app/api/market/dashboard/actions/route.ts`.
- Audit qualite : `npx tsc --noEmit` OK ; `npx vitest run
  src/app/api/market/dashboard/__tests__/route.test.ts
  src/app/api/market/dashboard/actions/__tests__/route.test.ts` OK ;
  `git diff --check` OK ; mini-audit Playwright headless OK sur
  `/app/dashboard` en desktop 1440x1000 et mobile 390x900 (KPI, graphiques,
  actions prioritaires, qualite du suivi et focus semaine detectes). Une 404
  parasite de ressource statique reste observee, sans bloquer le rendu.
- Prochain point : brancher un vrai choix de date pour `Reporter` si besoin ;
  la v1 reporte actuellement a J+7 depuis le dashboard.

### 05/07/2026 16:10 CEST - Affaires, contacts et clients scindes Vendeurs / Acquereurs
- Base/branche : `preview`, modifications locales non poussees.
- Type : refonte vocabulaire métier / client acquereur / UX contacts-clients.
- Statut : **fait**.
- Decision metier : un acquereur devient client uniquement apres signature d'un
  mandat de recherche, comme un vendeur devient client apres mandat de vente.
- Travail :
  1. Sidebar : la grande rubrique devient `Affaires`, avec les sous-rubriques
     `Opportunites`, `Contacts`, `Clients` et `Reseau`; route technique
     `/app/opportunities` conservee.
  2. `/app/opportunities` affiche `Opportunites` avec onglets `Vendeurs` /
     `Acquereurs`; ajout du stage acquereur `Mandat de recherche signe`.
  3. `/app/leads` devient une page `Contacts` a onglets `Vendeurs` / `Acquereurs`;
     bouton principal `Ajouter un contact` avec choix Vendeur ou Acquereur.
  4. Creation contact acquereur branchee sur `/api/market/buyers`, avec saisie
     contact + criteres et stage par defaut `Nouveau contact`.
  5. Migration `025_client_dossiers_buyer_scope.sql` : `client_dossiers.client_type`
     (`seller`/`buyer`), `buyer_lead_id`, index et contrainte scope etendus.
  6. Passage acquereur en `Mandat de recherche signe` : creation/rattachement du
     dossier client acquereur via `ensureClientDossierForBuyer`; refus `409` si
     aucun email client n'est disponible.
  7. `/app/clients` affiche `Clients` avec onglets `Vendeurs` / `Acquereurs` et
     filtre API `client_type`.
  8. `/app/liste-chaude` est integre a la rubrique `Affaires` et renomme
     visuellement `Reseau` pour accueillir cercle proche, partenaires,
     prescripteurs et contacts relationnels.
- Fichiers principaux : `src/app/admin/market/leads/page.tsx`,
  `src/app/admin/market/clients/page.tsx`, `src/app/api/market/buyers/[id]/route.ts`,
  `src/lib/client-portal.ts`, `supabase/migrations/025_client_dossiers_buyer_scope.sql`.
- Audit qualite : `npx tsc --noEmit` OK ; `npx vitest run
  src/app/api/leads/__tests__/route.test.ts src/app/api/client/invite/__tests__/route.test.ts
  src/app/api/market/buyers/[id]/__tests__/route.test.ts` OK ; `git diff --check`
  OK ; mini-audit Playwright headless OK sur `/app/opportunities`, `/app/leads`,
  `/app/clients` (titres `Opportunites`, `Contacts`, `Clients` et onglets
  `Vendeurs` / `Acquereurs` detectes).
- Prochain point : appliquer migrations 024 et 025 en base, puis tester avec un
  acquereur reel disposant d'un email avant passage en `Mandat de recherche signe`.

### 05/07/2026 16:18 CEST - Ajustement rubrique Affaires et reseau relationnel
- Base/branche : `preview`, modifications locales non poussees.
- Type : correction vocabulaire UX / navigation.
- Statut : **fait**.
- Demande (Alexandre) : garder `Affaires` comme nom de rubrique, mais conserver
  `Opportunites` pour le Kanban et la sous-rubrique; integrer l'ancienne `Liste
  chaude` dans `Affaires` sous le nom `Reseau`.
- Travail :
  1. Sidebar : `Affaires` contient maintenant `Opportunites`, `Contacts`,
     `Clients`, `Reseau`.
  2. Suppression de la rubrique sidebar separee `Reseau`.
  3. `/app/opportunities` redevient visuellement `Opportunites`.
  4. `/app/liste-chaude` devient visuellement `Reseau`, avec description elargie
     aux proches, partenaires, prescripteurs et contacts relationnels.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; mini-audit
  Playwright headless OK sur `/app/opportunities` (`Opportunites`, onglets
  `Vendeurs` / `Acquereurs`) et `/app/liste-chaude` (`Reseau`).

### 05/07/2026 15:55 CEST - Simplification sidebar, contacts, opportunites et matching acquereur
- Base/branche : `preview`, modifications locales non poussees.
- Type : simplification UX / pipeline acquereur / matching lisible.
- Statut : **fait**.
- Demande (Alexandre) : clarifier l'app autour de `Pilotage`, `Opportunites`,
  `Marche`, `Reseau`, renommer `Leads` en `Contacts` cote interface, ajouter un
  Kanban acquereurs dans les opportunites et rendre le matching comprehensible
  depuis la fiche acquereur.
- Travail :
  1. Sidebar reorganisee : `Pilotage` (Dashboard), `Opportunites` (Opportunites,
     Contacts, Clients), `Marche` (Biens, DVF), `Reseau` (Liste chaude),
     `Configuration` (Parametres). `Matching` sort du menu principal mais reste
     accessible par route.
  2. Renommage UI de `/app/leads` en `Contacts` sans migration technique des URLs,
     tables ou APIs.
  3. Ajout de la migration `024_buyer_criteria_pipeline_stage.sql` :
     `buyer_criteria.stage`, `next_action`, `due_date`.
  4. Extension des APIs acheteurs pour creer un acquereur en `Nouveau contact` par
     defaut et mettre a jour le statut/prochaine action/echeance.
  5. Transformation de `/app/opportunities` en deux onglets : Kanban `Vendeurs`
     existant et nouveau Kanban `Acquereurs` base sur `buyer_criteria`, avec
     drag-and-drop persistant.
  6. Fiche acquereur enrichie : statut commercial, prochaine action, echeance et
     bloc `Biens compatibles` avec bouton `Lancer le matching`, score lisible,
     raisons et actions.
  7. Fiche bien : libelle `Acquereurs compatibles` au lieu d'acquereurs potentiels.
- Fichiers principaux : `src/components/app-sidebar.tsx`,
  `src/app/admin/market/opportunities/page.tsx`,
  `src/app/admin/market/opportunities/BuyerKanbanBoard.tsx`,
  `src/app/admin/market/acheteurs/[id]/page.tsx`,
  `src/app/api/market/buyers/route.ts`,
  `src/app/api/market/buyers/[id]/route.ts`,
  `supabase/migrations/024_buyer_criteria_pipeline_stage.sql`.
- Audit qualite : `npx tsc --noEmit` OK ; `npx vitest run
  src/app/api/leads/__tests__/route.test.ts src/app/api/client/invite/__tests__/route.test.ts`
  OK ; `git diff --check` OK ; mini-audit Playwright headless OK sur
  `http://localhost:3001/app/opportunities` (titre `Opportunites`, onglets
  `Vendeurs` et `Acquereurs` detectes). Les logs stderr restants sont les erreurs
  attendues des tests 500 simules dans `/api/leads`.
- Prochain point : appliquer la migration 024 en base puis verifier visuellement
  `/app/opportunities` onglets vendeurs/acquereurs et `/app/acheteurs/[id]` avec
  donnees reelles.

### 05/07/2026 15:20 CEST - Cockpit pre-mandat sans doublon client
- Base/branche : `preview`, modifications locales non poussees.
- Type : correction architecture UX / donnees pre-mandat / verrou client.
- Statut : **fait**.
- Demande (Alexandre) : conserver les informations utiles de `Clients` des le debut
  du parcours vendeur, sans creer de client ni doublon avant mandat signe.
- Travail :
  1. Ajout de la migration `023_opportunity_pre_mandate_workspace.sql` avec
     `opportunities.property_snapshot` et `opportunities.professional_opinion`.
  2. Ajout des onglets `Bien & technique` et `Estimation` dans la fiche opportunite
     pour saisir les donnees pre-mandat directement sur l'opportunite.
  3. Extension du PATCH opportunite pour sauvegarder ces deux blocs JSON.
  4. Copie des donnees pre-mandat de l'opportunite vers le dossier client lors de la
     creation post-`Mandat signé`.
  5. Verrouillage de `/api/client/invite` : refus `409` tant que l'opportunite liee
     au lead n'est pas en `Mandat signé`.
  6. Ajustement liste leads : le bouton espace client est indisponible avant mandat
     signe et devient un libelle informatif.
  7. Liste clients : par defaut, lecture des dossiers `active` et `archived`, pas des
     brouillons.
  8. Documentation SMQ mise a jour : l'opportunite est la source de verite
     pre-mandat ; le client est cree apres signature.
- Fichiers principaux : `src/app/admin/market/opportunities/[id]/page.tsx`,
  `src/app/api/client/invite/route.ts`, `src/lib/client-portal.ts`,
  `supabase/migrations/023_opportunity_pre_mandate_workspace.sql`,
  `docs/SMQ_PROCESSUS_VENDEUR.md`.
- Audit qualite : `npx tsc --noEmit` OK ; `npx vitest run
  src/app/api/leads/__tests__/route.test.ts src/app/api/client/invite/__tests__/route.test.ts`
  OK ; `git diff --check` OK. Les logs stderr restants sont les erreurs attendues
  des tests 500 simules dans `/api/leads`.
- Prochain point : audit Playwright sur `/app/opportunities/[id]` apres application
  de la migration Supabase locale/preview, pour verifier la sauvegarde reelle des
  onglets pre-mandat et la copie vers client au passage `Mandat signé`.

### 05/07/2026 15:04 CEST - Opportunite pivot vendeur et SMQ v1
- Base/branche : `preview`, modifications locales non poussees.
- Type : structuration UX / CRM vendeur / SMQ / anti-doublons.
- Statut : **fait**.
- Demande (Alexandre) : clarifier et implementer le parcours lead/prospect vers
  opportunite vendeur, en limitant les frictions, doublons et complexite, avec une
  premiere cartographie SMQ orientee amelioration continue.
- Travail :
  1. Ajout de `docs/SMQ_PROCESSUS_VENDEUR.md` : processus P1 a P7, statuts,
     preuves qualite et indicateurs SMQ v1.
  2. Ajout du statut `Veille annonce` en tete du pipeline opportunites pour les
     annonces sans vendeur exploitable, notamment les annonces agence.
  3. Creation du helper serveur `src/lib/market/seller-opportunity.ts` pour creer ou
     rattacher automatiquement l'opportunite pivot depuis un lead vendeur, eviter les
     doublons par prospect et preparer le dossier client au passage `Mandat signé`.
  4. Branchement des estimations site et creations manuelles de leads vendeurs vers
     l'opportunite pivot ; la creation manuelle renvoie maintenant vers la fiche
     opportunite quand elle existe.
  5. Ajustement UX du Kanban : bouton/formulaire `Ajouter une piste vendeur`,
     recherche anti-doublon requise avant creation, sources `annonce_particulier` et
     `annonce_agence`.
  6. Passage `Mandat signé` : preparation/rattachement best-effort du dossier client
     si un lead avec email est disponible ; sinon creation d'une tache qualite.
  7. Passage `Perdu / Écarté` sans motif : creation d'une tache qualite demandant le
     motif de perte.
- Fichiers principaux : `docs/SMQ_PROCESSUS_VENDEUR.md`,
  `src/lib/market/seller-opportunity.ts`,
  `src/app/admin/market/opportunities/KanbanBoard.tsx`,
  `src/app/api/leads/route.ts`,
  `src/app/api/market/opportunities/route.ts`,
  `src/app/api/market/opportunities/[id]/route.ts`.
- Audit qualite : `npx tsc --noEmit` OK ; `npx vitest run
  src/app/api/leads/__tests__/route.test.ts` OK ; `git diff --check` OK. Les logs
  stderr du test sont les erreurs attendues des cas 500 simules.
- Prochain point : audit Playwright cible sur `/app/opportunities` pour valider le
  rendu Kanban, la creation avec recherche anti-doublon et le comportement
  `Veille annonce` sur un bien agence reel.

### 05/07/2026 01:24 CEST - Normalisation controles Console Admin Pro
- Base/branche : `preview` apres push du commit `336cabc`, modifications locales
  non poussees.
- Type : correction UI / socle Console Admin Pro / controles formulaire.
- Statut : **fait**.
- Demande (Alexandre) : corriger les inputs et dropdowns qui n'avaient pas la meme
  hauteur, puis demarrer le travail methodique par sections.
- Travail :
  1. Ajout d'une convention locale dans la page dossier client : classes communes pour
     inputs, selects natifs, textareas, actions principales, actions secondaires et
     boutons icones.
  2. Standardisation des inputs texte/date et dropdowns a `40px`.
  3. Standardisation des actions principales de la console (`Inviter`, `Preview admin`,
     `Acces direct client`, `Ajouter`, `Sauvegarder`) a `40px`.
  4. Conservation volontaire des actions secondaires de ligne a `36px` pour garder une
     bonne densite dans les listes documents / evenements.
  5. Harmonisation des textareas avec le meme rayon, padding et typographie que les
     champs, tout en conservant leur hauteur variable.
- Fichiers principaux : `src/app/admin/market/clients/[id]/page.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; audit Playwright
  sur `http://localhost:3002/app/clients/b9b76b97-8854-488f-b9d4-0a59f7090f3e`
  OK. Mesures ciblees par onglet : inputs `40px`, selects `40px`, actions principales
  `40px`, actions secondaires de ligne `36px`; aucun debordement horizontal mobile.
  Test sauvegarde avec PATCH intercepte OK : l'onglet `Offres d'achat` reste actif.
  Seuls messages observes : `404` local attendu sur `/_vercel/insights/script.js` et
  warning preload CSS dev non bloquant.
- Prochain point : revue visuelle par Alexandre du socle, puis balayage section
  `Mandat & Technical`.

### 05/07/2026 01:19 CEST - Plan projet Console Admin Pro
- Base/branche : `preview` apres push du commit `336cabc`, modifications locales
  non poussees.
- Type : plan projet / methode de travail / console admin dossier client.
- Statut : **en cours**.
- Objectif : travailler methodiquement la `Console d'Administration Pro` section par
  section avant de passer aux thematiques suivantes, sans perdre les corrections UX
  deja faites localement.
- Priorite immediate :
  1. Normaliser les hauteurs des inputs, dropdowns, boutons et controles de formulaire
     de la console admin dossier client.
  2. Garder la correction scopee a `src/app/admin/market/clients/[id]/page.tsx`, sans
     modifier les composants UI globaux.
  3. Utiliser une hauteur standard de `40px` pour les inputs texte/date et dropdowns.
  4. Conserver des boutons plus compacts uniquement pour les actions secondaires de
     ligne lorsque cela sert la densite de l'interface.
- Methode par section :
  1. Socle Console Admin Pro : hero sombre, actions `Inviter`, `Preview admin`,
     `Acces direct client`, bouton sticky `Sauvegarder`, onglets et responsive.
  2. Mandat & Technical : mandat, bien, adresse, surfaces, DPE, etat, equipements,
     statistiques par portail et dropdowns avec `Autre`.
  3. Estimation : prix, fourchette, honoraires, synthese, arguments, JSON comparables
     et clarification visible client / interne.
  4. Documents Vendeur : ajout de piece, categorie, statut, upload, validation, rejet
     et coherence avec le portail client `Mes documents`.
  5. Plan de Vente : etapes, statut, date, visibilite client et rendu cote client.
  6. Visites Physiques : visite, profil acquereur, financement, interet,
     compte-rendu et rendu vendeur.
  7. Offres d'Achat : montant, statut, condition principale, solidite, acheteur et
     statuts visibles client.
- Validation attendue pour chaque section : saisie, sauvegarde, onglet conserve,
  donnees visibles apres refresh, rendu portail client lorsque la section l'alimente,
  puis entree horodatee dans ce suivi.

### 05/07/2026 01:04 CEST - Badge requis documents portail client
- Base/branche : `preview` apres push du commit `336cabc`, modifications locales
  non poussees.
- Type : correction UX / portail client vendeur / documents.
- Statut : **fait**.
- Demande (Alexandre) : dans `Mes documents`, placer le badge `Requis` au meme
  endroit que le statut `Valide par Alexandre`.
- Travail :
  1. Retrait du badge `Requis` accole au titre du document.
  2. Ajout du badge `Requis` dans la colonne de statut/actions du document, au meme
     niveau visuel que les badges `A fournir`, `Manquant`, `Valide par Alexandre`,
     etc.
  3. Affichage limite aux statuts `missing` et `requested`.
- Fichiers principaux : `src/app/espace-client/client-documents.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; verification
  Playwright sur `http://localhost:3002/espace-client/test` OK. Le jeu de test local
  contient surtout un document valide, donc le cas `Requis` devra etre recontrole sur
  un dossier reel avec document manquant/demande.
- Prochain point : validation visuelle par Alexandre puis commit/push de la passe UX.

### 05/07/2026 00:53 CEST - Bouton sauvegarde console admin
- Base/branche : `preview` apres push du commit `336cabc`, modifications locales
  non poussees.
- Type : correction UX / console admin dossier client.
- Statut : **fait**.
- Demande (Alexandre) : remplacer le bouton bas de page `Publier sur l'espace client`
  par `Sauvegarder` et retirer le bouton de publication dans l'encadre
  `Console d'Administration Pro`.
- Travail :
  1. Suppression du bouton `Publier sur l'espace client` dans le hero sombre.
  2. Remplacement du bouton sticky bas de page par `Sauvegarder`.
  3. Renommage du handler interne en sauvegarde et message toast
     `Modifications sauvegardées`.
  4. Conservation du comportement precedent : les donnees sauvegardees restent celles
     qui alimentent l'espace client, sans retour au premier onglet.
- Fichiers principaux : `src/app/admin/market/clients/[id]/page.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; test Playwright
  cible OK sur le dossier client local : aucun bouton `Publier sur l'espace client`,
  un bouton `Sauvegarder`, onglet `Offres d'achat` conserve apres clic sauvegarde
  avec PATCH intercepte. Seul le `404` local attendu sur
  `/_vercel/insights/script.js` apparait.
- Prochain point : validation visuelle par Alexandre puis commit/push de cette passe.

### 05/07/2026 00:48 CEST - Conservation onglet admin apres sauvegarde
- Base/branche : `preview` apres push du commit `336cabc`, modifications locales
  non poussees.
- Type : correction UX / console admin dossier client.
- Statut : **fait**.
- Demande (Alexandre) : apres clic sur `Publier sur l'espace client` ou une action
  de sauvegarde, rester sur l'onglet courant au lieu de revenir au premier onglet.
- Travail :
  1. Passage des onglets de la page dossier client en mode controle avec `activeTab`.
  2. Conservation de l'onglet courant pendant les actions documents, evenements et
     publication.
  3. Rafraichissement des donnees en arriere-plan apres mutation sans repasser par
     l'ecran plein `Chargement du dossier...`.
- Fichiers principaux : `src/app/admin/market/clients/[id]/page.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ; test Playwright
  cible sur `http://localhost:3002/app/clients/b9b76b97-8854-488f-b9d4-0a59f7090f3e`
  OK : depuis l'onglet `Documents Vendeur`, clic `Publier sur l'espace client`
  avec PATCH intercepte, onglet toujours actif apres rafraichissement et pas de
  loader plein ecran. Seul le `404` local attendu sur `/_vercel/insights/script.js`
  apparait.
- Prochain point : si validation visuelle OK par Alexandre, commiter/pusher cette
  correction sur `preview`.

### 05/07/2026 00:40 CEST - Diagnostic warning hydration React
- Base/branche : `preview` alignee avec `origin/preview`, avec uniquement le suivi
  projet modifie localement depuis le push.
- Type : diagnostic front / console navigateur.
- Statut : **a surveiller**.
- Constat : le message partage par Alexandre n'est pas une erreur Node mais un
  warning d'hydratation React : des attributs auto-generes Radix (`id`,
  `aria-controls`) different entre HTML serveur et rendu client.
- Travail :
  1. Lecture du stack : `NavUser`, `SidebarMenuButton`, `NotificationsSheet`,
     `MarketShell`.
  2. Inspection de la sidebar, du menu utilisateur, de la sheet notifications et du
     hook `useIsMobile`.
  3. Reproduction Playwright en profil Chromium propre sur `/app/dashboard` puis sur
     `/app/clients/b9b76b97-8854-488f-b9d4-0a59f7090f3e`.
- Audit qualite : warning d'hydratation non reproduit en navigateur propre ; seul le
  `404` local attendu sur `/_vercel/insights/script.js` apparait. Hypotheses les plus
  probables : extension navigateur modifiant le DOM avant React, ou etat dev/HMR
  stale apres recompilation.
- Prochain point : si le warning persiste apres hard refresh / fenetre privee sans
  extensions, stabiliser les IDs Radix ou rendre le shell admin uniquement apres
  montage client.

### 05/07/2026 00:38 CEST - Diagnostic version Node locale
- Base/branche : `preview` alignee avec `origin/preview` apres le push du commit
  `336cabc`.
- Type : diagnostic environnement local / serveur Next.
- Statut : **fait**.
- Travail :
  1. Verification de la version Node locale : `v24.13.1`.
  2. Verification de la version npm locale : `11.8.0`.
  3. Verification du binaire utilise : `/usr/local/bin/node`.
  4. Lecture des logs du serveur Next local sur `http://localhost:3002`.
- Fichiers principaux : `docs/SUIVI_PROJET.md`.
- Audit qualite : aucun crash Node observe dans les logs locaux ; le serveur repond
  sur `/app/dashboard` et le dossier client teste. Le `404` local sur
  `/_vercel/insights/script.js` reste attendu hors environnement Vercel.
- Point de vigilance : Node local est sur la branche majeure LTS 24 mais pas sur le
  tout dernier patch public de la branche ; si une erreur de deploiement mentionne
  explicitement Node, comparer la version Vercel selectionnee et ajouter au besoin un
  champ `engines.node` dans `package.json`.

### 05/07/2026 00:25 CEST - Validation pre-push portail vendeur
- Base/branche : `preview` alignee avec `origin/preview` en commits apres
  `git fetch --all --prune` (`0 / 0` avance/retard).
- Type : validation / build / preparation commit-push.
- Statut : **fait**.
- Travail :
  1. Confirmation par Alexandre de faire `commit + push sur preview`.
  2. Verification du statut Git et du diff avant staging.
  3. Verification des routes non suivies de preview admin/client :
     `/admin/market/clients/[id]/preview` et `/espace-client/preview/[id]`.
  4. Relance de `npm run build` avant commit.
- Fichiers principaux : `docs/SUIVI_PROJET.md` et l'ensemble du chantier portail
  vendeur / console admin dossier client liste dans l'entree du 05/07/2026 00:16.
- Audit qualite : `git diff --check` OK ; `npm run build` OK. Warnings ESLint
  non bloquants encore presents, dont quelques helpers non utilises dans
  `src/app/espace-client/portal-view.tsx` a nettoyer lors d'une prochaine passe.
- Prochain point de reprise recommande apres push : revue fonctionnelle sur un
  dossier vendeur reel et test complet documents / suivi de mandat.

### 05/07/2026 00:21 CEST - Reprise de session
- Base/branche : `preview` alignee avec `origin/preview` en commits apres
  `git fetch --all --prune` (`0 / 0` avance/retard).
- Type : reprise / verification locale / suivi projet.
- Statut : **fait**.
- Travail :
  1. Lecture de `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md` et
     `docs/START.md`.
  2. Verification du working tree : le travail local non commite du portail vendeur
     et de la console admin dossier client est present et doit etre preserve.
  3. Demarrage du serveur Next local avec `npm run dev -- --port 3002`.
  4. Verification HTTP de `http://localhost:3002/app/dashboard` : reponse `200 OK`.
- Fichiers principaux : `docs/SUIVI_PROJET.md`.
- Audit qualite : serveur local pret sur `http://localhost:3002` ; le navigateur
  integre Codex n'etait pas disponible dans cette session, donc pas de verification
  visuelle Playwright/in-app browser effectuee a cette etape.
- Prochain point de reprise recommande : revue fonctionnelle du dossier vendeur reel,
  puis test des cycles documents et suivi de mandat avant validation/push.

### 05/07/2026 00:16 CEST - Portail vendeur + console admin dossier client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : produit / portail client vendeur / console Mandat OS / design system.
- Statut : **fait**.
- Demandes (Alexandre) : dupliquer le design du prototype vendeur sur l'espace client,
  aligner les onglets `Mes documents` et `Suivi de mandat` sur les captures Google AI
  Studio, ajouter une console admin dossier client dans Mandat OS, permettre l'acces
  admin au portail client et standardiser les champs admin avec des dropdowns
  pre-remplis + `Autre`.
- Travail portail client :
  1. Refonte visuelle scopee a `.client-portal` sans impacter le site public :
     police Plus Jakarta Sans, tokens AI Studio/iAD, surfaces blanches, bordures fines,
     boutons/badges en pilules et header compact.
  2. Header portail reproduit puis reduit pour une densite proche Google AI Studio ;
     marque mise a jour en `Alexandre Lopez immobilier` avec sous-titre
     `Provence Verte & Verdon`.
  3. Ajustement des gros chiffres KPI/prix/statistiques pour limiter les effets trop
     massifs et garder les valeurs critiques sur une ligne.
  4. Alignement de `/espace-client/connexion` sur la meme charte sans changer le magic
     link.
  5. Carte Leaflet et marqueurs harmonises avec les tokens portail.
- Travail `Mes documents` :
  1. Remplacement de l'onglet par une page dense : carte intro `Dossier administratif
     & Pieces justificatives`, encart avancement, grande dropzone, liste reglementaire
     et bloc bas diagnostics.
  2. Conservation de l'upload existant, des URLs signees, des statuts et du mode test.
  3. Reorganisation visuelle des statuts, motifs, commentaires et actions pour eviter
     les alignements confus.
- Travail `Suivi de mandat` :
  1. Recomposition en blocs : timeline pas-a-pas, diffusion/statistiques, offres
     d'achat et comptes-rendus de visites.
  2. Utilisation des donnees reelles `client_dossier_events`, `professional_opinion`
     et fallbacks test lorsque les donnees sont absentes.
  3. Reprise du bloc demande par Alexandre : timeline claire a gauche et panneau
     `Diffusion & Statistiques` a droite avec portails, KPI, repartition et avis.
  4. Boutons d'offres rendus visuellement mais non mutationnels.
- Travail console admin Mandat OS :
  1. Refonte de la page detail dossier client en `Console d'Administration Pro` avec
     hero sombre, reference mandat, adresse, bouton `Publier sur l'espace client` et
     tabs metier : mandat/technique, estimation, documents, plan de vente, visites,
     offres.
  2. Edition/sauvegarde via les API existantes du dossier, `property_snapshot`,
     `professional_opinion`, documents et events, sans migration SQL.
  3. Ajout des statistiques par portail dans `professional_opinion.audience.portals`
     et lecture cote client dans `Diffusion & Statistiques`.
  4. Ajout d'une preview admin et d'un acces direct au portail client depuis le dossier,
     sans exposer d'onglet admin au vendeur.
  5. Clarification du comportement : les donnees saisies dans Mandat OS sont les donnees
     synchronisees/publiees dans l'espace client.
- Travail dropdowns admin :
  1. Ajout de listes pre-remplies + option `Autre` pour les champs structurants :
     type de mandat, type de bien, etat general, DPE, equipements/atouts, categories
     documents, statuts, motifs de rejet, types d'etapes, visibilite, statuts visites,
     interet, profil acquereur, financement, statuts offres, condition principale,
     solidite et portails statistiques.
  2. Conservation en champs libres des donnees variables : adresse, commune, surfaces,
     pieces/chambres, prix, audiences, descriptions, syntheses, comparables JSON, noms
     acquereurs et montants.
  3. Les valeurs `Autre` sont stockees comme texte normal dans les JSON/API existants.
- Fichiers principaux : `src/app/globals.css`,
  `src/app/espace-client/portal-view.tsx`,
  `src/app/espace-client/client-documents.tsx`,
  `src/app/espace-client/comparable-leaflet-map.tsx`,
  `src/app/espace-client/connexion/page.tsx`,
  `src/app/espace-client/sign-out-button.tsx`,
  `src/app/espace-client/preview/[id]/page.tsx`,
  `src/app/admin/market/clients/[id]/page.tsx`,
  `src/app/admin/market/clients/[id]/preview/page.tsx`,
  `src/app/api/market/clients/[id]/invite/route.ts`,
  `src/app/auth/callback/route.ts`.
- Audit qualite : `npx tsc --noEmit` OK ; `git diff --check` OK ;
  `npm run build` OK avec warnings existants ; verification locale sur
  `http://localhost:3012/app/clients/b9b76b97-8854-488f-b9d4-0a59f7090f3e` OK
  (chargement page admin + API dossier/notifications, seul 404 local attendu sur
  `/_vercel/insights/script.js`).
- Points de vigilance : valider en session admin reelle que l'acces direct dossier
  client ouvre bien la vue attendue en rendez-vous ; tester un dossier reel avec
  documents/offres/visites non mockes avant push.
- Prochaines etapes recommandees :
  1. Faire une revue fonctionnelle sur un dossier vendeur reel : saisie admin,
     publication, ouverture du portail client et verification des donnees affichees.
  2. Finaliser le comportement exact de l'acces direct admin au portail client en
     conditions production : preview interne vs lien client partageable en rendez-vous.
  3. Tester le cycle documents complet en session reelle : upload vendeur, validation
     admin, rejet avec motif, remplacement et ouverture d'URL signee.
  4. Tester le cycle suivi mandat complet : ajout d'etapes, visites, offres et rendu
     immediat cote client.
  5. Stabiliser les listes pre-remplies des dropdowns apres usage terrain : ajouter,
     retirer ou renommer les valeurs selon les formulations qu'Alexandre veut imposer.
  6. Prevoir ensuite la couche email/notification vendeur si l'espace client devient
     utilise en production active.

### 03/07/2026 15:25 CEST - Scope typographique portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design system / typographie / coherence app.
- Statut : **fait**.
- Decision (Alexandre) : garder Inter pour l'app interne Mandat OS et le site public,
  mais utiliser Plus Jakarta Sans uniquement sur le portail client vendeur pour rester
  proche du rendu Google AI Studio.
- Travail :
  1. Repassage du scope `.app-product` sur `--font-inter`.
  2. Ajout du scope `.client-portal` avec `--font-jakarta` prioritaire.
  3. Ajout du scrollbar premium global : 6px, piste transparente, thumb `#E2E8F0`,
     hover `#CBD5E1`.
  4. Mise a jour de `docs/BRAND.md` pour documenter la separation Inter / Jakarta.
- Fichiers principaux : `src/app/globals.css`, `docs/BRAND.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; verification Playwright runtime sur
  `http://localhost:3001/espace-client/test` : portail en Plus Jakarta Sans, body/app
  en Inter, scrollbar thumb `rgb(226, 232, 240)`.

### 03/07/2026 14:27 CEST - Carte Leaflet des comparables portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : UX portail client / carte interactive / confidentialite donnees.
- Statut : **fait**.
- Demande (Alexandre) : remplacer la fausse carte SVG des biens comparables vendus
  par une vraie carte Leaflet, sans exposer automatiquement les adresses exactes.
- Travail :
  1. Ajout d'un composant client Leaflet dedie au portail vendeur avec chargement
     dynamique pour eviter les erreurs SSR.
  2. Branchement sur `professional_opinion.comparables` avec support de `lat` / `lng`
     optionnels, popups, selection active et marqueurs numerotes.
  3. Ajout du marqueur `Votre bien` lorsque les coordonnees existent via
     `property_snapshot` ou `seller_properties`.
  4. Application d'un decalage deterministe sur les coordonnees des comparables
     pour conserver un affichage indicatif cote client.
  5. Generation de points autour du bien vendeur ou du centre secteur lorsque les
     coordonnees comparables sont absentes.
  6. Mise a jour de l'aide admin JSON des comparables pour documenter `lat` / `lng`
     optionnels et l'affichage approximatif cote client.
- Fichiers principaux : `src/app/espace-client/comparable-leaflet-map.tsx`,
  `src/app/espace-client/portal-view.tsx`,
  `src/app/admin/market/clients/[id]/page.tsx`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; audit Playwright sur
  `http://localhost:3001/espace-client/test` OK desktop/mobile : Leaflet charge,
  marqueur bien vendeur present, comparables cliquables, selection active OK, aucun
  debordement horizontal.
- Captures : `/tmp/espace-client-leaflet-estimation-desktop.png`,
  `/tmp/espace-client-leaflet-estimation-mobile-loaded.png`.
- URL de verification : `http://localhost:3001/espace-client/test`.

### 03/07/2026 14:13 CEST - Alignement titre arguments estimation
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : micro-ajustement UI / hierarchie typographique.
- Statut : **fait**.
- Demande (Alexandre) : basculer `Pourquoi ce prix de 420 000 € ?` avec le meme style
  que `Carte des biens comparables vendus`.
- Travail : remplacement de `portal-h1` par `portal-h2` sur le titre de la carte sombre
  `Arguments d'Alexandre`.
- Fichier : `src/app/espace-client/portal-view.tsx`.
- Verification : `pnpm exec tsc --noEmit` OK ; audit Playwright cible OK :
  les deux titres sont en 20px/800 avec le meme line-height.

### 03/07/2026 14:07 CEST - Correction hierarchie titres portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design system / hierarchie typographique.
- Statut : **fait**.
- Demande (Alexandre) : verifier la hierarchie apres question sur le titre
  `Carte des biens comparables vendus`.
- Travail :
  1. Correction des titres de blocs secondaires en `portal-h2` 20px/800 :
     `Carte des biens comparables vendus`, `Detail des ventes recentes`,
     `Evolution du prix median au m2`, `Diffusion & Audience`,
     `Accompagnement de votre conseiller`.
  2. Passage de `Bonjour, ...` en vrai `h1` avec `portal-h1` 28px/800.
  3. Separation des gros chiffres et valeurs dans une classe `portal-value`
     28px/800 pour ne plus utiliser `portal-h1` sur des donnees non titrees.
  4. Conservation des H3 16px/700 pour titres internes : document, comparable,
     evenement, sous-bloc.
- Fichiers principaux : `src/app/globals.css`,
  `src/app/espace-client/portal-view.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; audit Playwright hierarchie OK sur
  `http://localhost:3000/espace-client/test` : H1 dashboard, H2 comparables/ventes/DVF,
  H3 interne, `portal-value`, aucun debordement desktop/mobile.
- Captures : `/tmp/espace-client-hierarchy-estimation-desktop.png`,
  `/tmp/espace-client-hierarchy-dashboard-mobile.png`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 13:52 CEST - Echelle typographique portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design system / typographie portail client.
- Statut : **fait**.
- Demande (Alexandre) : appliquer les tailles de police conformement aux captures, apres
  validation de la passe Inter.
- Travail :
  1. Ajout des classes typographiques scopees `.client-portal` :
     `portal-h1` 28px/800, `portal-h2` 20px/800, `portal-h3` 16px/700,
     `portal-body` 15px/400, `portal-button-text` 14px/600,
     `portal-meta` 13px/300 et `portal-label` 13px/600.
  2. Remplacement des tailles Tailwind dispersees dans les zones principales du portail :
     header, onglets, accueil, conseiller, audience, fiche bien, estimation, documents,
     suivi, timelines et composants utilitaires.
  3. Conservation volontaire des tres grands chiffres de valeur/prix/KPI en tailles
     specifiques, car ils correspondent aux emphases visuelles de la maquette.
  4. Mise a jour de `docs/BRAND.md` pour documenter les tailles exactes et les classes
     applicatives.
- Fichiers principaux : `src/app/globals.css`, `src/app/espace-client/portal-view.tsx`,
  `src/app/espace-client/client-documents.tsx`, `docs/BRAND.md`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; audit Playwright typographique OK sur
  `http://localhost:3000/espace-client/test` : Inter detecte, tailles/weights verifies
  au runtime pour `portal-h1`, `portal-h2`, `portal-h3`, `portal-body`,
  `portal-button-text`, `portal-meta`, `portal-label`, aucun debordement horizontal
  desktop/mobile.
- Captures : `/tmp/espace-client-typography-dashboard-desktop.png`,
  `/tmp/espace-client-typography-estimation-desktop.png`,
  `/tmp/espace-client-typography-dashboard-mobile.png`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 12:05 CEST - Tokens design AI Studio et typographie Inter
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design system / portail client.
- Statut : **fait**.
- Demande (Alexandre) : integrer les elements de design fournis et remplacer la typographie
  applicative par Inter.
- Travail :
  1. Harmonisation des tokens `.app-product` avec la palette cible : `#0077B6`,
     `#005F96`, `#E0F0FA`, `#0F172A`, `#64748B`, `#E2E8F0`, `#F8FAFC`,
     `#10B981`, `#B26A00`, `#EF4444`.
  2. Confirmation d'Inter comme police applicative via `--font-inter` et suppression des
     dernieres references actives a Plus Jakarta Sans.
  3. Ajout de styles scopes `.client-portal` pour boutons `rounded-full`, badges statut,
     KPI cards et neutralisation du letter-spacing dans l'espace applicatif.
  4. Reprise des badges documents vendeur : `VALIDE`, `A FOURNIR`, `A REPRENDRE` avec
     les couleurs exactes success/warning/error.
  5. Mise a jour de `docs/BRAND.md` pour aligner la documentation sur Inter et le token
     warning.
- Fichiers principaux : `src/app/globals.css`, `src/app/espace-client/portal-view.tsx`,
  `src/app/espace-client/client-documents.tsx`, `src/app/admin/login/page.tsx`,
  `docs/BRAND.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright sur
  `http://localhost:3000/espace-client/test` OK desktop/mobile : Inter detecte au runtime,
  badges documents presents, aucun debordement horizontal.
- Captures : `/tmp/espace-client-inter-dashboard-desktop.png`,
  `/tmp/espace-client-inter-estimation-desktop.png`,
  `/tmp/espace-client-inter-documents-desktop.png`,
  `/tmp/espace-client-inter-documents-mobile.png`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 11:58 CEST - Reprise fidele Google AI Studio accueil + estimation
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design produit / portail client vendeur.
- Statut : **fait**.
- Demande (Alexandre) : revenir a un rendu tres proche des captures Google AI Studio, en
  commencant par les onglets `Accueil` et `Estimation`, avec couleurs, grands arrondis,
  cartes et outils integres de la maquette.
- Travail :
  1. Restauration de la palette AI Studio/iAD scopee au portail client : bleu `#0077B6`,
     bleu hover `#005F96`, surfaces `#F8FAFC`, bordures claires, vert `#10B981`,
     cartes `rounded-3xl` et boutons `rounded-full`.
  2. Refonte de l'accueil vendeur : statut dossier, 3 KPI, checklist, bloc conseiller
     Alexandre, diffusion/audience, grande fiche bien illustree et CTA rendez-vous.
  3. Refonte de `Mon estimation` : switch `Avis de valeur Conseiller` / `Estimation Express
     iAD`, grande carte prix, jauge, simulateur net vendeur, carte sombre des arguments,
     comparables interactifs, ventes recentes et graphe DVF.
  4. Enrichissement du ViewModel interne avec `audience`, `propertyHero`, `comparables`,
     `priceTrend` et fallbacks complets reserves a `/espace-client/test`.
  5. Conservation de l'architecture Next/Supabase existante, sans nouvelle route, sans
     migration et sans importer le scaffold Vite/AI Studio.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`,
  `src/app/globals.css`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright sur
  `http://localhost:3000/espace-client/test` OK desktop/mobile : onglets `Accueil` et
  `Estimation`, switch estimation, simulateur, comparables, aucun debordement horizontal.
- Captures : `/tmp/espace-client-ai-dashboard-desktop.png`,
  `/tmp/espace-client-ai-estimation-desktop.png`,
  `/tmp/espace-client-ai-dashboard-mobile.png`,
  `/tmp/espace-client-ai-estimation-mobile.png`.
- Note locale : le seul `404` detecte en audit est `/_vercel/insights/script.js`, attendu en
  developpement local et sans impact sur le rendu.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 10:46 CEST - Largeur portail client app premium
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : decision UI / layout responsive.
- Statut : **fait**.
- Decision : ne pas passer le portail client en plein `100%` desktop. Pour une experience
  vendeur premium, garder une largeur de lecture contrainte, mais l'elargir de `max-w-6xl` a
  `max-w-7xl` pour donner plus d'ampleur app sur grands ecrans.
- Travail : header et contenu principal de `/espace-client` passent en `max-w-7xl`.
- Fichiers : `src/app/espace-client/portal-view.tsx`, `docs/SUIVI_PROJET.md`.
- Verification : `pnpm exec tsc --noEmit` OK ; `curl -I http://localhost:3000/espace-client/test`
  retourne `200 OK`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 10:39 CEST - Passe design premium portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design produit / direction visuelle.
- Statut : **fait**.
- Demande (Alexandre) : rendre le design du portail vendeur plus premium et moins `IA-style`.
- Travail :
  1. Conservation de la structure UX inspiree Google AI Studio, mais reduction des codes
     visuels trop prototype : pastilles bleues, icones sur fonds bleus, arrondis tres mous,
     couleurs trop presentes.
  2. Header produit rendu plus sobre : logo iAD blanc borde, onglets actifs anthracite,
     formes plus nettes, CTA rendez-vous conserve en bleu.
  3. Cartes et panneaux rendus plus premium : fond applicatif plus calme, radius 8px,
     ombres plus diffuses, surfaces neutres, accents bleus reserves aux actions ou signaux.
  4. Dashboard rendu moins demonstratif : KPI plus sobres, checklist moins coloree, conseiller
     et audience sans decoration excessive, timeline plus discrete.
  5. Tokens `.app-product` ajustes sans impacter le site public.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`,
  `src/app/globals.css`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright desktop/mobile sur
  `http://localhost:3000/espace-client/test` OK : route `200`, pas de header public,
  blocs essentiels presents, aucun debordement horizontal, cartes a `8px`.
- Captures : `/tmp/espace-client-premium-desktop.png`,
  `/tmp/espace-client-premium-mobile.png`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 10:31 CEST - Redemarrage localhost portail client
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : environnement local / support consultation.
- Statut : **fait**.
- Probleme : Alexandre ne pouvait pas consulter localhost. Les anciennes instances `3002` et
  `3004` pointaient vers un cache dev `.next` incoherent apres un `pnpm build`, provoquant des
  erreurs `500` de manifest manquant.
- Travail : arret des anciennes instances Node, relance du serveur dev sur le port standard
  `3000`.
- Verification : `curl -I http://localhost:3000/espace-client/test` retourne `200 OK`.
- URL active : `http://localhost:3000/espace-client/test`.

### 03/07/2026 10:28 CEST - Portail vendeur shadcn aligne UX Google AI Studio
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : design produit + UX portail client.
- Statut : **fait**.
- Decision (Alexandre) : rester sur `shadcn/ui` et les tokens Mandat OS, mais reprendre la
  structure UX de la maquette Google AI Studio : header produit compact, onglets centraux,
  navigation mobile basse, dashboard construit en blocs statut/KPI/checklist/conseiller.
- Travail :
  1. Reorganisation de `/espace-client` : le header n'est plus un hero, il devient une barre
     produit compacte avec logo, onglets desktop, vendeur, rendez-vous et telephone.
  2. Refonte de l'accueil vendeur selon l'ordre de la maquette : quick status, 3 KPI, checklist
     "Prochaines etapes conseillees", conseiller, diffusion/audience, synthese bien, jalons,
     message Alexandre et CTA final.
  3. Conservation des donnees reelles `ClientPortalDossier`, sans importer le scaffold Vite/AI
     Studio ni les donnees hardcodees de la maquette.
  4. Utilisation de primitives shadcn (`Card`, `CardContent`, `Progress`, `Badge`, `Button`) pour
     rester coherent avec Mandat OS.
  5. Isolation de `/espace-client/*` dans `AppChrome` pour retirer le header/footer public et
     preparer le rattachement futur a `app.alexandrelopez.fr`.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`,
  `src/components/layout/AppChrome.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright sur `http://localhost:3004/espace-client/test`
  OK desktop/mobile : route `200`, pas de header/footer public, blocs dashboard/conseiller/bien
  presents, aucun debordement horizontal. Captures : `/tmp/espace-client-ai-studio-isolated-desktop.png`
  et `/tmp/espace-client-ai-studio-isolated-mobile.png`.
- Point de reprise : serveur local de verification actif sur `http://localhost:3004/espace-client/test`.
- Suite conseillee : appliquer la meme logique de construction par onglets aux sous-pages
  `Estimation`, `Documents` et `Suivi`, puis aligner `/app/clients/[id]` champ par champ sur ce
  que voit le vendeur.

### 03/07/2026 09:57 CEST - Decision domaine app et base design applicative
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : architecture produit + design system applicatif.
- Statut : **fait**.
- Decision (Alexandre) : conserver le site, Mandat OS, le portail client et les APIs dans ce
  repo actuel, puis rattacher plus tard l'application metier au sous-domaine
  `app.alexandrelopez.fr`. Le domaine public cible reste `alexandrelopez.fr`.
- Travail :
  1. Documentation dans `docs/ROUTES.md` : repo unique, futur sous-domaine
     `app.alexandrelopez.fr`, surfaces `/app/*` et `/espace-client/*`.
  2. Ajout d'une base CSS scopee `.app-product` pour Mandat OS et le portail client, sans
     modifier le site public.
  3. Application de `.app-product` au shell Mandat OS (`MarketShell`) et au portail client.
  4. Ajout de styles communs `app-panel` et `app-page-title` pour unifier panneaux, titres,
     fonds, bordures et accent bleu.
  5. Realignement leger de `/app/clients` et des panneaux `/espace-client/test` sur cette base.
- Fichiers principaux : `src/app/globals.css`, `src/app/admin/market/MarketShell.tsx`,
  `src/app/admin/market/clients/page.tsx`, `src/app/espace-client/portal-view.tsx`,
  `docs/ROUTES.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright OK sur `/app/clients` et
  `/espace-client/test` : `.app-product` present, CTA/modale creation OK, onglets client OK,
  telephone visible, aucun debordement horizontal desktop/mobile.
- Point de reprise : serveur local actif sur `http://localhost:3002/app/clients` et
  `http://localhost:3002/espace-client/test`.
- Suite conseillee : poursuivre l'unification ecran par ecran dans `/app/*` avant de configurer
  DNS/Vercel pour `app.alexandrelopez.fr`.

### 03/07/2026 09:27 CEST - Creation manuelle dossiers clients vendeurs
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : backend admin + migration Supabase + UX etat vide.
- Statut : **fait, migration appliquee en base distante**.
- Demande (Alexandre) : continuer le chantier espace client vendeur apres la refonte premium.
- Travail :
  1. Ajout migration `022_client_dossiers_manual_creation.sql` pour autoriser un dossier client
     manuel si `property_snapshot` est renseigne, sans imposer un lead/bien/opportunite.
  2. Migration `022` appliquee sur la base Supabase distante et enregistree dans
     `supabase_migrations.schema_migrations`.
  3. Ajout de `POST /api/market/clients` : creation profil client, dossier vendeur manuel,
     checklist documentaire par defaut et premiers jalons visibles client.
  4. Ajout d'un bouton `Nouveau dossier` dans `/app/clients`, avec modale client + bien de
     depart et redirection vers `/app/clients/[id]` apres creation.
  5. Etat vide `/app/clients` rendu actionnable avec CTA `Creer le premier dossier`.
- Fichiers principaux : `supabase/migrations/022_client_dossiers_manual_creation.sql`,
  `src/app/api/market/clients/route.ts`, `src/app/admin/market/clients/page.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright OK sur `/app/clients` : route `200`,
  titre visible, CTA creation visible, modale creation visible, aucun debordement horizontal ;
  `/espace-client/test` OK route `200`, aucun debordement.
- Point de reprise : serveur local actif sur `http://localhost:3002/app/clients` et
  `http://localhost:3002/espace-client/test`.
- A verifier manuellement : creer un vrai dossier client depuis `/app/clients`, ouvrir la fiche,
  renseigner avis pro/documents/suivi, inviter le vendeur puis tester le lien magique.

### 03/07/2026 00:37 CEST - Refonte premium espace client vendeur par lots
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : UX client vendeur + enrichissement back-office client.
- Statut : **fait**.
- Demande (Alexandre) : implementer le plan projet en lots pour transformer `/espace-client`
  en espace vendeur premium inspire de la maquette.
- Travail :
  1. Refonte de `ClientPortalView` en shell a onglets `Accueil`, `Estimation`, `Documents`,
     `Suivi`, avec navigation desktop et barre mobile.
  2. Tableau de bord vendeur ajoute : KPI prix/documents/etape, prochaine action, bloc
     conseiller Alexandre, synthese du bien et jalons visibles.
  3. Onglet estimation ajoute : prix retenu, fourchette, net vendeur indicatif, arguments
     conseiller, comparables valides et lecture marche depuis `professional_opinion`.
  4. Onglet documents refait : progression, statuts lisibles, dates, taille fichier, motif de
     rejet, lecture seule en session test et upload client limite aux statuts autorises.
  5. Onglet suivi enrichi : timeline, visites, offres consultatives et avertissement sur les
     decisions juridiquement sensibles.
  6. Back-office `/app/clients/[id]` enrichi avec onglet `Avis pro`, champs arguments,
     comparables JSON et payloads simples pour visites/offres.
  7. API client document durcie : refus de remplacer une piece deja recue/en validation ou
     validee ; API events admin accepte maintenant `payload`.
- Fichiers principaux : `src/app/espace-client/portal-view.tsx`,
  `src/app/espace-client/client-documents.tsx`, `src/app/espace-client/test/page.tsx`,
  `src/app/admin/market/clients/[id]/page.tsx`,
  `src/app/api/client/documents/route.ts`,
  `src/app/api/market/clients/[id]/events/route.ts`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants Supabase Edge/runtime et lint historiques ;
  Playwright OK desktop/mobile sur `/espace-client/test` : route `200`, bannière test visible,
  onglets estimation/documents/suivi OK, documents en `Lecture test`, aucun debordement
  horizontal. Verification supplementaire OK : le telephone `06 13 18 01 68` reste visible.
- Point de reprise : serveur local actif sur `http://localhost:3002/espace-client/test`.
- A verifier en donnees reelles : renseigner un avis pro dans `/app/clients/[id]`, ajouter une
  visite/offre visible client, tester upload client authentifie et confirmer le rendu
  `/espace-client` avec session Supabase.

### 02/07/2026 16:10 CEST - Session test espace client sans connexion
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : UX locale / acces de demonstration espace vendeur.
- Statut : **fait**.
- Demande (Alexandre) : pouvoir ouvrir un espace client sans connexion avec une session test.
- Travail :
  1. Extraction de l'interface vendeur dans `ClientPortalView` pour reutiliser le meme rendu
     entre la session authentifiee et la session test.
  2. Ajout de `/espace-client/test`, disponible hors production uniquement ; en production la
     route redirige vers `/espace-client/connexion`.
  3. Chargement du premier dossier client actif si disponible via l'admin local, sinon fallback
     vers un dossier demo Cotignac complet.
  4. Mode test signale par une bannière, sans bouton de deconnexion et avec les documents en
     lecture seule pour eviter tout upload sans session.
  5. Documentation route ajoutee dans `docs/ROUTES.md`.
- Fichiers principaux : `src/app/espace-client/page.tsx`,
  `src/app/espace-client/portal-view.tsx`, `src/app/espace-client/test/page.tsx`,
  `src/app/espace-client/client-documents.tsx`, `docs/ROUTES.md`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants ;
  `pnpm build` OK avec warnings existants ; Playwright OK desktop/mobile sur
  `/espace-client/test` (`200`, bannière visible, documents `Lecture test`, aucun debordement
  horizontal). Warning navigateur connu : 404 ressource analytics/Vercel sans impact fonctionnel.
- Point de reprise : serveur local actif sur `http://localhost:3002/espace-client/test`.

### 02/07/2026 15:51 CEST - Backend admin clients vendeurs
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : module admin Mandat OS + APIs backend espace client.
- Statut : **fait**.
- Demande (Alexandre) : ajouter un backend pour gerer les clients vendeurs, les documents a
  demander/valider, les informations du bien et le suivi du dossier.
- Travail :
  1. Ajout du module canonique `/app/clients` dans la sidebar Mandat OS, section `Vendeurs`.
  2. Liste clients/dossiers : recherche, filtre statut, client, bien, compteur documents,
     derniere activite et action `Ouvrir`.
  3. Fiche `/app/clients/[id]` avec onglets `Dossier`, `Bien`, `Documents`, `Suivi`.
  4. APIs admin `/api/market/clients` ajoutees : liste, detail, patch profil/dossier/snapshot
     bien, invitation, checklist documents, upload admin, validation/rejet/suppression,
     jalons visibles ou internes.
  5. Depuis `/app/leads`, le bouton `Espace` prepare/envoie l'acces puis ouvre la fiche client.
  6. Le dossier client reste la source de verite visible vendeur via
     `client_dossiers.property_snapshot`; `seller_properties` reste l'historique lead/CRM.
- Fichiers principaux : `src/app/admin/market/clients/*`,
  `src/app/api/market/clients/*`, `src/lib/market/client-admin.ts`,
  `src/components/app-sidebar.tsx`, `src/app/admin/market/leads/page.tsx`,
  `docs/ROUTES.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK avec warnings existants Supabase Edge / lint ; audit Playwright
  mocke desktop/mobile OK sur `/app/clients` et `/app/clients/[id]`, sans debordement horizontal.
- A verifier en donnees reelles : inviter un lead vendeur pour creer le premier dossier, tester
  edition bien/documents/jalons sur Supabase, puis verifier que `/espace-client` reflete les
  modifications admin.

### 02/07/2026 15:08 CEST - Espace client vendeur v1
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : fondations produit + auth client + UX espace vendeur.
- Statut : **fait, a appliquer en base Supabase avant test reel complet**.
- Demande (Alexandre) : implementer le plan Espace Client Vendeur Mandat OS avec auth client
  distincte, rapport durable, documents, suivi de mandat et pont Cowork prepare.
- Travail :
  1. Migration `021_client_portal_foundations.sql` ajoutee : `client_profiles`,
     `client_dossiers`, `client_documents`, `client_dossier_events`, enums, bucket Storage
     prive `client-documents`, trigger de synchronisation `auth.users` -> `client_profiles`,
     policies RLS client et policies de lecture limitees sur `leads`, `prospects`,
     `seller_properties`, `opportunities`.
  2. Helper `src/lib/client-portal.ts` ajoute pour preparer un dossier client depuis un lead,
     creer checklist + jalons par defaut, puis relire le dossier via session client/RLS.
  3. Routes ajoutees : `/auth/callback`, `/api/client/auth/request-link`,
     `/api/client/invite`, `/api/client/dossier`, `/api/client/documents`.
  4. Ecrans client ajoutes : `/espace-client/connexion` et `/espace-client` avec synthese du
     bien, estimation durable, prochaine action, checklist documentaire uploadable, jalons et
     deconnexion.
  5. Liste leads admin : bouton `Espace` pour preparer le dossier et envoyer/copier le lien
     d'invitation client.
  6. Email Resend d'invitation espace vendeur ajoute, avec fallback lien manuel/Supabase selon
     disponibilite du lien genere.
- Fichiers principaux : `supabase/migrations/021_client_portal_foundations.sql`,
  `src/lib/client-portal.ts`, `src/app/espace-client/*`, `src/app/api/client/*`,
  `src/app/auth/callback/route.ts`, `src/app/admin/market/leads/page.tsx`,
  `src/lib/resend.ts`, `src/types/supabase.ts`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK avec warnings existants Supabase Edge / lint.
- 02/07/2026 15:15 CEST : migration `021_client_portal_foundations.sql` appliquee sur la base
  Supabase distante via connexion Postgres ciblee, puis enregistree dans
  `supabase_migrations.schema_migrations` (`version = 021`). Verification OK : tables client,
  policies RLS, bucket prive `client-documents`, trigger auth et historique presents.
- A verifier apres application migration : inviter un lead vendeur avec email, valider
  reception/lien magique, verifier RLS client A/B, tester upload document et audit Playwright
  mobile/desktop sur `/espace-client/connexion` + `/espace-client`.

### 30/06/2026 - Site public : correction couleur des textes secondaires
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : correction CSS globale / lisibilite site public.
- Statut : **fait**.
- Probleme : le token Tailwind `text-muted` etait genere depuis le token shadcn `--muted`
  destine aux fonds clairs, ce qui rendait de nombreux textes secondaires quasi blancs sur fond
  blanc.
- Travail : ajout d'une compatibilite CSS globale pour conserver `bg-muted` comme surface claire
  tout en forçant `text-muted`, `text-muted/60`, `hover:text-muted` et les placeholders muted vers
  `--muted-foreground`.
- Fichiers : `src/app/globals.css`, `docs/SUIVI_PROJET.md`.
- Audit qualite : verification navigateur OK (`text-muted` passe de `lab(96.52...)` a
  `lab(48.496...)`) ; capture `/tmp/home-muted-color-check.png` ; `pnpm exec tsc --noEmit` OK ;
  `pnpm lint` OK avec warnings existants hors changement ; `pnpm build` OK avec warnings existants
  Supabase Edge / lint.
- Etat final : fait, dev server relance ensuite sur `http://localhost:3002` apres nettoyage `.next`
  pour eviter le melange cache dev/prod.

### 30/06/2026 - Estimation vendeur : adresse libre geocodee et erreur visible
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : correction UX parcours public `/outils/vendre`.
- Statut : **fait**.
- Probleme : l'utilisateur pouvait saisir une adresse libre sans choisir une suggestion BAN ; le
  parcours avançait alors sans `lat/lng`, puis `/api/leads` echouait sur le calcul vendeur avec
  `lat, lng, surface requis`, pendant que l'ecran de calcul continuait vers les resultats.
- Travail :
  1. L'envoi d'une adresse libre tente maintenant un geocodage automatique via
     `api-adresse.data.gouv.fr`.
  2. Le parcours ne passe a l'etape suivante que si `adresse`, `lat` et `lng` sont enregistres
     ensemble.
  3. Une adresse introuvable reste sur l'etape adresse avec un message actionnable.
  4. En cas d'echec de `/api/leads`, l'ecran de calcul est stoppe, le parcours revient sur
     l'adresse et affiche `Impossible de generer l'estimation, verifiez l'adresse puis reessayez.`
  5. La redirection post-calcul attend maintenant la reussite reelle de `/api/leads`, pas seulement
     la fin de l'animation.
- Fichiers : `src/app/outils/vendre/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK ; tests API `dry_run` OK (`500` attendu sans `lat/lng`, `200` avec
  `lat/lng/surface`) ; audit Playwright mobile OK (adresse invalide bloquee, adresse libre
  `Cotignac` geocodee avec `lat/lng`) ; audit Playwright desktop complet OK avec `/api/leads`
  mocke, redirection `/resultats/...` et capture `/tmp/outils-vendre-full-desktop.png`.
- Etat final : fait, serveur local toujours disponible sur `http://localhost:3002/outils/vendre`,
  aucun push, aucune migration, aucune creation de lead reel pendant l'audit.

### 28/06/2026 - Biens : diffusions multi-sites et rapprochement manuel des doublons
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : donnees + API + UX fiche Bien.
- Statut : **fait**.
- Demande (Alexandre) : detecter les annonces identiques publiees sur plusieurs sites, afficher
  tous les sites d'annonces sur la fiche Bien, et permettre de rapprocher manuellement les
  `doublons probables`.
- Travail :
  1. Migration `020_property_sources_duplicates.sql` ajoutee et appliquee :
     `market_property_sources` pour historiser chaque diffusion d'un bien canonique, et
     `market_property_duplicate_candidates` pour memoriser les doublons confirmes ou ecartes.
  2. Ingestion Stream Estate : chaque annonce upsertee enregistre maintenant sa diffusion
     (`portal`, `url`, `external_id`, prix, statut, dates, raw JSON). En cas de doublon detecte,
     l'URL/source entrante est conservee comme diffusion du bien existant.
  3. Detection v1 des doublons probables : scoring local par commune/INSEE ou CP, type, prix,
     surface, terrain, pieces et titre. Seuil d'affichage : score >= 60, avec raisons visibles.
  4. API fiche Bien enrichie : `sources` + `duplicate_candidates`.
  5. Nouveau endpoint `POST /api/market/properties/[id]/duplicates` :
     `action=merge` rapproche vers la fiche canonique, transfere les diffusions et references
     utiles, puis marque l'autre bien en `status='duplicate'`; `action=reject` memorise l'ecart.
  6. Liste Biens : les biens `duplicate` sont masques par defaut et un badge `n diffusions`
     apparait quand plusieurs sites publient le meme bien.
  7. Fiche Bien : card `Diffusions` avec les portails et liens d'annonces, card `Doublons
     probables` avec boutons `Rapprocher`, `Ecarter`, `Ouvrir`.
- Fichiers : `supabase/migrations/020_property_sources_duplicates.sql`,
  `src/lib/market/property-deduplication.ts`, `src/lib/market/upsert-listing.ts`,
  `src/app/api/market/properties/route.ts`,
  `src/app/api/market/properties/[id]/route.ts`,
  `src/app/api/market/properties/[id]/duplicates/route.ts`,
  `src/app/admin/market/properties/PropertiesTable.tsx`,
  `src/app/admin/market/properties/[id]/PropertyDetail.tsx`,
  `src/types/supabase.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK ; test API reel OK (doublon probable score 90, merge PAP+Leboncoin,
  masquage du doublon, compteur `source_count=2`) ; test API `reject` OK ; Playwright desktop/mobile
  OK avec captures `/tmp/property-duplicates-desktop.png` et `/tmp/property-duplicates-mobile.png`.
- Cout API Stream Estate : aucun appel supplementaire ; le systeme exploite les donnees deja
  importees et les futures synchronisations.

### 28/06/2026 - Opportunites : pipeline revise, activites editables, miniatures et purge
- Base/branche : `preview` (local non commite au moment de l'ecriture).
- Type : refonte UX/API opportunites + nettoyage donnees.
- Statut : **fait**.
- Demande (Alexandre) : simplifier les jalons de la fiche opportunite, permettre de modifier
  et supprimer les activites, corriger le changement de bien, afficher les miniatures, ajouter
  la colonne `Vendu`, retirer le crayon des cards Kanban, puis supprimer toutes les opportunites
  sans toucher aux leads ni aux biens.
- Travail :
  1. Pipeline vendeur mis a jour : `Nouveau contact`, `Pre-estimation`, `Visite d'estimation`,
     `Remise de l'estimation`, `Decision vendeur`, `Suivi moyen terme`, `Mandat signe`,
     `Vendu`, `Perdu / Ecarte`.
  2. Migration `019_opportunity_pipeline_revision.sql` ajoutee et appliquee : anciens stages
     `RDV / Visite` -> `Visite d'estimation`, `Rapport remis` -> `Remise de l'estimation`,
     `Converti` -> `Mandat signe`.
  3. Fiche opportunite allegee : seuls les jalons `Estimation realisee` et `Prochaine action`
     restent visibles ; `Bien lead` retire de la card contacts.
  4. Activites : ajout du `DELETE /api/market/opportunities/[id]/events/[eventId]` et
     reutilisation du `PATCH` existant pour modifier titre, contenu, dates et statut termine.
  5. Biens : bouton `Changer` disponible meme si un bien est deja rattache ; bouton `Modifier`
     conserve seulement pour les biens `source = manual` ou `user`.
  6. Miniatures : extraction locale depuis `raw_json.photos`, `raw_json.images`,
     `raw_json.pictures` ou `raw_json.adverts[0].photos/images/pictures`, puis exposition
     via `thumbnail_url` dans les API biens et opportunites.
  7. Kanban : colonne `Vendu`, nouveaux libelles de pipeline, retrait du petit crayon des
     cards, boutons principaux en bleu primaire.
  8. Purge demandee executee sur la base : 6 opportunites et 12 `opportunity_events` supprimes.
     Verification apres purge : `opportunities = 0`, `opportunity_events = 0`, `leads = 5`,
     `prospects = 5`, `seller_properties = 2`, `market_properties = 5`.
- Fichiers : `src/app/admin/market/opportunities/KanbanBoard.tsx`,
  `src/app/admin/market/opportunities/[id]/page.tsx`,
  `src/app/api/market/opportunities/[id]/route.ts`,
  `src/app/api/market/opportunities/[id]/events/[eventId]/route.ts`,
  `src/app/api/market/properties/route.ts`,
  `src/app/api/market/properties/[id]/route.ts`,
  `src/lib/market/property-thumbnail.ts`,
  `src/types/supabase.ts`,
  `supabase/migrations/019_opportunity_pipeline_revision.sql`,
  `docs/SUIVI_PROJET.md`.
- Audit qualite : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK ; tests API reels OK (thumbnail liste/detail, changement de bien,
  stage `Visite d'estimation`, ajout/modification/suppression activite, verrou edition
  Stream Estate 403) ; Playwright desktop/mobile OK avec captures `/tmp/opportunity-desktop.png`
  et `/tmp/opportunity-mobile.png`.
- Serveur local : relance sur `http://localhost:3003`.

## Informations Generales
- Nom du projet: Mandat OS MVP - Site Alexandre Lopez (Provence Verte & Verdon)
- Client: Alexandre Lopez (conseiller immobilier iad)
- Date de debut: 09 juin 2026
- Date cible MVP: 30 juin 2026
- Statut global: En cours

## Liens Importants
- Linear: https://linear.app/alexandre-lopez/project/mandat-os-mvp-site-alexandre-lopez-af1414ac70da
- GitHub: https://github.com/alexlopez-studio/site-alex-lopez-provence
- Supabase: https://byrsmbgfkvgxdtdyhrro.supabase.co
- Vercel: https://vercel.com/alexlopez-studio/site-alex-lopez-provence

## Avancement par Lot

### Lot 1 - Infrastructure
- Statut: Termine
- Deadline: 01/06/2026

### Lot 2 - API Backend
- Statut: En cours (0%)
- Deadline: 15/06/2026
- Taches:
  - ALE-29: API-001 - CRUD Regles
  - ALE-30: API-002 - Notifications
  - ALE-31: API-003 - Opportunites
  - ALE-28: API-004 - Zones Surveillees

### Lot 3 - UI Dashboard
- Statut: Non commence (0%)
- Deadline: 20/06/2026
- Taches:
  - ALE-35: UI-001 - Dashboard KPIs
  - ALE-33: UI-002 - Table Marche
  - ALE-34: UI-003 - Fiche Bien
  - ALE-32: UI-004 - Kanban Opportunites
  - ALE-36: UI-005 - Gestion Regles

### Lot 4 - Moteur de Regles
- Statut: Non commence (0%)
- Deadline: 25/06/2026
- Taches:
  - ALE-39: RUL-001 - Assistant Creation Regle
  - ALE-38: RUL-002 - Execution Manuelle
  - ALE-37: RUL-003 - Regles Preconfigurees

### Lot 5 - Monitoring
- Statut: Non commence (0%)
- Deadline: 30/06/2026
- Taches:
  - ALE-40: MON-001 - Dashboard Consommation API

## Dependances entre Lots
Lot 2 (API Backend) -> Lot 3 (UI Dashboard)
Lot 2 -> Lot 4 (Moteur de Regles)
Lot 3 -> Lot 4
Lot 4 -> Lot 5 (Monitoring)

## Prochaines Etapes — MVP « trouver des vendeurs → récupérer des mandats »

Objectif MVP recentré : la seule chose qui compte pour le MVP est de **détecter les
vendeurs en fenêtre d'or et déclencher la prise de contact pour obtenir le mandat**.
Le reste (espace client, gestion de projet, etc.) vient ensuite — voir `docs/BACKLOG.md`.

Constat déterminant : le `mandate_score` est branché mais ne peut pas encore révéler de
fenêtre d'or. L'axe Temps (40 pts) monte passivement avec le calendrier, mais les axes
Frustration + Intensité (45 pts, le signal le plus fort) et Comportement (15 pts) ne se
déclenchent **que si on resynchronise dans le temps** (détection des baisses de prix et
des republications). Sans sync récurrente → tout reste `cold` → aucun vendeur à contacter.

### 27/06/2026 - Opportunités : fiche CRM type Brevo + activités
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : refonte UX fiche opportunité + API CRM.
- Statut : **fait**.
- Demande (Alexandre) : transformer la fiche opportunité en vue CRM inspirée Brevo, avec cards
  informatives `Bien` et `Contacts`, actions rapides, timeline d'activités, suppression de
  `Contexte` et `Journal de prospection`, et édition des biens uniquement pour les biens créés
  par l'utilisateur.
- Travail :
  1. Nouvelle table `opportunity_events` (`note`, `task`, `call`, `meeting`, `email`,
     `stage_change`, `estimation`, `system`) via migration `018_opportunity_events_crm.sql`.
     Migration appliquée sur la base Supabase locale/configurée pour tester le flux réel.
  2. API `GET /api/market/opportunities/[id]` enrichie avec `events`, `POST /events` ajouté,
     `PATCH /events/[eventId]` ajouté pour terminer/modifier une activité.
  3. `PATCH /api/market/opportunities/[id]` protège aussi le rattachement `lead_id` contre les
     doublons, comme pour `market_property_id`, et journalise les changements d'étape.
  4. `PATCH /api/market/properties/[id]` refuse l'édition si `source` n'est pas `manual` ou `user`.
  5. Fiche `/app/opportunities/[id]` refondue : header compact, onglets `Vue d'ensemble` /
     `Historique`, carte `Étape en cours`, `Activités à venir`, `Historique récent`, cards `Bien`
     et `Contacts`, menu `Ajouter` (note, tâche, appel, RDV, email loggé, étape estimation).
  6. Les actions `Ajouter contact` et `Ajouter bien` ouvrent des sélecteurs dans la fiche, sans
     appel Stream Estate ; les boutons `Modifier` renvoient vers les pages dédiées.
- Fichiers : `src/app/admin/market/opportunities/[id]/page.tsx`,
  `src/app/api/market/opportunities/[id]/route.ts`,
  `src/app/api/market/opportunities/[id]/events/route.ts`,
  `src/app/api/market/opportunities/[id]/events/[eventId]/route.ts`,
  `src/app/api/market/properties/[id]/route.ts`,
  `src/types/supabase.ts`, `supabase/migrations/018_opportunity_events_crm.sql`,
  `docs/SUIVI_PROJET.md`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK ; test API réel OK (rattachement lead/bien, conflits `409`,
  note/tâche/RDV/estimation, tâche terminée, jalon estimation, verrou édition Stream Estate) ;
  Playwright desktop/mobile OK. Les anciens blocs `Contexte` et `Journal de prospection` sont absents.

### 27/06/2026 - Opportunités : sélection du bien dès la création
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : correction UX Kanban / création opportunité.
- Statut : **fait**.
- Demande (Alexandre) : le bouton `Nouvelle opportunité` doit rester visible en haut à droite
  sans devoir scroller horizontalement, et la création d'une opportunité doit permettre de
  sélectionner le bien en annonce à rattacher.
- Travail :
  1. Modale `Nouvelle opportunité vendeur` enrichie avec un bloc `Bien en annonce` :
     recherche locale dans `market_properties`, affichage prix/surface/commune/statut/type vendeur,
     sélection en un clic et retrait possible.
  2. Les biens déjà liés à une opportunité sont affichés en `déjà lié` et non sélectionnables,
     pour conserver le dédoublonnage.
  3. `POST /api/market/opportunities` reçoit maintenant `market_property_id` depuis le Kanban
     quand un bien est sélectionné, sans appel Stream Estate.
  4. Shell admin + Kanban bornés en largeur (`min-w-0`, `overflow-x-hidden` côté shell, scroll
     horizontal uniquement sur les colonnes), ce qui garde le bouton principal dans le viewport.
- Fichiers : `src/app/admin/market/opportunities/KanbanBoard.tsx`,
  `src/app/admin/market/MarketShell.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors
  changement ; `pnpm build` OK ; Playwright local sur `localhost:3003` OK : bouton dans le viewport,
  modale ouverte, recherche de bien, sélection d'un bien libre temporaire, cleanup OK.

### 27/06/2026 - Opportunités : rapprochement Lead vendeur + Bien en annonce
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : ajustement CRM vendeur / rapprochement opportunité.
- Statut : **fait**.
- Demande (Alexandre) : confirmer et implémenter l'opportunité comme croisement entre un lead vendeur
  et un bien en annonce, afficher les deux sources d'information dans la fiche, et permettre de rattacher
  un bien déjà présent en base si l'opportunité n'en a pas. Aucun appel Stream Estate ne doit être fait.
- Travail :
  1. API `GET /api/market/opportunities/[id]` enrichie avec `lead` (`prospect` + `seller_property`) et
     `property` (`market_properties`) quand `lead_id` / `market_property_id` existent.
  2. API `PATCH /api/market/opportunities/[id]` protège le rattachement d'un bien : si un autre
     `opportunity` utilise déjà ce `market_property_id`, réponse `409` avec `existing_opportunity`.
  3. API `GET /api/market/properties` accepte `q` pour rechercher dans les biens déjà importés
     (titre, ville, code postal), sans consommation Stream Estate.
  4. Fiche `/app/opportunities/[id]` : nouveaux blocs `Lead vendeur` et `Bien en annonce`, liens vers
     fiche lead/bien, chiffres principaux du bien, et CTA `Rattacher` quand aucun bien n'est lié.
  5. Modale `Rattacher un bien en annonce` : recherche + filtres type/statut, affichage des biens,
     blocage visuel des biens déjà liés et bouton vers l'opportunité existante.
- Fichiers : `src/app/api/market/opportunities/[id]/route.ts`,
  `src/app/api/market/properties/route.ts`, `src/app/admin/market/opportunities/[id]/page.tsx`,
  `docs/SUIVI_PROJET.md`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors changement ;
  `pnpm build` OK ; test API réel sur `localhost:3003` : enrichissement lead+bien, rattachement d'un
  bien libre, conflit `409` sur bien déjà lié, cleanup OK ; Playwright desktop/mobile sur fiche avec bien,
  fiche sans bien + modale de rattachement OK. Seul 404 local observé : `_vercel/insights/script.js`,
  attendu hors Vercel.

### 27/06/2026 - Opportunités : rattachement lead + fiche dédiée
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : ajustement workflow CRM vendeur / UX opportunités.
- Statut : **fait**.
- Demande (Alexandre) : lors de la création d'une opportunité, pouvoir la rattacher à un lead/contact
  déjà créé ; si le lead n'existe pas, pouvoir créer ce contact depuis la création de l'opportunité.
  Supprimer les champs précis de la pop-up et les reporter dans une vraie page dédiée.
- Travail :
  1. API `POST /api/market/opportunities` enrichie : rattachement par `lead_id`, idempotence par
     `lead_id`, création optionnelle d'un lead vendeur via `create_lead=true`, puis création de
     l'opportunité préremplie depuis `prospects` + `seller_properties`.
  2. Kanban opportunités : la modale `Nouvelle opportunité` est simplifiée avec deux modes :
     `Lead existant` (recherche/sélection des leads vendeurs) et `Nouveau lead` (contact minimum).
     Les champs précis bien/estimation/dates/notes ne sont plus dans la pop-up.
  3. Navigation : clic carte et bouton crayon ouvrent désormais la fiche dédiée
     `/app/opportunities/[id]`.
  4. Nouvelle fiche opportunité : édition complète contact vendeur, bien potentiel, estimation,
     étapes, dates clés, prochaine action, contexte et journal de prospection.
- Fichiers : `src/app/api/market/opportunities/route.ts`,
  `src/app/admin/market/opportunities/KanbanBoard.tsx`,
  `src/app/admin/market/opportunities/[id]/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm lint` OK avec warnings existants hors changement ;
  `pnpm build` OK ; test API réel sur `localhost:3003` : opportunité depuis lead existant idempotente
  + opportunité avec création de lead + cleanup OK ; Playwright desktop/mobile sur Kanban + modale
  simplifiée + fiche dédiée OK. Seul 404 local observé : `_vercel/insights/script.js`, attendu hors Vercel.

### 27/06/2026 - Leads CRM vendeur : prospection terrain + conversion opportunité
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature CRM vendeur / API Leads / UI admin.
- Statut : **fait**.
- Demande (Alexandre) : recentrer la page Leads comme CRM vendeur avant opportunité, ajouter les leads
  terrain ou issus d'une estimation site, afficher les biens comparables déjà en base, puis convertir
  un lead en opportunité sans doublon.
- Travail :
  1. **Migrations appliquées sur la Supabase distante** : `017_seller_leads_crm.sql` ajoute
     `source_channel`, `priority`, `next_action`, `due_date`, `follow_up_at` sur `leads`, rend
     `prospects.email` nullable, et ajoute `opportunities.lead_id`. Le schéma matching historique
     `004_matching_schema.sql` a aussi été appliqué car la base distante n'avait pas encore
     `seller_properties`, `buyer_criteria` et `match_results`.
  2. API Leads : `/api/leads` persiste désormais les estimations site dans `prospects`, `leads` et
     `seller_properties`; correction du magic link pour qu'il pointe toujours vers le `leadId`
     réellement sauvegardé. Ajout de `POST /api/leads/manual`, enrichissement de
     `GET /api/leads/list` et `GET/PATCH /api/leads/[id]`.
  3. Conversion : nouveau `POST /api/leads/[id]/opportunity`, idempotent via `opportunities.lead_id`;
     l'opportunité récupère le contact vendeur, la source, la commune, le type de bien, surfaces,
     timing, priorité et prochaine action.
  4. Comparables : nouveau `GET /api/leads/[id]/comparables`, basé sur les biens déjà présents dans
     `market_properties` de la commune, sans appel Stream Estate supplémentaire.
  5. UI : liste `/app/leads` refondue en vue CRM vendeur avec filtres source/priorité/commune/statut,
     bouton `Nouveau lead` et formulaire manuel. Fiche `/app/leads/[id]` refondue avec contact,
     bien vendeur potentiel, prochaines actions, résultats d'estimation, comparables, historique,
     note, renvoi du lien et CTA `Créer une opportunité` / `Voir l'opportunité`.
- Fichiers : `supabase/migrations/017_seller_leads_crm.sql`, `src/types/supabase.ts`,
  `src/lib/leads-crm.ts`, `src/lib/leads-repo.ts`, `src/app/api/leads/route.ts`,
  `src/app/api/leads/manual/route.ts`, `src/app/api/leads/list/route.ts`,
  `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/[id]/comparables/route.ts`,
  `src/app/api/leads/[id]/opportunity/route.ts`, `src/app/api/leads/[id]/resend/route.ts`,
  `src/app/api/market/opportunities/route.ts`, `src/app/api/market/opportunities/[id]/route.ts`,
  `src/app/admin/market/leads/page.tsx`, `src/app/admin/market/leads/[id]/page.tsx`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm vitest run src/app/api/leads/__tests__/route.test.ts
  'src/app/resultats/[token]/__tests__/lookup.test.ts'` OK (17 tests) ; `pnpm lint` OK avec warnings
  existants hors Leads ; `pnpm build` OK ; migration 017 + schéma matching vérifiés en base ; test API
  réel sur `localhost:3003` : création lead manuel → fiche enrichie → comparables → création opportunité
  → deuxième création idempotente → cleanup OK. Playwright desktop/mobile sur `/app/leads` et
  `/app/leads/[id]` OK ; seul 404 local observé : `_vercel/insights/script.js`, attendu hors Vercel.
- Point d'attention : sur mobile, la table Leads reste horizontalement scrollable. Le badge utilisateur
  flottant du layout admin peut visuellement recouvrir le bord gauche en local ; ce point est transverse
  au layout `/app/*`, pas spécifique à la refonte Leads.

### 27/06/2026 - Opportunités vendeur : création manuelle + pipeline simplifié
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature CRM vendeur / pipeline mandat.
- Statut : **fait**.
- Demande (Alexandre) : pouvoir créer une opportunité manuellement pour un vendeur sans annonce
  en ligne, et simplifier le pipeline autour du workflow réel : appel/flyer → pré-estimation →
  visite → rapport → décision → mandat ou suivi moyen terme.
- Travail :
  1. **Migration 016** (`016_seller_opportunities_pipeline.sql`, appliquée sur la Supabase distante)
     : champs optionnels contact vendeur, origine, infos bien, estimation, dates clés
     (`pre_estimation_done_at`, `visit_at`, `report_delivered_at`, `follow_up_at`) + migration des
     anciens stages vers `Nouveau contact`, `Pré-estimation`, `RDV / Visite`, `Rapport remis`,
     `Décision vendeur`, `Suivi moyen terme`, `Mandat signé`, `Perdu / Écarté`.
  2. API opportunités : `POST /api/market/opportunities` et `PATCH /api/market/opportunities/[id]`
     acceptent les nouveaux champs structurés ; l'idempotence par `market_property_id` est conservée.
  3. `KanbanBoard.tsx` refondu : 6 colonnes actives + 2 issues, cartes centrées sur vendeur/commune/type
     de bien/prochaine action, formulaire manuel “Contact + bien”, fiche d'édition complète.
  4. Création depuis les biens et règles automatiques alignées sur `Nouveau contact`, avec enrichissement
     minimum (`source_channel=annonce`, commune, CP, type, prix estimé). Dashboard stats mis à jour
     pour exclure `Mandat signé` / `Perdu / Écarté` du pipeline actif.
  5. Correction navigation CRM : clic sur une carte opportunité liée → fiche du bien
     `/app/properties/[id]`; les opportunités manuelles sans bien ouvrent leur fiche de suivi.
     La page Biens privilégie aussi l'action `Fiche CRM` plutôt qu'un retour générique au pipeline.
- Fichiers : `supabase/migrations/016_seller_opportunities_pipeline.sql`, `src/types/supabase.ts`,
  `src/app/api/market/opportunities/route.ts`, `src/app/api/market/opportunities/[id]/route.ts`,
  `src/app/admin/market/opportunities/KanbanBoard.tsx`, `src/app/admin/market/properties/PropertiesTable.tsx`,
  `src/app/admin/market/properties/[id]/PropertyDetail.tsx`, `src/app/api/market/dashboard-stats/route.ts`,
  `src/app/api/market/sync/route.ts`, `src/app/api/market/rules/[id]/execute/route.ts`,
  `src/components/admin/RuleWizard.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `pnpm exec tsc --noEmit` OK ; `pnpm build` OK ; `pnpm lint` OK avec warnings existants
  du projet ; migration 016 vérifiée en base ; test API création manuelle → PATCH suivi moyen terme →
  DELETE OK ; test idempotence création depuis bien OK ; Playwright sur `http://localhost:3003/app/opportunities`
  desktop/mobile + dialog OK ; clic carte opportunité liée → `/app/properties/[id]` OK. Le seul 404
  local observé est `_vercel/insights/script.js`, attendu hors Vercel.
- Point d'attention : le serveur déjà présent sur `localhost:3002` répondait 500 sans logs accessibles ;
  une instance fraîche a été lancée sur `localhost:3003` pour les vérifications.
- Suite : utiliser le nouveau pipeline pour les prochains tests métier ; si besoin, ajouter ensuite une
  vue “relances du jour” basée sur `due_date` / `follow_up_at`.

### P0 — sans ça, la boucle ne tourne pas
1. ✅ **Sync récurrente contrôlée — CODÉE, gardée OFF** (22/06, optimisée 26/06). Job
   `/api/jobs/sync-zones` qui fait le monitoring ciblé des biens connus puis un pull
   incrémental `fromUpdatedAt` par zone déjà importée (alimente `market_properties`, pas le
   `listings` mort). Schedule `0 3 * * *` câblé dans `vercel.json` mais **inerte** tant que
   `STREAM_ESTATE_CRON_ENABLED != 'true'`.
   **Pour activer en prod** : poser `STREAM_ESTATE_CRON_ENABLED=true` (+ `CRON_SECRET`)
   dans Vercel et vérifier le budget Stream Estate. Détail : entrée journal 22/06.
2. ✅ **Détection baisse de prix + republication → score — FAIT** (22/06). Baisse de prix
   déjà câblée (sync → `property_price_history` → axes Frustration/Intensité). Republication
   dérivée de l'avancée de `published_at` vs `first_seen_at` (axe Comportement), sans
   migration. Détail : entrée journal 22/06. À valider sur données réelles quand la sync tourne.

### P1 — transformer la détection en action
3. **Surfaçage « à contacter »** :
   - ✅ a. **Widget dashboard FAIT** (22/06) : `VendeursAContacter` (phases golden+hot, top 8).
   - ✅ b. **Alertes au franchissement de seuil FAIT** (22/06) : score persisté sur
     `market_properties` (migration 012), `rescoreAndPersist` à la sync → notification
     `mandate_hot`/`mandate_golden` au passage à la hausse, anti-doublon. Endpoint rescore
     pour backfill. Détail : entrée journal 22/06. Reste optionnel : surfacer ces
     notifications dans l'UI + envoi email (`golden-alert-template`).
4. ✅ **Workflow prospection → mandat FAIT** (22/06) : édition d'opportunité (étape, prochaine
   action, échéance) + journal de prospection (`note`) via panneau sur chaque carte du Kanban.
   Contact vendeur dans le journal pour l'instant (champ structuré différé, dépend de la donnée
   Stream Estate). Détail : entrée journal 22/06.

### P1.5 — fiabilité pour usage réel
5. **Réactiver/sécuriser la garde auth admin** (actuellement neutralisée en local) avant
   toute utilisation en conditions réelles.

### Le reste (plus tard)
- Backlog produit (espace client, stats client, gestion de projet, KPI, marque, Plaud Pro) : `docs/BACKLOG.md`.
- Nettoyage du monde `dashboard/radar` mort (tables `listings`/`listing_events` absentes).
- Unification UX `/app/*` + audit Playwright.

## Taches Ouvertes Courantes

- En cours : design logiciel Mandat OS, navigation et ergonomie backoffice.
- A verifier : audit Playwright cible sur la navigation sidebar et les routes `/app/dashboard`, `/app/leads`, `/app/radar`, `/app/properties`, `/app/acheteurs`.
- A verifier : erreurs locales Radar sur `/api/radar/listings` si les tables Supabase `listings` / `listing_events` ne sont pas presentes.
- A faire avant production : reactiver/verifier la garde auth admin actuellement facilitee pour la navigation locale.
- A maintenir : tenir `docs/START.md`, `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md` et `docs/ROUTES.md` alignes avec les routes canoniques `/app/*`.

## Journal de Bord

### 26/06/2026 - Maîtrise budget Stream Estate : webhooks + reconcile incrémental
- Base/branche : `preview`.
- Type : backend / intégration Stream Estate / budget.
- Statut : fait localement.
- Résumé : implémentation du modèle économe validé : import initial volontaire par commune, webhooks Stream Estate en capteur primaire, pull incrémental `fromUpdatedAt` en filet de sécurité et monitoring ciblé par ID pour les biens connus. Le cron `/api/jobs/sync-zones` ne fait plus de découverte/scans complets en rythme normal : il traite les biens connus puis réconcilie seulement les zones déjà importées avec une fenêtre de recouvrement configurable.
- Budget : ajout d’un plafond mensuel `stream_estate_monthly_budget_eur` (défaut 20 €), d’un coût event webhook `stream_estate_webhook_event_cost_eur` (défaut 0 €), du suivi `source`/`event_type` dans `stream_estate_usage_events`, et de compteurs events webhook exposés dans `/api/market/sync-stats`. Les webhooks sont journalisés avec `item_count=0` tant que la facturation fournisseur n’est pas confirmée.
- Webhooks : nouveau `POST /api/market/webhooks/stream-estate`, protégé par `STREAM_ESTATE_WEBHOOK_SECRET` si présent, `stream_estate_webhook_enabled=false` par défaut. Le endpoint accepte les payloads event/match, extrait `propertyDocument`, upsert le bien, historise les prix, marque les expirés, notifie les nouveaux biens et re-score de façon idempotente.
- Saved searches : helpers `createSavedSearch/listSavedSearches/deleteSavedSearch` + rattachement best-effort `monitored_zones.stream_estate_search_id` quand les webhooks sont activés et qu’une URL publique stable est configurée (`STREAM_ESTATE_PUBLIC_BASE_URL` ou `NEXT_PUBLIC_SITE_URL`).
- Fichiers principaux : `supabase/migrations/014_stream_estate_webhooks_budget.sql`, `src/lib/stream-estate.ts`, `src/lib/stream-estate-budget.ts`, `src/lib/market/upsert-listing.ts`, `src/lib/market/stream-estate-searches.ts`, `src/app/api/market/webhooks/stream-estate/route.ts`, `src/app/api/jobs/sync-zones/route.ts`, `src/app/api/market/sync/route.ts`, `src/app/api/market/sync-stats/route.ts`, `src/types/supabase.ts`.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `npm run lint` OK avec warnings préexistants ; `npm run build` OK. Pas d’appel réel Stream Estate lancé pendant cette tâche.
- À faire avant prod : appliquer la migration 014 sur Supabase ; définir `STREAM_ESTATE_WEBHOOK_SECRET`, `STREAM_ESTATE_PUBLIC_BASE_URL`, puis activer `stream_estate_webhook_enabled` seulement après validation de l’URL publique et de la facturation events avec Stream Estate ; garder `STREAM_ESTATE_CRON_ENABLED` OFF tant qu’Alexandre ne valide pas l’activation.

### 26/06/2026 - Migration 014 appliquée + tests non dépensiers
- Base/branche : `preview`.
- Type : base distante / vérification API.
- Statut : fait.
- Résumé : application ciblée de `supabase/migrations/014_stream_estate_webhooks_budget.sql` sur la Supabase distante `byrsmbgfkvgxdtdyhrro` via connexion Postgres directe, car l’historique Supabase CLI distant est horodaté et ne correspond pas aux fichiers locaux `001…014` (pas de `supabase migration up` pour éviter de rejouer d’anciens fichiers).
- Vérifications base : colonnes présentes `monitored_zones.stream_estate_search_id`, `monitored_zones.last_reconciled_at`, `sync_runs.source`, `stream_estate_usage_events.source`, `stream_estate_usage_events.event_type`; réglages présents `stream_estate_monthly_budget_eur=20`, `stream_estate_webhook_enabled=false`, `stream_estate_webhook_event_cost_eur=0`, `stream_estate_reconcile_window_days=1`.
- Tests locaux sans dépense Stream Estate : serveur Next temporaire sur `http://localhost:3002`; `GET /api/market/sync-stats` OK (budget mensuel exposé, events webhook à 0) ; `POST /api/market/webhooks/stream-estate` retourne bien `403 stream_estate_webhook_disabled` ; `GET /api/jobs/sync-zones` retourne `skipped=true, reason=cron_disabled`. Serveur local arrêté après tests.
- Suite : définir `STREAM_ESTATE_WEBHOOK_SECRET` + `STREAM_ESTATE_PUBLIC_BASE_URL`, puis tester un webhook simulé seulement après activation contrôlée de `stream_estate_webhook_enabled`.

### 26/06/2026 - Budget Stream Estate : plafond centime par centime
- Base/branche : `preview`.
- Type : sécurité budget / réglage live.
- Statut : fait.
- Décision Alexandre : ne pas garder un plafond par défaut à 20 € ; le budget doit être piloté explicitement au centime près.
- Travail : défaut applicatif `stream_estate_monthly_budget_eur` passé de `20` à `0`; la logique budget considère désormais `0 €` comme un vrai plafond bloquant (et non comme illimité). La migration 014 locale a été alignée sur ce défaut.
- Base distante : `app_settings.stream_estate_monthly_budget_eur` mis à `0`. Vérification API locale : `monthly_budget_eur=0`, `estimated_month_remaining_eur=0`, solde manuel existant `4,72 €` conservé mais inutilisable tant qu’un plafond mensuel explicite n’est pas fixé.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; serveur Next temporaire sur `http://localhost:3002` pour vérifier `/api/market/sync-stats`, puis arrêté.

### 26/06/2026 - UX import Stream Estate : décision explicite après preview gratuite
- Base/branche : `preview`.
- Type : UX / garde-fou budget.
- Statut : fait.
- Décision Alexandre : le flux central doit être « je choisis une commune → je prévisualise gratuitement le nombre d’items → je valide ou refuse l’appel payant », puis seulement ensuite les updates/nouvelles annonces/expirations prennent le relais.
- Travail : wording de `/app/settings` clarifié : la carte d’import parle de prévisualisation gratuite puis de décision ; le coût est libellé « Appel payant si validation » ; le bouton principal devient « Valider l’appel payant » ; ajout d’un bouton « Refuser » qui annule la décision et confirme qu’aucun item n’a été téléchargé ni facturé.
- Audit qualité : `npx tsc --noEmit --pretty false` OK.

### 26/06/2026 - Stream Estate : recherche PAP uniquement et biens en ligne
- Base/branche : `preview`.
- Type : filtrage fournisseur / maîtrise budget.
- Statut : fait.
- Décision Alexandre : la recherche doit se concentrer sur les annonces publiées en ligne actuellement, en excluant les biens de professionnels/agences, locaux professionnels, commerces, terrains, parkings et annonces expirées/hors ligne. Cible prioritaire : PAP.
- Travail : le client Stream Estate filtre désormais par défaut `expired=false`, `propertyTypes=[0,1]` (maisons/appartements) et `publisherTypes=[0]` (particuliers/PAP) pour la prévisualisation, l’import, le reconcile incrémental et les saved searches. Le mapping vendeur reconnaît aussi `publisherTypes=[0]` comme `seller_type='individual'`.
- UX : la prévisualisation dans `/app/settings` affiche les badges « PAP uniquement », « Annonces en ligne » et « Maisons & appartements ».
- Budget live : solde manuel Stream Estate mis à `2,41 €`; plafond mensuel conservé à `0 €`, donc aucun appel payant ne peut partir tant qu’un plafond explicite n’est pas fixé.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `GET /api/market/sync-stats` confirme `manual_balance_eur=2.41`, `monthly_budget_eur=0`, `estimated_month_remaining_eur=0`, `cost_per_item_eur=0.01`.

### 26/06/2026 - Stream Estate : terrains PAP + anti-doublon annonce
- Base/branche : `preview`.
- Type : filtrage fournisseur / qualité données.
- Statut : fait.
- Décision Alexandre : inclure les terrains, mais uniquement lorsqu’ils sont publiés par un particulier ; éviter les doublons d’annonces.
- Travail : le filtre par défaut Stream Estate passe à `propertyTypes=[0,1,5]` (appartements, maisons, terrains), toujours avec `publisherTypes=[0]` et `expired=false`. Les saved searches, previews, imports et reconciliations héritent de ce périmètre. L’UI affiche désormais « Maisons, appartements & terrains ».
- Anti-doublon : l’ingestion partagée cherche d’abord un bien existant par `external_id`, puis par URL exacte, puis par signature stricte (commune/CP, type, prix, surface ou terrain, pièces et titre si disponible). Si un doublon est détecté, le bien existant est mis à jour au lieu de créer une nouvelle fiche/notification.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `/app/settings` répond 200 sur le serveur local.

### 26/06/2026 - Preview Stream Estate : filtres types de biens + budget non bloquant
- Base/branche : `preview`.
- Type : UX / filtrage preview / garde-fou budget.
- Statut : fait.
- Décision Alexandre : la prévisualisation gratuite suffit comme sécurité budget ; retirer le blocage par plafond mensuel à 0 et permettre de jouer avec les types de biens avant validation.
- Travail : `stream_estate_monthly_budget_eur=0` signifie désormais « pas de plafond mensuel » au lieu de bloquer les appels ; le solde manuel/réserve reste le garde-fou dur. `/api/market/sync-preview` et `/api/market/sync` acceptent `property_types` et limitent les valeurs à `[0,1,5]`.
- UX : ajout dans `/app/settings` d’un filtre multi-sélection `Appartement`, `Maison`, `Terrain`. La prévisualisation se relance automatiquement quand le filtre change, et l’import validé utilise exactement les mêmes types.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `/app/settings` répond 200 ; `/api/market/sync-stats` confirme `manual_balance_eur=2.41`, `monthly_budget_eur=0`.

### 26/06/2026 - Stream Estate : retrait du plafond 5 items par appel
- Base/branche : `preview`.
- Type : réglage live / budget.
- Statut : fait.
- Décision Alexandre : la prévisualisation gratuite suffit pour décider ; retirer le plafond à 0,05 € qui limitait encore les appels validés.
- Travail : `app_settings.stream_estate_unlimited_items` passé à `true`. Le réglage historique `stream_estate_max_items_per_sync=5` reste en base mais il est ignoré tant que le mode illimité est actif.
- Vérification : `/api/market/sync-stats` confirme `unlimited_items=true`, solde estimé `2,13 €`, coût item `0,01 €`, soit environ 212 items finançables par le solde actuel.

### 26/06/2026 - Page Biens : statut expiré/retiré et scoring mandat
- Base/branche : `preview`.
- Type : UX biens / ingestion Stream Estate / analyse scoring.
- Statut : fait localement.
- Décision Alexandre : sur la page Biens, les annonces retirées lors des updates doivent être visibles comme expirées/retirées.
- Travail : la table Biens affiche maintenant les statuts `expired` et `removed` avec les libellés `Expiré` et `Retiré`, et le filtre Statut permet de les isoler. La carte normalise aussi ces statuts avec une couleur neutre. L'ingestion Stream Estate reconnaît désormais les events/statuts terminaux larges (`expired`, `removed`, `deleted`, `offline`, `inactive`, `archived`) : ils renseignent `expired_at`, deviennent non actifs, et ne déclenchent pas de fausse notification de nouvelle annonce.
- Analyse scoring : la ressource IA Lab Immo sur l'analyse PAP confirme que le socle actuel est pertinent pour les signaux temporels/comportementaux (ancienneté, baisses, republication), mais qu'il faudra ajouter ensuite un axe d'écart prix marché/DVF et des signaux qualitatifs d'annonce (photos, description, DPE, contexte quartier) pour prioriser les vendeurs PAP les plus convertibles.
- Audit qualité : `npx tsc --noEmit --pretty false` OK.

### 27/06/2026 - Observatoire DVF : base locale + BI par commune
- Base/branche : `preview`.
- Type : data / BI / UX marché.
- Statut : fait localement + migration appliquée sur Supabase distante.
- Décision Alexandre : créer une base DVF reliée à la donnée gouvernementale, consultable dans Mandat OS, avec tableaux de bord BI, filtres par commune, ajout et suppression de communes.
- Source : données DVF publiques DGFiP/data.gouv ; import technique depuis le flux Geo-DVF CSV compressé par département (`https://files.data.gouv.fr/geo-dvf/latest/csv/{année}/departements/{département}.csv.gz`) pour filtrer ensuite par code INSEE.
- Travail : ajout de la migration `015_dvf_observatory.sql` avec `dvf_communes`, `dvf_transactions`, `dvf_import_runs`. Ajout des APIs `/api/market/dvf/zones`, `/api/market/dvf/zones/[id]`, `/api/market/dvf/import`, `/api/market/dvf/stats`, `/api/market/dvf/transactions`. Ajout de la page `/app/dvf` dans le groupe Marché : ajout de commune, import, suppression, filtres commune/année/type, KPI, répartition par type, évolution annuelle, tableau des mutations.
- Base distante : migration 015 appliquée via Postgres direct. Test réel : commune Barjols (`83012`) ajoutée et import 2025 réussi, `320` lignes DVF importées après scan du fichier départemental du Var (`79 857` lignes scannées).
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `npm run build` OK avec warnings préexistants ; `/app/dvf` répond 200 ; APIs DVF OK ; Playwright desktop/mobile OK, sans overflow horizontal. Test Vitest ciblé `src/lib/__tests__/dvf.test.ts` non exploitable en l'état car la config Vitest ne résout pas l'alias `@/lib/dvf`.
- Suite : décider si l'import doit devenir multi-années automatique par commune (2021-2025) et ajouter ensuite le rapprochement scoring PAP ↔ comparables DVF.

### 27/06/2026 - Navigation Marché : retrait Zones + opportunités depuis Biens
- Base/branche : `preview`.
- Type : UX navigation / workflow opportunités.
- Statut : fait localement.
- Décision Alexandre : retirer la page visible `Zones surveillées`, car la gestion des communes est maintenant disponible dans `/app/settings`.
- Travail navigation : retrait de `Zones surveillées` du menu Marché, remplacement du raccourci dashboard par `Gérer les communes`, support du deep-link `/app/settings?section=communes`, et redirection `/app/zones` vers cette section pour ne pas casser les anciens liens.
- Travail opportunités : `/api/market/properties` expose l'opportunité liée par bien ; la table Biens affiche `Voir l’opportunité` quand elle existe déjà, sinon `Créer une opportunité`. Le POST `/api/market/opportunities` est idempotent sur `market_property_id` : il renvoie l'opportunité existante au lieu de créer un doublon. Le détail bien lit aussi la plus récente opportunité liée pour éviter les erreurs si des doublons historiques existent.
- Vérification workflow : test API sur le bien `0d79f7bc-d4d7-4245-afc7-fcc96da581b7` : `POST /api/market/opportunities` retourne `200`, `existing=true`, même `opportunity_id`, et aucun doublon n'est créé (`existing_before=1`, `existing_after=1`).
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `npm run build` OK avec warnings préexistants ; Playwright `/app/properties` desktop/mobile sans overflow ; `/app/zones` redirige vers `/app/settings?section=communes`.

### 23/06/2026 - Paramètres Stream Estate simplifiés
- Base/branche : `preview`.
- Type : UX / intégration Stream Estate.
- Statut : fait.
- Resume : simplification de l’onglet `API Stream Estate` dans `/app/settings` : retrait du bandeau en 3 étapes, du bloc budget après import et du panneau de réglages API/budget. Stream Estate est présenté comme actif par défaut, avec sélection de commune, prévisualisation, import, communes surveillées modifiables/supprimables et historique.
- Point API : la prévisualisation conserve le comptage fournisseur `itemsPerPage=0` pour le plafond 10 000, mais le nombre affiché dans la page correspond désormais aux annonces encore en ligne après le même filtre que l’import.
- Fichiers : `src/app/admin/market/settings/page.tsx`, `src/app/api/market/sync-preview/route.ts`, `src/lib/stream-estate.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit --pretty false` OK ; `npm run lint` OK avec warnings préexistants ; `npm run build` OK ; Playwright local sur `/app/settings` desktop/mobile OK, sans overflow horizontal.

### 22/06/2026 - Paramètres : onglet API Stream Estate + informations personnelles
- Type : refonte UX admin branchée — simplification du cœur Stream Estate.
- Résumé : remplacement de `/app/settings` par une page à deux onglets. Onglet **API Stream Estate** : recherche de commune via `/api/market/communes`, rattachement CP/INSEE, prévisualisation réelle via `/api/market/sync-preview`, import réel via `/api/market/sync`, édition/suppression des communes surveillées via `/api/market/zones`, réglages budget/sync via `/api/market/settings` et historique masqué. La règle fournisseur transmise par Alexandre est visible : `itemsPerPage=0` permet de compter sans récupérer les biens, avec limite de 10 000 résultats pour `/documents/properties`. Onglet **Informations personnelles** : champs nom, fonction, email, téléphone sauvegardés dans `app_settings`.
- Fichiers : `src/app/admin/market/settings/page.tsx`, suppression de `src/app/admin/market/stream-estate-prototype/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit --pretty false` OK ; `npm run lint` OK avec warnings préexistants hors fichiers touchés ; `npm run build` OK après nettoyage `.next` ; Playwright local sur `/app/settings` desktop/mobile OK, onglets API Stream Estate + Informations personnelles OK, mention 10 000 visible, pas d'overflow horizontal.
- Suite : tester avec une commune réelle et décider si la page `/app/zones` doit être réduite à un inventaire simple ou rester une vue opérationnelle secondaire.

### 22/06/2026 - Notifications : base cohérente + redesign du volet
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : nettoyage données + amélioration UX du volet.
- Statut : **fait** (tsc OK ; table purgée ; pages 200).
- Demande (Alexandre) : base notifications cohérente + volet latéral mieux designé.
- Cohérence base : les notifications restantes (5) étaient **toutes des données de démo/seed**
  (ids `0000…006x`, types de modules morts price_drop/match/system, biens fictifs sans
  `market_property_id` réel). Purge des notifications **sans bien réel lié** → table à **0**.
  Désormais seules les vraies notifs la peuplent (new_listing à la découverte, mandate_hot/golden).
- Redesign du volet (`NotificationsSheet.tsx`), sobre/scannable (guidelines admin) :
  - **icône + teinte par type** (`TYPE_META` : Nouveau bien=bleu/Home, Fenêtre d'or=rouge/Flame,
    Vendeur chaud=orange/Flame, Acquéreur=violet/Users, Baisse=rose/TrendingDown) dans une pastille ;
  - libellé de type en capitales discrètes + heure relative + pastille « non lu » ;
  - distinction lu/non-lu nette (accent gauche brand) ; **actions visibles** (pas de hover-only) :
    action vers la fiche, marquer lu, archiver ;
  - suppression du badge priorité (bruit) ; états vides utiles ; loader discret.
- Fichiers : `src/components/admin/NotificationsSheet.tsx`, purge SQL (MCP), `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/dashboard` 200 ; API notifications = 0 (cohérent).
- Suite : activer la sync nocturne ; P1.5 (auth admin).

### 22/06/2026 - Cloche notifications en header (haut droite) + archivage
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — accès direct aux notifications + action archiver.
- Statut : **fait** (testé end-to-end, données de test nettoyées ; tsc OK).
- Demande (Alexandre) : notification visible en haut à droite du dashboard + pouvoir
  marquer lu **et** archiver.
- Constat : `NotificationsSheet` n'était **montée nulle part** ; le shell `/app/*` (`MarketShell`)
  n'avait **pas de header**.
- Travail :
  1. `MarketShell.tsx` : ajout d'une barre d'en-tête (`SidebarTrigger` + cloche `NotificationsSheet`
     en haut à droite via `ml-auto`) → visible sur **toutes** les pages `/app` dont le dashboard.
  2. Archivage : `PATCH /api/market/notifications/[id]` pose `resolved_at` quand `status='archived'` ;
     `GET` exclut les archivées par défaut (`.neq('status','archived')` si aucun filtre statut).
  3. Bouton **Archiver** ajouté dans la cloche **et** la page `/app/notifications` (+ marquer lu déjà présent).
- Fichiers : `src/app/admin/market/MarketShell.tsx`, `src/components/admin/NotificationsSheet.tsx`,
  `src/app/admin/market/notifications/page.tsx`, `src/app/api/market/notifications/route.ts`,
  `src/app/api/market/notifications/[id]/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/dashboard` + `/app/notifications` 200 ; flux archive
  testé (visible → `archived` + `resolved_at` → exclu du GET défaut) ; notif de test supprimée.
- Suite : activer la sync nocturne ; P1.5 (auth admin).

### 22/06/2026 - Audit des écrans + page Notifications branchée au réel
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : audit / nettoyage.
- Statut : **fait** (tsc OK ; page 200).
- Audit complet de la sidebar (tables vérifiées en base) :
  - ✅ Réels : Dashboard, Biens, Zones, Opportunités, Liste chaude (`warm_contacts` peuplée),
    Leads (`leads`), Réglages, Utilisateurs (`admin_users`, gated 403), cloche Notifications.
  - ❌ Cassés (tables absentes) : **Acquéreurs** + **Matching** (tables `buyers`/`match_results`
    inexistantes → API 500). Module côté acheteurs, distinct de la boucle mandat.
  - ⚠️ Mock : la **page** `/app/notifications` (≠ cloche).
  - Déjà masqués : Radar, Règles.
- Décisions (Alexandre) :
  - Module Acquéreurs + Matching : **gardé** (à construire plus tard — tables à créer le moment
    venu). Non modifié. NB : `runMatchingForProperty` est appelé à chaque nouveau bien dans la
    sync mais échoue en silence (tables absentes) — à brancher quand le module sera construit.
  - Page Notifications : **branchée au réel**.
- Travail : `src/app/admin/market/notifications/page.tsx` réécrit (fin du mock) → `GET
  /api/market/notifications` avec filtres **Toutes/Non lues** + **Tous types/Nouveaux biens/Alertes
  mandat**, marquer lu (PATCH `/[id]`), **tout marquer lu** (PATCH `{all:true}`), action → fiche bien.
- Fichiers : `src/app/admin/market/notifications/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/notifications` 200 ; plus de mock.
- Suite : activer la sync nocturne ; P1.5 (auth admin) ; (plus tard) construire le module acheteurs.

### 22/06/2026 - Masquage du Radar (écran mort, doublon de /app/properties)
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : nettoyage / clarification UX.
- Statut : **fait** (tsc OK).
- Question (Alexandre) : « le radar ça sert à quoi ? » → vérifié : `/app/radar` lit les tables
  `listings`/`seller_scores` **inexistantes en base** (`relation "listings" does not exist`),
  son API `/api/radar/listings` renvoie « Erreur inconnue » → écran non fonctionnel. Sa capacité
  (scoring vendeur) est reprise sur `market_properties` (table /app/properties + dimensions,
  widget « Vendeurs à contacter », alertes). Doublon mort, comme le moteur de règles.
- Décision : **masquer de la sidebar**, page/code conservés (réversible).
- Travail : `app-sidebar.tsx` — entrée « Radar » retirée de `SELLER_ITEMS` + import `RadarIcon`.
  Conservés : `src/app/dashboard/radar/*`, `src/app/api/radar/*`, `radar-queries.ts` ;
  `SellerPhaseBadge` intact (réutilisé partout).
- Fichiers : `src/components/app-sidebar.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; sidebar sans « Radar » ; `/app/dashboard` 200 ;
  `/app/radar` toujours 200 par URL (réversible).
- Note : la sidebar est désormais nettoyée des deux doublons morts (Règles + Radar).
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - Polissages : « tout marquer comme lu » + défaut max items/sync
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : amélioration / confort.
- Statut : **fait** (tsc OK ; testé live).
- Travail :
  1. `api/market/notifications/route.ts` (PATCH groupé) : nouveau mode `{all:true, status, type?}`
     en plus de `{ids, status}` → marque toutes les non-lues (optionnellement par type).
  2. `NotificationsSheet.tsx` : bouton **« Tout marquer comme lu »** (visible si non-lues) →
     PATCH `{all:true,status:'read'}`, MAJ optimiste + recompte.
  3. `stream-estate-budget.ts` : défaut `DEFAULT_MAX_REQUESTS_PER_SYNC` 1 → **30** (= max page API)
     pour les setups non configurés. (La valeur live d'Alexandre reste pilotée dans /app/settings.)
- Fichiers : `src/app/api/market/notifications/route.ts`, `src/components/admin/NotificationsSheet.tsx`,
  `src/lib/stream-estate-budget.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; PATCH `{all:true}` → 3 non-lues passées à 0 ; `/app/dashboard` 200.
- Pour passer en live (actions Alexandre) : régler le budget dans /app/settings (monter
  max items/sync, solde manuel) puis poser `STREAM_ESTATE_CRON_ENABLED=true` (+ `CRON_SECRET`) en prod Vercel.
- Suite : P1.5 (auth admin) avant ouverture ; observer les premières données réelles une fois la sync active.

### 22/06/2026 - Neutralisation du moteur de règles (doublon + bruit) + réponses coût
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : nettoyage / décision produit.
- Statut : **fait** (tsc OK ; base purgée).
- Questions (Alexandre) : (1) le push coûte-t-il des crédits ? → **non** (notifications = écritures
  en base sur biens déjà fetchés ; moteur de règles = 0 appel API). Seul coût = la sync, déjà
  plafonnée/cadencée. (2) la page des règles est-elle nécessaire ? → **non** : 128/133 notifications
  étaient des `rule_triggered` générées par les règles seed à conditions vides ; le score est
  désormais la source de vérité.
- Décision : **neutraliser + masquer + purger**, code conservé (réversible).
- Travail :
  1. `sync/route.ts` : appel `executeRulesForZone` gardé derrière `RULES_ENGINE_ENABLED = false`
     (en tête de module) → moteur coupé, fonction conservée.
  2. `app-sidebar.tsx` : entrée « Règles » retirée de `AUTOMATION_ITEMS` + import `ScrollTextIcon`
     supprimé. Page `/app/rules` + `RuleWizard` conservés (accessibles par URL, hors nav).
  3. Purge SQL : `delete from notifications where type='rule_triggered'` → **128 supprimées**,
     base passée de 133 à **5 notifications** (3 non lues). La cloche ne montre plus que les
     signaux pertinents (new_listing / mandate_* / match).
- Fichiers : `src/app/api/market/sync/route.ts`, `src/components/app-sidebar.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/dashboard`, `/app/properties` 200 ; `/app/rules`
  toujours 200 par URL (réversible) ; vérif base : 0 `rule_triggered`, 5 notifs restantes.
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - Push « nouveaux biens » dans la cloche in-app
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — notifier les nouveaux biens (canal retenu : cloche in-app).
- Statut : **fait** (testé end-to-end, données de test nettoyées ; tsc OK).
- Décision (Alexandre) : « push » = la **cloche in-app**, filtrée aux nouveaux biens (pas d'email/web-push).
- Travail :
  1. `sync/route.ts` (branche création) : émission d'une notification **déterministe**
     `type='new_listing'` par bien réellement créé (titre, ville/CP/prix/PAP-agence, priorité
     `high` si particulier, `market_property_id`, action « Voir le bien »).
  2. `NotificationsSheet.tsx` : **branché au réel** (fin du mock) — `GET /api/market/notifications`
     (filtre `type`), filtre **Nouveaux biens** (défaut) / **Tout**, badge non-lues réel,
     marquer-lu via `PATCH /[id]`, action → `/app/properties/[id]`.
- Constat : la règle seed « Nouveau bien » insère un type `rule_triggered` (pas `new_listing`) →
  pas de conflit avec le filtre ; source fiable = l'émission déterministe à la découverte.
- Fichiers : `src/app/api/market/sync/route.ts`, `src/components/admin/NotificationsSheet.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; notif `new_listing` de test → visible via filtre API,
  `PATCH {status:'read'}` → `read` + `read_at` posé ; **notif de test supprimée** ; `/app/dashboard` 200 ; plus de mock.
- Point d'attention : ~132 notifications non lues héritées en base → la cloche affiche « 9+ »
  (purge éventuelle hors périmètre). Les notifs `new_listing` n'arriveront automatiquement qu'aux
  syncs de découverte (lundi / `?discover=1`).
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - KPI « Particuliers chauds » (PAP) au dashboard
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — valoriser la cible premium (PAP en fenêtre d'or).
- Statut : **fait** (tsc OK ; dashboard 200).
- Travail : `GET /api/market/dashboard-stats` ajoute `pap_chauds` (= `seller_type='individual'`
  ET `mandate_phase` in hot/golden) ; `MandatKpiCards` affiche une 5e carte « Particuliers chauds »
  (vert, cible premium), grille passée à 5 colonnes en large.
- Fichiers : `src/app/api/market/dashboard-stats/route.ts`, `src/app/admin/market/MandatKpiCards.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; endpoint → `pap_chauds: 0` (cohérent : 5 biens agence/cold) ; `/app/dashboard` 200.
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - Refonte du modèle de qualification : score motivation + dimensions lisibles
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — cœur métier (modèle de qualification des opportunités de mandat).
- Statut : **fait** (testé end-to-end ; tsc OK). Plan validé : `~/.claude/plans/je-veux-qu-on-pense-cosmic-unicorn.md`.
- Décisions (Alexandre) : garder UN score 0-100 = **motivation** (axes inchangés) ; afficher à côté
  des **dimensions lisibles et filtrables** (type de vendeur PAP/agence — on garde les deux mais
  on les différencie —, sous-évaluation, DPE F/G, retrait récent) ; **score = source de vérité**
  pour détection+alertes, `management_rules` reste une couche optionnelle, **retrait du
  `buildBusinessSignal` en prose**.
- Découverte API (probe ~0,03 €) : `publisherTypes`/`adverts[].publisher` exposent le type de
  vendeur. Mapping confirmé : `publisher.type=1` + catégorie « Agences… » + `contact.agency` →
  **agence** ; catégorie particulier/propriétaire → **individual** ; sinon null. (Cf. mémoire
  `stream-estate-credit-optimization`.) Filtres date/tri toujours non supportés.
- Travail :
  1. **Type de vendeur** : migration 013 `seller_type` (+ index) ; types supabase ; `mapSellerType()`
     dans `stream-estate.ts` (exposé via `fetchListingStatusById` + `normalizeListing`) ; écriture
     dans `lead-monitor.ts` (monitoring par-id) et `sync/route.ts` (découverte, sans écraser).
  2. **Sous-évaluation** : `src/lib/market/zone-valuation.ts` (médiane prix/m² par zone INSEE/CP,
     `undervaluationPct`) ; `undervaluation_pct` calculé à la lecture dans les routes liste + détail.
  3. **Surfaçage** : `DimensionBadges.tsx` (PAP/Agence, Sous-évalué −X%, DPE F/G, Retiré) intégré
     dans `PropertiesTable` (+ filtre type de vendeur), `PropertyDetail` (carte « Profil du bien »
     remplace « Lecture du signal »), widget `VendeursAContacter` (badge PAP/agence).
  4. **Retrait prose** : `buildBusinessSignal` + champ `signal` supprimés de l'API détail.
  5. `management_rules` : inchangé (couche optionnelle, secondaire au score).
- Fichiers : `supabase/migrations/013_*.sql`, `src/types/supabase.ts`, `src/lib/stream-estate.ts`,
  `src/lib/market/lead-monitor.ts`, `src/lib/market/zone-valuation.ts` (nouveau),
  `src/app/api/market/sync/route.ts`, `src/app/api/market/properties/route.ts`,
  `src/app/api/market/properties/[id]/route.ts`, `src/app/admin/market/DimensionBadges.tsx` (nouveau),
  `PropertiesTable.tsx`, `PropertyDetail.tsx`, `VendeursAContacter.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK. Tests live : probe mapping (type=1=agence) ; backfill
  monitoring → `seller_type=agency` ×5 ; liste → `undervaluation_pct` (médiane ~2915 €/m², bien
  0d79f7bc à −5,5 %) + `seller_type` ; détail → `undervaluation_pct=5.5`, **plus de champ `signal`** ;
  `/app/dashboard|properties|properties/[id]` → 200 ; grep `buildBusinessSignal` propre.
- Point d'attention : pas encore d'échantillon PAP en base (zone d'agences) → le badge Particulier
  ressortira quand un PAP sera capté ; sous-évaluation liste calculée sur la page (zone filtrée),
  détail sur toute la zone.
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin) ; option KPI « PAP chauds » au dashboard.

### 22/06/2026 - Cadence de monitoring ajustable depuis les réglages
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — rendre les règles de cadence configurables (workflow efficient).
- Statut : **fait** (round-trip testé sans dépense ; tsc OK).
- Demande (Alexandre) : pouvoir ajuster les règles de cadence pour un workflow efficient.
- Travail :
  1. `settings.ts` : clés `monitoring_recheck_hours_{golden,hot,warm,cold}` + défauts
     (20/20/20/72 h) + helper `getMonitoringRecheckHours()` (coercition, valeurs > 0).
  2. `lead-monitor.ts` : `isDue` reçoit désormais les intervalles **lus depuis les réglages**
     (plus de constantes en dur).
  3. `settings/page.tsx` : nouvelle section « Cadence de monitoring » (4 champs heures par
     phase + Enregistrer). L'API settings générique (`PATCH {clé:valeur}`) suffit.
- Fichiers : `src/lib/settings.ts`, `src/lib/market/lead-monitor.ts`,
  `src/app/admin/market/settings/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/settings` 200. Round-trip live : PATCH
  (12/18/24/96) → GET confirme la persistance → monitoring lit `cold=96h` → 0 dû, 0 € ;
  **valeurs ensuite remises aux défauts (20/20/20/72)**.
- Point d'attention : la cadence pilote la fréquence (donc le coût) ; baisser les intervalles
  augmente la fraîcheur ET la dépense. Le budget reste le plafond dur.
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - Monitoring : sélection des biens par règles de cadence (coût sous-linéaire)
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — maîtriser le coût du monitoring quand le portefeuille grandit.
- Statut : **fait** (testé des deux côtés ; tsc OK).
- Problème soulevé (Alexandre) : avec 100 biens, re-vérifier tout chaque nuit = 100 items ≈
  1 €/nuit (~30 €/mois). Or re-checker un bien froid récent n'apporte presque rien.
- Solution : **sélectionner les biens à monitorer selon des règles de cadence** liées à leur
  phase, dans `monitorKnownLeads` :
  - golden / hot / warm → re-check **quotidien** (intervalle 20 h) ;
  - cold / non scoré → re-check **en roulement** (~tous les 3 jours) ;
  - un bien est « dû » s'il n'a jamais été scoré ou si l'intervalle de sa phase est écoulé
    (`isDue` sur `scored_at`). Tri : phase la plus chaude d'abord, puis le plus anciennement scoré.
  - Le tout reste plafonné par le budget (`getAvailableStreamEstateItems`).
- Effet : ex. 100 biens dont ~20 chauds/tièdes → ~20 quotidiens + ~80/3 en roulement ≈ 40
  items/nuit (~0,40 €) au lieu de 1 €, sans rater de baisse sur les biens qui comptent.
- Fichiers : `src/lib/market/lead-monitor.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK. Tests live (`?test=1&discover=0`) :
  - 5 leads cold scorés à l'instant → **0 dû, 0 €** (pas de re-check inutile) ;
  - 1 lead cold vieilli de 4 j (SQL) → **1 dû, vérifié, 0,01 €** puis re-scoré.
- Point d'attention : intervalles en dur (20 h / 3 j) — pourront devenir des réglages si besoin.
- Suite : activer la sync nocturne en prod (`STREAM_ESTATE_CRON_ENABLED=true`) ; P1.5 (auth admin).

### 22/06/2026 - Sync nocturne optimisée crédits : monitoring par-id + découverte hebdo
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — optimisation des crédits Stream Estate (cœur économique).
- Statut : **fait** (monitoring testé end-to-end ; tsc OK).
- Demande (Alexandre) : ne payer que pour l'info utile — télécharger seulement les nouveaux
  leads, ne re-synchroniser que ceux qui changent (baisse de prix…), le tout la nuit.
- Découvertes API (probe gratuit `itemsPerPage=0` + ~0,07 € de fetch, cf. mémoire
  `stream-estate-credit-optimization`) :
  - **Pas de filtre date** (`updatedAt[after]`/`publishedAt[after]` ignorés) ni **de tri**
    (`order[...]` ignoré) côté recherche → impossible de demander « seulement ce qui a changé ».
  - **Endpoint par-id** `/documents/properties/{id}` riche : `price`, `expired`, `adverts`
    (republication), `publisherTypes` (agence/particulier). C'est le levier.
- Stratégie retenue (Alexandre) : **monitoring quotidien + découverte hebdo**.
- Travail :
  1. `stream-estate.ts` : `fetchListingStatusById()` (prix + `expired`, 1 item facturé).
  2. **Nouveau** `src/lib/market/lead-monitor.ts` : `monitorKnownLeads()` — re-fetch par-id de
     nos leads actifs (plafonné par le budget via `getAvailableStreamEstateItems`), détecte
     baisse de prix (→ `property_price_history`) et retrait (`expired` → status/expired_at),
     journalise chaque item (`recordStreamEstateUsageEvent`), puis `rescoreAndPersist`.
  3. `jobs/sync-zones` : **monitoring chaque nuit** + **découverte (scan de zone) seulement le
     lundi** (Europe/Paris) ou `?discover=1` ; `?discover=0` force-saute. Réponse `{monitoring, discovery}`.
- Économie : re-vérifier nos 5 leads = **0,05 €** vs re-scanner la zone (166 items ≈ **1,66 €**) → ~33×.
- Fichiers : `src/lib/stream-estate.ts`, `src/lib/market/lead-monitor.ts` (nouveau),
  `src/app/api/jobs/sync-zones/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `GET /api/jobs/sync-zones?test=1&discover=0` →
  `monitoring {checked:5, price_changes:0, expired:0, billed_items:5, ~0,05 €}`, discovery non lancée.
- Point d'attention : monitoring plafonné au budget dispo (au-delà, les leads en trop sont
  laissés au run suivant — tri par `scored_at` le plus ancien). `published_at`/`updated_at` de
  l'endpoint liste peu fiables (champs réels dans `adverts`/`createdAt`) — à fiabiliser si besoin.
- Suite : activer la sync nocturne en prod (`STREAM_ESTATE_CRON_ENABLED=true`) ; P1.5 (auth admin).

### 22/06/2026 - Dashboard : activité de sync Stream Estate par jour (téléchargés / mis à jour)
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — faire ressortir l'activité Stream Estate quotidienne.
- Statut : **fait** (tsc OK ; dashboard 200 ; agrégation testée sur données réelles).
- Demande (Alexandre) : le flux de prospection doit être connecté à l'API Stream Estate et
  faire ressortir, **par jour**, le nombre de leads téléchargés et mis à jour.
- Constat : la sync (`/api/market/sync`, branchée à Stream Estate) journalise déjà chaque run
  dans `sync_runs` (`created_count`, `updated_count`, `external_item_count`, `estimated_cost_eur`,
  `started_at`). Il manquait l'agrégation + l'affichage.
- Travail :
  1. **Nouveau** `GET /api/market/sync-daily-stats?days=14` : agrège `sync_runs` par jour
     (clé de jour en Europe/Paris) → `today` + `daily[]` avec `downloaded` (=created_count),
     `updated` (=updated_count), `items` (facturés), `cost`.
  2. **Nouveau** `SyncDailyStats.tsx` : 2 compteurs du jour (Téléchargés / Mis à jour) + tableau
     des 14 derniers jours (Jour | Téléchargés | Mis à jour | Items | Coût).
  3. `page.tsx` : remplace le graphique placeholder `ChartAreaInteractive` par `SyncDailyStats`
     → **plus aucun élément factice sur le dashboard**.
- Mapping retenu : « téléchargés » = `created_count` (nouveaux leads importés), « mis à jour » = `updated_count`.
- Fichiers : `src/app/api/market/sync-daily-stats/route.ts` (nouveau), `src/app/admin/market/SyncDailyStats.tsx`
  (nouveau), `src/app/admin/market/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; endpoint réel → 18/06 : 35 téléchargés ; 20/06 : 5 ;
  22/06 : 5 mis à jour (~0,05 €) ; `/app/dashboard` 200, bloc présent.
- ⚠️ Point clé : ces chiffres ne se remplissent **chaque jour** que si la **sync nocturne est
  active**. Le cron `sync-zones` est codé mais OFF (`STREAM_ESTATE_CRON_ENABLED` non posé). Pour
  un vrai « tous les jours » automatique → activer le cron (cf. entrée P0.1). Les données
  actuelles viennent des syncs manuelles/test.
- Suite : activer la sync nocturne en prod ; P1.5 (auth admin).

### 22/06/2026 - Dashboard : KPI réels + suppression de la démo template
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — brancher le dashboard sur les vraies données.
- Statut : **fait** (tsc OK ; dashboard 200 ; données réelles vérifiées).
- Constat : `/app/dashboard` (= `admin/market/page.tsx`) était quasi entièrement le template
  shadcn — KPI en dur (« 1 248 biens », « 37 chaudes »…), table de démo hors-sujet
  (`data.json` : « Cover page / Eddie Lake »), boutons d'en-tête sans `onClick`. Seul le
  widget « Vendeurs à contacter » (P1.a) était réel.
- Décision (Alexandre) : KPI réels + virer la table de démo ; graphique laissé de côté (pas d'historique).
- Travail :
  1. **Nouveau** `GET /api/market/dashboard-stats` : `biens_surveilles`, `opportunites_chaudes`
     (mandate_phase hot/golden), `alertes_mandat` (notifications mandate_* non lues),
     `pipeline_actif` (opportunités hors Converti/Écarté), `zones_actives`.
  2. **Nouveau** `MandatKpiCards.tsx` (client) : 4 cartes `MetricCard` branchées sur l'endpoint.
     Composant dédié pour ne pas muter `SectionCards`/`DataTable` (partagés avec `app/dashboard`).
  3. `page.tsx` : remplace SectionCards par MandatKpiCards, **supprime la DataTable + `data.json`**,
     boutons d'en-tête → liens utiles (« Voir le marché » → /app/properties, « Gérer les zones » → /app/zones).
- Fichiers : `src/app/api/market/dashboard-stats/route.ts` (nouveau), `src/app/admin/market/MandatKpiCards.tsx`
  (nouveau), `src/app/admin/market/page.tsx`, `src/app/admin/market/data.json` (supprimé), `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `dashboard-stats` → `{biens:5, chaudes:0, alertes:0, pipeline:5, zones:1}` ;
  `/app/dashboard` 200 ; HTML : KPI présents, démo (Eddie Lake/Cover page) absente.
- Point d'attention : le **graphique** `ChartAreaInteractive` reste un placeholder template (laissé
  de côté faute d'historique) — à retirer ou brancher plus tard. Design/layout pur = ressort de Codex.
- Suite : P1.5 (réactiver l'auth admin) ; options graphique réel / notifications dans l'UI.

### 22/06/2026 - P1.4 : édition d'opportunité + journal de prospection (boucle fermée)
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — fermer la boucle détection → mandat.
- Statut : **fait** (tsc OK ; testé end-to-end, données restaurées).
- Constat : le pipeline modélisait déjà tout le parcours (stages À qualifier → … → Mandat
  potentiel → Converti/Écarté, drag&drop persistant) et l'opportunité portait déjà
  `next_action`/`due_date`/`note`/`priority`. Manque réel : **aucune édition de carte après
  création** → impossible de journaliser la prospection. Le PATCH `/opportunities/[id]`
  acceptait déjà tous les champs → P1.4 = pur frontend, sans schéma.
- Travail (`KanbanBoard.tsx`) : bouton crayon sur chaque carte (avec `pointer-events-auto`
  + `stopPropagation` pour cohabiter avec le drag) → ouvre un **panneau d'édition** : étape,
  priorité, prochaine action, échéance, et **journal de prospection** (`note`, textarea :
  contact vendeur, comptes rendus d'appels, objections, RDV). Sauvegarde via PATCH + reload.
  `note` ajouté au type/mapRow.
- Choix : le **contact vendeur** est saisi dans le journal (`note`) pour l'instant. Un champ
  contact structuré dépend de ce que fournit Stream Estate (souvent annonces d'agence) →
  différé tant qu'on ne connaît pas la disponibilité réelle de la donnée.
- Fichiers : `src/app/admin/market/opportunities/KanbanBoard.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/opportunities` 200 ; PATCH testé (stage +
  next_action + note persistés) puis **opportunité restaurée à son état d'origine**.
- Suite : la boucle mandat MVP est fonctionnelle de bout en bout (sync → score → surfaçage →
  alerte → suivi prospection). Restent P1.5 (réactiver l'auth admin) et options : surfacer
  les notifications mandate dans l'UI, envoi email (golden-alert-template), contact structuré.

### 22/06/2026 - P1.b : score persisté + alerte au passage hot/golden
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — alertes de franchissement de seuil (détection → action).
- Statut : **fait** (testé end-to-end sur la base live, données restaurées ; tsc OK).
- Décision (Alexandre) : persister le score via **colonnes sur `market_properties`** (pas de table dédiée).
- Travail :
  1. **Migration 012** (`012_market_properties_mandate_score.sql`, appliquée) : colonnes
     `mandate_score` / `mandate_phase` / `scored_at` + index score/phase. Types `supabase.ts` à jour.
  2. **Nouveau** `src/lib/market/mandate-score-persist.ts` : `rescoreAndPersist(id)` recalcule le
     score, écrit les colonnes, et insère une **notification** quand le bien passe (à la hausse)
     en hot/golden (`mandate_hot`/`mandate_golden`, priorité medium/high, `market_property_id`,
     `action_label`). Anti-doublon par comparaison stricte `rank(new) > rank(prev)` (golden→golden n'alerte pas).
  3. **Sync** (`sync/route.ts`) : `rescoreAndPersist` appelé après upsert (branches update + create).
  4. **Nouveau** `POST /api/market/properties/[id]/rescore` : re-score à la demande (backfill des
     biens existants sans attendre la sync ; sert aussi de point de test).
- Fichiers : `supabase/migrations/012_market_properties_mandate_score.sql`, `src/types/supabase.ts`,
  `src/lib/market/mandate-score-persist.ts`, `src/app/api/market/sync/route.ts`,
  `src/app/api/market/properties/[id]/rescore/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK. Test end-to-end (bien Pontevès `f773d231…`) :
  baseline rescore → cold 5, pas d'alerte ; scénario crafté (first_seen −200 j + 3 baisses) →
  **golden 100 + notification `mandate_golden` priorité high créée** ; 2e rescore → pas de doublon ;
  **toutes les données de test supprimées/restaurées** (dates, historique, colonnes, notification).
- Point d'attention : les biens existants ont `mandate_*` à `null` tant qu'ils n'ont pas été
  re-scorés (prochaine sync ou endpoint rescore). Les routes de lecture (table, widget) calculent
  toujours le score à la volée → affichage non impacté ; les colonnes servent à la comparaison
  inter-sync et au futur tri/filtre serveur.
- Suite : P1 item 4 — workflow prospection → mandat (capter le contact vendeur + statut, relié à
  l'opportunité) ; éventuellement surfacer les notifications mandate dans l'UI + email (golden-alert-template).

### 22/06/2026 - P1.a : widget « Vendeurs à contacter » sur le dashboard
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — transformer la détection en action (surfaçage).
- Statut : **fait** (tsc OK ; dashboard 200 ; widget monté).
- Contexte : le dashboard `/app/dashboard` (= `admin/market/page.tsx`) était encore le
  template shadcn (SectionCards/Chart/DataTable sur `data.json` statique). On y ajoute un
  premier bloc branché au réel : les vendeurs en fenêtre d'or à prospecter en priorité.
- Travail :
  1. **Nouveau** `src/app/admin/market/VendeursAContacter.tsx` (client) : fetch
     `/api/market/properties?limit=100`, filtre les phases `golden`+`hot`, tri par score
     décroissant, top 8. Chaque ligne : titre, ville (CP), motif (`X j en ligne · N baisses
     (-Y%)`), prix, score + `SellerPhaseBadge`, lien vers la fiche bien. État vide explicite
     (« les signaux émergent avec la sync récurrente »). Bouton refresh + « Voir le marché ».
  2. `admin/market/page.tsx` : widget inséré en tête de `PageSection`.
- Distinction importante : ce « à contacter » (vendeurs détectés par le score sur
  `market_properties`) est **différent** de `liste-chaude` / `warm-contacts` (CRM de contacts
  saisis manuellement, migration 006).
- Fichiers : `src/app/admin/market/VendeursAContacter.tsx` (nouveau), `src/app/admin/market/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/dashboard` 200 ; widget présent dans le HTML rendu ; aucun log d'erreur.
- Point d'attention : actuellement tous les biens sont `cold` → le widget affiche l'état
  vide (normal). Il se remplira quand la sync récurrente fera monter les scores. Filtrage/tri
  côté client sur la page chargée (≤100 biens/zone), cohérent avec PropertiesTable.
- Suite : P1.b — alertes au franchissement de seuil (nécessite de **persister le score/phase**
  pour comparer entre deux syncs) ; puis P1 item 4 (workflow prospection → mandat).

### 22/06/2026 - P0.2 : baisses de prix + republication branchées au score
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — réveiller les axes Frustration/Intensité/Comportement du score.
- Statut : **fait** (testé end-to-end ; tsc OK).
- Constat préalable : la **baisse de prix → score était déjà câblée** : la sync insère une
  ligne `property_price_history` à chaque changement de prix, et `mandate-score.ts` compte
  les baisses (Frustration 30) + la baisse totale % (Intensité 15). Ces axes s'activent donc
  d'eux-mêmes dès que la sync récurrente (P0.1) tourne dans le temps. Le seul manque réel
  était l'**axe Comportement (republication, 15 pts)**, hardcodé `isRelisted=false`.
- Contrainte : l'API Stream Estate **filtre les annonces hors-ligne** (`isOnlineListingStatus`)
  → impossible de détecter un retrait par absence (d'autant que le budget plafonne le fetch).
  Signal fiable retenu : **`published_at` qui avance**. Une annonce retirée puis remise en
  ligne reçoit une nouvelle date de publication ; si elle devient postérieure à `first_seen_at`
  (figé) de >1 j, c'est une republication. **Sans migration.**
- Travail :
  1. `mandate-score.ts` : `ScorableProperty` reçoit `published_at` ; `computeIsRelisted()`
     (gap `published_at − first_seen_at ≥ 1 j) ; `isRelistedWithNewPrice = isRelisted &&
     totalDropPercent > 0` ; branchés dans `calculateScore()`.
  2. `sync/route.ts` : la branche update lit `published_at` existant et met à jour
     `published_at = listing.publishedAt ?? existing` (first_seen_at reste figé) → l'avancée
     révèle la republication aux syncs suivantes.
- Fichiers : `src/lib/market/mandate-score.ts`, `src/app/api/market/sync/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK. Test end-to-end sur la base live (bien Pontevès
  `f773d231…`) : published_at = first_seen → `is_relisted=false`, behavior 0, score 5 (non-régression) ;
  published_at décalé +10 j (via SQL) → `is_relisted=true`, behavior 10, score 15 ; puis
  **published_at restauré à sa valeur d'origine**. `with_new_price=false` ici (pas de baisse), cohérent.
- Point d'attention : la détection de republication suppose que Stream Estate **renvoie une
  nouvelle `published_at` lors d'une remise en ligne** (et non lors d'un simple changement de
  prix — le mapping utilise published_at/date_publication/created_at, pas updatedAt). À
  confirmer sur données réelles une fois la sync récurrente active. Si l'annonce republiée
  reçoit un nouvel `external_id`, elle serait vue comme un nouveau bien (relist non détecté) — limite connue.
- Suite : P1 — surfaçage « à contacter » (vendeurs hot/golden) + alertes au franchissement de seuil.

### 22/06/2026 - P0.1 : job cron de sync récurrente par zone (codé, gardé OFF)
- Base/branche : `preview` (local non commité au moment de l'écriture).
- Type : feature — oxygène du score (sync récurrente alimentant `market_properties`).
- Statut : **fait** (codé + testé ; cron inerte par défaut).
- Décision (Alexandre) : coder le job, garder le cron OFF, activable plus tard ; cadence 1×/jour la nuit.
- Travail :
  1. **Nouveau** `src/app/api/jobs/sync-zones/route.ts` : itère `monitored_zones` actives
     (triées par `last_synced_at` la plus ancienne, plafond `MAX_ZONES_PER_RUN=20`) et
     appelle `/api/market/sync` par zone → réutilise TOUS les garde-fous existants
     (budget, fenêtre anti-re-sync). Alimente `market_properties` (≠ `import-stream-estate`
     qui visait la table `listings` du monde radar mort).
  2. `vercel.json` : schedule `{ "path": "/api/jobs/sync-zones", "schedule": "0 3 * * *" }`
     ajouté mais **inerte**.
- Deux filets de sécurité « zéro crédit par surprise » :
  1. `STREAM_ESTATE_CRON_ENABLED` doit valoir `'true'` (défaut OFF) pour exécuter — sinon
     no-op `{skipped:true, reason:'cron_disabled'}`. C'est l'interrupteur volontaire (à
     poser dans les env Vercel quand Alexandre valide). Choisi car
     `isMandatFinderPipelineEnabled()` a un défaut `true` (settings.ts) → pas fiable comme OFF.
  2. Chaque `/api/market/sync` respecte le budget Stream Estate (item limit, solde, syncEnabled).
  - Auth cron optionnelle via `CRON_SECRET` (en-tête `Authorization: Bearer`).
- Fichiers : `src/app/api/jobs/sync-zones/route.ts` (nouveau), `vercel.json`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK. Test live :
  - sans param → `{skipped:true, reason:'cron_disabled'}` (sécurité OK) ;
  - `?test=1` → 1 zone active (83670/Pontevès) synchronisée, **5 biens MAJ, 5 items facturés (~0,05 €)**, stop sur `stream_estate_item_limit_reached`. Orchestration + plafond budget validés.
- ⚠️ Point d'attention : `?test=1` n'est **pas un dry-run** — il déclenche une vraie sync
  et dépense le budget disponible (ici borné à 5 items par le garde-fou). Pour tester sans
  dépense, mettre la sync budget à 0/désactivée avant.
- Tradeoff assumé : orchestration via self-HTTP `fetch` vers `/api/market/sync` (réutilise
  les garde-fous sans refactor du handler de 370 lignes). À remplacer par une fonction
  partagée `syncZone()` si le nombre de zones ou la durée pose problème (maxDuration 60s).
- Suite : quand Alexandre veut activer en prod → poser `STREAM_ESTATE_CRON_ENABLED=true`
  (+ `CRON_SECRET`) dans Vercel et vérifier le budget Stream Estate. Puis P0.2 (détection
  baisse/republication → axe Comportement).

### 22/06/2026 - Recentrage MVP sur la boucle mandat (priorisation)
- Base/branche : `preview`.
- Type : décision / cadrage produit.
- Statut : **fait** (priorisation tracée ; aucune implémentation).
- Décision (Alexandre) : recentrer le MVP sur l'essentiel = **trouver des vendeurs et
  récupérer des mandats** ; le reste se fera ensuite.
- Constat déterminant : le `mandate_score` est branché mais ne discrimine pas encore.
  L'axe Temps monte passivement, mais les baisses de prix (45 pts, signal le plus fort)
  et les republications (15 pts) ne se détectent **qu'avec une sync récurrente**. Sans
  elle, tout reste `cold` → aucun vendeur chaud → pas de mandat. Donc la priorité n°1
  n'est pas de l'UI mais la **réactivation de la sync récurrente contrôlée** (garde-fous
  budget 009/010/011 déjà en place ; `vercel.json` → `"crons": []` actuellement).
- Plan priorisé (détail dans « Prochaines Etapes ») : P0 = sync récurrente + détection
  baisse/republication branchée au score ; P1 = surfaçage « à contacter » + workflow
  prospection→mandat ; P1.5 = réactiver l'auth admin ; le reste = backlog.
- Cadence validée (Alexandre) : **1×/jour la nuit** (cron ~`0 3 * * *`).
- ⚠️ Constat à l'analyse de P0.1 : le cron existant `import-stream-estate` alimente la
  table `listings` (monde radar mort), pas `market_properties`. Réactiver en l'état =
  crédits brûlés sans effet sur le score. P0.1 doit donc créer/repointer un job qui itère
  `monitored_zones` et lance le flux `/api/market/sync` par zone (détail dans « Prochaines Etapes »).
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualité : non applicable (cadrage).
- Suite : implémenter P0.1 = job cron market-sync par zone (à coder, pas un simple flag), puis brancher `vercel.json`.

### 22/06/2026 - Tri/filtre par score mandat + breakdown des sous-scores
- Base/branche : `preview` (local non commité).
- Type : feature — triage du marché par score mandat.
- Statut : **fait** (tsc OK ; `/app/properties` 200).
- Contexte / décision (Alexandre) : le score mandat final doit être un **indicateur de triage important mais non déterminant** — les 4 sous-scores (Temps/Frustration/Intensité/Comportement) doivent rester étudiables au cas par cas. Donc surfacer le détail, pas seulement l'agrégat.
- Travail (tout dans `PropertiesTable.tsx`, côté client car le score n'est pas une colonne SQL et la table charge ≤100 biens filtrés par zone) :
  1. **Tri « Score mandat »** ajouté au Select de tri ; tri appliqué en mémoire sur le score (les tris prix/surface/dernière vue restent serveur).
  2. **Filtre « Phase vendeur »** (Toutes / Fenêtre d'or / Chaud / Tiède / Froid) → filtre `mandate_score.phase`.
  3. **Tooltip de breakdown** sur la cellule score : Temps (j · /40), Baisses (n · /30), Intensité (% · /15), Comportement (/15), avec mention « à étudier au cas par cas ». Le détail complet reste aussi dans la carte de la fiche bien.
- Fichiers : `src/app/admin/market/properties/PropertiesTable.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; `/app/properties` répond 200.
- Point d'attention : tri/filtre opèrent sur la page chargée (≤100 biens par zone) ; si un jour une zone dépasse ce volume, prévoir un tri/filtre score côté serveur (full-scan + scoring) avec pagination.
- Suite : commit sur `preview` après validation ; pré-remplir le `signal_type`/priorité d'opportunité selon la phase à la création.

### 21/06/2026 - CŒUR : MandateProbabilityScore branché sur les biens réels
- Base/branche : `preview` (local non commité).
- Type : feature — cœur métier / avantage concurrentiel.
- Statut : **fait** (testé live sur les 5 biens Pontevès ; tsc OK).
- Contexte / diagnostic : le moteur de score différenciateur (`MandateProbabilityScore`, 0-100, 4 axes Temps/Frustration/Intensité/Comportement → phases cold/warm/hot/golden) existait déjà dans `src/lib/mandat/scoring-service.ts` MAIS tournait à vide : il était câblé au monde `dashboard/radar` qui lit les tables `listings`/`listing_events`/`seller_scores` **absentes en base live**. Pendant ce temps, les vrais biens synchronisés (`market_properties`) ne recevaient qu'une heuristique en prose ad-hoc (`buildBusinessSignal`). Bug latent découvert au passage : `market_properties` n'a **pas** de colonne `days_online` → l'heuristique lisait `property.days_online` toujours `undefined` (axe temps jamais déclenché).
- Décision (Alexandre) : **porter le score sur `market_properties`** (source de vérité unique = les données synchronisées), pas de nouvelles tables.
- Travail :
  1. **Adaptateur** `src/lib/market/mandate-score.ts` (nouveau) : `scoreMarketProperty(property, priceHistory)` dérive `days_online` depuis `first_seen_at` (jusqu'à maintenant si actif, sinon `last_seen_at`), compte les baisses et calcule la baisse totale % depuis le prix d'origine via `property_price_history`, puis appelle `calculateScore()`. Axe comportement (republication) non encore tracé par la sync → `isRelisted=false` (15 pts non exploités, TODO documenté).
  2. **Route détail** `GET /api/market/properties/[id]` : ajoute `mandate_score` dans la réponse ; `buildBusinessSignal` reçoit désormais le `days_online` calculé (corrige le bug latent de l'axe temps).
  3. **Route liste** `GET /api/market/properties` : un seul appel groupé `property_price_history` (`.in('market_property_id', ids)`) pour la page courante, puis scoring en mémoire → chaque bien porte `mandate_score`.
  4. **UI** : colonne « Score mandat » (score + badge phase) dans `PropertiesTable.tsx` ; carte « Score mandat » dans `PropertyDetail.tsx` (jauge 0-100 colorée par phase + détail des 4 axes). Réutilise `SellerPhaseBadge` du monde radar.
- Fichiers : `src/lib/market/mandate-score.ts` (nouveau), `src/app/api/market/properties/[id]/route.ts`, `src/app/api/market/properties/route.ts`, `src/app/admin/market/properties/PropertiesTable.tsx`, `src/app/admin/market/properties/[id]/PropertyDetail.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK ; test live `/api/market/properties?limit=5` → 5 biens Pontevès scorés (tous `cold` score 5 : ≤30 j, 0 baisse — cohérent avec des annonces récentes) ; détail `f773d231…` → `mandate_score` complet avec breakdown ; pages `/app/properties` et `/app/properties/[id]` répondent 200, aucune erreur runtime liée (seules erreurs log = `/api/matching` préexistant, tables absentes).
- Point d'attention : (a) tant que les biens sont récents et sans baisse, tout reste `cold` — la différenciation hot/golden apparaîtra avec l'ancienneté + les baisses détectées par la sync ; (b) axe comportement (republication) à activer côté sync ; (c) le monde `dashboard/radar` (tables `listings`) reste en doublon, non utilisé par le pipeline réel — à retirer/réconcilier plus tard.
- Suite : commit sur `preview` après validation Alexandre ; envisager un seuil de phase qui pré-remplit le `signal_type` à la création d'opportunité, et un tri/filtre par score dans la table.

### 21/06/2026 - reprise de session + consolidation tracée
- Base/branche : `preview`, alignée sur `origin/preview` (working tree propre).
- Type : suivi projet / reprise de session.
- Statut : **fait**.
- Résumé : reprise de session. Serveur Next relancé via `npm run dev -- --port 3002` (Next 15.5.15 Turbopack, prêt en ~1,7 s) ; routes vérifiées `/app/dashboard`, `/app/zones`, `/` → toutes `200`. Traçage explicite du commit de consolidation **`d9eceff`** (2026-06-20 00:57) « feat(mandat-os): zones commune-exacte + pont biens→opportunités + fiche bien réelle » : il regroupe les 3 chantiers décrits dans les entrées 19/06 11:05 (zones INSEE), 20/06 00:36 (pont biens→opportunités) et 20/06 01:05 (fiche bien réelle), qui étaient « local non commité ». Ce travail est désormais **commité ET poussé** sur `origin/preview`. La « Suite : commit unique sur preview » de ces entrées est donc réalisée.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualité : `curl` HTTP local OK (3 routes `200`) ; `git status` propre, `preview` == `origin/preview`.
- Point d'attention : les sections « Avancement par Lot » et « Métriques » plus bas restent historiques (ère Linear) et ne reflètent pas l'état réel — voir note ligne 18.
- Suite : **pivot vers le cœur de l'application** (avantage concurrentiel) — moteur de détection/qualification d'opportunités de mandat. Cadre à définir avec Alexandre avant implémentation.

### 20/06/2026 - 01:05 CEST
- Base/branche : `preview`.
- Type : feature — fiche bien `/app/properties/[id]` réelle (fin du mock).
- Statut : **fait** (local non commité ; testé sur un vrai bien Pontevès).
- Résumé : la fiche détail tournait entièrement sur `MOCK_PROPERTY`. L'API `/api/market/properties/[id]` était déjà complète (bien + historique prix + tags + notes + opportunité liée + notifications + **signal métier calculé**). Travail :
  1. `PropertyDetail.tsx` réécrit : `fetch('/api/market/properties/[id]')`, états chargement/404, mapping des vrais champs `market_properties`. KPI prix (avec prix d'origine déduit de l'historique), surface/terrain, prix/m², jours en ligne (calculé depuis `first_seen_at`). Caractéristiques : chambres/pièces/surface/DPE + tags réels. Historique des prix réel (variations `property_price_history`). Acquéreurs potentiels (matching, déjà réel) conservés.
  2. Bloc **« Lecture du signal »** branché sur le `signal` calculé par l'API (résumé, points intéressants, préoccupations, action recommandée) — remplace l'alerte « -9,1 % » en dur.
  3. **Opportunité liée** affichée si présente (lien vers `/app/opportunities`) ; sinon bouton **« Créer une opportunité »** câblé (POST `market_property_id`, signal_type selon l'état) + toast « Voir le pipeline ».
  4. **Notes fonctionnelles** : nouvel endpoint `POST /api/market/properties/[id]/notes` + composer (Entrée pour valider) ; liste des notes réelle.
  5. Boutons morts retirés (Favori, Gérer les tags — sans backend).
- Fichiers : `src/app/admin/market/properties/[id]/PropertyDetail.tsx` (réécrit), `src/app/api/market/properties/[id]/notes/route.ts` (nouveau).
- Audit qualité : `npx tsc --noEmit` OK ; test live sur bien Pontevès `f773d231…` : détail 200, données réelles (4 tags, opportunité liée, signal), POST note 0→1 ; note de test supprimée ensuite.
- Point d'attention : pas de DELETE note exposé (suppression de test faite via SQL) ; le bien testé avait `dpe` vide et 0 variation de prix → blocs « DPE n/d » et « Aucune variation » gérés.
- Suite : commit unique sur `preview` après validation (zones commune-exacte + pont opportunités + fiche bien réelle) ; éventuellement exposer un DELETE note et « Gérer les tags ».

### 20/06/2026 - 00:36 CEST
- Base/branche : `preview`.
- Type : feature — pont biens → opportunités (pipeline de mandats réel).
- Statut : **fait** (local non commité ; testé end-to-end sur la base live).
- Résumé : cœur métier MandatFinder. L'API `opportunities` (GET/POST/PATCH/DELETE) et la table existaient déjà, mais le Kanban était mocké et le drag&drop ne persistait pas. Travail :
  1. `GET /api/market/opportunities` enrichi : 2e requête groupée `market_properties` (`.in('id', ids)`, sans relation PostgREST) → chaque opportunité reçoit `property: {title, city, zipcode, price}|null`.
  2. `KanbanBoard.tsx` réécrit : suppression de `MOCK_OPPORTUNITIES`, chargement réel via l'API, mapping ligne→carte (`signal_type`→type avec fallback `manual`, encart bien masqué si absent). **Convention `stage` = label FR** (valeur déjà stockée par le POST/les règles) ; un stage inconnu retombe sur « À qualifier ». Colonnes Converti/Écarté rendues droppables (pipeline complet, fin des cartes « légende » statiques).
  3. Drag&drop **persistant** : update optimiste local + `PATCH /[id] {stage}`, revert + toast si échec.
  4. Dialog « Nouvelle opportunité » (création manuelle) branché sur le bouton header + les « + » de colonne (stage pré-rempli) ; pattern `Dialog`/`Select` réutilisé.
  5. `PropertiesTable.tsx` : item dropdown « Créer une opportunité » sur un vrai bien → POST avec `market_property_id`, `signal_type` selon l'état (price_drop/new_listing), toast avec action « Voir le pipeline ».
- Fichiers : `src/app/api/market/opportunities/route.ts`, `src/app/admin/market/opportunities/KanbanBoard.tsx`, `src/app/admin/market/properties/PropertiesTable.tsx`.
- Audit qualité : `npx tsc --noEmit` OK ; end-to-end live OK (POST→GET enrichi→PATCH stage persisté→DELETE) ; `/app/opportunities` répond 200.
- Nettoyage data (validé par Alexandre « purger orphelines + mock ») : `DELETE FROM opportunities WHERE market_property_id IS NULL` après nullification des FK `notifications.opportunity_id` / `property_notes.opportunity_id` (transaction Supabase MCP). **65 opportunités orphelines supprimées** (dont les 8 restes de mock à stage slug, toutes sans bien). Reste **5 opportunités**, toutes rattachées à un vrai bien Pontevès 83670, en stage « À analyser ».
- Point d'attention : avant nettoyage la base contenait 70 opportunités (Alexandre avait resynchronisé : biens Pontevès 83670 réapparus + règles ayant créé ~60 opportunités). Désormais le Kanban est propre (5 cartes enrichies).
- Suite : rendre la fiche `/app/properties/[id]` réelle (encore mockée) ; commit unique sur `preview` après validation.

### 19/06/2026 - 11:05 CEST
- Base/branche : `preview`.
- Type : feature — zones « commune exacte » (INSEE) de bout en bout + fix purge biens + nettoyage base.
- Statut : **fait** (local non commité ; base live nettoyée).
- Resume : objectif = filtrage commune-par-commune via code INSEE plutôt que par CP (qui ramène toutes les communes voisines). Diagnostic : l'infra INSEE était déjà câblée (colonne `insee_code` migration 008, POST zones, lib `includedInseeCodes[]`, sync + preview relisant l'INSEE), MAIS le pipeline identifiait une zone **par `zipcode` avec `.maybeSingle()`** → cassait dès que 2 communes partagent un CP, et le panneau « Sync contrôlée » **perdait l'INSEE** avant l'envoi. Corrections :
  1. `sync/route.ts` : `getOrCreateZone` cible par INSEE quand fourni (sinon CP-mode `insee_code IS NULL`), via `.order().limit(1)` au lieu de `.maybeSingle()` ; stocke `insee_code`/`name`/`city` à la création ; le POST lit `insee_code`/`name`/`city` du body. Garde-fou anti-re-sync : comptage filtré par INSEE quand dispo.
  2. `sync-preview/route.ts` : accepte `insee_code` du body (priorité), fallback zone CP sans `.maybeSingle()`.
  3. `zones/page.tsx` : `syncDraft` porte `insee`/`communeName` ; `CommuneSearch` du panneau capture l'INSEE ; CP saisi à la main réinitialise l'INSEE ; `previewSync`/`confirmSync`/`prefillSyncFromZone` transmettent l'INSEE ; badge « Commune exacte · INSEE … » vs « CP seul · communes voisines incluses » dans le récap.
  4. `sync-stats/route.ts` : compte les biens par INSEE quand la zone en a un (sinon par CP).
  5. `src/lib/market/property-cleanup.ts` : **fix** — la chaîne de purge avortait sur `match_results` (table absente en base live) → toute suppression de bien échouait. Ajout `isMissingTableError()` qui ignore les tables absentes (PGRST205/42P01/« Could not find the table »).
- Action base live (choix Alexandre « repartir propre ») : suppression des 2 zones CP (`83670` 30 biens, `13390` 5 biens) + purge des 35 biens orphelins. Base désormais : **0 zone, 0 bien, 0 orphelin**.
- Fichiers : `src/app/api/market/sync/route.ts`, `src/app/api/market/sync-preview/route.ts`, `src/app/api/market/sync-stats/route.ts`, `src/app/admin/market/zones/page.tsx`, `src/lib/market/property-cleanup.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualité : `npx tsc --noEmit` OK (×2) ; HTTP local OK (`sync-stats`=200, `sync-preview` renvoie un total filtré par INSEE) ; suppression zones + purge orphelins confirmées via API.
- Point d'attention : les `total_available` du preview sont gonflés (Tavernes 83135=773, Barjols 83012=1750, CP 83670 seul=3772, Paris 75056=10000 plafonné). Les comptages **varient par INSEE** → le filtre serveur agit bien, mais le total `itemsPerPage=0` semble ignorer une partie du filtrage. Sans impact sur le coût (plafonné par `max_items` ; filtre client `matchesGeoTarget` garantit qu'on ne garde que la commune), mais **on paie les items d'une page même si certains sont hors commune** : à valider par une sync sonde (~0,01 €) quand Alexandre autorise une dépense.
- Suite : Alexandre reconstruit les zones commune par commune via « Ajouter une commune » ; remettre un solde manuel dans Réglages pour réautoriser une sync ; commit unique sur `preview` après validation.

### 19/06/2026 - 10:15 CEST
- Base/branche : `preview`.
- Type : reprise de session / démarrage serveur local.
- Statut : **fait**.
- Résumé : application du protocole `docs/START.md`. Fetch `origin/preview`, vérification Git (preview alignée sur origin/preview), serveur Next lancé sur port 3002 avec `npm run dev -- --port 3002`. Serveur compilé en 1330ms, middleware compilé en 185ms.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualité : `curl -I http://localhost:3002/app/dashboard` → `200 OK` ; serveur live et réactif.
- Point d'attention : aucun.
- Suite : selon Alexandre, tâche suivante.

### 19/06/2026 - 00:12 CEST
- Base/branche : `preview`.
- Type : commit local (UX bouton sync + maj suivi projet).
- Statut : **fait** (commit local, non pousse).
- Resume : commit de l'edit UX restant (message explicite de la raison de blocage sous "Confirmer la sync" + infobulle, dans `zones/page.tsx`) et des entrees de journal `23:19`/`00:07`/`00:12`. Le working tree est de nouveau propre apres ce commit. Rappel : les correctifs base (migration 010 appliquee, run debloque) sont cote Supabase, pas dans git.
- Fichiers : `src/app/admin/market/zones/page.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npx tsc --noEmit` OK (deja verifie sur l'edit UX) ; pas de push (en attente de validation explicite d'Alexandre).
- Point d'attention : aucun push effectue ; `preview` local en avance sur `origin/preview` de 2 commits (`06ce78a` puis celui-ci).
- Suite : selon Alexandre, creer les zones commune-par-commune et/ou pousser `preview`.

### 19/06/2026 - 00:07 CEST
- Base/branche : `preview`.
- Type : correction base live (migration manquante) + diagnostic affichage zones + UX bouton sync + cadrage filtrage commune.
- Statut : **fait** (correctifs base appliques ; edit UX local non commite).
- Resume : diagnostic du symptome "plus rien ne s'affiche dans Zones / sync coincee". Cause racine trouvee : la **migration 010 n'avait jamais ete appliquee en base live** (colonnes `external_item_count` sur `sync_runs` et `item_count` sur `stream_estate_usage_events` absentes). A la fin d'une sync, l'update de `sync_runs` echouait silencieusement -> run bloque en statut `running`. Correctif : **migration 010 appliquee** sur Supabase (`byrsmbgfkvgxdtdyhrro`) + run bloque repare (`running` -> `success`). Verifie que les donnees etaient intactes : 1 zone (CP 83670) + 30 biens, APIs `zones`/`sync-stats`/`properties` repondent 200 avec les 30 biens. Cote UX : bouton "Confirmer la sync" reste grise tant que budget/preview ne le permettent pas -> ajout d'un message explicite de la raison (texte + infobulle) pour ne plus laisser un bouton muet (le blocage actuel vient d'un solde manuel a 0 EUR). Cadrage filtrage commune : le CP 83670 couvre 6 communes (Tavernes 83135, Varages 83145, Barjols 83012, Fox-Amphoux 83060, Montmeyan 83084, Chateauvert 83039) ; Pontevès = INSEE 83095, 0 bien actuellement. Pour filtrer une commune exclusivement -> creer la zone via "Ajouter une commune" (porte l'INSEE -> sync `includedInseeCodes[]`), la "Zone 83670" actuelle est en mode CP (sans INSEE) et ramene toutes les communes ; cote affichage, le menu "Ville" de la page Biens filtre deja par commune.
- Fichiers : `src/app/admin/market/zones/page.tsx` (message raison bouton, local non commite). Base : migration `010_stream_estate_items_budget.sql` appliquee, ligne `sync_runs` debloquee.
- Audit qualite : `npx tsc --noEmit` OK ; verifs HTTP sur `http://localhost:3000` : `/api/market/zones`=1 zone, `/api/market/sync-stats`=zone 83670 / 30 biens, `/api/market/properties?zipcode=83670`=total 30 ; schema `sync_runs`/`stream_estate_usage_events` confirme complet apres 010.
- Point d'attention : **correction de l'entree 23:19** -> la migration 010 n'etait PAS appliquee (009 oui). Etat live desormais : 006, 008, 009, 010, 011 appliquees. Le tracker Supabase reste partiel (009/010 ajoutees hors tracker au depart) : prudence avant tout `supabase db push`. L'edit UX du bouton est en working tree non commite (le reste du chantier est dans `06ce78a`).
- Suite : selon choix d'Alexandre, creer une/des zone(s) commune-par-commune (ex. Pontevès 83095) et decider du sort de la "Zone 83670" CP ; remettre un petit solde manuel pour reautoriser une sync ; commiter l'edit UX du bouton.

### 18/06/2026 - 23:19 CEST
- Base/branche : `preview`.
- Type : optimisation crédits Stream Estate (backend) + cohérence UX zones surveillées + migration Supabase.
- Statut : **fait** (local, non commité).
- Resume : confirmation du contrat API Stream Estate via doc officielle `docs.stream.estate` (filtre commune `includedZipcodes[]` / `includedInseeCodes[]`, `transactionType=0`=vente, `propertyTypes[]` numériques Appartement 0 / Maison 1, `itemsPerPage` max 30, `itemsPerPage=0`=comptage gratuit, `hydra:totalItems`). Facturation confirmée par Alexandre : **0,01 €/bien** (30 biens = 0,30 €). Côté code : suppression de la route de diagnostic `test-stream-estate` (tapait l'API à chaque chargement) ; `fetchListings`/`previewListings` filtrent par INSEE quand dispo et par `propertyTypes=[0,1]` (résidentiel) ; preview désormais **gratuit** (`itemsPerPage=0`) ; suppression de l'appel preview facturé séparé dans `/api/market/sync` (total lu sur la page 1) ; **garde-fou anti-re-sync** configurable (`stream_estate_resync_window_minutes`, défaut 360 min) qui renvoie la base sans appel si la zone est fraîche, avec bypass `force:true`. UX zones rendue cohérente : toast distinct « déjà à jour » + action « Forcer la resync », toast « sync partielle », badge fraîcheur aligné sur la fenêtre, badge précision INSEE (« Commune exacte » vs « CP seul · communes voisines incluses »), mention « Estimation · gratuit ». Champ « Fenêtre resync (min) » éditable dans Réglages.
- Fichiers : `src/lib/stream-estate.ts`, `src/lib/mandat/import-service.ts`, `src/app/api/market/sync/route.ts`, `src/app/api/market/sync-preview/route.ts`, `src/app/api/market/sync-stats/route.ts`, `src/app/admin/market/zones/page.tsx`, `src/app/admin/market/settings/page.tsx`, `supabase/migrations/011_stream_estate_resync_window.sql` (suppr. `src/app/api/market/test-stream-estate/route.ts`).
- Audit qualite : `npx tsc --noEmit` OK ; `npm run build` OK ; migration `011` **appliquée sur Supabase** (`byrsmbgfkvgxdtdyhrro`) → clé `stream_estate_resync_window_minutes=360` présente ; serveur dev relancé proprement (un graphe turbopack corrompu par la suppression/ajout de routes à chaud provoquait un 500 sur `/api/market/sync-stats`, résolu au redémarrage).
- Point d'attention : tracker de migrations Supabase ne liste que `006`/`008` alors que les clés de `009` sont en base → `009`/`010` ont été appliquées hors tracker ; prudence si futur `supabase db push`. Tout le travail reste **local non commité** sur `preview`.
- Suite : sur validation d'Alexandre, commit unique (optimisation backend + UX + migration) sur `preview` ; vérification visuelle des badges après `npm run dev` + hard refresh.

### 18/06/2026 - 21:55 CEST
- Base/branche : `preview`.
- Type : sync contrôlée Stream Estate + mise à jour documentaire.
- Statut : **fait**.
- Resume : ajout d'un flux de prévisualisation `/api/market/sync-preview` et d'une sync contrôlée par CP + plafond `max_items` sur `/app/zones`. L'import Stream Estate filtre maintenant les annonces clairement hors ligne (`expired`, `removed`, `inactive`, etc.) pour éviter de surcharger l'estimation et la sync. Mise à jour des docs de reprise et d'architecture pour refléter le flux budgeté sur les items.
- Fichiers : `src/lib/stream-estate.ts`, `src/lib/stream-estate-budget.ts`, `src/app/api/market/sync/route.ts`, `src/app/api/market/sync-preview/route.ts`, `src/app/api/market/sync-stats/route.ts`, `src/app/admin/market/zones/page.tsx`, `src/app/admin/market/settings/page.tsx`, `src/app/admin/market/properties/PropertiesTable.tsx`, `docs/START.md`, `docs/MEMOIRE_SESSION.md`, `docs/MANDATFINDER_ARCHITECTURE.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run build` OK ; serveur Next relance sur `http://localhost:3002` ; verification visuelle du panneau `/app/zones` et de la previsualisation.
- Point d'attention : la base live doit encore recevoir la migration `010_stream_estate_items_budget.sql` pour tracer officiellement `item_count` / `external_item_count`.
- Suite : appliquer la migration Supabase puis, si besoin, poursuivre le nettoyage des libellés historiques restants "appel/requete" dans les écrans secondaires.

### 18/06/2026 - 20:59 CEST
- Base/branche : `preview`.
- Type : correction de lecture budget Stream Estate.
- Statut : **fait**.
- Resume : prise en compte de la console Stream Estate fournie par Alexandre. La consommation reellement visible cote fournisseur n'etait pas de 0,02 EUR mais d'environ 0,92 EUR depuis 5 EUR de depart, avec 92 items utilises et 4,08 EUR restants. Conclusion: notre suivi local par requetes sous-estimait la consommation reelle. Le tableau de bord fournisseur doit rester la source de verite pour la depense effective.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : lecture de la capture d'ecran fournie par Alexandre ; pas de changement de code applique dans cette entree.
- Point d'attention : le modele local actuel mesure encore des appels/requetes et non directement les items factures par le fournisseur. Il faut eviter de confondre estimation interne et consommation facturée.
- Suite : si on reviens sur le budget Stream Estate, recalibrer le modele de cout sur l'unite facturee par le fournisseur avant d'autoriser de nouvelles syncs.

### 18/06/2026 - 20:56 CEST
- Base/branche : `preview`.
- Type : ajustement flux Stream Estate / reprise propre apres test.
- Statut : **fait**.
- Resume : correction du comportement de `fetchListings` pour permettre un import partiel explicite quand le plafond de requetes coupe la pagination. La route `/api/market/sync` marque maintenant le run comme `blocked` avec `stream_estate_request_limit_reached` tout en conservant les biens deja importes. Reexecution du pilote `83670` avec budget minimal rearme temporairement a `0.02 EUR` pour un seul appel supplementaire : `30` biens crees, `1` requete externe, run `blocked` mais utile, puis remise de `stream_estate_sync_enabled=false` et du solde manuel a `0`.
- Fichiers : `src/lib/stream-estate.ts`, `src/app/api/market/sync/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run build` OK ; redemarrage propre du serveur Next sur `http://localhost:3002` ; verification HTTP OK sur `/api/market/settings` et `/api/market/sync-stats` apres redemarrage ; base finale confirmee avec `market_properties=30`, `monitored_zones=0`, `sync_runs=3`, `stream_estate_usage_events=2`.
- Point d'attention : le test a consommé `2` appels externes au total sur Stream Estate depuis la reprise. Le dernier run reste trace comme `blocked` par plafond de requete, mais le partage de progression fonctionne désormais.
- Suite : si on veut aller plus loin, soit augmenter temporairement `stream_estate_max_requests_per_sync` pour couvrir plus de pages, soit garder ce mode partiel et utiliser les 30 biens importes pour la suite des tests UI/API.

### 18/06/2026 - 20:48 CEST
- Base/branche : `preview`.
- Type : environnement local / redemarrage Next.
- Statut : **fait**.
- Resume : apres ajout de `STREAMESTATE_API_KEY` et `STREAMESTATE_API_URL` dans `.env.local`, redemarrage du serveur Next local sur `http://localhost:3002` pour recharger les variables d'environnement. Aucun appel fournisseur Stream Estate n'a ete lance pendant cette verification.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : `http://localhost:3002/app/dashboard` repond `200 OK` ; `/api/market/sync-stats` confirme `zones=0`, sync Stream Estate desactivee, solde manuel `0`, cout par requete `0.01`, plafond `1`, aucun appel externe enregistre.
- Point d'attention : serveur Next actif sur le port `3002` via process Node PID `36774`.
- Suite : pour le vrai test API, reactiver temporairement la sync avec un solde manuel de `0.01 EUR`, conserver `stream_estate_max_requests_per_sync=1`, puis lancer un seul `POST /api/market/sync` sur le CP pilote.

### 18/06/2026 - 17:56 CEST
- Base/branche : `preview`.
- Type : nettoyage Supabase / preparation test API Stream Estate.
- Statut : **fait, test API bloque par configuration locale**.
- Resume : purge de la base Supabase distante pour repartir d'un etat propre avant test Stream Estate. Suppression coherente des biens `market_properties` et de leurs dependances directes, puis suppression de l'historique `sync_runs`, du journal `stream_estate_usage_events` et des zones surveillees `monitored_zones`. Tentative de test controle sur le CP `83670` avec garde-fou a 1 requete : l'appel a ete bloque avant appel fournisseur reel car `STREAMESTATE_API_KEY` est absente de l'environnement serveur local. Le faux depart cree par la route (`zone`, `sync_run`, `usage_event`) a ete supprime ensuite.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : verification SQL finale : `market_properties=0`, `monitored_zones=0`, `sync_runs=0`, `stream_estate_usage_events=0`. Verification API locale : `/api/market/properties?limit=5` retourne `total=0`, `/api/market/zones` retourne `0`, `/api/market/sync-stats` retourne `zones=0`, sync Stream Estate desactivee, solde manuel `0`, cout par requete `0.01`, plafond `1`.
- Point d'attention : ajouter `STREAMESTATE_API_KEY` dans `.env.local` puis redemarrer le serveur Next avant un vrai test d'appel API. La route actuelle compte aussi une erreur de configuration comme un `external_request` dans le run ; le faux compteur a ete purge pour garder la base propre.
- Suite : une fois la cle locale ajoutee et le serveur redemarre, reactiver temporairement la sync avec `stream_estate_manual_balance_eur=0.01`, conserver `stream_estate_max_requests_per_sync=1`, puis relancer `POST /api/market/sync` sur un seul CP pilote.

### 18/06/2026 - 17:48 CEST
- Base/branche : `preview`.
- Type : reprise de session / start.
- Statut : **fait**.
- Resume : application du protocole `docs/START.md` : lecture de `docs/MEMOIRE_SESSION.md` et `docs/SUIVI_PROJET.md`, `git fetch --all --prune`, verification de l'etat Git, comparaison avec `origin/preview`, verification du serveur local Next deja actif sur le port `3002`.
- Etat Git : `preview` locale est 5 commits devant `origin/preview` et 0 commit derriere ; des changements locaux non commites sont presents sur le chantier Stream Estate / budget / zones / biens synchronises.
- Fichiers : `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `curl -I` OK sur `http://localhost:3002/app/dashboard`, `http://localhost:3002/app/settings` et `http://localhost:3002/app/zones` ; navigateur integre Codex non disponible dans cette session (`iab` absent), donc pas d'ouverture visuelle via Browser.
- Point d'attention : ne pas pousser vers `origin/preview` sans demande explicite ; ne pas ecraser les modifications locales en cours.
- Suite : reprendre apres l'application de la migration `009_stream_estate_budget_guardrails.sql` : renseigner le solde manuel dans `/app/settings`, activer prudemment la sync Stream Estate, puis tester un seul code postal pilote.

### 18/06/2026 - 15:38 CEST
- Base/branche : `preview`.
- Type : application migration Supabase.
- Statut : **fait**.
- Resume : application reussie de la migration `009_stream_estate_budget_guardrails.sql` sur la base Supabase distante. La migration ajoute :
  - 3 colonnes a `sync_runs` : `external_request_count`, `estimated_cost_eur`, `blocked_reason` ;
  - nouvelle table `stream_estate_usage_events` avec index pour tracer chaque appel Stream Estate ;
  - 5 parametres dans `app_settings` : `stream_estate_sync_enabled` (false), `stream_estate_manual_balance_eur` (0), `stream_estate_cost_per_request_eur` (0.01), `stream_estate_max_requests_per_sync` (1), `stream_estate_min_balance_eur` (0).
- Fichiers : `supabase/migrations/009_stream_estate_budget_guardrails.sql`, `docs/SUIVI_PROJET.md`.
- Audit qualite : execution directe via script Node.js + `pg` ; 12/12 statements SQL executes avec succes ; verification post-application confirme colonnes, table et parametres crees.
- Point d'attention : aucun.
- Suite : renseigner le solde manuel dans `/app/settings` via UI, puis activer la sync Stream Estate et tester un CP pilote.

### 18/06/2026 - 11:10 CEST
- Base/branche : `preview`.
- Type : coherence zones surveillees / biens synchronises.
- Statut : implemente et verifie en local.
- Resume : renforcement du lien operationnel entre zones surveillees et biens sans ajouter de nouvelle table. La source de verite reste le code postal : `monitored_zones.zipcode = market_properties.zipcode`. L'API `/api/market/sync-stats` expose maintenant, par zone, le dernier run, le dernier succes, les appels et couts du dernier run, le nombre de biens en base, le nombre de biens revus et le nombre de biens non revus depuis la derniere sync reussie. `/app/zones` affiche ces reperes sur chaque zone. `/app/properties?zipcode=...` affiche un bandeau contextualise avec la zone, les biens revus/non revus et le cout/appels du dernier succes.
- Fichiers : `src/app/api/market/sync-stats/route.ts`, `src/app/admin/market/zones/page.tsx`, `src/app/admin/market/properties/PropertiesTable.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run lint` OK avec warnings preexistants ; `npm run build` OK ; HTTP local OK sur `http://localhost:3003/app/zones`, `http://localhost:3003/app/properties?zipcode=83670`, `http://localhost:3003/api/market/sync-stats`.
- Point d'attention : la base locale renvoie actuellement `zones: []`, car des zones ont ete supprimees via l'UI/API pendant la session locale. Rien n'a ete restaure automatiquement.
- Suite : recreer une zone pilote, appliquer la migration budget Stream Estate, puis tester une sync CP unique pour voir les compteurs `revus / non revus / cout` avec donnees reelles.

### 18/06/2026 - 10:19 CEST
- Base/branche : `preview`.
- Type : architecture API / budget / admin UX.
- Statut : implemente et verifie en local.
- Resume : remplacement de la synchronisation Stream Estate large par une synchronisation stricte par code postal avec `includedZipcodes[]`. Ajout d'un double garde-fou budget : activation manuelle, solde manuel estime, cout par appel fixe a 0,01 EUR, plafond d'appels par sync et solde minimum. Ajout du journal estime des appels Stream Estate et extension du suivi `sync_runs` pour appels externes, cout estime et raison de blocage.
- Fichiers : `src/lib/stream-estate.ts`, `src/lib/stream-estate-budget.ts`, `src/app/api/market/sync/route.ts`, `src/app/api/market/sync-stats/route.ts`, `src/app/api/market/test-stream-estate/route.ts`, `src/lib/mandat/import-service.ts`, `src/app/admin/market/settings/page.tsx`, `src/app/admin/market/zones/page.tsx`, `src/types/supabase.ts`, `supabase/migrations/009_stream_estate_budget_guardrails.sql`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run lint` OK avec warnings preexistants ; `npm run build` OK ; verification statique OK (`includedZipcodes[]` present, plus de `includedDepartments[]` ni `/cities` dans `src`) ; HTTP local OK sur `http://localhost:3003/app/settings`, `http://localhost:3003/app/zones`, `http://localhost:3003/api/market/sync-stats` ; test `POST /api/market/sync` avec CP invalide => `400`, sync desactivee => `403` et `external_requests: 0`.
- Point d'attention : la migration Supabase `009_stream_estate_budget_guardrails.sql` est creee mais pas appliquee a la base connectee localement au moment du test. L'API garde un repli compatible avant migration pour eviter un `500`, mais le suivi complet des couts demande l'application de cette migration.
- Suite : appliquer la migration Supabase, renseigner le solde manuel et le cout par appel dans `/app/settings`, puis seulement activer la sync Stream Estate et tester un seul CP pilote.

### 18/06/2026 - 10:24 CEST
- Base/branche : `preview`.
- Type : correction parametre budget.
- Statut : fait.
- Resume : alignement du cout Stream Estate par appel sur la valeur confirmee par Alexandre : 0,01 EUR. Mise a jour du fallback serveur, de la valeur initiale UI, de la migration Supabase et du parametre local via `/api/market/settings`.
- Fichiers : `src/lib/stream-estate-budget.ts`, `src/app/admin/market/settings/page.tsx`, `supabase/migrations/009_stream_estate_budget_guardrails.sql`, `docs/SUIVI_PROJET.md`.
- Audit qualite : verification HTTP locale sur `/api/market/sync-stats`, le champ `stream_estate_budget.cost_per_request_eur` retourne `0.01`.
- Suite : appliquer la migration Supabase puis renseigner le solde manuel avant d'activer une sync CP pilote.

### 18/06/2026 - 09:51 CEST
- Base/branche : `preview`.
- Type : correction UX / zones surveillees.
- Statut : fait localement, en attente de validation visuelle.
- Resume : correction du manque constate sur le parcours zones surveillees. Chaque zone affiche maintenant une action directe vers les biens du code postal (`/app/properties?zipcode=...`). La page Biens lit ce parametre, filtre l'API `/api/market/properties` avec `zipcode`, affiche un bandeau de contexte et permet de revenir a tous les biens. La carte des biens n'utilise plus les 8 donnees mockees : elle charge les vrais biens depuis l'API et respecte le meme filtre CP. Le toast de synchronisation de zone affiche aussi le nombre de biens recuperes.
- Fichiers : `src/app/admin/market/zones/page.tsx`, `src/app/admin/market/properties/page.tsx`, `src/app/admin/market/properties/PropertiesTable.tsx`, `src/app/admin/market/properties/PropertiesMapWrapper.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run lint` passe avec warnings existants hors fichiers touches ; `npm run build` passe. Verification HTTP : `/app/zones` et `/app/properties?zipcode=83670` repondent `200 OK`, API `/api/market/properties?zipcode=83670&limit=100` retourne des biens filtres. Le serveur dev a ete redemarre sur `3002` apres le build pour remettre le cache `.next` en etat.
- Suite : verifier visuellement dans le navigateur local le clic depuis `/app/zones` vers les biens filtres, puis pousser `preview` vers `origin/preview` uniquement apres validation explicite.

### 18/06/2026 - 09:41 CEST
- Base/branche : `preview`.
- Type : visualisation locale / pre-push.
- Statut : en cours de verification utilisateur.
- Resume : lancement du serveur local Next sur le port `3002` avec `npm run dev -- --port 3002`. Verification HTTP : `/app/dashboard` repond `200 OK`, `/admin/market` redirige vers `/app/dashboard`, `/admin/market/properties` redirige vers `/app/properties`. Ouverture de `http://localhost:3002/app/dashboard` dans le navigateur macOS. Le navigateur integre Codex n'etait pas disponible dans cette session ; la commande VS Code `code` n'est pas installee dans le shell.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : `curl -I` sur `/app/dashboard`, `/admin/market`, `/dashboard`, `/admin/market/properties`.
- Suite : Alexandre verifie visuellement en local. Ne pas pousser vers `origin/preview` avant validation explicite.

### 18/06/2026 - 09:24 CEST
- Base/branche : `preview`.
- Type : organisation / consolidation Git.
- Statut : fait localement, en attente de validation push.
- Resume : consolidation du flux demande par Alexandre. `preview` locale a ete fast-forward sur `origin/preview`, puis la branche locale `feat/estimation-zod-validation` a ete mergee dans `preview` avec resolution du conflit sur `src/app/api/estimation/route.ts`. La validation Zod a ete conservee et etendue aux champs actuels de l'estimation (`sous_type`, surfaces terrain/cadastre, annee, DPE verifie, numero DPE). Les changements en cours de `design/shadcn-pro-system` ont ete recuperes via stash sur `preview`. Les consignes projet ont ete alignees sur le flux simplifie : travail local sur `preview`, `origin/preview` source de verite, plus de sous-branches locales sauf decision explicite. Les branches locales integrees `design/shadcn-pro-system`, `feat/estimation-zod-validation` et `main` ont ete supprimees ; il ne reste que `preview` en local.
- Fichiers : `CLAUDE.md`, `AGENTS.md`, `docs/WORKFLOW_BRANCHES.md`, `docs/SUIVI_PROJET.md`, `src/app/api/estimation/route.ts`, `src/lib/schemas/estimation.ts`.
- Audit qualite : `npm run lint` passe avec warnings existants ; `npm run build` passe avec warnings existants (`next lint` deprecie, Supabase Edge Runtime, imports inutilises). Aucun push effectue.
- Suite : pousser `preview` vers `origin/preview` uniquement apres validation explicite d'Alexandre. Point de reprise : `preview` locale propre, 3 commits d'avance sur `origin/preview`.

### 18/06/2026 - 00:51 CEST
- Base/branche : `preview`.
- Type : optimisation / consommation API Stream Estate.
- Statut : fait.
- Resume : Alexandre signale 364 credits consommes sur Stream Estate alors qu'on etait en phase de configuration. Diagnostic : `fetchListings()` refaisait la pagination complete (10 pages, ~1 appel/page) pour CHAQUE code postal, meme pour 7 CP du meme departement. Correction :
  1. `src/lib/stream-estate.ts` : ajout d'un cache `deptResultsCache` avec TTL 5 minutes + fonction `fetchAllByDept()` qui ne pagine qu'une seule fois par departement.
  2. `vercel.json` : crons vides (`[]`) pour arreter tout appel automatique pendant la config.
- Fichiers : `src/lib/stream-estate.ts`, `vercel.json`.
- Audit qualite : build TS sans erreur.
- Suite : verifier le comportement en local avec plusieurs CP du Var ; reactiver les crons plus tard.

### 18/06/2026 - 00:38 CEST
- Base/branche : `preview`.
- Type : développement / branchement UI biens réels.
- Statut : fait.
- Resume : `PropertiesTable` était câblé sur 8 biens hardcodés. Réécriture complète du composant pour fetch `/api/market/properties` (100 biens, tri côté API). Mapping des champs Supabase → UI, calcul `daysOnline` depuis `first_seen_at`, bouton Actualiser, état de chargement, lien "Voir l'annonce" dans le dropdown.
- Fichiers : `src/app/admin/market/properties/PropertiesTable.tsx`.
- Audit qualite : build sans erreur TS, GET /app/properties 200.
- Suite : vérifier l'affichage des 30 biens dans le navigateur.

### 18/06/2026 - 00:22 CEST
- Base/branche : `preview`.
- Type : correction / normalisation données Stream Estate.
- Statut : fait.
- Resume : deux correctifs supplémentaires après avoir constaté que l'API retournait 30 biens mais Supabase n'en contenait qu'1. Cause : `raw.id = null` chez Stream Estate, l'identifiant réel est `uuid` → toutes les annonces avaient `external_id = ""` et s'écrasaient mutuellement. Correction normalisation `id`/`externalId` pour utiliser `raw.uuid`. Correction aussi du champ `city` (objet JS pas string) et `zipcode` (dans `city.zipcode`, pas `location.postalCode`). Suppression de l'enregistrement corrompu en base (external_id vide), relance sync → 30 créés, données correctes (villes/CP du Var).
- Fichiers : `src/lib/stream-estate.ts`.
- Audit qualite : GET /api/market/properties → total 30, villes Var correctes.
- Suite : vérifier l'affichage dans /app/properties UI, puis consolider le schema Supabase.

### 17/06/2026 - 23:58 CEST
- Base/branche : `preview`.
- Type : correction / sync Stream Estate.
- Statut : fait.
- Resume : trois correctifs appliques pour debloquer la sync Stream Estate sur le code postal 83670 (Barjols, Var).
  1. `src/lib/stream-estate.ts` — `deptIdFromZipcode` : resolution de l'ID interne Stream Estate via l'endpoint `/cities` au lieu de deriver les 2 premiers chiffres du CP. Le Var a le code INSEE 83 mais l'ID interne 85 chez Stream Estate ; l'ancien code passait `83` = Tarn.
  2. `src/lib/stream-estate.ts` — normalisation `publishedAt`/`updatedAt` : retourne `undefined` au lieu de `""` pour eviter une erreur Supabase `invalid input syntax for type timestamp`.
  3. `src/app/api/market/sync/route.ts` — suppression du filtre exact par code postal (qui filtrait 100% des resultats du departement) et correction `published_at: listing.publishedAt || null`.
- Resultat : sync 83670 => 30 fetched, 1 created, 29 updated. Flux complet valide.
- Fichiers : `src/lib/stream-estate.ts`, `src/app/api/market/sync/route.ts`.
- Audit qualite : `npm run build` passe sans erreur. POST /api/market/sync {"zipcode":"83670"} => 200 success.
- Suite : verifier les biens inseres dans `market_properties` via l'UI /app/properties, puis consolider le schema Supabase.

### 17/06/2026 - 23:13 CEST
- Base/branche : `preview`.
- Type : clarification / securite secrets.
- Statut : fait.
- Resume : clarification sur l'ajout de `STREAMESTATE_API_KEY` dans `.env.local`. Le fichier `.env.local` est bien ignore par Git via `.gitignore`, donc il peut contenir des secrets pour le developpement local. Les cles ne doivent jamais etre committees, documentees en clair, ni exposees avec le prefixe `NEXT_PUBLIC_`. Pour Vercel, la meme cle devra etre ajoutee dans les variables d'environnement du projet, cote serveur uniquement.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : verification `git check-ignore -v .env.local`.
- Suite : ajouter la cle Stream Estate localement si disponible, redemarrer le serveur, puis relancer la sync Barjols.

### 17/06/2026 - 22:54 CEST
- Base/branche : `preview`.
- Type : test / API zones surveillees.
- Statut : bloque par configuration externe.
- Resume : apres validation, test manuel de `POST /api/market/sync` sur le code postal `83670`. Le serveur local fonctionne, mais la sync echoue avant l'ecriture Supabase : Stream Estate renvoie `401 Authentication failed`. Verification `.env.local` : les variables `STREAMESTATE_API_URL` et `STREAMESTATE_API_KEY` sont absentes. Ajout d'une erreur explicite dans le client Stream Estate pour signaler `STREAMESTATE_API_KEY manquante dans les variables d’environnement` au lieu de laisser partir un appel fournisseur avec une cle vide. Le schema Supabase reste a consolider ensuite, mais le premier blocage concret est la cle API Stream Estate.
- Fichiers : `src/lib/stream-estate.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run build` passe. Verification HTTP : `POST /api/market/sync` retourne `500` avec erreur fournisseur `401 Authentication failed`; `sync-runs` confirme le run en erreur.
- Suite : ajouter une cle `STREAMESTATE_API_KEY` valide dans `.env.local` et dans les environnements Vercel concernes, redemarrer le serveur local, relancer la sync Barjols, puis verifier les inserts dans `market_properties`.

### 17/06/2026 - 22:50 CEST
- Base/branche : `preview`.
- Type : clarification / architecture donnees.
- Statut : fait.
- Resume : clarification importante : travailler en local ne signifie pas travailler sur une base locale. L'app Next locale utilise les variables `.env.local` et peut donc lire/ecrire dans la Supabase distante configuree. Pour les zones surveillees, la suite doit commencer par stabiliser la source de verite du schema Supabase, puis tester le flux `zones -> sync Stream Estate -> market_properties`, avant de creer le pont metier vers leads/opportunites vendeurs.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : non lance, clarification uniquement.
- Suite : definir si le schéma distant doit etre exporte en migration repo ou si l'on applique les migrations manquantes depuis le repo vers Supabase.

### 17/06/2026 - 22:49 CEST
- Base/branche : `preview`.
- Type : diagnostic / API zones surveillees.
- Statut : en cours, premier correctif fait.
- Resume : analyse de la partie zones surveillees et capture des biens. La base utilisee par `.env.local` est une Supabase distante, pas une base locale rejouable exactement depuis le repo. Les endpoints `/api/market/zones`, `/api/market/sync-stats` et `/api/market/sync-runs` fonctionnent et voient une zone Barjols. `/api/market/properties` fonctionne mais retourne 0 bien. Les migrations du repo ne contiennent pas encore la creation complete des tables `market_properties`, `monitored_zones`, `sync_runs`, alors que `src/types/supabase.ts` les reference : le schema distant n'est donc pas entierement reconstructible depuis les migrations actuelles. Correction appliquee sur `/api/market/sync` : filtrage des annonces Stream Estate au code postal exact et verification explicite des erreurs Supabase sur lecture/update/insert/tag, pour eviter les compteurs `created_count` faux.
- Fichiers : `src/app/api/market/sync/route.ts`, `docs/SUIVI_PROJET.md`.
- Audit qualite : `npm run build` passe. Verification HTTP : zones = 1 zone Barjols, sync runs = derniers runs visibles, properties = 0 bien, Radar listings toujours lie au schema `listings` absent.
- Suite : consolider le schema Supabase comme source de verite (migration manquante ou dump schema), puis definir le pont metier "bien detecte" vers une entree vendeur/lead sans melanger les tables `market_properties` et `leads`.

### 17/06/2026 - 22:43 CEST
- Base/branche : `preview`.
- Type : diagnostic / serveur local.
- Statut : fait, avec point a verifier.
- Resume : diagnostic d'un `500 Internal Server Error` en local. Cause principale corrigee : cache `.next` incoherent apres builds/reloads, avec manifests Next manquants. Arret du serveur, suppression de `.next`, relance de `npm run dev -- --port 3002`. Les pages `/app/dashboard`, `/app/leads` et `/app/radar` repondent a nouveau `200 OK`. Point restant : `/api/radar/listings?mode=kpis` repond encore `500`, car Supabase ne trouve pas la table `public.listings` dans le schema cache.
- Fichiers : `docs/SUIVI_PROJET.md`.
- Audit qualite : verification HTTP via `curl -I` sur `/app/dashboard`, `/app/leads`, `/app/radar` et `/api/radar/listings?mode=kpis`.
- Suite : traiter separement le schema Radar Supabase (`listings`, potentiellement `listing_events`) ou adapter l'API Radar a l'environnement local.

### 17/06/2026 - 22:41 CEST
- Base/branche : `preview`.
- Type : decision / suivi projet.
- Statut : fait.
- Resume : ajout d'une regle explicite : a chaque fin de tache, le suivi projet doit etre mis a jour avant la reponse finale, avec l'etat final, les fichiers touches, les verifications/audits et le prochain point de reprise.
- Fichiers : `docs/START.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : non lance, documentation/protocole uniquement.
- Suite : appliquer cette regle a toutes les prochaines taches, y compris les petites corrections UI.

### 17/06/2026 - 22:39 CEST
- Base/branche : `preview`.
- Type : decision / protocole de reprise.
- Statut : fait.
- Resume : formalisation du comportement attendu quand Alexandre ouvre un nouveau chat et dit `start`. Le protocole doit lire la memoire et le suivi, verifier Git, relancer ou reutiliser localhost, reprendre depuis la derniere entree horodatee, puis donner un compte rendu de depart avec l'URL active et les taches ouvertes/en cours.
- Fichiers : `CLAUDE.md`, `docs/START.md`, `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md`, `docs/ROUTES.md`.
- Audit qualite : non lance, documentation/protocole uniquement.
- Suite : au prochain `start`, appliquer cette routine avant toute nouvelle modification.

### 17/06/2026 - 21:59 CEST
- Base/branche : `preview` alignee sur `origin/preview`.
- Type : decision / organisation.
- Statut : fait.
- Resume : decision de simplifier le workflow. Codex travaille seul sur le developpement et le design. Le flux courant utilise uniquement `preview`; les branches `design/*` et `feat/*` ne sont plus des bases de travail sauf demande explicite. Le push vers `origin/preview` reste soumis a validation explicite d'Alexandre.
- Fichiers : `docs/START.md`, `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : non lance, documentation uniquement.
- Suite : continuer les prochains chantiers depuis `preview`, en local, puis pousser uniquement apres validation.

### 17/06/2026 - 22:00 CEST
- Base/branche : `preview`.
- Type : visualisation locale / preference environnement.
- Statut : fait.
- Resume : verification de `http://localhost:3000/admin/market` et ouverture demandee dans VS Code via le Simple Browser integre. La route repond avec une redirection `307` vers `/admin/login?redirect=/admin/market`, conforme a la garde admin actuelle.
- Fichiers : `docs/START.md`, `docs/MEMOIRE_SESSION.md`, `docs/SUIVI_PROJET.md`.
- Audit qualite : verification HTTP via `curl -I http://localhost:3000/admin/market`; Playwright non lance.
- Suite : pour les prochaines visualisations locales, utiliser `localhost` et VS Code.

### 17/06/2026 - 22:16 CEST
- Base/branche : `preview`.
- Type : developpement local / auth temporaire.
- Statut : fait.
- Resume : le middleware etait deja desactive via `matcher: []`, mais la garde serveur du layout `/admin/market` redirigeait encore vers le login. Neutralisation temporaire de cette garde avec un admin local `super_admin` pour accelerer la navigation locale.
- Fichiers : `src/app/admin/market/layout.tsx`, `docs/SUIVI_PROJET.md`.
- Audit qualite : verification HTTP via `curl -I`; `/admin/market` repond maintenant `200 OK`.
- Suite : reactiver `getCurrentAdmin()` et la redirection avant mise en production si l'acces admin doit redevenir protege.

### 09/06/2026
- Redaction du Cahier des Charges
- Creation du projet Linear
- Creation de tous les labels (16 labels)
- Creation de toutes les issues Linear (13 issues)

### A faire
- Configurer GitHub Projects avec tableau Kanban
- Verifier les integrations Linear <-> GitHub
- Creer le fichier supabase/seed.sql
- Demarrer le developpement du Lot 2

## Commandes Work Utiles
Creer une issue: Work, cree une issue Linear pour [tache] avec description [texte], assigne a @alexlopez, priorite [urgent/high/medium], labels [lot-2, backend], due date [15/06/2026].

Mettre a jour une issue: Work, passe l issue API-001 en In Progress dans Linear.

Lier une PR: Work, lie la PR #123 a l issue API-001 dans Linear.

Rapport d avancement: Work, donne-moi un rapport d avancement du Lot 2.

Deployment: Work, declenche un deployment Vercel pour la branche preview.

## Metriques
- Total issues: 13
- Issues terminees: 0
- Issues en cours: 0
- Issues a faire: 13
- Progression globale: 0%

---
Derniere mise a jour: 10/07/2026
Maintenu par: Codex (sur `preview`)
