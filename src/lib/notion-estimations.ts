type NotionEstimationInput = {
  token: string
  type: string
  email: string
  prenom?: string
  nom?: string
  telephone?: string
  formData: Record<string, unknown>
  results: Record<string, unknown>
  magicLinkUrl: string
}

type NotionSearchPage = {
  id?: string
  object?: string
}

type NotionRichText = {
  plain_text?: string
  text?: { content?: string }
}

type NotionBlock = {
  id?: string
  type?: string
  heading_2?: { rich_text?: NotionRichText[] }
  paragraph?: { rich_text?: NotionRichText[] }
  code?: { rich_text?: NotionRichText[] }
}

export type NotionEstimationRecord = {
  token: string
  type?: string
  email?: string
  telephone?: string
  magicLinkUrl?: string
  submittedAt?: string
  formData: Record<string, unknown>
  results: Record<string, unknown>
  pageId: string
}

const NOTION_VERSION = '2022-06-28'
const NOTION_API_BASE_URL = 'https://api.notion.com/v1'

/**
 * Best-effort Notion backup for estimation submissions.
 *
 * This is intentionally non-blocking: the estimation must remain usable even if
 * Notion is not configured or rejects a property schema.
 *
 * Recommended env for the current estimation-first phase:
 * - NOTION_API_KEY
 * - NOTION_ESTIMATIONS_PARENT_PAGE_ID
 *
 * Optional database mode:
 * - NOTION_ESTIMATIONS_DATABASE_ID (expects a title property named "Name")
 */
export async function saveEstimationToNotion(
  input: NotionEstimationInput,
): Promise<{ ok: boolean; pageId?: string; skipped?: boolean; error?: string }> {
  const apiKey = process.env.NOTION_API_KEY
  const parentPageId = process.env.NOTION_ESTIMATIONS_PARENT_PAGE_ID
  const databaseId = process.env.NOTION_ESTIMATIONS_DATABASE_ID

  if (!apiKey || (!parentPageId && !databaseId)) {
    return { ok: false, skipped: true }
  }

  const title = buildTitle(input)
  const body = buildPageBody(input)

  const payload = databaseId
    ? {
        parent: { database_id: databaseId },
        properties: {
          Name: titleProperty(title),
        },
        children: body,
      }
    : {
        parent: { page_id: parentPageId },
        properties: {
          title: titleProperty(title),
        },
        children: body,
      }

  try {
    const res = await notionFetch('/pages', {
      method: 'POST',
      apiKey,
      body: payload,
    })

    if (!res.ok) {
      const detail = await safeText(res)
      return { ok: false, error: `Notion ${res.status}: ${detail}` }
    }

    const json = (await res.json()) as { id?: string }
    return { ok: true, pageId: json.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown Notion error',
    }
  }
}

/**
 * Load an estimation from the Notion backup using the token in the magic link.
 *
 * This is intentionally best-effort and returns null when Notion is not
 * configured. The result page can then fall back to the local browser store.
 */
export async function loadEstimationFromNotionByToken(
  token: string,
): Promise<NotionEstimationRecord | null> {
  const apiKey = process.env.NOTION_API_KEY
  if (!apiKey || token.trim().length === 0) return null

  try {
    const pageId = await findPageIdByToken({ token, apiKey })
    if (!pageId) return null

    const sections = await loadPageSections({ pageId, apiKey })
    const summary = sections['Résumé'] ?? ''
    const formData = parseJsonSection(sections['Formulaire'])
    const results = parseJsonSection(sections['Résultat estimation'])

    if (!formData || !results) return null

    return {
      token,
      ...parseSummary(summary),
      formData,
      results,
      pageId,
    }
  } catch (err) {
    console.error('[Notion estimation lookup] échec :', err)
    return null
  }
}

async function findPageIdByToken({ token, apiKey }: { token: string; apiKey: string }) {
  const databaseId = process.env.NOTION_ESTIMATIONS_DATABASE_ID

  if (databaseId) {
    const fromDatabase = await findDatabasePageIdByToken({ token, apiKey, databaseId })
    if (fromDatabase) return fromDatabase
  }

  const res = await notionFetch('/search', {
    method: 'POST',
    apiKey,
    body: {
      query: token,
      page_size: 10,
      filter: { value: 'page', property: 'object' },
    },
  })

  if (!res.ok) return null
  const json = (await res.json()) as { results?: NotionSearchPage[] }
  const candidates = (json.results ?? []).filter((item) => item.object === 'page' && item.id)

  for (const page of candidates) {
    if (!page.id) continue
    const sections = await loadPageSections({ pageId: page.id, apiKey })
    if ((sections['Résumé'] ?? '').includes(token)) return page.id
  }

  return null
}

