import type { AiToolDefinition } from '@/lib/ai/gateway'
import {
  addNoteOrTask,
  createBuyer,
  createSeller,
  dossierLabel,
  readDossierDetail,
  searchDossiers,
  type AppliedOperation,
} from '@/lib/telegram/crm'

/**
 * Outils mis à disposition de l'agent.
 *
 * Les deux premiers sont en lecture : ce sont eux qui remplacent la liste
 * figée de l'ancienne version et permettent à l'agent de vérifier lui-même
 * si une personne existe avant d'en créer une seconde.
 */
export const TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: 'chercher_dossier',
    description:
      "Cherche un vendeur ou un acquéreur dans le CRM par nom ou par ville. À appeler SYSTÉMATIQUEMENT avant de créer un contact, pour vérifier qu'il n'existe pas déjà, et avant d'ajouter une note pour retrouver le bon dossier.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: "Nom de la personne ou nom de commune. Sans civilité." },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'lire_dossier',
    description:
      "Renvoie la fiche complète d'un dossier et ses 8 derniers événements : coordonnées, budget ou prix, étape, notes et tâches déjà enregistrées. Utile pour savoir ce qui est déjà connu avant d'ajouter quoi que ce soit.",
    parameters: {
      type: 'object',
      properties: {
        dossier_id: { type: 'string', description: 'Identifiant renvoyé par chercher_dossier.' },
      },
      required: ['dossier_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'creer_vendeur',
    description:
      "Crée une opportunité vendeur. N'appeler qu'après avoir vérifié via chercher_dossier que la personne n'existe pas déjà.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        ville: { type: 'string' },
        telephone: { type: 'string' },
        email: { type: 'string' },
        type_bien: { type: 'string', description: 'maison, appartement, terrain…' },
        prix: { type: 'number', description: "Prix souhaité en euros. 250 signifie 250000." },
        note: { type: 'string', description: 'Contexte utile en une phrase.' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'creer_acquereur',
    description:
      "Crée un acquéreur avec ses critères de recherche. N'appeler qu'après avoir vérifié via chercher_dossier que la personne n'existe pas déjà.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        ville: { type: 'string', description: 'Commune recherchée.' },
        telephone: { type: 'string' },
        email: { type: 'string' },
        type_bien: { type: 'string' },
        budget: { type: 'number', description: "Budget maximum en euros. 250 signifie 250000." },
        note: { type: 'string' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'ajouter_note',
    description: "Enregistre une information sur un dossier existant (vendeur ou acquéreur).",
    parameters: {
      type: 'object',
      properties: {
        dossier_id: { type: 'string' },
        contenu: {
          type: 'string',
          description: "L'information reformulée en français clair, à la troisième personne, sans perdre les chiffres.",
        },
      },
      required: ['dossier_id', 'contenu'],
      additionalProperties: false,
    },
  },
  {
    name: 'ajouter_tache',
    description: "Enregistre une chose à faire sur un dossier existant, avec une échéance si elle est exprimée.",
    parameters: {
      type: 'object',
      properties: {
        dossier_id: { type: 'string' },
        contenu: { type: 'string', description: "L'action à mener, à l'infinitif." },
        echeance: { type: 'string', description: 'Date AAAA-MM-JJ, ou omise si aucune échéance.' },
      },
      required: ['dossier_id', 'contenu'],
      additionalProperties: false,
    },
  },
]

export type ToolContext = { chatId: number; sourceText: string }

export type ToolOutcome = {
  /** Résultat rendu au modèle, en JSON. */
  result: string
  /** Renseigné si l'appel a écrit en base : sert au récapitulatif Telegram. */
  operation?: AppliedOperation
}

/** Exécute un outil demandé par le modèle. Ne lève jamais : renvoie l'erreur au modèle. */
export async function executeTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutcome> {
  let args: Record<string, any>
  try {
    args = JSON.parse(rawArgs || '{}')
  } catch {
    return { result: JSON.stringify({ erreur: 'Arguments illisibles' }) }
  }

  try {
    switch (name) {
      case 'chercher_dossier': {
        const found = await searchDossiers(String(args.nom ?? ''))
        return {
          result: JSON.stringify({
            resultats: found.map((dossier) => ({
              dossier_id: dossier.id,
              libelle: dossierLabel(dossier),
              type: dossier.kind,
              ville: dossier.city,
              etape: dossier.stage,
            })),
            nombre: found.length,
          }),
        }
      }

      case 'lire_dossier': {
        const detail = await readDossierDetail(String(args.dossier_id ?? ''))
        return { result: JSON.stringify(detail ?? { erreur: 'Dossier introuvable' }) }
      }

      case 'creer_vendeur': {
        const operation = await createSeller({
          ...ctx,
          name: String(args.nom ?? '').trim(),
          city: args.ville ?? null,
          phone: args.telephone ?? null,
          email: args.email ?? null,
          propertyType: args.type_bien ?? null,
          amount: normalizeAmount(args.prix),
          note: args.note ?? null,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      case 'creer_acquereur': {
        const operation = await createBuyer({
          ...ctx,
          name: String(args.nom ?? '').trim(),
          city: args.ville ?? null,
          phone: args.telephone ?? null,
          email: args.email ?? null,
          propertyType: args.type_bien ?? null,
          amount: normalizeAmount(args.budget),
          note: args.note ?? null,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      case 'ajouter_note':
      case 'ajouter_tache': {
        const isTask = name === 'ajouter_tache'
        const operation = await addNoteOrTask({
          ...ctx,
          dossierId: String(args.dossier_id ?? ''),
          content: String(args.contenu ?? '').trim(),
          dueDate: isTask ? (args.echeance ?? null) : null,
          isTask,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      default:
        return { result: JSON.stringify({ erreur: `Outil inconnu : ${name}` }) }
    }
  } catch (err) {
    // L'erreur remonte au modèle plutôt qu'à l'utilisateur : il peut corriger
    // son appel (dossier inexistant, champ manquant) et réessayer.
    return { result: JSON.stringify({ erreur: err instanceof Error ? err.message : String(err) }) }
  }
}

/** « 250 » dit d'un prix immobilier signifie 250 000 €. */
function normalizeAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount < 10000 ? Math.round(amount * 1000) : Math.round(amount)
}
