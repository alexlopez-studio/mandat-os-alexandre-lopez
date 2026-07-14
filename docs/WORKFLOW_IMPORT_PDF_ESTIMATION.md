# Workflow — Import d'un PDF d'estimation → Supabase → affichage Mandat OS

> But : à partir d'un **PDF de rapport d'estimation immobilier** (modèle iad / « Avis de valeur »),
> extraire les données, les mapper dans la structure attendue par l'app, et les écrire dans Supabase
> pour qu'elles s'affichent (fiche opportunité admin + portail client vendeur).
>
> Ce workflow est aujourd'hui **exécuté à la demande par Claude via MCP** (pas encore une feature
> in-app). Ce document sert de mémoire de procédure : toute session peut le relire et refaire
> exactement les mêmes étapes.

---

## 1. Cible Supabase

- **Projet** : `Site web Alexandre Lopez` — ref **`byrsmbgfkvgxdtdyhrro`** (région eu-west-1, `ACTIVE_HEALTHY`).
  - ⚠️ Deux autres projets existent (`app-alex-lopez-provence` `tnlrqtfqnyaptazpzmot`, `supabase-alex-lopez-provence` `abegeohipftoquzpwbcm`) mais sont **en pause** et ne portent pas les données de l'app. Toujours vérifier que le projet contient la table `opportunities` avant d'écrire.
- **Tables concernées** :
  - `opportunities` — colonnes clés : `property_snapshot` (jsonb), `professional_opinion` (jsonb), + `title`, `seller_name`, `property_address`, `property_city`, `property_zipcode`, `stage`, `lead_id`…
  - `client_dossiers` — lié par `opportunity_id` ; mêmes colonnes jsonb `property_snapshot` / `professional_opinion`. **C'est ce que lit le portail client.**
  - `seller_properties` — optionnel (`prix_estime`).

---

## 2. Extraction du texte du PDF

Le PDF iad a une **vraie couche texte** (polices sous-ensembles LiberationSans + CMaps `ToUnicode`),
mais **pas** de texte ASCII brut.

- ✅ Utiliser un vrai extracteur : **PyMuPDF** (`pip install pymupdf`) puis `page.get_text("text")`,
  ou `pdftotext` (poppler-utils).
- ❌ **Ne pas** tenter une extraction « maison » via `zlib` + regex sur les opérateurs `Tj/TJ` :
  les codes de glyphes des polices sous-ensembles ne sont pas de l'ASCII → sortie illisible.
- Le rendu PDF natif de l'outil Read échoue ici (nécessite `pdftoppm`/poppler non installé) — passer
  directement par PyMuPDF.

Script de référence (12 pages, ~15 k caractères pour l'exemple Verger) :
```python
import fitz  # pymupdf
doc = fitz.open(chemin_pdf)
texte = "\n".join(f"===== PAGE {i+1} =====\n" + p.get_text("text") for i, p in enumerate(doc))
```

---

## 3. Mapping vers la structure de l'app

La structure cible est **exactement** celle produite par `normalizeProfessionalDraft()` dans
`src/app/admin/market/opportunities/[id]/page.tsx` (≈ lignes 654-749). Ne pas inventer d'autres clés.

### `professional_opinion` (jsonb)
```
{
  price, price_suggested, price_low, price_high,   // nombres (€)
  summary,                                         // string
  arguments: [ ... ],                              // string[]  (points forts)
  comparables: [ { title, address, price, price_per_sqm, status, surface?, rooms?, bedrooms?, land_surface?, dpe?, date_label? }, ... ],
  price_trend: [ { period, change, median? }, ... ],   // graphe d'évolution du marché
  iad_report: {
    cover:       { title, subtitle, date, reference, recipient, context },
    advisor:     { name, phone, email },
    situation:   { commune, plan_note, cadastral_rows:[{section,prefixe,numero,superficie}], cadastral_total },
    property:    { title, stats:[{label,value}], strengths:[], objections:[] },
    market:      { basis, price_per_sqm_low/median/high, price_filter, evolution:[{period,change,median?}], sale_delay_fast/median/slow },
    competition: { criteria:[], methodology, retained_count, active_average_price(+_per_sqm), sold_average_price(+_per_sqm) },
    comparables: { sold:[...], average_per_sqm, low_per_sqm, high_per_sqm },
    positioning: { reference_price(+_per_sqm), cheaper_percent, larger_percent, cheaper_larger_percent,
                   competition_average_per_sqm, low/median/high_per_sqm, rank, rank_total,
                   threshold_low/median/high_price },
    conclusion:  { recommendations:[], text, legal_notice },
    iad_proof:   { sold_properties:[{title,address,price,price_per_sqm,note,date_label}], client_reviews:[{author,rating,title,content,date}] },
    services:    { advantages:[], services:[] }
  }
}
```

### `property_snapshot` (jsonb)
Clés lues par l'affichage portail (`buildSummary`, `portal-view.tsx`) et l'éditeur admin (`PropertyDraft`) :
`adresse, commune, type_bien, surface, surface_terrain, nb_pieces, dpe, equipements, contexte`,
+ pour l'éditeur : `mandate_number, mandate_type, etat, points_vigilance`.
Le jsonb est **souple** : des clés supplémentaires (`features`, `chambres`, `etages`,
`annee_construction`, `type_label`) sont tolérées et déjà présentes sur certains biens.

### Règles de mapping
- Nombres en `number` (pas de string), listes en tableaux, champs absents du PDF → `null` / `[]`.
- Correspondance des rubriques PDF iad → sections `iad_report` : couverture→cover, cadastre→situation,
  présentation→property, tendance marché→market, analyse concurrence→competition,
  comparables vendus→comparables, positionnement→positioning, conclusion→conclusion,
  nos biens vendus + avis→iad_proof, les + iad→services.

---

## 4. Écriture dans Supabase

1. Retrouver (ou créer) l'opportunité cible :
   ```sql
   select id, title, property_address from opportunities
   where seller_name ilike '%<nom>%' or property_address ilike '%<adresse>%';
   ```
2. **Faire relire le JSON mappé à Alexandre avant d'écrire** (garde-fou anti-erreur d'extraction).
3. **Ne jamais écraser aveuglément** : si `property_snapshot` / `professional_opinion` sont déjà
   remplis, comparer d'abord. La version en base peut être **plus complète** que la ré-extraction
   (ex. valeurs du graphe de marché, détail par comparable).
