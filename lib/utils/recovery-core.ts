export function isRecoveryLink(href: string): boolean {
  const url = new URL(href, 'http://localhost')
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
  return url.searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery'
}

export function recoveryTokensFromHref(href: string): { accessToken: string; refreshToken: string } | null {
  const url = new URL(href, 'http://localhost')
  const params = new URLSearchParams(url.hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}
