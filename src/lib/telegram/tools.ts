import type { AiToolDefinition } from '@/lib/ai/gateway'
import {
  executeGoogleTool,
  GOOGLE_TOOL_DEFINITIONS,
  GOOGLE_TOOL_NAMES,
} from '@/lib/google/tools'
import {
  addNoteOrTask,
  createProject,
  projetLabel,
  findSimilarOpenTask,
  getProject,
  readProjectDetail,
  searchContacts,
  searchProjects,
  updateTask,
  type AppliedOperation,
} from '@/lib/telegram/crm'

/**
 * Outils mis à disposition de l'agent.
 */
export const TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: 'chercher_contact',
    description:
      "Recherche un contact existant par son nom (et éventuellement sa ville). Renvoie l'identifiant du contact. Utile avant de créer un projet pour éviter les doublons de contacts.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: 'Nom de la personne (sans civilité).' },
        ville: { type: 'string', description: 'Ville éventuelle pour affiner.' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'chercher_projet',
    description:
      "Cherche un projet (vente ou achat) associé à un contact par nom ou ville. À appeler SYSTÉMATIQUEMENT avant d'ajouter une note pour retrouver le bon projet.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: 'Nom de la personne ou nom de commune. Sans civilité.' },
      },
      required: ['nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'lire_projet',
    description:
      "Renvoie la fiche complète d'un projet et ses 8 derniers événements : coordonnées, budget ou prix, étape, notes et tâches déjà enregistrées. Utile pour savoir ce qui est déjà connu avant d'ajouter quoi que ce soit.",
    parameters: {
      type: 'object',
      properties: {
        projet_id: { type: 'string', description: 'Identifiant renvoyé par chercher_projet.' },
      },
      required: ['projet_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'creer_projet',
    description:
      "Crée un projet (vente ou achat) et le contact associé s'il n'existe pas. N'appeler qu'après avoir vérifié que le projet n'existe pas déjà.",
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: "Type de projet : 'vente' ou 'achat'." },
        nom: { type: 'string', description: 'Nom du contact principal.' },
        ville: { type: 'string' },
        telephone: { type: 'string' },
        email: { type: 'string' },
        type_bien: { type: 'string', description: 'maison, appartement, terrain…' },
        prix_ou_budget: { type: 'number', description: 'Prix ou budget max en euros. 250 signifie 250000.' },
        note: { type: 'string', description: 'Contexte utile en une phrase.' },
        contact_id: {
          type: 'string',
          description: "Optionnel, identifiant du contact s'il a été trouvé via chercher_contact.",
        },
      },
      required: ['type', 'nom'],
      additionalProperties: false,
    },
  },
  {
    name: 'ajouter_note',
    description: 'Enregistre une information sur un projet existant (vente ou achat).',
    parameters: {
      type: 'object',
      properties: {
        projet_id: { type: 'string' },
        contenu: {
          type: 'string',
          description:
            "L'information reformulée en français clair, à la troisième personne, sans perdre les chiffres.",
        },
      },
      required: ['projet_id', 'contenu'],
      additionalProperties: false,
    },
  },
  {
    name: 'ajouter_tache',
    description:
      "Enregistre une chose à faire sur un projet existant. Si une tâche ouverte équivalente existe déjà, elle n'est pas dupliquée : l'échéance fournie y est appliquée, et l'outil te le signale.",
    parameters: {
      type: 'object',
      properties: {
        projet_id: { type: 'string' },
        contenu: { type: 'string', description: "L'action à mener, à l'infinitif." },
        echeance: {
          type: 'string',
          description:
            "Date d'échéance. Le format AAAA-MM-JJ est préféré, mais « 10/08/2026 », « 10 août 2026 », « demain » ou « lundi prochain » sont acceptés. Omise si aucune échéance n'est exprimée.",
        },
      },
      required: ['projet_id', 'contenu'],
      additionalProperties: false,
    },
  },
  {
    name: 'modifier_tache',
    description:
      "Modifie une tâche qui EXISTE DÉJÀ : pose ou déplace son échéance, corrige son libellé, ou la marque comme faite. C'est l'outil à utiliser quand Alexandre dit « ajoute une date », « reporte », « décale », « c'est fait ». Il ne crée jamais rien. L'identifiant s'obtient via lire_projet.",
    parameters: {
      type: 'object',
      properties: {
        tache_id: { type: 'string', description: 'Identifiant de la tâche, renvoyé par lire_projet.' },
        echeance: { type: 'string', description: "Nouvelle échéance. Mêmes formats qu'ajouter_tache." },
        contenu: { type: 'string', description: 'Nouveau libellé, si le précédent était imprécis.' },
        faite: { type: 'boolean', description: 'true pour marquer la tâche comme faite.' },
      },
      required: ['tache_id'],
      additionalProperties: false,
    },
  },
  // Outils Google, partagés avec l'assistant web (lecture seule).
  ...GOOGLE_TOOL_DEFINITIONS,
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
  // Les outils Google sont partagés avec l'assistant web et n'écrivent jamais
  // en base : ils ne produisent donc pas d'`operation` à récapituler.
  if (GOOGLE_TOOL_NAMES.has(name)) {
    return { result: await executeGoogleTool(name, rawArgs) }
  }

  let args: Record<string, any>
  try {
    args = JSON.parse(rawArgs || '{}')
  } catch {
    return { result: JSON.stringify({ erreur: 'Arguments illisibles' }) }
  }

  try {
    switch (name) {
      case 'chercher_contact': {
        const found = await searchContacts(String(args.nom ?? ''))
        return {
          result: JSON.stringify({
            resultats: found.map((contact: any) => ({
              contact_id: contact.id,
              nom: `${contact.first_name} ${contact.last_name}`.trim(),
              email: contact.email,
              telephone: contact.phone,
            })),
            nombre: found.length,
          }),
        }
      }

      case 'chercher_projet': {
        const found = await searchProjects(String(args.nom ?? ''))
        return {
          result: JSON.stringify({
            resultats: found.map((projet) => ({
              projet_id: projet.id,
              libelle: projetLabel(projet),
              type: projet.kind,
              ville: projet.city,
              etape: projet.stage,
            })),
            nombre: found.length,
          }),
        }
      }

      case 'lire_projet': {
        const detail = await readProjectDetail(String(args.projet_id ?? ''))
        return { result: JSON.stringify(detail ?? { erreur: 'Projet introuvable' }) }
      }

      case 'creer_projet': {
        const operation = await createProject({
          ...ctx,
          type: args.type === 'vente' || args.type === 'achat' ? args.type : 'vente',
          name: String(args.nom ?? '').trim(),
          city: args.ville ?? null,
          phone: args.telephone ?? null,
          email: args.email ?? null,
          propertyType: args.type_bien ?? null,
          amount: normalizeAmount(args.prix_ou_budget),
          note: args.note ?? null,
          contactId: args.contact_id ?? null,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      case 'ajouter_note':
      case 'ajouter_tache': {
        const isTask = name === 'ajouter_tache'
        const projetId = String(args.projet_id ?? '')
        const content = String(args.contenu ?? '').trim()

        if (isTask) {
          const projet = await getProject(projetId)
          if (!projet) return { result: JSON.stringify({ erreur: 'Projet introuvable' }) }

          const existing = await findSimilarOpenTask(projet, content)
          if (existing) {
            if (args.echeance) {
              const operation = await updateTask({ ...ctx, taskId: existing.id, dueDate: args.echeance })
              return {
                result: JSON.stringify({
                  ok: true,
                  mise_a_jour: true,
                  note: "La tâche existait déjà : son échéance a été mise à jour, aucune tâche n'a été créée.",
                  reference: operation.ref,
                  resume: operation.summary,
                }),
                operation,
              }
            }

            return {
              result: JSON.stringify({
                deja_present: true,
                tache_existante: { tache_id: existing.id, contenu: existing.content, echeance: existing.dueDate },
                a_faire: "Cette tâche est déjà enregistrée. Pour changer son échéance ou son libellé, appelle modifier_tache avec cette tache_id.",
              }),
            }
          }
        }

        const operation = await addNoteOrTask({
          ...ctx,
          projetId,
          content,
          dueDate: isTask ? (args.echeance ?? null) : null,
          isTask,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      case 'modifier_tache': {
        const operation = await updateTask({
          ...ctx,
          taskId: String(args.tache_id ?? ''),
          content: args.contenu ?? undefined,
          dueDate: args.echeance === undefined ? undefined : args.echeance,
          done: typeof args.faite === 'boolean' ? args.faite : undefined,
        })
        return { result: JSON.stringify({ ok: true, reference: operation.ref, resume: operation.summary }), operation }
      }

      default:
        return { result: JSON.stringify({ erreur: `Outil inconnu : ${name}` }) }
    }
  } catch (err) {
    return { result: JSON.stringify({ erreur: err instanceof Error ? err.message : String(err) }) }
  }
}

/** « 250 » dit d'un prix immobilier signifie 250 000 €. */
function normalizeAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount < 10000 ? Math.round(amount * 1000) : Math.round(amount)
}
