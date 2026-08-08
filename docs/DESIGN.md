# DESIGN.md — Regles de design de l'app

> Ce fichier fait autorite sur la **mise en page** et la **coherence visuelle**.
> Toute page ou composant qui le contredit est un bug.
>
> Il se lit avec deux autres documents, qui restent autoritaires sur leur domaine :
>
> - `docs/BRAND.md` — couleurs de marque, typographie, ton, regles de copie.
> - `docs/DESIGN_UX_GUIDELINES.md` — principes UX produit, densite, etats.
>
> En cas de conflit sur la typographie ou les couleurs, **`BRAND.md` gagne**.
>
> Verification automatique : `npm run lint:design`.

---

## 1. Principe fondateur

**Une page ne definit jamais sa propre mise en page.**
Une page = un `<PageLayout>` + du contenu place dans des primitives existantes.
Si un besoin n'est pas couvert par une primitive, on **ajoute une primitive** dans
`src/components/pro/` — on n'improvise pas un `<div className="...">` dans la page.

Interdits dans un fichier `page.tsx` :

- `max-w-*`, `mx-auto`, padding de conteneur global → role de `PageLayout`
- `<h1>` style a la main → utiliser `PageHeader`

Interdits partout (hors `src/components/pro/` et `src/components/ui/`) :

- valeurs arbitraires Tailwind : `p-[13px]`, `text-[15px]`, `bg-[#f3f3f3]`
- couleurs de palette neutre brutes : `bg-white`, `text-gray-500`, `bg-slate-100`,
  `text-zinc-400` → uniquement des tokens semantiques
- ombres ad hoc : `shadow-md`, `shadow-lg`, `shadow-xl` → seul `shadow-sm` existe
- espacements hors echelle (voir §2)

---

## 2. Tokens

### Espacement (echelle 4px, sous-ensemble impose)

| Usage | Valeur |
|---|---|
| Interne composant serre | `gap-2` (8px) |
| Interne composant standard | `gap-4` (16px) |
| Entre blocs d'une section | `gap-6` (24px) |
| Entre sections d'une page | `gap-8` (32px) |
| Padding interne carte | `p-6` |
| Padding page (mobile / desktop) | `px-4` / `px-8` |

**Aucune autre valeur d'espacement.** Pas de `gap-5`, `p-7`, `mt-3`, `gap-1.5`.
Seules exceptions tolerees, pour les ajustements optiques d'une bordure ou d'un
liseré : `0`, `0.5`, `1`.

### Largeurs de page

| Variante | Largeur | Pour |
|---|---|---|
| `default` | `max-w-5xl` | pages de contenu |
| `wide` | `max-w-7xl` | tableaux, kanban, dashboards |
| `narrow` | `max-w-2xl` | formulaires, reglages, lecture |

### Rayons & ombres

- Rayon : `rounded-lg` (cartes, inputs). `rounded-xl` pour les boutons (charte shadcn du projet).
  `rounded-full` uniquement pour avatars et pastilles.
- Ombre : `shadow-sm` sur les cartes et les tableaux. **Aucune autre ombre nulle part.**
  La profondeur se fait a la bordure, pas a l'ombre.

### Couleurs — tokens semantiques uniquement

Definis une seule fois dans `src/app/globals.css`, jamais en dur ailleurs :

```
--background        fond de page
--foreground        texte principal
--muted             fond secondaire (zones grisees)
--muted-foreground  texte secondaire, labels, aides
--card              fond de carte
--border            toutes les bordures
--primary           action principale (bleu Mediterranee, voir BRAND.md)
--accent            fond teinte de l'accent
--destructive       suppression, erreur
```

Dans le code : `bg-background`, `text-muted-foreground`, `border-border`.
Jamais `text-gray-500` ni `bg-white`.

**Couleurs de statut** (vert / ambre / rouge / bleu) : elles passent par les `tone`
de `StatusPill` (`neutral | brand | success | warning | danger`), pas par des classes
Tailwind ecrites a la main dans une page.

### Typographie — 5 niveaux, pas un de plus

Aligne sur `docs/BRAND.md` (H1 28px extrabold, H2 20px extrabold).

| Role | Classes | Ou |
|---|---|---|
| Titre de page | `text-2xl font-extrabold leading-tight` | `PageHeader` uniquement |
| Titre de section | `text-lg font-bold` | `SectionHeader` uniquement |
| Corps | `text-sm` | par defaut |
| Secondaire / aide | `text-sm text-muted-foreground` | descriptions, legendes |
| Label / eyebrow | `text-xs font-bold uppercase tracking-normal` | labels, en-tetes de tableau, eyebrow |

---

## 3. Primitives (contrat d'API)

Elles vivent dans `src/components/pro/` et s'importent depuis `@/components/pro`.
Ce sont les **seuls** composants autorises a porter du CSS de mise en page.

