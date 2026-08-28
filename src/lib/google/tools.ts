import type { AiToolDefinition } from '@/lib/ai/gateway'
import { getGoogleAccessToken, getGoogleGrantedScopes } from '@/lib/google/tokens'

const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

/**
 * Sans `drive.readonly`, l'API Drive répond 200 avec zéro fichier : le modèle
 * conclurait à tort « aucun document ». On préfère une erreur explicite à un
 * résultat vide trompeur.
 */
async function driveReadUnavailable(): Promise<string | null> {
  const scopes = await getGoogleGrantedScopes()
  if (scopes.includes(DRIVE_READ_SCOPE)) return null
  return JSON.stringify({
    erreur:
      "Accès au Drive limité aux fichiers créés par l'application : les documents existants sont invisibles. " +
      "Ne conclus pas qu'il n'y a aucun document. Dis à Alexandre de reconnecter son compte Google dans " +
      'Réglages → Intégrations pour autoriser la lecture du Drive.',
  })
}

/**
 * Outils Google mis à disposition des agents (assistant web, copilote et Telegram).
 * Permet la lecture Drive, Gmail, et la gestion complète (lecture, création, modification, suppression) de l'Agenda Google.
 */
export const GOOGLE_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: 'google_chercher_documents',
    description:
      "Cherche des documents dans le Google Drive d'Alexandre par mots-clés (nom de client, commune, type de pièce). À utiliser dès qu'il demande où se trouve un document, un mandat, un diagnostic, un compromis. Renvoie le nom, le type, la date et le lien Drive.",
    parameters: {
      type: 'object',
      properties: {
        recherche: {
          type: 'string',
          description: 'Mots-clés, typiquement un nom de client ou de commune. Ex : "Martin compromis".',
        },
        limite: { type: 'number', description: 'Nombre maximum de résultats (défaut 10, max 25).' },
      },
      required: ['recherche'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_lire_document',
    description:
      "Renvoie le contenu texte d'un document Drive à partir de son identifiant (obtenu via google_chercher_documents). Utile pour résumer un compromis, retrouver une surface dans un diagnostic, vérifier une clause. Ne fonctionne pas sur les images ni les PDF scannés.",
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'Identifiant renvoyé par google_chercher_documents.' },
      },
      required: ['document_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_chercher_emails',
    description:
      "Cherche dans la messagerie Gmail d'Alexandre. Accepte la syntaxe Gmail (from:, to:, subject:, after:). À utiliser pour retrouver un échange avec un client. Renvoie expéditeur, objet, date et extrait.",
    parameters: {
      type: 'object',
      properties: {
        recherche: {
          type: 'string',
          description: 'Requête Gmail. Ex : "from:martin@example.com" ou "compromis Cotignac".',
        },
        limite: { type: 'number', description: 'Nombre maximum de messages (défaut 10, max 25).' },
      },
      required: ['recherche'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_agenda',
    description:
      "Liste les événements de l'agenda principal d'Alexandre sur une période. Renvoie l'id (event_id), le titre, les dates/heures de début et fin, le lieu, et la description. À utiliser pour vérifier ce qui est prévu ou trouver l'id d'un événement à modifier ou supprimer.",
    parameters: {
      type: 'object',
      properties: {
        debut: { type: 'string', description: 'Date de début au format AAAA-MM-JJ.' },
        fin: { type: 'string', description: 'Date de fin au format AAAA-MM-JJ.' },
      },
      required: ['debut', 'fin'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_agenda_creer_evenement',
    description:
      "Crée un nouvel événement ou rendez-vous dans l'agenda Google principal d'Alexandre. À utiliser dès qu'il demande de planifier ou d'ajouter un créneau, une visite, une estimation, un rendez-vous client ou un rappel.",
    parameters: {
      type: 'object',
      properties: {
        titre: {
          type: 'string',
          description: "Titre ou objet du rendez-vous. Ex : 'Visite maison Tavernes avec M. Dupont'.",
        },
        debut: {
          type: 'string',
          description: "Date et heure de début au format ISO 8601 (ex : '2026-08-29T14:30:00') ou AAAA-MM-JJ pour journée entière.",
        },
        fin: {
          type: 'string',
          description: "Date et heure de fin au format ISO 8601 (ex : '2026-08-29T15:30:00') ou AAAA-MM-JJ.",
        },
        description: {
          type: 'string',
          description: 'Notes, détails ou compte-rendu associé au rendez-vous (optionnel).',
        },
        lieu: {
          type: 'string',
          description: "Adresse ou lieu du rendez-vous (optionnel). Ex : '12 rue de la Paix, 83110 Sanary'.",
        },
        participants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Adresses email des participants à inviter (optionnel).',
        },
      },
      required: ['titre', 'debut', 'fin'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_agenda_modifier_evenement',
    description:
      "Modifie un événement ou rendez-vous existant dans l'agenda Google d'Alexandre (changer l'heure, le jour, le titre, le lieu ou les notes). Utilise d'abord google_agenda pour retrouver l'event_id si nécessaire.",
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: "Identifiant Google de l'événement à modifier (obtenu via google_agenda).",
        },
        titre: {
          type: 'string',
          description: 'Nouveau titre du rendez-vous (optionnel).',
        },
        debut: {
          type: 'string',
          description: 'Nouvelle date/heure de début (format ISO 8601 ou AAAA-MM-JJ) (optionnel).',
        },
        fin: {
          type: 'string',
          description: 'Nouvelle date/heure de fin (format ISO 8601 ou AAAA-MM-JJ) (optionnel).',
        },
        description: {
          type: 'string',
          description: 'Nouvelle description ou notes (optionnel).',
        },
        lieu: {
          type: 'string',
          description: 'Nouveau lieu ou adresse (optionnel).',
        },
      },
      required: ['event_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'google_agenda_supprimer_evenement',
    description:
      "Supprime ou annule un événement ou rendez-vous dans l'agenda Google d'Alexandre. Utilise d'abord google_agenda pour obtenir l'event_id si nécessaire.",
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: "Identifiant Google de l'événement à supprimer (obtenu via google_agenda).",
        },
      },
      required: ['event_id'],
      additionalProperties: false,
    },
  },
]

