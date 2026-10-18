import { describe, it, expect } from 'vitest'
import { compareVersions, parseChangelog, entriesToShow } from './entries'

const MD = `# Changelog

Intro que no es una entrada.

## v5.139 — 2026-10-18

**Ya puedes eliminar un borrador.**
- Abre un post «Borrador».
- Te pide confirmar.

[Ver diseño](/previews/v5.139-borrar-borrador.html)

![Eliminar borrador](/changelog/v5.139-borrar-borrador.png)

## v5.138 — 2026-10-16

**Recibos muestra tus videos pendientes.**
- Selecciona un cliente.

## v4.76

**Cada idea explica qué quiere lograr.**
- El objetivo aparece en la propuesta.

## v3.93.1 — 2026-08-30

**Login más simple.**

- Nuevo botón Google.
`

describe('compareVersions', () => {
  it('compara numéricamente cada parte, no como texto', () => {
    expect(compareVersions('5.139', '5.14')).toBeGreaterThan(0)
    expect(compareVersions('5.9', '5.10')).toBeLessThan(0)
    expect(compareVersions('3.93.1', '3.93')).toBeGreaterThan(0)
    expect(compareVersions('5.139', '5.139')).toBe(0)
  })
})

describe('parseChangelog', () => {
  const entries = parseChangelog(MD)

  it('saca una entrada por cada «## vX.Y», con o sin fecha', () => {
    expect(entries.map((e) => e.version)).toEqual(['5.139', '5.138', '4.76', '3.93.1'])
    expect(entries[0].date).toBe('2026-10-18')
    expect(entries[2].date).toBeNull()
  })

  it('separa el titular en negrita del resto del cuerpo', () => {
    expect(entries[0].headline).toBe('Ya puedes eliminar un borrador.')
    expect(entries[0].body).toContain('- Abre un post «Borrador».')
    expect(entries[0].media).toEqual({ kind: 'image', src: '/changelog/v5.139-borrar-borrador.png', alt: 'Eliminar borrador' })
    expect(entries[0].body).toContain('[Ver diseño](/previews/v5.139-borrar-borrador.html)')
    expect(entries[0].body).not.toContain('**Ya puedes')
  })

  it('el cuerpo no arrastra la siguiente entrada', () => {
    expect(entries[1].body).not.toContain('v4.76')
    expect(entries[3].body.trim()).toBe('- Nuevo botón Google.')
  })
})

describe('parseChangelog con el formato actual de main', () => {
  const md = `## v5.146 — 18 de octubre de 2026

**Semanas restantes.**
- Resumen.

![Semanas restantes](/changelog/v5.146-calendar-weeks.png)

## v5.145 — 18 de octubre de 2026

**Recibos reúne mejoras.**
- Sin captura.

## Acceso local — 18 de octubre de 2026 (incluido en v5.145)

**Un acceso más claro.**

![Acceso](/changelog/v5.139-login.png)

# Changelog

Intro.

## v5.144 — 18 de octubre de 2026

**Grabación nueva.**

![Demo en video](/changelog/v5.144-demo.mp4)

## v5.143

**Solo diseño.**

[Ver diseño](/previews/v5.143-algo.html)
`
  const entries = parseChangelog(md)

  it('acepta la fecha escrita en palabras', () => {
    expect(entries[0].version).toBe('5.146')
    expect(entries[0].date).toBe('18 de octubre de 2026')
  })

  it('un «##» que no es versión (o el «# Changelog») corta la entrada anterior', () => {
    expect(entries.map((e) => e.version)).toEqual(['5.146', '5.145', '5.144', '5.143'])
    expect(entries[1].body).not.toContain('Acceso')
    expect(entries[1].body).not.toContain('Intro')
  })

  it('saca la primera captura como media y la quita del cuerpo', () => {
    expect(entries[0].media).toEqual({
      kind: 'image',
      src: '/changelog/v5.146-calendar-weeks.png',
      alt: 'Semanas restantes',
    })
    expect(entries[0].body).not.toContain('calendar-weeks.png')
  })

  it('un .mp4 es video', () => {
    expect(entries[2].media).toEqual({ kind: 'video', src: '/changelog/v5.144-demo.mp4', alt: 'Demo en video' })
  })

  it('sin captura usa el diseño interactivo (preview) como media', () => {
    expect(entries[3].media).toEqual({ kind: 'preview', src: '/previews/v5.143-algo.html', alt: 'Solo diseño.' })
  })

  it('sin captura ni diseño no hay media', () => {
    expect(entries[1].media).toBeNull()
  })
})

describe('entriesToShow', () => {
  const entries = parseChangelog(MD)

  it('muestra lo nuevo desde la última versión vista, de la más nueva a la más vieja', () => {
    const shown = entriesToShow(entries, { lastSeen: '4.76', current: '5.139' })
    expect(shown.map((e) => e.version)).toEqual(['5.139', '5.138'])
  })

  it('si ya vio la versión actual no hay nada que mostrar', () => {
    expect(entriesToShow(entries, { lastSeen: '5.139', current: '5.139' })).toEqual([])
  })

  it('primera vez (nunca vio nada): solo la novedad más reciente, no 300 entradas', () => {
    const shown = entriesToShow(entries, { lastSeen: null, current: '5.139' })
    expect(shown.map((e) => e.version)).toEqual(['5.139'])
  })

  it('nunca muestra entradas posteriores a la versión que corre el navegador', () => {
    const shown = entriesToShow(entries, { lastSeen: '4.76', current: '5.138' })
    expect(shown.map((e) => e.version)).toEqual(['5.138'])
  })

  it('limita la cantidad para quien estuvo mucho tiempo fuera', () => {
    const shown = entriesToShow(entries, { lastSeen: '1.0', current: '5.139', max: 2 })
    expect(shown.map((e) => e.version)).toEqual(['5.139', '5.138'])
  })

  it('una versión guardada inválida se trata como primera vez', () => {
    const shown = entriesToShow(entries, { lastSeen: 'basura', current: '5.139' })
    expect(shown.map((e) => e.version)).toEqual(['5.139'])
  })
})

describe('CHANGELOG.md real', () => {
  it('la versión actual tiene su entrada con titular (si no, «Novedades» sale vacío)', async () => {
    const { readFileSync } = await import('node:fs')
    const { APP_VERSION } = await import('@/lib/version')
    const entries = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))
    const current = entries.find((e) => e.version === APP_VERSION)
    expect(current?.headline).toBeTruthy()
  })

  it('la versión actual trae foto o video de lo que cambió (Novedades lo enseña)', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const { APP_VERSION } = await import('@/lib/version')
    const current = parseChangelog(readFileSync('CHANGELOG.md', 'utf8')).find((e) => e.version === APP_VERSION)
    expect(current?.media?.kind, 'añade ![...](/changelog/vX.Y-....png|.mp4) a la entrada').toMatch(/^(image|video)$/)
    expect(existsSync(`public${current!.media!.src}`)).toBe(true)
  })
})