4. Écrire l'opportunité :
   ```sql
   update opportunities
   set property_snapshot = $1::jsonb, professional_opinion = $2::jsonb, updated_at = now()
   where id = '<opportunity_id>';
   ```
5. Répercuter sur le **dossier client lié** (sinon le portail n'affiche pas la MAJ). La logique app
   (`syncDossierFromOpportunity` dans `src/app/api/market/opportunities/[id]/route.ts`) fusionne en
   laissant l'opportunité gagner sur les clés partagées. En SQL direct, faire l'équivalent :
   ```sql
   update client_dossiers d
   set property_snapshot   = coalesce(d.property_snapshot,'{}'::jsonb)   || o.property_snapshot,
       professional_opinion = coalesce(d.professional_opinion,'{}'::jsonb) || o.professional_opinion,
       updated_at = now()
   from opportunities o
   where d.opportunity_id = o.id and o.id = '<opportunity_id>';
   ```

---

## 5. Affichage (aucun code à écrire — déjà en place)

- **Portail client vendeur** : `src/app/espace-client/portal-view.tsx`
  - `buildSummary` / `buildEstimate` (≈ l.2604-2687) lisent `property_snapshot` + `professional_opinion`.
  - `IadReportSections` (≈ l.605-778) rend les 11 sections `iad_report`.
- **Éditeur admin** : `src/app/admin/market/opportunities/[id]/page.tsx` (formulaire pré-rempli,
  sauvegarde via `PATCH /api/market/opportunities/[id]`).
- Vérification : `select property_snapshot, professional_opinion from opportunities where id = '...';`
  puis ouvrir la fiche `/app/opportunities/<id>` et la preview portail.

> Note : booter l'app authentifiée en sandbox nécessite `SUPABASE_SERVICE_ROLE_KEY` (non exposée par
> le MCP) + une session de connexion → la vérification visuelle « live » n'est pas possible sans ces
> accès ; la vérification par contrôle du contrat données↔affichage (clés lues par le code) suffit.

---

## 6. Cas d'exemple traité — Verger

- PDF : « Votre estimation Alain et Yvette VERGER » (Maison 125 m², 30 Bd des Catacholis, 13011 Marseille).
- Déjà intégré (le 10/07/2026) : opportunité `116b26d6-c024-43d5-ab0b-2dcd2032b9a1`
  + dossier client `54da3ceb-9004-4d4e-b134-81e12a758234` (les deux `property_snapshot` +
  `professional_opinion` complets). Prix 400 000 € (400–420 k).

---

## 7. Rattachement d'une réunion Granola (workflow connexe)

Table dédiée **`opportunity_meeting_links`** (créée dans `byrsmbgfkvgxdtdyhrro`) :
`opportunity_id, source('granola'), meeting_id, meeting_title, meeting_date, meeting_url,
match_score, match_reasons(jsonb), confirmed_by, confirmed_at`.

Procédure (à la demande, via MCP, **validation manuelle**) :
1. Lister les réunions Granola récentes (`list_meetings`) et/ou `query_granola_meetings`.
2. Scorer contre l'opportunité : nom vendeur / adresse-ville / proximité de date.
3. Proposer le top 1-3 → Alexandre **confirme**.
4. Insérer la ligne confirmée dans `opportunity_meeting_links`.

⚠️ **Limite Granola** : le plan actuel ne donne accès qu'aux réunions des **30 derniers jours**. Les
RDV plus anciens (ex. la visite Verger) ne sont pas rattachables tant qu'ils sont hors fenêtre.

---

## 8. Industrialisation (prochaine étape possible, non faite)

Transformer ce workflow manuel en **feature in-app** : bouton « Importer un PDF d'estimation » →
`POST /api/market/opportunities/[id]/import-pdf` (upload bucket `client-documents`, extraction texte,
mapping IA via `src/lib/ai/gateway.ts`, validation zod, pré-remplissage de l'éditeur pour relecture).
