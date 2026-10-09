/**
 * Follows a signed download URL (Content-Disposition: attachment) in the same
 * tab: the browser saves the file and the page stays put. Safe after an await —
 * unlike window.open(url, '_blank'), which Safari/iOS blocks once the click's
 * user gesture is gone.
 */
export function followDownload(url: string): void {
  const link = document.createElement('a')
  link.href = url
  document.body.appendChild(link)
  link.click()
  link.remove()
}
