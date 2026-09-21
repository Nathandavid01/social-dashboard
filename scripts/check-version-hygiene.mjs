#!/usr/bin/env node
/**
 * Version / CHANGELOG hygiene — fails when headers are duplicated or
 * lib/version.ts APP_VERSION does not match the latest CHANGELOG entry.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION_HEADER_RE = /^##\s+v(\d+\.\d+(?:\.\d+)?)\b/gm
const APP_VERSION_RE = /export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/

/** @param {string} markdown */
export function extractChangelogVersions(markdown) {
  const versions = []
  const re = new RegExp(VERSION_HEADER_RE.source, VERSION_HEADER_RE.flags)
  let match
  while ((match = re.exec(markdown))) {
    versions.push(match[1])
  }
  return versions
}

/** @param {string[]} versions */
export function findDuplicateVersions(versions) {
  const counts = new Map()
  for (const version of versions) {
    counts.set(version, (counts.get(version) || 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([version]) => version)
}

/** @param {string} source */
export function extractAppVersion(source) {
  return source.match(APP_VERSION_RE)?.[1] ?? null
}

/**
 * @param {{ changelog: string, versionTs: string }} files
 * @returns {{ ok: boolean, errors: string[], versions: string[], appVersion: string | null }}
 */
export function checkVersionHygiene({ changelog, versionTs }) {
  const errors = []
  const versions = extractChangelogVersions(changelog)
  const appVersion = extractAppVersion(versionTs)

  if (versions.length === 0) {
    errors.push('CHANGELOG has no version headers (expected ## vX.Y)')
  }

  const duplicates = findDuplicateVersions(versions)
  if (duplicates.length > 0) {
    errors.push(`CHANGELOG has duplicate version headers: ${duplicates.join(', ')}`)
  }

  if (!appVersion) {
    errors.push('lib/version.ts has no APP_VERSION export')
  } else if (versions[0] && versions[0] !== appVersion) {
    errors.push(
      `APP_VERSION ${appVersion} does not match latest CHANGELOG v${versions[0]}`,
    )
  }

  return { ok: errors.length === 0, errors, versions, appVersion }
}

/** @param {string} [root] */
export function checkVersionHygieneFromFiles(root = process.cwd()) {
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
  const versionTs = readFileSync(resolve(root, 'lib/version.ts'), 'utf8')
  return checkVersionHygiene({ changelog, versionTs })
}

function main() {
  const result = checkVersionHygieneFromFiles()
  if (result.ok) {
    console.log(`version-hygiene: PASS (APP_VERSION ${result.appVersion} matches latest CHANGELOG)`)
    return
  }
  console.error('version-hygiene: FAIL')
  for (const error of result.errors) {
    console.error(`  • ${error}`)
  }
  process.exitCode = 1
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : null
if (invoked === fileURLToPath(import.meta.url)) {
  main()
}
