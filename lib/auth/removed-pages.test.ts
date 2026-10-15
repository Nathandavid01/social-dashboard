import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { AREAS, ALWAYS_ALLOWED_PREFIXES, LANDING_PATH, canAccessPath } from './areas'
import { navItems } from '@/components/layout/nav-items'
import { primerRoundCtas } from '@/lib/primer-round/studio'
import { cadenceRevalidatePaths } from '@/lib/utils/client-cadence'

// Eric 2026-10-14: «Inicio» (/home) y «Escribir ideas» (/escribir-ideas) se
// quitan del dashboard del todo. Todo lo que caía en /home ahora cae en /mi-dia.
const ROOT = path.resolve(__dirname, '../..')
const GONE = ['/home', '/escribir-ideas']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(rel))
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel)
  }
  return out
}

describe('páginas quitadas: /home y /escribir-ideas', () => {
  it('ya no existen sus rutas', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/(dashboard)/home'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'app/(dashboard)/escribir-ideas'))).toBe(false)
  })

  it('no salen en el menú ni son áreas', () => {
    const hrefs = navItems.map((n) => n.href)
    for (const href of GONE) {
      expect(hrefs).not.toContain(href)
      expect(AREAS.find((a) => a.href === href)).toBeUndefined()
      expect(ALWAYS_ALLOWED_PREFIXES).not.toContain(href)
    }
  })

  it('el aterrizaje de respaldo es /mi-dia y siempre se puede entrar', () => {
    expect(LANDING_PATH).toBe('/mi-dia')
    expect(canAccessPath(LANDING_PATH, 'editor', [])).toBe(true)
  })

  it('la PWA abre en /mi-dia', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8'))
    expect(manifest.start_url).toBe('/mi-dia')
  })

  it('Primer Round manda las ideas al Lab de Ideas', () => {
    expect(primerRoundCtas('cid').ideas).toBe('/idea-lab')
  })

  it('cadencia ya no revalida /home', () => {
    expect(cadenceRevalidatePaths('c1')).not.toContain('/home')
  })

  it('ningún archivo de código enlaza, redirige ni revalida esas rutas', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('components'), ...sourceFiles('lib'), 'middleware.ts']
    const hits: string[] = []
    for (const file of files) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
      for (const href of GONE) {
        if (new RegExp(`['"\`]${href}(['"\`#?/])`).test(text)) hits.push(`${file} → ${href}`)
      }
    }
    expect(hits).toEqual([])
  })
})
