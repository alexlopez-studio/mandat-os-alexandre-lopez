# Audit photos — alexlopez-provence.fr

Date : 17 mai 2026  
Branche de travail : `feat/photo-audit-step1` → `preview`

## Objectif

Renforcer la cohérence visuelle du site autour d’un univers plus local, immobilier et premium : Provence Verte & Verdon, villages, rues, maisons, façades, bâti provençal, avec le portrait d’Alexandre comme élément de confiance.

## Principes validés

- Priorité aux villages, rues, maisons, façades et détails de bâti.
- Les paysages Verdon / lavandes / vignes restent possibles, mais seulement en respiration.
- Éviter les images hors territoire ou trop Côte d’Azur.
- Ne pas surutiliser les mêmes images d’une page à l’autre.
- Ne pas enchaîner deux sections image au scroll : une section éditoriale / contenu doit séparer deux grands visuels.
- Optimiser les images lourdes avant usage intensif.
- Limiter fortement le portrait d’Alexandre : il doit créer de la confiance, pas devenir une répétition sur chaque page.
- Les visuels de hero secondaires doivent être **full bleed** : la photo recouvre toute la section, avec un overlay sombre et le contenu posé dessus. Pas d’image en encadré.

## Inventaire initial

| Image | Poids approx. | Diagnostic | Action recommandée |
| --- | ---: | --- | --- |
| `alexandre-lopez-no-background.png` | 1,16 Mo | Très pertinent pour la confiance, mais trop répétitif si présent sur toutes les pages | Garder surtout pour la homepage ; retirer des pages secondaires |
| `alexandre-lopez.jpg` | 1,95 Mo | Portrait potentiellement utile, lourd | Évaluer visuellement, compresser si gardé |
| `alexandre-lopez-face.jpg` | 2,42 Mo | Redondant et lourd | Archiver ou compresser fortement |
| `village-cotignac.jpg` | 3,35 Mo | Très local, très pertinent, mais trop répété | Garder comme image territoire principale, optimiser |
| `maison-bleue-cotignac.jpg` | 1,70 Mo | Excellent asset immobilier / village | Garder, optimiser, utiliser pour habitat / achat / audit transitoire |
| `vignobles-var.jpg` | 2,06 Mo | Joli mais trop paysage pour l’audit | Remplacer sur `/audit` |
| `lver-south-4790158_1920.jpg` | 955 Ko | Ambiance Provence correcte, peu incarnée | Remplacer à terme sur `/a-propos` |
| `gorges-du-verdon.jpg` | 3,35 Mo | Très territoire, mais touristique et lourd | Usage ponctuel uniquement, optimisation obligatoire |
| `lavandes-proche.jpg` | 1,69 Mo | Provence générique | Usage secondaire |
| `geertd-lavende-2287924_1920.jpg` | 844 Ko | Provence générique | Usage secondaire ou archive |
| `hans-olive-tree-1595493_1920.jpg` | 1,19 Mo | Ambiance locale possible, peu immobilier | Usage secondaire |
| `Saint-Tropez.jpg` | 1,99 Mo | Hors territoire, trop littoral | Ne pas utiliser sur le site public |

## Changement lot 1

- `/audit` ne s’appuie plus sur `vignobles-var.jpg`.
- Le visuel audit passe temporairement sur `maison-bleue-cotignac.jpg`, plus cohérent avec le bâti, la maison et la décision immobilière.
- `next.config.ts` autorise désormais `images.pexels.com` et `cdn.pixabay.com` pour faciliter des tests de visuels gratuits en remote si nécessaire.

## Changement lot 2 — correction après retour

- Le portrait d’Alexandre est retiré des heroes secondaires : `/vendre`, `/acheter`, `/audit`, `/a-propos`, `/contact`.
- Le portrait reste surtout utile sur la homepage, où il crée un premier lien humain.
- Chaque page éditoriale reçoit maintenant un visuel hero différent :
  - `/vendre` : maison / extérieur de bien, source Pexels.
  - `/acheter` : maison de village provençale, source Pexels.
  - `/audit` : façade / maison à observer, source Pexels.
  - `/a-propos` : rue / bâtiments provençaux, source Pexels + maison de Cotignac en section parcours.
  - `/contact` : ambiance village / proximité, source Pexels.
- Les visuels de hero recouvrent maintenant toute la section : suppression de l’image en encadré, ajout d’overlays pour garder la lisibilité du texte.
- Les visuels éditoriaux distinguent maintenant image de hero et image de section, pour éviter le même rendu répété dans une page.
- Les sections image ne sont plus enchaînées directement : une section de contenu sépare les grands visuels.
- Les choix sont centralisés dans `src/lib/site-visuals.ts` avec source, crédit et usage recommandé.

## Shortlist gratuite utilisée / testée

### Habitat / immobilier

- https://www.pexels.com/photo/exterior-of-a-house-13935476/
- https://www.pexels.com/photo/charming-rustic-house-in-provence-france-32802440/
- https://www.pexels.com/photo/charming-provence-house-with-green-shutters-36403734/

### Villages / rues provençales

- https://www.pexels.com/photo/charming-buildings-in-provence-alpes-cote-d-azur-29864399/
- https://pixabay.com/images/search/village%20de%20provence/

### Verdon / territoire

- https://pixabay.com/images/search/verdon/
- https://pixabay.com/photos/esparron-de-verdon-lake-provence-5358921/
- https://pixabay.com/photos/france-the-gorge-of-verdon-3234611/

## Prochain lot recommandé

1. Vérifier le rendu réel des images Pexels dans la preview.
2. Télécharger les meilleures images retenues et les servir localement plutôt qu’en remote.
3. Les convertir en WebP optimisé.
4. Diversifier ensuite la homepage sans multiplier les paysages génériques.
