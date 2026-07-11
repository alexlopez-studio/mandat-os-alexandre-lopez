type ServerAnalyticsParams = Record<string, string | number | boolean | null | undefined>

function isServerAnalyticsEnabled() {
  return process.env.ANALYTICS_SERVER_LOGS !== 'false'
}

export function logServerConversionEvent(name: string, params: ServerAnalyticsParams = {}) {
  if (!isServerAnalyticsEnabled()) return

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )

  console.info('[analytics]', JSON.stringify({
    event: name,
    timestamp: new Date().toISOString(),
    ...cleanParams,
  }))
}
