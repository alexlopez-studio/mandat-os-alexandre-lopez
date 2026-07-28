# Avis de valeur — plan d'exécution

État au 28/07/2026. Complète `AVIS_DE_VALEUR.md` (l'architecture) et
`specification_rapport.md` (le cahier des charges).

**Règle de progression** : ne pas entamer un lot avant que le critère de
validation du précédent soit vert. Brancher une couche sur une base non validée
revient à déboguer deux choses à la fois.

---

## Déjà fait et vérifié

| | Preuve |
|---|---|
| Fonctions SQL DVF + `buildAvisDeValeur()` | JSON complet sur l'opportunité Cotignac, données réelles |
| Purge des données fictives, passage en props | plus aucune donnée en dur dans les pages |
| Pied de page fixe, polices locales | pied à 12 mm identique sur toutes les pages, mesuré |
| Plan 11 pages + page optionnelle | 11 pages sans drapeau, 12 avec `hesite_location`, séquence intacte |
| Numérotation calculée | plus aucun `pageNumber={n}` ni `TOTAL_PAGES` |
| Garde-fous de mise en page | contrôle en page, aucun débordement sur les 12 pages |
| Méthode d'estimation | 36 tests verts, `+0,4 %` de Cotignac reproduit |

Reste **l'étape 5** de l'ordre de travail : le vendeur voit son avis.

---

## Lot 0 — Réparer la skill `avis-de-valeur`

Hors repo. Court, et prioritaire si une estimation est prévue : **la skill ne
peut pas générer en l'état**.

- [ ] Déballer `generateur_avis_de_valeur.zip` dans `skills/avis-de-valeur/scripts/`
      (`gen.py`, `charts.py`, `theme.py`, `cablage.py`, `garde_fous.py`)
- [ ] Supprimer `scripts/gen_avis_word.js` — le SKILL.md l'interdit déjà
- [ ] Supprimer ou réécrire `references/design.md`, marqué obsolète mais toujours livré
- [ ] Relire `references/plan.md` et `exemple_data.json`, antérieurs à la refonte
- [ ] Vérifier que le renvoi vers `finalisation-avis-valeur` pour la méthode reste exact

**Validation** : une estimation lancée depuis la skill produit un PDF sans erreur.

---

## Lot 1 — Sécurité, prérequis de l'Espace client

Constaté en base : RLS désactivé et **zéro policy** sur deux tables.

- [ ] Migration : `enable row level security` sur `market_property_sources` et
      `market_property_duplicate_candidates`
- [ ] Policies service-role, alignées sur les autres tables `market_*`
- [ ] Vérifier qu'aucun code exposé au client ne lit ces deux tables
- [ ] Appliquer sur preview, puis sur production

**Validation** : la requête de contrôle RLS ne renvoie plus aucune table à
`rls_enabled = false` dans `public`.

> Ne pas ouvrir le lot 2 avant que celui-ci soit vert.

---

## Lot 2 — Le vendeur voit son avis (étape 5 de la spécification)

Le seul lot qui produise de la valeur côté client.

**2.1 Tracer la génération**
- [ ] À chaque génération, insérer dans `estimation_imports` :
      `kind = 'avis_de_valeur'`, `source = 'mandat_os'`, `status = 'draft'`,
      payload = l'objet `AvisDeValeur` complet
- [ ] Incrémenter `meta.version` à chaque régénération

**2.2 Remettre l'avis**
- [ ] Action « Remettre l'avis de valeur » sur la fiche opportunité
- [ ] Écrire `opportunities` : `professional_opinion`, `estimated_price_min/max`,
      `report_delivered_at`
- [ ] Recopier vers `client_dossiers` : `professional_opinion`, `property_snapshot`
- [ ] Refuser la remise tant qu'il reste un avertissement bloquant
      (prix retenu absent, aucune vente comparable)

**2.3 Servir au vendeur**
- [ ] Route publique en lecture seule via `client_dossiers.public_token`
- [ ] Réutiliser `AvisDeValeurDocument` tel quel — **sans** `ReportToolbar` ni
      `LayoutGuard`, qui s'adressent au conseiller
- [ ] Bouton d'impression PDF côté vendeur
- [ ] Vérifier qu'un token invalide ou révoqué ne rend rien

**2.4 Tests**
- [ ] Remise → le dossier client porte bien l'avis
- [ ] Token valide → 200, token inconnu → 404
- [ ] Aucun avertissement interne visible dans le rendu vendeur

**Validation** : depuis un lien `public_token`, le vendeur lit son avis de valeur
complet, sans pièce jointe et sans rien voir des mentions internes.

---

## Lot 3 — Rendre les données exploitables ailleurs qu'à Cotignac

Sans ce lot, le rapport est juste mais muet sur les autres communes.

- [ ] `dvf_communes.housing_stock_houses` par commune (source INSEE) —
      **débloque la rotation du parc**, aujourd'hui affichée « — »
- [ ] Étudier l'automatisation depuis les données INSEE plutôt qu'une saisie
      commune par commune
- [ ] `price_m2_floor` / `price_m2_ceiling` par commune — les valeurs par défaut
      (800 / 8 000 €/m²) sont des garde-corps, pas un calibrage
- [ ] Délais de vente : décider de la source, la citer, la saisir
- [ ] Appliquer la migration 032 en **production** (absente aujourd'hui)
- [ ] Importer le DVF des communes travaillées en production — elle ne contient
      que 812 mutations, le rapport y sortirait vide

**Validation** : un avis de valeur généré sur une commune autre que Cotignac
affiche rotation, distribution et comparables sans aucun « — » de données.

---

## Lot 4 — Garde-fous en CI

Aujourd'hui le contrôle prévient à l'écran ; il ne bloque pas un build.

- [ ] `playwright.config.ts` (le script `test:e2e` existe déjà, la config non)
- [ ] Spec : impression PDF, rendu en image, les 7 contrôles du §8
- [ ] **Échec bloquant**, pas un avertissement
- [ ] Captures de référence par page + régression visuelle
- [ ] Rejouer sur un dossier avec page optionnelle activée
- [ ] Brancher sur la CI

**Validation** : un débordement introduit volontairement fait échouer le build.

---

## Lot 5 — Conformité et finitions

- [ ] Couverture : trois champs, encadré « document non contractuel », quatre
      tuiles KPI, paragraphe de méthode — **ou** décision assumée de garder la
      composition actuelle
- [ ] `EditorModal` : porter, ou acter que les corrections passent par la fiche
- [ ] Page « Le bien » à 24 % de remplissage sur un dossier peu renseigné
- [ ] Lien Immodvisor réel, ou suppression définitive du bloc note client
- [ ] La visite virtuelle est-elle réellement proposée ?
- [ ] RSAC et RCP pour la version longue des mentions légales

---

## Décisions qui n'appartiennent qu'à Alexandre

| Question | Enjeu |
|---|---|
| **11 ou 12 pages ?** | Le SKILL.md annonce 11 et en liste 12. L'écart est la page « Les biens en concurrence », aujourd'hui intégrée à la page Stratégie dans Mandat OS |
| **Marge d'impression : 10 ou 12 mm ?** | Le SKILL.md dit 10, la spécification dit 12, Mandat OS applique 12 |
| **Couverture** | Suivre la spécification, ou garder le design établi |
| **Thème prestige** | Existe dans la skill, pas dans Mandat OS. À porter ou à réserver à la chaîne Word |

---

## Ordre recommandé

**Lot 1 → Lot 2** d'abord : c'est la suite de l'ordre de travail et la seule qui
serve le vendeur. **Lot 0** en coupe-file si une estimation est prévue dans les
jours qui viennent. **Lot 3** avant toute mise en production réelle. Les lots 4
et 5 suivent.
