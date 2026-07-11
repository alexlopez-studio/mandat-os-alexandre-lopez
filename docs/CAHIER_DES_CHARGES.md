# CAHIER DES CHARGES PROJET
Nom du projet : Mandat OS MVP - Site Alexandre Lopez (Provence Verte & Verdon)
Version : 1.0
Date : 09 juin 2026
Redige par : Work (IA) avec Mistral
Destinataires : Alexandre Lopez, Equipe Dev, Supabase, GitHub, Linear

## 1. CONTEXTE & OBJECTIFS

### 1.1 Contexte
- Client : Alexandre Lopez (conseiller immobilier iad en Provence Verte & Verdon)
- Besoin : Outil de suivi intelligent du marche immobilier (Mandat OS) integre a son site vitrine existant
- Public cible : Alexandre (utilisateur unique, pas de multi-tenant)
- Perimetre geographique : Provence Verte & Verdon (Var, Bouches-du-Rhone partiel)

### 1.2 Objectifs

| Objectif | Description | Indicateur de succes |
|----------|-------------|---------------------|
| Automatisation | Synchroniser les biens immobiliers depuis Stream Estate vers Supabase | 100% des biens cibles synchronises en <24h |
| Analyse marche | Fournir des KPIs temps reel (prix/m2, DPE, temps de vente) | Dashboard operationnel avec donnees actualisees |
| Gestion opportunites | Pipeline visuel pour suivre les leads vendeurs/acheteurs | Kanban fonctionnel avec drag-and-drop |
| Alertes intelligentes | Notifications basees sur des regles metier (ex: bien sous-evalue) | 0 faux positifs, 100% des alertes pertinentes |
| Estimation automatisee | Outil d estimation pour les clients (integre au site) | 90% des estimations validees par Alexandre |

### 1.3 Contraintes
- Budget : A definir (cout principal = API Stream Estate)
- Delai : MVP operationnel pour fin juin 2026
- Technologies imposees :
  - Frontend : Next.js 15 (App Router), Tailwind CSS
  - Backend : Supabase (PostgreSQL), API Routes (Next.js)
  - Data : Stream Estate (API marche immobilier)
  - Hebergement : Vercel
- Securite : Pas de donnees sensibles exposees (RGPD conforme)

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Schema Global

Client -> Site Vitrine (Next.js) -> Next.js API Routes -> Supabase (PostgreSQL)
                     -> Outils (Estimation) ->
                     -> Dashboard (KPIs, Alertes, Opportunites) ->

Backend: Next.js API Routes -> Stream Estate (API Marche)
                              -> Supabase (PostgreSQL)
                              -> Vercel (Hebergement)

### 2.2 Composants Techniques

| Composant | Technologie | Role | Lien/Acces |
|-----------|-------------|------|------------|
| Frontend | Next.js 15, Tailwind CSS, TypeScript | Site vitrine + Dashboard Mandat OS | Repo GitHub |
| Backend | Next.js API Routes | Logique metier, synchronisation | src/app/api/market/ |
| Base de donnees | Supabase (PostgreSQL) | Stockage des biens, regles, opportunites | Supabase |
| API Marche | Stream Estate | Donnees immobilières (biens, prix, historique) | Cles API a demander a Alexandre |
| Hebergement | Vercel | Deployment continu | Projet Vercel |
| Suivi Projet | Linear | Gestion des tâches, priorites, deadlines | Linear |
| Versioning | GitHub | Code, PR, CI/CD | Repo |

### 2.3 Flux de Donnees

Synchronisation Stream Estate -> Supabase:
- Tous les jours a 8h, l API /api/market/sync recuperer les nouveaux biens
- Les donnees sont normalisees et stockees dans market_properties
- Le moteur de regles applique des tags/alertes

Dashboard Mandat OS:
- Affiche les KPIs depuis Supabase
- Permet de creer/modifier des regles

Outils Clients:
- Les visiteurs utilisent les outils (estimation, audit) -> donnees stockees en Supabase
- Alexandre acces au Dashboard pour suivre les leads

## 3. LIVRABLES & TACHES

