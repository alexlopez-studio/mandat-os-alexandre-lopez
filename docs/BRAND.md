# Brand — Tokens UI

## Couleurs

| Token CSS | Valeur | Nom | Usage | Classe Tailwind |
|-----------|--------|-----|-------|------------------|
| `--color-brand` | `#0077B6` | Bleu Méditerranée | Accent principal, CTAs, liens actifs | `bg-brand`, `text-brand` |
| `--color-brand-hover` | `#005F96` | Bleu profond | Hover boutons primaires | `hover:bg-brand-hover` |
| `--color-brand-light` | `#E0F0FA` | Bleu clair | Fonds teintés, badges, CTA final | `bg-brand-light` |
| `--color-foreground` | `#0F172A` | Anthracite | Texte principal, titres | `text-foreground` |
| `--color-muted` | `#64748B` | Gris | Texte secondaire | `text-muted` |
| `--color-border` | `#E2E8F0` | Gris clair | Bordures, séparateurs | `border-border` |
| `--color-surface` | `#F8FAFC` | Off-white | Sections alternées, fonds de cards | `bg-surface` |
| `--color-success` | `#10B981` | Vert | Tags "VENDU", badges positifs | `bg-success`, `text-success` |
| `--color-warning` | `#B26A00` | Ambre | Statuts en attente ou documents manquants | `bg-warning`, `text-warning` |
| `--color-error` | `#EF4444` | Rouge | Messages d'erreur | `text-error` |

> **Note IAD** : La couleur `#0077B6` (Bleu Méditerranée) est une déclinaison premium du bleu IAD, plus profonde et adaptée au positionnement immobilier Provence Verte.

## Typographie

- **Police principale app interne Mandat OS + site public** : **Inter** (Google Fonts, via `next/font`)
- **Police portail client vendeur** : **Plus Jakarta Sans** (Google Fonts, via `next/font`) pour coller à l'UX AI Studio
- Chargées avec les weights : 300, 400, 500, 600, 700, 800
- Variables CSS : `--font-inter` sur le scope `.app-product`, `--font-jakarta` sur le scope `.client-portal`

| Élément | Taille | Weight | Classe portail | Usage |
|---------|--------|--------|----------------|-------|
| H1 | 28px | 800 (extrabold) | `portal-h1` | Titres principaux, grands blocs |
| H2 | 20px | 800 (extrabold) | `portal-h2` | Titres de sections |
| H3 | 16px | 700 (bold) | `portal-h3` | Sous-titres, titres de lignes |
| Corps | 15px | 400 (regular) | `portal-body` | Texte courant |
| Boutons / onglets | 14px | 600 (semibold) | `portal-button-text` | Navigation, CTAs, actions |
| Meta / légendes | 13px | 300 (light) | `portal-meta` | Dates, descriptions courtes |
| Labels uppercase | 13px | 600 (semibold) | `portal-label` | Eyebrows, labels KPI |

## Boutons

| Variante | Style |
|----------|-------|
| `primary` | Fond `#0077B6`, texte blanc, `rounded-full` |
| `secondary` | Fond `#0F172A`, texte blanc, `rounded-full` |
| `outline` | Bordure `border-border`, fond blanc, `rounded-full` |
| `ghost` | Transparent, texte foreground |

## Règles importantes
- Style : épuré, premium, moderne — mobile-first
- Ne jamais utiliser le mot **"agence"** (mandataire)
- CTAs : orientés action ("Estimer mon bien", "Prendre RDV")
- Téléphone **06 13 18 01 68** toujours en texte HTML pur
- Aucune section sombre — alternance blanc/surface uniquement
- CTA final : fond `bg-brand-light` (#E0F0FA)
