/**
 * Google Drive integration — placeholder.
 *
 * The actual upload flow (resumable, ~8MB chunks with retry) runs in the
 * browser to keep the app server light. Once the upload completes, the
 * client calls registerIdeaVideo() server action with the resulting
 * fileId + viewLink + thumb metadata.
 *
 * Auth modes (only one needs configuring):
 *   - SERVICE ACCOUNT (recommended for a team-shared Drive folder):
 *       GOOGLE_SERVICE_ACCOUNT_EMAIL
 *       GOOGLE_SERVICE_ACCOUNT_KEY     (PEM private key, multiline)
 *       GDRIVE_ROOT_FOLDER_ID          (the parent folder where videos land)
 *   - OAUTH PERSONAL (each user uses their own Drive):
 *       GOOGLE_OAUTH_CLIENT_ID
 *       GOOGLE_OAUTH_CLIENT_SECRET
 *       (per-user refresh tokens stored in profiles.google_oauth_refresh_token,
 *        not implemented yet — needs a migration)
 *
 * Until env is set, server actions surface a friendly error so the UI can
 * display "configura Google Drive" prompt without crashing the app.
 */

export type DriveAuthMode = 'service_account' | 'oauth' | null

export function getDriveAuthMode(): DriveAuthMode {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GDRIVE_ROOT_FOLDER_ID) {
    return 'service_account'
  }
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return 'oauth'
  }
  return null
}

export function isDriveConfigured(): boolean {
  return getDriveAuthMode() !== null
}

/**
 * Generate a service-account JWT bearer token. Lazy — only run when an
 * upload is actually starting. Implemented when the user picks the
 * service_account mode and adds the env vars.
 */
export async function getServiceAccountAccessToken(): Promise<{ token?: string; error?: string }> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !key) return { error: 'Service account no configurado' }

  // TODO: implement JWT signing (RS256) → exchange at oauth2.googleapis.com/token
  // We deliberately stub this until the user confirms which mode to use,
  // because signing requires importing crypto + base64url helpers and
  // we don't want bundle weight on the server until the feature is live.
  return { error: 'Implementación pendiente — confirma modo (service account vs OAuth) para terminar.' }
}
