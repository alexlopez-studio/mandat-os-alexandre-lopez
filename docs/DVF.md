# Source DVF — estimation immobilière

## Objectif

Le moteur d’estimation utilise les données DVF pour récupérer des ventes comparables autour du bien estimé.

Cette couche doit rester robuste : si une source DVF est indisponible, l’estimation ne doit pas planter. Le moteur peut alors tenter une source secondaire ou revenir à son fallback métier.

## Source primaire actuelle

Par défaut, le site utilise l’endpoint Cerema configuré dans :

```plain text
DVF_PRIMARY_PROVIDER=cerema
DVF_CEREMA_API_URL=https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/
```

Le code ne dépend plus uniquement d’une constante codée en dur : l’URL et le fournisseur primaire sont configurables par variables d’environnement.

## Source secondaire

Une source secondaire peut être utilisée :

```plain text
DVF_ENABLE_FALLBACK=true
DVF_CQUEST_API_URL=https://api.cquest.org/dvf
```

La micro-API cquest est documentée publiquement, mais sa disponibilité n’est pas garantie. Elle sert donc uniquement de fallback opportuniste, pas de socle de production critique.

Référence : la page data.gouv indique explicitement que cette micro-API est une preuve de concept sans garantie de disponibilité.

## Variables disponibles

```plain text
DVF_PRIMARY_PROVIDER=cerema
DVF_ENABLE_FALLBACK=true
DVF_CEREMA_API_URL=https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/
DVF_CQUEST_API_URL=https://api.cquest.org/dvf
```

Valeurs possibles :

- `DVF_PRIMARY_PROVIDER=cerema` : source primaire Cerema ;
- `DVF_PRIMARY_PROVIDER=cquest` : source primaire cquest ;
- `DVF_ENABLE_FALLBACK=false` : désactive la source secondaire.

## Stratégie de robustesse

Le module `src/lib/dvf.ts` :

1. interroge la source primaire ;
2. normalise les formats de réponse courants :
   - `results[]` ;
   - `features[]` GeoJSON ;
   - tableau JSON direct ;
3. filtre les lignes inutilisables sans valeur foncière ou sans surface bâtie ;
4. loggue les erreurs / statuts HTTP non OK ;
5. tente cquest si Cerema ne renvoie rien et si le fallback est activé ;
6. renvoie `[]` si aucune source ne répond.

Le moteur d’estimation sait déjà gérer `[]` en basculant sur son fallback métier.

## Point important production

Pour une vraie production durable, la meilleure solution reste de ne pas dépendre d’une micro-API publique non garantie.

Options futures possibles :

1. conserver Cerema si l’endpoint reste stable ;
2. contractualiser une API DVF tierce ;
3. héberger une instance DVF interne ;
4. charger un export DVF dans une base interne.

La présente étape sécurise le code sans changer l’architecture de données du projet.
