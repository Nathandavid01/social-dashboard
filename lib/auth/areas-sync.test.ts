/**
 * Guards that the area registry (lib/auth/areas.ts) stays in sync with the real
 * routes under app/(dashboard) — automatically, in CI:
 *
 *   - Add a feature (new route) → this test fails until it's registered as an
 *     AREA (so it appears in the admin permission UI and gets gated) or listed
 *     as an intentional non-area route.
 *   - Delete a feature → a dangling AREA whose route no longer exists fails the
 *     test, so removed things drop out of the permission UI.
 *
 * This is what makes "future features and deleted things adjust automatically".
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { AREAS } from './areas'

const DASHBOARD_DIR = join(process.cwd(), 'app', '(dashboard)')

/**
 * Routes under (dashboard) that are deliberately NOT gated areas: personal/
 * essential pages every signed-in user can always reach. Adding a new top-level
 * route forces a conscious choice — register it as an AREA or add it here.
 */
const NON_AREA_ROUTES = new Set<string>([
  '/home',       // mandatory landing
  '/changelog',  // release notes, everyone
  '/account',    // personal account (e.g. /account/security)
  '/settings/metricool', // personal Metricool connection
])

/** Top-level route hrefs that have their own page.tsx. */
function topLevelRoutes(): string[] {
  return readdirSync(DASHBOARD_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('[') && !d.name.startsWith('('))
    .filter((d) => existsSync(join(DASHBOARD_DIR, d.name, 'page.tsx')))
    .map((d) => `/${d.name}`)
}

/** settings/* subroutes that have a page.tsx. */
function settingsRoutes(): string[] {
  const dir = join(DASHBOARD_DIR, 'settings')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'page.tsx')))
    .map((d) => `/settings/${d.name}`)
}

const areaHrefs = new Set(AREAS.map((a) => a.href))

describe('area registry ↔ routes sync', () => {
  it('every real route is a registered area or an explicit non-area route', () => {
    const routes = [...topLevelRoutes(), ...settingsRoutes()]
    const unregistered = routes.filter((r) => !areaHrefs.has(r) && !NON_AREA_ROUTES.has(r))
    expect(
      unregistered,
      `These routes exist but aren't registered as areas (add to AREAS in lib/auth/areas.ts ` +
        `so they show in the permission UI and get gated, or to NON_AREA_ROUTES if intentionally open): ` +
        unregistered.join(', '),
    ).toEqual([])
  })

  it('every registered area maps to a route that actually exists', () => {
    const dangling = AREAS.filter((a) => {
      const segments = a.href.replace(/^\//, '').split('/')
      return !existsSync(join(DASHBOARD_DIR, ...segments, 'page.tsx'))
    }).map((a) => a.href)
    expect(
      dangling,
      `These areas point to routes that no longer exist (remove them from AREAS): ${dangling.join(', ')}`,
    ).toEqual([])
  })
})
