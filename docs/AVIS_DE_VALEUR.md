# Avis de valeur A4

Rapport d'estimation A4 généré depuis les données de Mandat OS et destiné au
papier. Il remplace la sortie Yanport et le prototype React issu d'AI Studio.

Route : `/admin/avis-de-valeur/[opportunityId]` — accessible depuis le bloc
« Estimation & avis de valeur » de la fiche opportunité.

## Documents de référence

Trois textes font foi, et aucun ne vit dans ce repo :

| Document | Ce qu'il fixe |
|---|---|
| `specification_rapport.md` | Le plan, la spécification page par page, les corrections obligatoires |
| `note_methode_estimation.md` | La méthode d'estimation et les règles de rédaction |
| Skill `finalisation-avis-valeur` | La méthode complète, source unique partagée avec la chaîne Word |

La méthode n'est **pas** dupliquée ici : ce fichier la résume pour le lecteur du
code, la référence reste la skill. Si les deux divergent, c'est la skill qui a
raison et ce fichier qui est à corriger.

---

## Le plan

**11 pages socle**, plus des pages activées selon la situation du vendeur. Le
document n'a pas un nombre de pages fixe : la majorité des dossiers sont des
projets de vente déjà arbitrés, leur servir une page « faut-il vendre ou
conserver ? » est hors sujet.

Narration : le bien → le marché → le prix → l'argent → comment je vends → qui je suis.

| # | Page | # | Page |
|---|---|---|---|
| 1 | Couverture | 7 | Synthèse des prix |
| 2 | Le bien | 8 | Analyse patrimoniale |
| 3 | Performance énergétique | — | *Vendre ou conserver* (optionnelle) |
| 4 | Le marché | 9 | Stratégie de mise en vente |
| 5 | Tension du marché | 10 | Conclusion & avis de valeur |
| 6 | Biens comparables | 11 | Engagements & conseiller |

Le plan vit dans `src/components/avis-de-valeur/page-registry.ts`. Une page
optionnelle déclare un `includeWhen` lu sur `meta.flags`, alimenté par
`opportunities.professional_opinion->'flags'` — la détection propose, le
conseiller décide.

**Aucun composant ne connaît son numéro.** Il le reçoit du document, calculé
depuis la liste filtrée. C'est la condition pour qu'insérer une page ne décale
pas silencieusement toute la numérotation et ne fasse pas échouer le contrôle de
séquence.

---

## 1. Le principe qui structure tout le document

**Les prix affichés ne sont pas les prix payés.**

- `market_properties` → ce que les vendeurs *demandent*.
- `dvf_transactions` → ce que les acquéreurs ont *payé*. Seule référence opposable.

Les deux ne sont jamais mélangés dans un même graphique. Ils sont présentés côte
à côte en page 4, et c'est cet écart qui porte l'argument commercial : un rapport
qui n'afficherait que la sortie du moteur d'estimation enverrait le vendeur
au-devant de plusieurs mois de vitrine.

Vérifié sur Cotignac (INSEE 83046, données réelles importées) : la médiane des
comparables DVF ressort à 2 681 €/m², contre un prix retenu à 3 414 €/m². L'écart
est visible dans le rapport, pas dissimulé dans une moyenne.

---

## 2. Architecture

```
opportunities ─┐
seller_properties ─┼─→ buildAvisDeValeur(opportunityId) ─→ AvisDeValeur ─→ <AvisDeValeurDocument/>
dvf_transactions ─┤
market_properties ┘
```

| Fichier | Rôle |
|---|---|
| `src/lib/avis-de-valeur/types.ts` | Type racine `AvisDeValeur` et ses sous-types |
| `src/lib/avis-de-valeur/build.ts` | Assemblage serveur, point d'entrée unique |
| `src/lib/avis-de-valeur/market-analysis.ts` | Méthode d'estimation, fonctions pures |
| `src/lib/avis-de-valeur/layout-guards.ts` | Règles de mise en page, fonctions pures |
| `src/lib/avis-de-valeur/advisor.ts` | Constantes conseiller et mentions légales |
| `src/lib/avis-de-valeur/geocode.ts` | Géocodage BAN de secours, pour le plan de situation |
| `src/components/avis-de-valeur/page-registry.ts` | Le plan : ordre, pages optionnelles, conditions |
| `src/components/avis-de-valeur/pages/` | Les pages, sans aucune donnée ni numéro en dur |
| `supabase/migrations/032_avis_de_valeur_dvf.sql` | Fonctions d'agrégation DVF |

Aucune page n'accède aux données autrement que par la prop `avis`. Le document
est donc rendu identiquement quelle que soit la source des chiffres, ce qui rend
les tests possibles et les régressions visibles.

---

## 3. Les règles de méthode encodées dans le code

Elles ne sont pas décoratives : chacune est implémentée et testée
(`src/lib/__tests__/avis-de-valeur-market-analysis.test.ts`, 20 tests).

**Segmenter avant de médianiser.** Sur les petites surfaces le marché est
bimodal : bâti ancien d'un côté, biens rénovés ou bien situés de l'autre, avec un
vide entre les deux. `detectSegments()` cherche la plus grande rupture dans le
cœur de la distribution (entre 1er et 3e quartile, pour ne pas confondre une
queue avec une frontière) et ne segmente que si l'écart dépasse 12 % de la
médiane. Une médiane communale globale tomberait dans le vide, là où rien ne se
vend.

