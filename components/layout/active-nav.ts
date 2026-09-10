/** Match one visible navigation entry, preferring the most specific route. */
export function activeNavHref(pathname: string, hrefs: readonly string[]): string | null {
  return hrefs.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(href + '/')
    return matches && (!best || href.length > best.length) ? href : best
  }, null)
}
