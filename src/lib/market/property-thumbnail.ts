function firstImageUrl(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstImageUrl(item)
      if (url) return url
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['url', 'src', 'href', 'originalUrl', 'largeUrl', 'mediumUrl', 'smallUrl']) {
      const url = firstImageUrl(record[key])
      if (url) return url
    }
  }

  return null
}

export function propertyThumbnailUrl(rawJson: unknown): string | null {
  if (!rawJson || typeof rawJson !== 'object') return null
  const raw = rawJson as Record<string, unknown>
  const firstAdvert = Array.isArray(raw.adverts) && raw.adverts[0] && typeof raw.adverts[0] === 'object'
    ? raw.adverts[0] as Record<string, unknown>
    : {}

  return (
    firstImageUrl(raw.photos) ??
    firstImageUrl(raw.images) ??
    firstImageUrl(raw.pictures) ??
    firstImageUrl(firstAdvert.photos) ??
    firstImageUrl(firstAdvert.images) ??
    firstImageUrl(firstAdvert.pictures)
  )
}