**La segmentation porte sur le segment comparable, pas sur la commune.** Elle est
calculée sur les mutations de surface ±35 % et d'emprise foncière comparable —
sinon on opposerait des studios de village à des mas sur plusieurs hectares.

**Encadrer le terrain, pas seulement le plafonner.** Un 65 m² sur 800 m² n'est
comparable ni à un 65 m² sur 40 m², ni l'inverse. La bande est dérivée de
l'emprise du bien lui-même (0,4× à 2,2×), pas figée à 350 m².

**Réactualiser les comparables.** Une vente de 2023 est corrigée de la dérive du
prix médian communal avant d'être présentée. La colonne « Actualisé » du tableau
page 6 montre les deux valeurs.

**Mesurer la tension par les volumes.** La DVF ne contient pas de délai de vente.
La rotation du parc — part du stock communal vendue chaque année — en tient lieu :
un marché s'ajuste d'abord par les volumes, ensuite seulement par les prix. Aucun
délai de vente n'est affiché sauf saisie manuelle avec sa source.

**Ne jamais inventer.** Le capital restant dû est laissé en blanc, avec renvoi au
relevé annuel de prêt. Le DPE affiché est celui du diagnostic en vigueur, jamais
un classement projeté après travaux. Les valeurs manquantes s'écrivent « — ».

**Charte.** Le prix est en cyan ; le corail iad est réservé aux alertes et aux
variations négatives. Pas de titre en cyan pur sur blanc (contraste 2,4:1) : les
titres utilisent `#008EC3` ou `#006390`.

---

## 4. Garde-fous de mise en page

Un document A4 se casse en silence. `LayoutGuard` mesure chaque page dans le
navigateur et affiche les infractions au-dessus du rapport, avant impression :

| Contrôle | Règle |
|---|---|
| Format | 210 × 297 mm à 0,5 mm près |
| Débordement | aucun contenu sous la limite utilisable |
| Zone d'impression | aucune encre à moins de 12 mm d'un bord, hors couverture |
| Pied de page | présent sur toute page hors couverture |
| Alignement | filet à la même hauteur au millimètre près sur toutes les pages |
| Numérotation | continue, sans trou ni doublon |
| Remplissage | alerte sous 45 % de la zone utile |

⚠ La skill `avis-de-valeur` fixe la zone d'impression à **10 mm** et
`specification_rapport.md` à **12 mm**. Mandat OS applique 12 mm. À arbitrer :
les deux documents ne peuvent pas avoir raison.

Deux défauts du prototype AI Studio sont corrigés à la racine : le pied de page
est positionné en absolu à 12 mm du bas (et non poussé par `mt-auto`, dont la
position dépendait de la hauteur du contenu), et le corps de page ne masque plus
son débordement — un `overflow:hidden` supprimait une ligne sans prévenir.

La logique est testée sans navigateur
(`src/lib/__tests__/avis-de-valeur-layout-guards.test.ts`, 9 tests), et le plan
l'est aussi (`avis-de-valeur-pages.test.ts`, 7 tests : ordre, insertion de la
page optionnelle, renumérotation).

Reste à faire, demandé par le §8 de la spécification : porter ces contrôles en
CI Playwright sur le PDF imprimé, avec **échec bloquant** et régression visuelle
contre une capture de référence. Aujourd'hui le contrôle est fait dans la page,
à l'écran : il prévient le conseiller, il ne bloque pas un build.

---

## 5. Ce qui reste à faire

1. **Parc de logements par commune.** `dvf_communes.housing_stock_houses` est vide.
   Sans lui, la rotation du parc — l'indicateur de tension le plus solide — ne se
   calcule pas et le rapport se rabat sur les variations annuelles. Source INSEE,
   à renseigner commune par commune.
2. **Bornes d'écrêtage par commune.** `price_m2_floor` / `price_m2_ceiling` sont
   nuls, donc les valeurs par défaut (800 / 8 000 €/m²) s'appliquent. À calibrer
   sur les communes travaillées.
3. **Migration 032 en production.** Appliquée sur `ntlbforzrdmeifpzfjtk` (preview)
   uniquement. À appliquer sur `byrsmbgfkvgxdtdyhrro`.
4. **Photo du bien en couverture.** Lue dans `property_snapshot.hero_image_url`.
5. **Espace client.** Le rapport n'est pour l'instant servi qu'en interne. Le
   servir en lecture seule via `client_dossiers.public_token` reste à faire.
   ⚠ Prérequis de sécurité signalé au §10 de la spécification : **RLS désactivé**
   sur `market_property_sources` et `market_property_duplicate_candidates`.
6. **Plan cadastral IGN**, via `src/lib/cadastre.ts` déjà présent.
7. **Couverture** : la spécification demande trois champs (à l'attention de /
   établi le / visite), un encadré « document d'information non contractuel »,
   quatre tuiles KPI et un paragraphe de méthode. La couverture actuelle garde la
   composition du prototype — écart assumé, le design prime.
8. **`EditorModal`**, listé au §5 des composants à conserver : non porté. Les
   corrections passent aujourd'hui par la fiche opportunité.
