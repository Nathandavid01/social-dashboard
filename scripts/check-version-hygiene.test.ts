import { describe, expect, it } from 'vitest'
import {
  checkVersionHygiene,
  extractAppVersion,
  extractChangelogVersions,
  findDuplicateVersions,
} from './check-version-hygiene.mjs'

describe('extractChangelogVersions', () => {
  it('reads ## vX.Y headers in file order, including patch and undated', () => {
    const markdown = `# Changelog

## v5.8 — 2026-09-21

notes

## v3.93.1 — 2026-08-30

## v4.75
`

    expect(extractChangelogVersions(markdown)).toEqual(['5.8', '3.93.1', '4.75'])
  })

  it('ignores version mentions that are not headers', () => {
    const markdown = `See v5.7 in the sidebar.

![Panel](/changelog/v5.6-panel-pool.png)

### v5.0 subsection
`

    expect(extractChangelogVersions(markdown)).toEqual([])
  })
})

describe('findDuplicateVersions', () => {
  it('returns versions that appear more than once', () => {
    expect(findDuplicateVersions(['5.8', '5.7', '5.8', '4.75'])).toEqual(['5.8'])
  })

  it('returns empty when every header is unique', () => {
    expect(findDuplicateVersions(['5.8', '5.7', '5.6'])).toEqual([])
  })
})

describe('extractAppVersion', () => {
  it('reads APP_VERSION from version.ts', () => {
    expect(extractAppVersion("export const APP_VERSION = '5.8'\n")).toBe('5.8')
  })

  it('returns null when the export is missing', () => {
    expect(extractAppVersion('export const OTHER = "1"\n')).toBeNull()
  })
})

describe('checkVersionHygiene', () => {
  const versionTs = "export const APP_VERSION = '5.8'\n"

  it('passes when the latest header matches APP_VERSION and headers are unique', () => {
    const result = checkVersionHygiene({
      changelog: '## v5.8 — 2026-09-21\n\n## v5.7 — 2026-09-20\n',
      versionTs,
    })

    expect(result).toMatchObject({ ok: true, errors: [], appVersion: '5.8' })
    expect(result.versions).toEqual(['5.8', '5.7'])
  })

  it('fails when CHANGELOG repeats a version header', () => {
    const result = checkVersionHygiene({
      changelog: '## v5.8 — today\n\n## v5.7\n\n## v5.8 — again\n',
      versionTs,
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/duplicate/i)
    expect(result.errors.join('\n')).toMatch(/5\.8/)
  })

  it('fails when APP_VERSION does not match the latest CHANGELOG header', () => {
    const result = checkVersionHygiene({
      changelog: '## v5.8 — 2026-09-21\n\n## v5.7 — 2026-09-20\n',
      versionTs: "export const APP_VERSION = '5.7'\n",
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/5\.7/)
    expect(result.errors.join('\n')).toMatch(/5\.8/)
  })

  it('fails when CHANGELOG has no version headers', () => {
    const result = checkVersionHygiene({
      changelog: '# Changelog\n\nNo versions yet.\n',
      versionTs,
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/no version headers/i)
  })
})
