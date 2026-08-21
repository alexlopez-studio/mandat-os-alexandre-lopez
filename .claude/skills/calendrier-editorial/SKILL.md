---
name: calendrier-editorial
description: Pilote le calendrier éditorial de Mandat OS à partir de la veille immobilière. Lit les articles collectés, propose des angles, écrit les déclinaisons (blog, LinkedIn, Instagram, Facebook, newsletter), les planifie et les corrige. Déclencher quand Alexandre demande « alimente le calendrier éditorial », « qu'est-ce que je poste cette semaine », « propose des sujets à partir de la veille », « replanifie ce post », « réécris ce post », ou fournit un article à transformer en publication.
---

# Calendrier éditorial

Tout part de la veille. Un article collecté devient un **angle**, l'angle se décline
en **posts** datés par canal. La chaîne se lit en base :
`news_items` → `content_angles` → `content_posts`.

## Accès

Base URL : `https://app.alexandrelopez.fr` (ou `http://localhost:3000` en local).
Toutes les requêtes portent `Authorization: Bearer $EDITORIAL_API_KEY`.

Ne jamais écrire directement dans Supabase : les routes valident les statuts, les
canaux, les dates, et posent `published_at`. Un `INSERT` direct contourne tout ça.

## Le cycle

### 1. Lire la veille

```bash
curl -s -H "Authorization: Bearer $EDITORIAL_API_KEY" \
  "$BASE/api/market/news?status=inbox&limit=200"
```

`status=inbox` = les articles `new` + `reviewed`, c'est-à-dire ce qui n'est ni
classé ni archivé. Chaque article porte `category`, `relevance` (0-100),
`key_figure`, `city` / `insee_code`, et `confidence`
(`verified` / `external` / `hypothesis`).

**Un article à `confidence: hypothesis` ne sert jamais de source à un chiffre
avancé publiquement.** Il peut inspirer un angle, pas fournir une donnée.

### 2. Lire ce qui est déjà planifié

```bash
curl -s -H "Authorization: Bearer $EDITORIAL_API_KEY" \
  "$BASE/api/market/content/posts?from=2026-09-01T00:00:00Z&to=2026-09-30T23:59:59Z"
```

Toujours faire cette lecture **avant** de proposer : c'est ce qui évite de
surcharger une semaine, de doublonner un angle déjà traité, ou de programmer deux
posts LinkedIn le même matin.

Voir aussi ce qui attend d'être écrit :
`GET /api/market/content/posts?unscheduled=1`.

### 3. Proposer un angle et ses déclinaisons

Un seul appel crée l'angle et tous ses posts :

```bash
curl -s -X POST -H "Authorization: Bearer $EDITORIAL_API_KEY" \
  -H "Content-Type: application/json" \
  "$BASE/api/market/content/angles" -d '{
    "news_item_id": "<uuid de l article source>",
    "title": "Les taux repassent sous 3 % : ce que ça change à Barjols",
    "angle": "Traduire la baisse nationale en pouvoir d achat local concret.",
    "pillar": "taux",
    "city": "Barjols",
    "status": "planned",
    "created_by": "claude",
    "posts": [
      {
        "channel": "linkedin",
        "scheduled_for": "2026-09-17T08:00:00Z",
        "status": "ready",
        "title": "Taux sous 3 % : +18 000 € de capacité d achat",
        "hook": "Une baisse de 0,4 point, ce n est pas une ligne dans un journal.",
        "body": "…",
        "cta": "Vous vendez cette année ? Parlons-en.",
        "hashtags": ["#immobilier", "#ProvenceVerte"]
      }
    ]
  }'
```

Si un seul post est invalide, **rien** n'est créé : la route valide les
déclinaisons avant d'insérer l'angle, précisément pour ne pas laisser d'angle
orphelin. Corriger et rejouer l'appel entier.

Ajouter une déclinaison à un angle déjà créé : `POST /api/market/content/posts`
avec `angle_id`.

### 4. Corriger, replanifier

```bash
curl -s -X PATCH -H "Authorization: Bearer $EDITORIAL_API_KEY" \
  -H "Content-Type: application/json" \
  "$BASE/api/market/content/posts/<id>" \
  -d '{"body": "…", "scheduled_for": "2026-09-18T08:00:00Z", "status": "ready"}'
```

Champs modifiables : `channel`, `status`, `scheduled_for`, `title`, `body`,
`hook`, `cta`, `visual_brief`, `hashtags`, `seo_slug`, `seo_keyword`,
`seo_description`, `external_ref`, `external_url`.

`published_at` n'est jamais envoyé : le serveur l'horodate au passage en
`published`. `scheduled_for: null` sort le post du calendrier et le renvoie dans
« À produire ».

## Cadence cible

| Canal | Rythme | Statut à la création |
|---|---|---|
| LinkedIn | 2 / semaine — mardi et jeudi, 8h | `ready` si le texte est écrit, sinon `draft` |
| Instagram | 1-2 / semaine | `draft` tant que le visuel n'est pas décidé |
| Facebook | reprise d'Instagram, même semaine | `draft` |
| Blog | 2 / mois | `draft` — voir ci-dessous |
| Newsletter | 1 / mois, en fin de mois | `draft` |

Ne jamais programmer plus de deux posts le même jour, tous canaux confondus.
Un angle donne au maximum une publication par canal.

## Règles de fond

- **Ton et charte** : `docs/BRAND.md` fait autorité. Alexandre est conseiller iad
  en Provence Verte & Verdon ; il parle en praticien du terrain, pas en
  commentateur de marché.
- **Local d'abord** : une actualité nationale n'a d'intérêt que traduite pour
  Barjols, Cotignac, Brignoles, Saint-Maximin, Lorgues, Pontevès. Un post qui
  pourrait être publié par n'importe quel agent de France est à retravailler.
- **Chiffres sourcés** : tout chiffre avancé vient de l'article source ou des
  données DVF. Pas d'estimation inventée.
- **Le CTA vendeur** reste l'avis de valeur, jamais « contactez-moi » sec.

### Le canal `blog` est un brouillon, pas une publication

Le blog vit dans **Sanity**, servi par le repo `site-alex-lopez-provence` — pas
dans Mandat OS. Un post `channel: "blog"` produit donc un **brouillon markdown**
qu'Alexandre reprend dans Sanity :

- `body` en markdown ;
- `seo_slug`, `seo_keyword`, `seo_description` renseignés en visant un cluster
  d'intention de `docs/SEO_GEO_PLAN.md` (priorités P0 d'abord) ;
- une fois publié dans Sanity, poser `external_url` (et `external_ref` = id du
  document) puis `status: "published"`.

## Après avoir alimenté le calendrier

Résumer à Alexandre : combien d'angles créés, combien de posts, sur quelles
semaines, et ce qui reste à écrire. Le calendrier se relit dans l'app sur
`/app/editorial`.
