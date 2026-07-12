export function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.MANDAT_OS_DEV_AUTH_BYPASS !== '0'
}
