# Personnalisation de l'espace client (issue du R1 / Granola)

> Problème : le rapport Yanport (remis en PDF) est fiable et solide sur l'aspect marché, mais peu
> personnalisé. Au R1, le conseiller capte des informations riches (faits de vie, attaches au bien,
> projet de vie, appréciations) qui hyper-personnalisent son travail. Objectif : intégrer ces
> informations dans l'espace client via une **couche de données supplémentaire**, sans dénaturer le
> rapport Yanport.

## Principe directeur

Deux livrables **complémentaires**, volontairement non alignés :
- **PDF Yanport** = preuve marché (chiffres, comparables) — caution objective.
- **Espace client** = couche relationnelle vivante — prouve qu'on a compris *leur* projet et *leur* bien.

Le « décalage » est assumé : le PDF justifie le prix, l'espace client justifie le choix du conseiller.

## Règle d'or (sécurité relationnelle + RGPD)

> On ne publie côté client **que** ce que le client serait content ou rassuré de lire.

Tout ce qui est capté au R1 ne remonte pas au client. La séparation est **structurelle** (deux tables
différentes) — c'est le garde-fou : le client-facing et l'interne ne peuvent pas fuir l'un dans l'autre.

## Structures de données (Phase 1 — créée)

Projet Supabase `Site web Alexandre Lopez` (`byrsmbgfkvgxdtdyhrro`).

### 👁️ Client-facing — `client_dossiers.personalization` (jsonb)
Lu par l'espace client. Curé et **validé manuellement** avant publication.
```
{
  status: 'draft' | 'published',
  client_project: string|null,        // le projet de vie derrière la vente (reformulé)
  property_story: string|null,        // histoire & attaches au bien
  key_points: string[],               // ce que le conseiller a retenu de l'échange
  advisor_commitments: string[],      // engagements concrets du conseiller
  personal_note: string|null,         // mot du conseiller (cf. aussi client_dossiers.advisor_note, déjà affiché)
  sources: [ { type:'granola', meeting_id, quote } ],  // traçabilité vers le R1
  updated_at
}
```

### 🔒 Interne — `opportunities.internal_intel` (jsonb)
CRM only, **jamais exposé côté client** (réservé service role).
```
{
  motivation: string|null,            // vraie raison de vente
  constraints: string|null,           // urgence, délais, situation financière
  negotiation: string|null,           // marge, leviers
  sensitive_notes: string[],          // confidences à ne pas divulguer
  sources: [ { type:'granola', meeting_id, quote } ]
}
```

> Rappel : `professional_opinion` (données Yanport/marché) reste **inchangé**. La personnalisation est
> une couche *à part*.

## Taxonomie client / interne

| Capté au R1 | Destination |
|---|---|
| Projet de vie, motivation « présentable » (se rapprocher des enfants…) | 👁️ `client_project` |
| Histoire du bien, travaux réalisés, anecdotes, attaches | 👁️ `property_story` |
| Ce qui compte pour eux, ce qu'on a retenu | 👁️ `key_points` |
| Engagements du conseiller (photographe, home staging, délais) | 👁️ `advisor_commitments` |
| Vraie motivation sensible (divorce, mutation, dettes) | 🔒 `motivation` |
| Urgence, contraintes financières, deadline cachée | 🔒 `constraints` |
| Marge de négociation, leviers, prix plancher accepté | 🔒 `negotiation` |
| Confidences, jugements, infos à ne pas divulguer | 🔒 `sensitive_notes` |

## Workflow de production (Phase 2 — à venir)

Réutilise le rattachement Granola (`opportunity_meeting_links`, cf.
`docs/WORKFLOW_IMPORT_PDF_ESTIMATION.md` §7) :
```
R1 Granola → transcript → l'IA EXTRAIT et CLASSE les items (client-facing vs interne, avec citations)
           → le conseiller VALIDE / édite / ajuste le ton → publication (status = 'published')
```
Human-in-the-loop obligatoire. L'IA propose, le conseiller décide. Aucune auto-publication du transcript.

## Affichage (Phase 3 — à venir)

- Nouvelle section « personnalisée » dans `src/app/espace-client/portal-view.tsx` (rendre `personalization`
  quand `status = 'published'`), en cohérence avec l'existant (`advisor_note` déjà affiché ~l.429).
- Écran de validation côté admin (dossier / opportunité) pour éditer et publier.
- Option anti-décalage : mot de synthèse personnalisé en tête d'espace client, voire addendum PDF
  personnalisé annexé au Yanport.

## État

- [x] Phase 1 — structures de données créées (`client_dossiers.personalization`, `opportunities.internal_intel`).
- [ ] Phase 2 — workflow de curation depuis Granola.
- [ ] Phase 3 — affichage espace client + écran de validation admin.