```tsx
// Enveloppe TOUTE page. Gere largeur, padding et espacement vertical.
<PageLayout width="default" | "wide" | "narrow">

// Bandeau de titre. Toujours premier enfant de PageLayout, exactement un par page.
<PageHeader eyebrow="…" title="…" description="…" actions={<Button/>} />

// Regroupement logique. Avec en-tete si titre fourni.
<Section title="Filtres" description="…" actions={…}>
<SectionHeader title="…" description="…" actions={…} />
<PageSection>                      // regroupement sans en-tete

// Barre d'outils d'un ecran de donnees : titre, compteur, filtres, actions.
<DataToolbar title="…" description="…" filters={…} actions={…} />

// Champ de recherche des barres d'outils (porte l'icone et son decalage).
<SearchInput label="Rechercher un contact" placeholder="…" value={…} onChange={…} />

// Grilles standardisees — pas de grid-cols improvise dans une page.
<Grid cols={2} | {3} | {4}>

// Ligne d'actions en bas de formulaire ou de modale (ordre et alignement fixes).
<ActionBar>

// Etats non-heureux, identiques sur toutes les pages.
<EmptyState icon={…} title="…" description="…" action={…} />
<LoadingState variant="table" | "cards" | "text" rows={…} />
<ErrorState title="…" description="…" onRetry={…} />

// Pastilles
<StatusPill tone="neutral" | "brand" | "success" | "warning" | "danger">
<ToggleChip selected={…} icon={…} onClick={…}>     // pastille interactive
<ContactTypePills types={…} />                      // typologies d'un contact

// KPI
<MetricCard />
```

`PageShell` est un alias deprecie de `PageLayout`, conserve pour les pages non migrees.

**Regle :** si tu ecris un `className` avec du flex/grid/padding/max-width dans un
fichier `page.tsx`, tu es en train de creer une incoherence. Cree ou etends une
primitive a la place.

---

## 4. Anatomie imposee d'une page

```tsx
export default function MaPage() {
  return (
    <PageLayout width="wide">
      <PageHeader eyebrow="Annuaire" title="Contacts" description="…" actions={…} />

      <PageSection>
        <DataToolbar title="…" description="…" filters={…} />
        {loading ? <LoadingState variant="table" /> : null}
        {error ? <ErrorState onRetry={reload} /> : null}
        {empty ? <EmptyState … /> : <Table>…</Table>}
      </PageSection>
    </PageLayout>
  )
}
```

Reference vivante : `src/app/admin/market/contacts/page.tsx` et
`src/app/admin/market/opportunities/OpportunitiesWorkspace.tsx`.
Les deux passent `npm run lint:design` sans violation.

Chaque page a **exactement un** `PageHeader`, en premiere position.
Pas de titre flottant ailleurs.

---

## 5. Conventions transverses

- **Boutons** : un seul bouton `primary` par ecran (l'action principale). Le reste en
  `outline` / `ghost`. Les actions destructives sont `ghost` + `text-destructive`,
  jamais un gros bouton rouge.
- **Ordre des actions** : action principale a droite, annuler a sa gauche. Toujours.
- **Formulaires** : label au-dessus du champ, aide en `text-muted-foreground` en
  dessous, erreur en `text-destructive` en dessous. Largeur `narrow`.
- **Tableaux** : en-tete `bg-muted/50` en style label, lignes `text-sm`, separateurs
  `border-border`, `EmptyState` si zero ligne. Le titre de la ligne est un lien
  (accessible au clavier) meme si toute la ligne est cliquable.
- **Chargement** : squelettes qui reprennent la forme du contenu final (`LoadingState`).
  Jamais de spinner plein ecran sur une page deja structuree. Un spinner reste
  acceptable dans un bouton pendant une soumission.
- **Icones** : lucide-react uniquement, `size-4` inline, `size-5` dans les boutons.
- **Responsive** : mobile d'abord. Les breakpoints des grilles et des largeurs sont
  geres dans les primitives. Les colonnes de tableau qui se replient restent dans la
  page, avec les memes breakpoints partout : `md` → secondaire, `lg` → tertiaire,
  `xl` → detail.
- **Aucun debordement horizontal du body.** Un tableau large defile dans son propre
  conteneur `overflow-x-auto`.

---

## 6. Checklist avant de valider une page

- [ ] La page est enveloppee dans `PageLayout` et rien d'autre
- [ ] Zero `className` de layout (flex/grid/max-w/padding de conteneur) dans le `page.tsx`
- [ ] Zero couleur brute, zero valeur arbitraire `[...]`
- [ ] Espacements uniquement dans l'echelle autorisee
- [ ] Un seul `PageHeader`, un seul bouton primaire
- [ ] Etats vide / chargement / erreur presents et issus des primitives
- [ ] `npm run lint:design -- <fichier>` ne remonte rien
- [ ] Ouverte cote a cote avec Contacts ou Projets : meme gouttiere, meme largeur,
      meme hauteur de titre

---

## 7. Verification automatique

```bash
npm run lint:design            # rapport complet, dette historique incluse
npm run lint:design:changed    # uniquement les fichiers modifies (git diff)
node scripts/check-design.mjs src/app/admin/market/contacts   # un chemin precis
```

Le script (`scripts/check-design.mjs`) verifie les regles mecaniquement verifiables :
couleurs brutes, valeurs arbitraires, echelle d'espacement, largeur dans un `page.tsx`,
ombres ad hoc, `<h1>` dans une page.

**Ce qu'il ne verifie pas** et qui reste a la revue humaine : un seul bouton primaire
par ecran, l'ordre des actions, la pertinence du squelette de chargement, l'usage des
couleurs de statut, la hierarchie typographique.

Les pages existantes portent encore de la dette (`npm run lint:design` la chiffre).
Elle n'est pas bloquante : on la resorbe au fil des retouches, page par page.
Toute page **nouvelle ou reecrite** doit sortir a zero violation.