### 3.1 Decoupage en Lots

| Lot | Nom | Objectif | Taches | Priorite | Deadline | Statut |
|-----|-----|----------|--------|----------|---------|--------|
| Lot 1 | Infrastructure | Prerequis techniques | Termine (voir MEMOIRE_SESSION.md) | ⭐⭐⭐ | 01/06/2026 | ✅ Done |
| Lot 2 | API Backend | Completer les endpoints | CRUD Regles, Notifications, Opportunites, Zones | ⭐⭐⭐ | 15/06/2026 | ⏳ Todo |
| Lot 3 | UI Dashboard | Interface utilisateur | Dashboard, Table marche, Fiche bien, Kanban | ⭐⭐⭐ | 20/06/2026 | ⏳ Todo |
| Lot 4 | Moteur de Regles | Logique metier | Assistant creation regle, Execution manuelle, Regles preconfigurees | ⭐⭐ | 25/06/2026 | ⏳ Todo |
| Lot 5 | Monitoring | Suivi consommation | Dashboard Stream Estate | ⭐ | 30/06/2026 | ⏳ Todo |

### 3.2 Detail des Taches (Linear)

#### Lot 2 : API Backend
| ID | Tache | Description | Endpoint | Methodes | Tables Supabase | Priorite | Labels | Assigne |
|----|-------|-------------|----------|----------|------------------|----------|--------|---------|
| API-001 | CRUD Regles | Creer, lire, mettre a jour, supprimer des regles metier | /api/market/rules | GET, POST, PATCH, DELETE | management_rules | ⭐⭐⭐ | backend, api, lot-2 | @alexlopez |
| API-002 | Notifications | Lister et marquer comme lues les notifications | /api/market/notifications | GET, PATCH | notifications | ⭐⭐⭐ | backend, api, lot-2 | @alexlopez |
| API-003 | Opportunites | Gerer le pipeline des opportunites (leads) | /api/market/opportunities | GET, POST, PATCH | opportunities | ⭐⭐⭐ | backend, api, lot-2 | @alexlopez |
| API-004 | Zones Surveillees | Ajouter/supprimer des zones geographiques a surveiller | /api/market/zones | GET, POST, DELETE | monitored_zones | ⭐⭐ | backend, api, lot-2 | @alexlopez |

#### Lot 3 : UI Dashboard
| ID | Tache | Description | Page | Composants | Librairies | Priorite | Labels | Assigne |
|----|-------|-------------|------|-------------|------------|----------|--------|---------|
| UI-001 | Dashboard KPIs | Afficher les indicateurs cles | /dashboard | KpiCard, AlertList | TanStack Query | ⭐⭐⭐ | frontend, ui, lot-3 | @alexlopez |
| UI-002 | Table Marche | Tableau filtrable des biens | /dashboard/market | MarketTable | TanStack Table | ⭐⭐⭐ | frontend, ui, lot-3 | @alexlopez |
| UI-003 | Fiche Bien | Detail d un bien avec historique | /dashboard/properties/[id] | PropertyDetail, PriceHistoryChart | Recharts | ⭐⭐ | frontend, ui, lot-3 | @alexlopez |
| UI-004 | Kanban Opportunites | Pipeline glisser-deposer | /dashboard/opportunities | KanbanBoard | @hello-pangea/dnd | ⭐⭐ | frontend, ui, lot-3 | @alexlopez |
| UI-005 | Gestion Regles | Interface pour creer/modifier des regles | /dashboard/rules | RuleForm, RuleList | - | ⭐⭐ | frontend, ui, lot-3 | @alexlopez |

#### Lot 4 : Moteur de Regles
| ID | Tache | Description | Livrable | Priorite | Labels | Assigne |
|----|-------|-------------|----------|----------|--------|---------|
| RUL-001 | Assistant Creation Regle | UI en 4 etapes pour creer une regle | /dashboard/rules/new | ⭐⭐ | moteur, lot-4 | @alexlopez |
| RUL-002 | Execution Manuelle | Bouton pour tester une regle | Fonction executeRule() | ⭐⭐ | moteur, lot-4 | @alexlopez |
| RUL-003 | Regles Preconfigurees | Seed en base de regles par defaut | supabase/seed.sql | ⭐ | moteur, lot-4 | @alexlopez |