export const GOOGLE_TOOL_NAMES = new Set(GOOGLE_TOOL_DEFINITIONS.map((tool) => tool.name))

/** Plafond de contenu renvoyé au modèle, pour ne pas saturer sa fenêtre. */
const MAX_DOCUMENT_CHARS = 12000

function clampLimit(value: unknown, fallback = 10) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(25, Math.trunc(parsed))
}

function formatGoogleDate(dateStr: string) {
  const str = dateStr.trim()
  if (!str.includes('T')) {
    return { date: str }
  }
  // If time does not have timezone offset, add +02:00 (Paris summer time) or Z
  const hasTz = str.includes('Z') || str.includes('+') || /-\d{2}:\d{2}$/.test(str)
  const fullIso = hasTz ? str : `${str}+02:00`
  return { dateTime: fullIso }
}

/**
 * Exécute un outil Google. Renvoie toujours du JSON en chaîne : le modèle doit
 * pouvoir lire une erreur comme un résultat, sans que la boucle d'agent casse.
 */
export async function executeGoogleTool(name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown>
  try {
    args = JSON.parse(rawArgs || '{}')
  } catch {
    return JSON.stringify({ erreur: 'Arguments illisibles' })
  }

  const token = await getGoogleAccessToken()
  if (!token) {
    return JSON.stringify({
      erreur: 'Compte Google non connecté ou autorisation expirée. Reconnecte-le dans Réglages → Intégrations.',
    })
  }

  const auth = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    switch (name) {
      case 'google_chercher_documents': {
        const unavailable = await driveReadUnavailable()
        if (unavailable) return unavailable

        const recherche = String(args.recherche ?? '').trim()
        if (!recherche) return JSON.stringify({ erreur: 'Recherche vide' })

        const q = `fullText contains '${recherche.replace(/'/g, "\\'")}' and trashed = false`
        const url = new URL('https://www.googleapis.com/drive/v3/files')
        url.searchParams.set('q', q)
        url.searchParams.set('pageSize', String(clampLimit(args.limite)))
        url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,size)')
        url.searchParams.set('orderBy', 'modifiedTime desc')

        const res = await fetch(url, { headers: { Authorization: auth.Authorization } })
        const body = await res.json()
        if (!res.ok) return JSON.stringify({ erreur: body?.error?.message ?? `HTTP ${res.status}` })

        const files = (body.files ?? []) as Array<Record<string, string>>
        return JSON.stringify({
          nombre: files.length,
          documents: files.map((file) => ({
            document_id: file.id,
            nom: file.name,
            type: lisibleMimeType(file.mimeType),
            modifie_le: file.modifiedTime?.slice(0, 10) ?? null,
            lien: file.webViewLink ?? null,
          })),
        })
      }

      case 'google_lire_document': {
        const unavailable = await driveReadUnavailable()
        if (unavailable) return unavailable

        const id = String(args.document_id ?? '').trim()
        if (!id) return JSON.stringify({ erreur: 'document_id manquant' })

        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType`,
          { headers: { Authorization: auth.Authorization } },
        )
        const meta = await metaRes.json()
        if (!metaRes.ok) return JSON.stringify({ erreur: meta?.error?.message ?? `HTTP ${metaRes.status}` })

        const isNative = String(meta.mimeType ?? '').startsWith('application/vnd.google-apps')
        const contentUrl = isNative
          ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text/plain`
          : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`

        const contentRes = await fetch(contentUrl, { headers: { Authorization: auth.Authorization } })
        if (!contentRes.ok) {
          const detail = await contentRes.json().catch(() => ({}))
          return JSON.stringify({
            erreur: detail?.error?.message ?? `Contenu illisible (HTTP ${contentRes.status})`,
            nom: meta.name,
          })
        }

        const raw = await contentRes.text()
        const printable = raw.replace(/[^\P{C}\n\t]/gu, '')
        if (printable.trim().length < 20) {
          return JSON.stringify({
            nom: meta.name,
            erreur: 'Document non textuel (image ou PDF scanné) : contenu non exploitable.',
          })
        }

        return JSON.stringify({
          nom: meta.name,
          tronque: printable.length > MAX_DOCUMENT_CHARS,
          contenu: printable.slice(0, MAX_DOCUMENT_CHARS),
        })
      }

      case 'google_chercher_emails': {
        const recherche = String(args.recherche ?? '').trim()
        if (!recherche) return JSON.stringify({ erreur: 'Recherche vide' })

        const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
        listUrl.searchParams.set('q', recherche)
        listUrl.searchParams.set('maxResults', String(clampLimit(args.limite)))

        const listRes = await fetch(listUrl, { headers: { Authorization: auth.Authorization } })
        const list = await listRes.json()
        if (!listRes.ok) return JSON.stringify({ erreur: list?.error?.message ?? `HTTP ${listRes.status}` })

        const ids = (list.messages ?? []) as Array<{ id: string }>
        const messages = await Promise.all(
          ids.map(async (item) => {
            const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`)
            url.searchParams.set('format', 'metadata')
            for (const header of ['From', 'To', 'Subject', 'Date']) {
              url.searchParams.append('metadataHeaders', header)
            }
            const res = await fetch(url, { headers: { Authorization: auth.Authorization } })
            if (!res.ok) return null
            const message = await res.json()
            const headers = new Map<string, string>(
              (message.payload?.headers ?? []).map((h: { name: string; value: string }) => [h.name, h.value]),
            )
            return {
              email_id: message.id,
              de: headers.get('From') ?? null,
              a: headers.get('To') ?? null,
              objet: headers.get('Subject') ?? null,
              date: headers.get('Date') ?? null,
              extrait: message.snippet ?? null,
            }
          }),
        )

        const found = messages.filter(Boolean)
        return JSON.stringify({ nombre: found.length, emails: found })
      }

      case 'google_agenda': {
        const debut = String(args.debut ?? '').trim()
        const fin = String(args.fin ?? '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
          return JSON.stringify({ erreur: 'Dates attendues au format AAAA-MM-JJ' })
        }

        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
        url.searchParams.set('timeMin', `${debut}T00:00:00Z`)
        url.searchParams.set('timeMax', `${fin}T23:59:59Z`)
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')
        url.searchParams.set('maxResults', '50')

        const res = await fetch(url, { headers: { Authorization: auth.Authorization } })
        const body = await res.json()
        if (!res.ok) return JSON.stringify({ erreur: body?.error?.message ?? `HTTP ${res.status}` })

        const items = (body.items ?? []) as Array<Record<string, any>>
        return JSON.stringify({
          nombre: items.length,
          evenements: items.map((item) => ({
            event_id: item.id,
            titre: item.summary ?? '(sans titre)',
            debut: item.start?.dateTime ?? item.start?.date ?? null,
            fin: item.end?.dateTime ?? item.end?.date ?? null,
            lieu: item.location ?? null,
            description: item.description ?? null,
            participants: (item.attendees ?? []).map((a: { email: string }) => a.email),
            lien: item.htmlLink ?? null,
          })),
        })
      }

      case 'google_agenda_creer_evenement': {
        const titre = String(args.titre ?? '').trim()
        const debut = String(args.debut ?? '').trim()
        const fin = String(args.fin ?? '').trim()
        if (!titre || !debut || !fin) {
          return JSON.stringify({ erreur: 'Titre, date de début et date de fin requis' })
        }

        const startObj = formatGoogleDate(debut)
        const endObj = formatGoogleDate(fin)

        const payload: Record<string, any> = {
          summary: titre,
          start: startObj,
          end: endObj,
        }

        if (args.description) payload.description = String(args.description)
        if (args.lieu) payload.location = String(args.lieu)
        if (Array.isArray(args.participants) && args.participants.length > 0) {
          payload.attendees = args.participants.map((email) => ({ email: String(email).trim() }))
        }

        const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        const res = await fetch(url, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify(payload),
        })

        const created = await res.json()
        if (!res.ok) {
          return JSON.stringify({ erreur: created?.error?.message ?? `HTTP ${res.status}` })
        }

        return JSON.stringify({
          succes: true,
          event_id: created.id,
          titre: created.summary,
          debut: created.start?.dateTime ?? created.start?.date,
          fin: created.end?.dateTime ?? created.end?.date,
          lieu: created.location ?? null,
          lien: created.htmlLink ?? null,
          message: `Rendez-vous « ${created.summary} » créé avec succès dans l'agenda Google.`,
        })
      }

      case 'google_agenda_modifier_evenement': {
        const eventId = String(args.event_id ?? '').trim()
        if (!eventId) return JSON.stringify({ erreur: 'event_id manquant' })

        const patchPayload: Record<string, any> = {}
        if (args.titre) patchPayload.summary = String(args.titre).trim()
        if (args.description !== undefined) patchPayload.description = String(args.description)
        if (args.lieu !== undefined) patchPayload.location = String(args.lieu)
        if (args.debut) patchPayload.start = formatGoogleDate(String(args.debut))
        if (args.fin) patchPayload.end = formatGoogleDate(String(args.fin))

        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`
        const res = await fetch(url, {
          method: 'PATCH',
          headers: auth,
          body: JSON.stringify(patchPayload),
        })

        const updated = await res.json()
        if (!res.ok) {
          return JSON.stringify({ erreur: updated?.error?.message ?? `HTTP ${res.status}` })
        }

        return JSON.stringify({
          succes: true,
          event_id: updated.id,
          titre: updated.summary,
          debut: updated.start?.dateTime ?? updated.start?.date,
          fin: updated.end?.dateTime ?? updated.end?.date,
          lieu: updated.location ?? null,
          message: `Événement « ${updated.summary} » modifié avec succès.`,
        })
      }

      case 'google_agenda_supprimer_evenement': {
        const eventId = String(args.event_id ?? '').trim()
        if (!eventId) return JSON.stringify({ erreur: 'event_id manquant' })

        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: auth.Authorization },
        })

        if (!res.ok && res.status !== 204 && res.status !== 404) {
          const body = await res.json().catch(() => ({}))
          return JSON.stringify({ erreur: body?.error?.message ?? `HTTP ${res.status}` })
        }

        return JSON.stringify({
          succes: true,
          event_id: eventId,
          message: "L'événement a bien été supprimé de votre agenda Google.",
        })
      }

      default:
        return JSON.stringify({ erreur: `Outil Google inconnu : ${name}` })
    }
  } catch (err) {
    console.error(`[google/tools] ${name}:`, err)
    return JSON.stringify({ erreur: "L'appel à Google a échoué" })
  }
}

function lisibleMimeType(mimeType: string | undefined) {
  if (!mimeType) return 'inconnu'
  const map: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Docs',
    'application/vnd.google-apps.spreadsheet': 'Google Sheets',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': 'Dossier',
    'application/pdf': 'PDF',
  }
  return map[mimeType] ?? mimeType
}
