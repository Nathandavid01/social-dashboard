/** Display only: preserve stored client names and identifiers. */
export function clientDisplayName(value: string): string {
  return value.trim().split(/\s+/).map(word => {
    if (/^(PR|PVC|LLC|PNP|AA|VSS|AI|USA)$/i.test(word)) return word.toUpperCase()
    if (/^\d+(am|pm|k)$/i.test(word)) return word.toUpperCase()
    return word.toLocaleLowerCase('es-PR').replace(/(^|[-/])\p{L}/gu, letter => letter.toLocaleUpperCase('es-PR'))
  }).join(' ')
}