#### Lot 5 : Monitoring
| ID | Tache | Description | Livrable | Priorite | Labels | Assigne |
|----|-------|-------------|----------|----------|--------|---------|
| MON-001 | Dashboard Consommation API | Suivi des items facturés à Stream Estate | /dashboard/monitoring | ⭐ | monitoring, lot-5 | @alexlopez |

## 4. INTEGRATIONS & AUTOMATISATIONS

### 4.1 Work + Linear + GitHub + Supabase

| Outil | Role | Integration | Exemple |
|-------|------|-------------|---------|
| Work | Orchestration IA | Connecte a Linear, GitHub, Supabase | Work, cree une issue Linear... |
| Linear | Suivi des taches | Sync avec GitHub (PR) et Supabase | Issues Linear liees aux PR GitHub |
| GitHub | Versioning | Webhooks -> Vercel | Push sur main -> deployment automatique |
| Supabase | Base de donnees | API Next.js -> Supabase | API routes utilisent supabaseAdmin |
| Vercel | Hebergement | Variables d environnement | STREAMESTATE_API_KEY configure |

### 4.2 Automatisations Cles

| Declencheur | Action | Outil | Resultat |
|-------------|--------|-------|----------|
| Push sur main | Deployment production | Vercel | Site mis a jour en <5 min |
| Push sur preview | Deployment preview | Vercel | Lien preview genere |
| Nouvelle issue Linear | Creation de branche GitHub | Work | Branche feature/[id-linear] creee |
| Issue Linear en In Progress | Notification Slack | Linear | Alexandre notifie |
| Sync quotidienne | Recuperation biens Stream Estate | Cron Vercel | Donnees a jour dans Supabase avec garde-fou budget / items |

### 4.3 Commandes Work pour ce Projet

| Besoin | Commande Work | Resultat |
|--------|----------------|----------|
| Creer une tache | Work, cree une issue Linear pour [tache] avec description [texte], assigne a @alexlopez, priorite [X], labels [Y], due date [Z] | Issue creee dans Linear + lien partage |
| Mettre a jour une tache | Work, passe l issue [ID] en In Progress dans Linear | Statut mis a jour |
| Lier une PR GitHub | Work, lie la PR #123 a l issue [ID] dans Linear | PR et issue synchronisees |
| Generer un rapport | Work, donne-moi un rapport d avancement du Lot [X] | Resume des taches + statuts |
| Deployer | Work, declenche un deployment Vercel pour la branche [X] | Build lance + lien preview |

## 5. PLANNING & DEPENDANCES

### 5.1 Roadmap

Lot 2 - API Backend (09-15 juin):
- API Regles (3 jours)
- API Notifications (2 jours)
- API Opportunites (2 jours)
- API Zones (1 jour)

Lot 3 - UI Dashboard (15-20 juin):
- Dashboard KPIs (3 jours)
- Table Marche (3 jours)
- Fiche Bien (2 jours)
- Kanban Opportunites (2 jours)

Lot 4 - Moteur de Regles (20-25 juin):
- Assistant Regles (3 jours)
- Execution Manuelle (1 jour)
- Regles Preconfigurees (1 jour)

Lot 5 - Monitoring (25-30 juin):
- Dashboard Consommation (2 jours)

### 5.2 Dependances

| Tache | Depend de | Bloque |
|-------|-----------|--------|
| API Notifications | API Regles | Dashboard KPIs |
| Table Marche | API Backend (Lot 2) | Fiche Bien |
| Kanban Opportunites | API Opportunites | Dashboard |
| Assistant Regles | API Regles + UI Dashboard | Execution Manuelle |

## 6. STRUCTURE DES FICHIERS (GitHub)

