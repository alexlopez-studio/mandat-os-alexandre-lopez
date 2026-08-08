import { aiChatWithTools, type AiConversationMessage } from '@/lib/ai/gateway'
import type { AppliedOperation } from '@/lib/telegram/crm'
import { appendAssistant, appendToolResult, appendUser, getOrCreateThread, loadHistory } from '@/lib/telegram/memory'
import { executeTool, TOOL_DEFINITIONS } from '@/lib/telegram/tools'

/**
 * Boucle d'agent.
 *
 * Le modèle alterne réflexion et appels d'outils jusqu'à produire une réponse
 * en clair — qui peut être une confirmation d'écriture, ou une question posée
 * à Alexandre. Dans ce second cas la conversation reste ouverte : sa réponse
 * au message suivant reprendra le fil grâce à la mémoire.
 */

/** Garde-fou : au-delà, on rend la main plutôt que de boucler indéfiniment. */
const MAX_STEPS = 6

/**
 * Le prompt dépend du jour : sans la date d'aujourd'hui, le modèle ne peut pas
 * convertir « lundi prochain » et transmet la formulation brute en échéance.
 */
function buildSystemPrompt(today: Date) {
  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  }).format(today)
  const iso = today.toISOString().slice(0, 10)

  return `Nous sommes le ${jour} (${iso}).

${SYSTEM_PROMPT}`
}

const SYSTEM_PROMPT = `Tu es l'assistant CRM d'Alexandre Lopez, conseiller immobilier iad en Provence Verte (Brignoles, Saint-Maximin, Rocbaron, Nans-les-Pins…).

Il t'écrit entre deux rendez-vous, souvent en style télégraphique. Ton rôle est d'enregistrer proprement ce qu'il te dit dans son CRM — et de lui poser une question quand c'est nécessaire pour bien faire.

MÉTHODE — dans cet ordre, sans exception :
1. Avant TOUTE création, appelle chercher_contact et chercher_projet pour vérifier que la personne ou le projet n'existent pas déjà.
2. Si un projet correspond, appelle lire_projet pour voir ce qui est déjà connu.
3. Puis agis : ajouter_note, ajouter_tache ou creer_projet.

QUAND POSER UNE QUESTION plutôt qu'agir :
- Plusieurs contacts ou projets pourraient correspondre au nom mentionné.
- Le nom existe déjà et tu ne sais pas s'il s'agit de la même personne ou d'une homonyme.
- Une information structurante manque et ne peut pas être devinée (type de projet vente ou achat ? quelle commune ?).
- Ce qu'il demande contredit ce que dit la fiche.
Dans ces cas, réponds par une question courte et précise, sans appeler d'outil d'écriture. Propose les options que tu as trouvées.

QUAND AGIR SANS DEMANDER :
- Le projet ou contact est identifié sans ambiguïté et l'information est claire. Tu écris, tu confirmes.
Alexandre dispose de /recap et /annuler : une écriture n'est jamais définitive. Ne demande pas de confirmation pour le principe.

TÂCHES ET ÉCHÉANCES :
- « ajoute une date », « reporte », « décale », « c'est fait » portent sur une tâche qui existe déjà : appelle lire_projet pour récupérer son identifiant, puis modifier_tache. Ce n'est jamais une création.
- N'appelle ajouter_tache que pour une chose à faire réellement nouvelle.
- Convertis toi-même les dates en AAAA-MM-JJ à partir de la date du jour indiquée plus haut. Ne transmets jamais « lundi prochain » tel quel.

RÈGLES :
- Ne confirme jamais une écriture qu'un outil n'a pas confirmée. Si un outil renvoie une erreur, dis ce qui a échoué et pourquoi — n'annonce pas que c'est enregistré.
- Les civilités ne comptent pas : « Monsieur Martin » et « Martin » désignent la même personne.
- Les montants sont en euros. « 250 » dans un contexte immobilier signifie 250 000.
- Vendeur = projet de type "vente". Acquéreur = projet de type "achat".
- N'invente jamais une information absente du message.
- Réponds en français, brièvement. Une à deux phrases suffisent.
- Ne mentionne jamais les identifiants techniques à l'écran.`

export type AgentOutcome = {
  answer: string
  operations: AppliedOperation[]
}

export async function runAgent(input: { chatId: number; text: string }): Promise<AgentOutcome> {
  const threadId = await getOrCreateThread(input.chatId)
  await appendUser(threadId, input.text)

  const history = await loadHistory(threadId)
  const messages: AiConversationMessage[] = [
    { role: 'system', content: buildSystemPrompt(new Date()) },
    ...history,
  ]
  const operations: AppliedOperation[] = []

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const turn = await aiChatWithTools({ messages, tools: TOOL_DEFINITIONS })

    await appendAssistant(threadId, turn.content, turn.toolCalls)
    messages.push({
      role: 'assistant',
      content: turn.content || null,
      ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls } : {}),
    })

    // Pas d'outil demandé : le modèle a fini, il répond ou il questionne.
    if (turn.toolCalls.length === 0) {
      return { answer: turn.content.trim() || 'C\'est noté.', operations }
    }

    for (const call of turn.toolCalls) {
      const outcome = await executeTool(call.name, call.arguments, {
        chatId: input.chatId,
        sourceText: input.text,
      })
      if (outcome.operation) operations.push(outcome.operation)

      await appendToolResult(threadId, call.id, outcome.result)
      messages.push({ role: 'tool', tool_call_id: call.id, content: outcome.result })
    }
  }

  // Sortie de boucle : on a écrit, mais le modèle n'a pas conclu.
  return {
    answer:
      operations.length > 0
        ? 'Enregistré, mais je me suis un peu perdu en route — vérifie avec /recap.'
        : "Je n'arrive pas à traiter cette demande. Reformule plus simplement ?",
    operations,
  }
}
