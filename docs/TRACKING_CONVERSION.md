# Tracking conversion & performance SEO

## Objectif

Mettre en place un suivi simple, non bloquant et exploitable pour relier les pages SEO/GEO aux conversions réelles.

Le tracking doit aider à répondre à ces questions :

- quelles pages amènent vers l’outil vendeur ?
- quels CTA fonctionnent ?
- quelles pages locales génèrent des clics vers l’avis de valeur ?
- combien de soumissions `/api/leads` aboutissent ?
- quelles pages doivent être renforcées dans les prochains sprints SEO/GEO ?

## Variables d’environnement

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ID GA4. Si vide, aucun script GA4 n’est chargé. |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | Si `true`, affiche les événements client dans la console navigateur. |
| `ANALYTICS_SERVER_LOGS` | Si différent de `false`, journalise les conversions serveur dans les logs Vercel. |

## Événements client

Les événements client sont envoyés via `gtag` si `NEXT_PUBLIC_GA_MEASUREMENT_ID` est configuré.

| Événement | Déclenchement | Paramètres principaux |
| --- | --- | --- |
| `page_view` | navigation interne | `page_path`, `page_location` |
| `cta_click` | clic vers `/outils/vendre` ou `/avis-de-valeur-immobilier` | `source_path`, `target_path`, `cta_label`, `cta_destination` |
| `contact_click` | clic vers `/contact` | `source_path`, `target_path`, `cta_label` |
| `phone_click` | clic téléphone | `source_path`, `cta_label` |
| `appointment_click` | clic vers Cal.com | `source_path`, `cta_label` |
| `local_page_click` | clic vers une page `/marche/[commune]` | `source_path`, `target_path`, `cta_label` |

## Événements serveur

La route `/api/leads` journalise des événements sans données personnelles.

| Événement | Déclenchement | Paramètres principaux |
| --- | --- | --- |
| `lead_submit` | soumission réussie | `lead_type`, `email_sent`, `notion_backup_ok`, `attio_sync_ok` |
| `lead_submit_error` | échec du calcul avant réponse | `lead_type`, `error_step` |

Les logs serveur ne contiennent pas d’email, de téléphone, de nom, d’adresse ni de token.

## Indicateurs à suivre

### Acquisition SEO/GEO

- impressions Search Console par page ;
- clics Search Console par page ;
- CTR par page ;
- position moyenne par groupe de mots-clés SE Ranking ;
- pages locales qui commencent à remonter sur les requêtes `estimation maison + commune`.

### Conversion

- clics depuis `/marche/[commune]` vers `/avis-de-valeur-immobilier` ;
- clics depuis `/marche/[commune]` vers `/outils/vendre` ;
- clics depuis `/avis-de-valeur-immobilier` vers `/outils/vendre` ;
- soumissions `lead_submit` ;
- appels / rendez-vous si tracking activé.

## Lecture recommandée

Chaque mois :

1. Exporter les pages les plus visibles dans Search Console.
2. Comparer avec les événements GA4 : `cta_click`, `local_page_click`, `lead_submit`.
3. Identifier les pages avec impressions mais faible CTR : retravailler title/meta.
4. Identifier les pages avec clics mais peu de conversion : renforcer CTA ou preuve locale.
5. Prioriser les prochains contenus selon les communes et intentions déjà visibles.

## Respect vie privée

- Le tracking GA4 est optionnel.
- Le site fonctionne sans variable GA4.
- Les événements serveur évitent les données personnelles.
- Le tracking ne bloque jamais le parcours utilisateur.