async function findDatabasePageIdByToken({
  token,
  apiKey,
  databaseId,
}: {
  token: string
  apiKey: string
  databaseId: string
}) {
  const res = await notionFetch(`/databases/${databaseId}/query`, {
    method: 'POST',
    apiKey,
    body: {
      page_size: 10,
      filter: {
        property: 'Name',
        title: { contains: token },
      },
    },
  })

  if (!res.ok) return null
  const json = (await res.json()) as { results?: NotionSearchPage[] }
  return json.results?.find((page) => page.object === 'page' && page.id)?.id ?? null
}

async function loadPageSections({ pageId, apiKey }: { pageId: string; apiKey: string }) {
  const blocks = await loadAllBlockChildren({ blockId: pageId, apiKey })
  const sections: Record<string, string> = {}
  let currentSection: string | null = null

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      currentSection = richTextToPlain(block.heading_2?.rich_text)
      if (currentSection) sections[currentSection] = ''
      continue
    }

    if (!currentSection) continue

    if (block.type === 'paragraph') {
      sections[currentSection] += richTextToPlain(block.paragraph?.rich_text)
      sections[currentSection] += '\n'
      continue
    }

    if (block.type === 'code') {
      sections[currentSection] += richTextToPlain(block.code?.rich_text)
      sections[currentSection] += '\n'
    }
  }

  return sections
}

async function loadAllBlockChildren({ blockId, apiKey }: { blockId: string; apiKey: string }) {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined

  do {
    const path = `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    const res = await notionFetch(path, { method: 'GET', apiKey })
    if (!res.ok) break
    const json = (await res.json()) as {
      results?: NotionBlock[]
      has_more?: boolean
      next_cursor?: string | null
    }
    blocks.push(...(json.results ?? []))
    cursor = json.has_more && json.next_cursor ? json.next_cursor : undefined
  } while (cursor)

  return blocks
}

function parseJsonSection(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value.trim())
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function parseSummary(summary: string) {
  const lines = summary.split('\n')
  const out: Pick<NotionEstimationRecord, 'type' | 'email' | 'telephone' | 'magicLinkUrl' | 'submittedAt'> = {}

  for (const line of lines) {
    const [label, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    if (!value) continue

    if (label === 'Type') out.type = value
    if (label === 'Email') out.email = value
    if (label === 'Téléphone') out.telephone = value
    if (label === 'Magic link') out.magicLinkUrl = value
    if (label === 'Soumission') out.submittedAt = value
  }

  return out
}

function buildTitle(input: NotionEstimationInput): string {
  const name = [input.prenom, input.nom].filter(Boolean).join(' ').trim()
  const adresse = stringValue(input.formData.adresse)
  return [
    'Estimation',
    input.token,
    name || input.email,
    adresse,
  ].filter(Boolean).join(' — ')
}

function buildPageBody(input: NotionEstimationInput) {
  const summary = [
    `Token : ${input.token}`,
    `Type : ${input.type}`,
    `Email : ${input.email}`,
    input.telephone ? `Téléphone : ${input.telephone}` : null,
    `Magic link : ${input.magicLinkUrl}`,
    `Soumission : ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  return [
    heading('Résumé'),
    paragraph(summary),
    heading('Coordonnées'),
    codeBlock(JSON.stringify({
      prenom: input.prenom ?? null,
      nom: input.nom ?? null,
      email: input.email,
      telephone: input.telephone ?? null,
    }, null, 2)),
    heading('Formulaire'),
    ...jsonBlocks(input.formData),
    heading('Résultat estimation'),
    ...jsonBlocks(input.results),
  ]
}

function notionFetch(
  path: string,
  input: { method: 'GET' | 'POST'; apiKey: string; body?: unknown },
) {
  return fetch(`${NOTION_API_BASE_URL}${path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  })
}

function richTextToPlain(value: NotionRichText[] | undefined): string {
  return (value ?? []).map((item) => item.plain_text ?? item.text?.content ?? '').join('')
}

function titleProperty(content: string) {
  return {
    title: [{ type: 'text', text: { content: truncate(content, 1800) } }],
  }
}

function heading(content: string) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content } }] },
  }
}

function paragraph(content: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: truncate(content, 1800) } }] },
  }
}

function codeBlock(content: string) {
  return {
    object: 'block',
    type: 'code',
    code: {
      language: 'json',
      rich_text: [{ type: 'text', text: { content: truncate(content, 1800) } }],
    },
  }
}

function jsonBlocks(value: Record<string, unknown>) {
  const json = JSON.stringify(value, null, 2)
  return split(json, 1800).map(codeBlock)
}

function split(value: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size))
  }
  return chunks.length > 0 ? chunks : ['{}']
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

async function safeText(res: Response): Promise<string> {
  try {
    return truncate(await res.text(), 500)
  } catch {
    return 'Unable to read response body'
  }
}