site-alex-lopez-provence/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── market/
│   │   │       ├── properties/ route.ts (✅ Termine)
│   │   │       ├── sync/ route.ts (✅ Termine)
│   │   │       ├── rules/ route.ts (⏳ A faire)
│   │   │       ├── notifications/ route.ts (⏳ A faire)
│   │   │       ├── opportunities/ route.ts (⏳ A faire)
│   │   │       └── zones/ route.ts (⏳ A faire)
│   │   ├── dashboard/
│   │   │   ├── page.tsx (⏳ A faire)
│   │   │   ├── market/ page.tsx (⏳ A faire)
│   │   │   ├── properties/[id]/ page.tsx (⏳ A faire)
│   │   │   ├── opportunities/ page.tsx (⏳ A faire)
│   │   │   └── rules/ page.tsx (⏳ A faire)
│   │   └── outils/ (✅ Existant)
│   ├── lib/
│   │   ├── supabase.ts (✅ Termine)
│   │   ├── stream-estate.ts (✅ Termine)
│   │   └── env.ts (✅ Termine)
│   └── types/
│       └── supabase.ts (✅ Termine)
├── docs/
│   ├── MEMOIRE_SESSION.md (✅ Existant)
│   ├── SUIVI_PROJET.md (✅ Cree)
│   └── CAHIER_DES_CHARGES.md (📌 Ce fichier)
└── supabase/
    ├── seed.sql (✅ Cree)
    └── migrations/ (📌 A creer si besoin)

## 7. SECURITE & RGPD

### 7.1 Donnees Sensibles

| Donnee | Stockage | Chiffrement | Acces | Duree de Conservation |
|--------|---------|-------------|-------|----------------------|
| Coordonnees clients | Supabase (prospects) | Oui (PostgreSQL) | Alexandre uniquement | 2 ans |
| Adresses biens | Supabase (market_properties) | Oui | Alexandre + API | 5 ans |
| Regles metier | Supabase (management_rules) | Oui | Alexandre | Illimite |
| Cles API | Vercel (Variables d env) | Oui | Alexandre | Illimite |

### 7.2 Bonnes Pratiques
- Ne jamais commiter de cles API dans le repo GitHub
- Utiliser supabaseAdmin (service_role) uniquement dans les API Routes
- Masquer les donnees sensibles dans les logs
- RGPD : Ajouter une mention dans la politique de confidentialite

## 8. ANNEXES

### 8.1 Glossaire

| Terme | Definition |
|-------|------------|
| Mandat OS | Outil de suivi intelligent du marche immobilier pour Alexandre |
| Stream Estate | API fournissant des donnees immobilières |
| Supabase | Base de donnees PostgreSQL + Auth + Storage |
| TanStack Table | Librairie pour tables avancees |
| DPE | Diagnostic de Performance Energetique (A a G) |
| IAD | Reseau immobilier auquel appartient Alexandre |

### 8.2 Contacts

| Role | Nom | Email | Linear |
|------|-----|-------|--------|
| Client | Alexandre Lopez | alexandre.lopez@iadfrance.fr | @alexlopez |
| Dev | Work (IA) | - | - |

### 8.3 Ressources Utiles
- Repo GitHub: alexlopez-studio/site-alex-lopez-provence
- Supabase: https://byrsmbgfkvgxdtdyhrro.supabase.co
- Vercel: https://vercel.com/alexlopez-studio/site-alex-lopez-provence
- Linear: https://linear.app
- Stream Estate: https://www.streamestate.fr

## 9. VALIDATION & PROCHAINES ETAPES

### 9.1 Validation

| Etape | Responsable | Date | Statut |
|-------|-------------|------|--------|
| Redaction Cahier des Charges | Work (IA) | 09/06/2026 | ✅ Done |
| Validation par Alexandre | Alexandre Lopez | A completer | ⏳ Todo |
| Creation des issues Linear | Work | 09/06/2026 | ✅ Done |
| Configuration GitHub Projects | Work | A completer | ⏳ Todo |

### 9.2 Prochaines Actions
1. Valider ce cahier des charges avec Alexandre
2. Configurer GitHub Projects pour un suivi visuel
3. Demarrer le Lot 2 (API Backend) en priorite

## 10. EXPORT POUR WORK

Voir le fichier SUIVI_PROJET.md pour les instructions detaillees.
