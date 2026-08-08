#!/usr/bin/env node
/**
 * check-design — verifie que le code respecte `docs/DESIGN.md`.
 *
 * Usage :
 *   node scripts/check-design.mjs            # rapport complet (dette incluse)
 *   node scripts/check-design.mjs --staged   # uniquement les fichiers stages dans git
 *   node scripts/check-design.mjs --since=HEAD~1
 *   node scripts/check-design.mjs <chemin>…  # fichiers ou dossiers precis
 *
 * Sort en code 1 si une violation est trouvee dans le perimetre analyse.
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** Fichiers exemptes : primitives de layout et primitives shadcn. */
const EXEMPT = [
  'src/components/pro/',
  'src/components/ui/',
  'src/app/globals.css',
]

/**
 * Echelle d'espacement autorisee (docs/DESIGN.md §2).
 * 2 = 8px, 4 = 16px, 6 = 24px, 8 = 32px. Plus 0 et 1 pour les cas de bordure.
 */
const ALLOWED_SPACING = new Set(['0', '0.5', '1', '2', '4', '6', '8', 'px', 'auto'])
const SPACING_PREFIX =
  '(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)'

const RULES = [
  {
    id: 'raw-color',
    label: 'Couleur brute (utiliser un token semantique : bg-card, text-muted-foreground…)',
    // Couleurs Tailwind par palette + hex en dur dans une className.
    regex:
      /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide)-(?:white|black|gray|grey|zinc|neutral|stone|slate)-(?:50|[1-9]00|950)\b|\b(?:bg|text|border)-white\b|\b(?:bg|text|border)-black\b/g,
    appliesTo: () => true,
  },
  {
    id: 'arbitrary-value',
    label: 'Valeur arbitraire Tailwind (interdite : utiliser un token)',
    regex: /\b[a-z-]+-\[[^\]]+\]/g,
    appliesTo: () => true,
    // Les calculs de hauteur de viewport et les selecteurs data-* restent legitimes.
    ignore: (match) =>
      match.includes('calc(') ||
      match.startsWith('data-[') ||
      match.startsWith('group-data-[') ||
      match.startsWith('peer-') ||
      match.startsWith('has-data-[') ||
      match.startsWith('aria-') ||
      match.startsWith('supports-['),
  },
  {
    id: 'spacing-scale',
    label: 'Espacement hors echelle (autorise : 0, 2, 4, 6, 8)',
    regex: new RegExp(`\\b(?:sm:|md:|lg:|xl:|2xl:)?${SPACING_PREFIX}-([0-9.]+|px|auto)\\b`, 'g'),
    appliesTo: () => true,
    ignore: (match) => {
      const value = match.split('-').pop()
      return ALLOWED_SPACING.has(value)
    },
  },
  {
    id: 'page-owns-layout',
    label: 'Une page ne definit pas sa largeur ni son padding de conteneur (role de PageLayout)',
    regex: /\b(?:max-w-(?:xs|sm|md|lg|xl|[2-7]xl|full|screen-[a-z]+)|mx-auto)\b/g,
    appliesTo: (file) => /(?:^|\/)page\.tsx$/.test(file),
  },
  {
    id: 'ad-hoc-shadow',
    label: 'Ombre ad hoc (seul shadow-sm est autorise, sur Card)',
    regex: /\bshadow-(?:md|lg|xl|2xl|inner)\b/g,
    appliesTo: () => true,
  },
  {
    id: 'ad-hoc-heading',
    label: 'Titre stylé a la main (utiliser PageHeader ou SectionHeader)',
    regex: /<h1[\s>]/g,
    appliesTo: (file) => /(?:^|\/)page\.tsx$/.test(file),
  },
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, out)
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function resolveTargets(args) {
  const paths = args.filter((arg) => !arg.startsWith('--'))
  const staged = args.includes('--staged')
  const sinceArg = args.find((arg) => arg.startsWith('--since='))

  if (staged || sinceArg) {
    const command = staged
      ? 'git diff --cached --name-only --diff-filter=ACMR'
      : `git diff --name-only --diff-filter=ACMR ${sinceArg.split('=')[1]}`
    return execSync(command, { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => path.join(ROOT, file))
      .filter((file) => {
        try {
          return statSync(file).isFile()
        } catch {
          return false
        }
      })
  }

  if (paths.length > 0) {
    return paths.flatMap((target) => {
      const full = path.isAbsolute(target) ? target : path.join(ROOT, target)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })
  }

  return walk(SRC)
}

function isExempt(relative) {
  return EXEMPT.some((prefix) => relative.startsWith(prefix))
}

const args = process.argv.slice(2)
const files = resolveTargets(args)
const findings = []

for (const file of files) {
  const relative = path.relative(ROOT, file)
  if (isExempt(relative)) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (const rule of RULES) {
    if (!rule.appliesTo(relative)) continue

    lines.forEach((line, index) => {
      // On ignore les lignes de commentaire.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return

      const matches = line.match(rule.regex)
      if (!matches) return

      for (const match of new Set(matches)) {
        if (rule.ignore?.(match)) continue
        findings.push({
          file: relative,
          line: index + 1,
          rule: rule.id,
          label: rule.label,
          match,
        })
      }
    })
  }
}

if (findings.length === 0) {
  console.log('✓ check-design : aucune violation dans le périmètre analysé.')
  process.exit(0)
}

const byRule = new Map()
for (const finding of findings) {
  const list = byRule.get(finding.rule) ?? []
  list.push(finding)
  byRule.set(finding.rule, list)
}

console.log(`\ncheck-design — ${findings.length} violation(s) de docs/DESIGN.md\n`)

for (const [ruleId, list] of byRule) {
  console.log(`  ${ruleId} — ${list[0].label}  (${list.length})`)
  for (const finding of list.slice(0, 15)) {
    console.log(`    ${finding.file}:${finding.line}  ${finding.match}`)
  }
  if (list.length > 15) console.log(`    … et ${list.length - 15} autre(s)`)
  console.log('')
}

console.log('Détail des règles : docs/DESIGN.md\n')
process.exit(1)
