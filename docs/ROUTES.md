# Routes Mandat OS

## Architecture cible domaines

Decision du 12/07/2026 :

- Site public : repo `site-alex-lopez-provence`, domaine `alexandrelopez.fr`.
- Portail client : repo `espace-client-alexandre-lopez`, domaine `espace.alexandrelopez.fr`.
- Mandat OS : repo `mandat-os-alexandre-lopez`, domaine `app.alexandrelopez.fr`.

Ce repo porte uniquement Mandat OS et les APIs metier associees.

## Routes applicatives

| Route | Description |
|-------|-------------|
| `/` | Redirection vers `/app/dashboard` |
| `/app/dashboard` | Vue d'ensemble Mandat OS |
| `/app/radar` | Supprime — redirige vers `/app/properties` |
| `/app/contacts` | Annuaire unifie : vendeurs, acquereurs, partenaires pro, reseau |
| `/app/contacts/[id]` | Detail contact (projets rattaches + historique) |
| `/app/leads` | Supprime — redirige vers `/app/contacts` |
| `/app/clients` | Dossiers clients vendeurs et acquereurs |
| `/app/clients/[id]` | Detail dossier client |
| `/app/clients/[id]/preview` | Preview admin du portail client |
| `/app/liste-chaude` | Reseau relationnel |
| `/app/properties` | Biens du marche |
| `/app/properties/[id]` | Detail d'un bien |
| `/app/acheteurs` | Acquereurs |
| `/app/acheteurs/[id]` | Detail acquereur |
| `/app/acheteurs/nouveau` | Creation acquereur |
| `/app/matching` | Matching biens / acquereurs |
| `/app/opportunities` | Opportunites vendeurs et acquereurs |
| `/app/opportunities/[id]` | Detail opportunite |
| `/app/rules` | Regles d'automatisation |
| `/app/rules/new` | Creation de regle |
| `/app/notifications` | Notifications |
| `/app/settings` | Parametres, sync, IA et integrations |
| `/app/utilisateurs` | Gestion utilisateurs admin |

## Routes historiques

Ces routes restent conservees en redirection/rewrite pour compatibilite :

| Ancienne route | Nouvelle route |
|----------------|----------------|
| `/admin/market` | `/app/dashboard` |
| `/admin/market/:path*` | `/app/:path*` |
| `/dashboard` | `/app/dashboard` |
| `/dashboard/radar` | `/app/properties` |
| `/app/radar` | `/app/properties` |
| `/app/dashboard/radar` | `/app/properties` |
| `/app/dashboard/:path+` | `/app/:path*` |

## APIs principales

| Prefixe | Usage |
|---------|-------|
| `/api/admin/*` | Auth admin, bootstrap, utilisateurs |
| `/api/market/*` | Donnees Mandat OS, opportunites, biens, clients, sync |
| `/api/market/projects` | Liste unifiee des projets (vente + achat) pour `/app/opportunities` |
| `/api/market/projects/[id]` | Detail et mise a jour d'un projet (etape kanban) |
| `/api/market/contacts/search` | Annuaire contacts avec filtre de typologie |
| `/api/ai/*` | Assistant IA et credentials |
| `/api/jobs/*` | Jobs et crons |
| `/api/leads/*` | Gestion des leads relies aux opportunites |
