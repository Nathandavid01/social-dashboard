/**
 * Guard against PostgREST PGRST201 on content_ideas ↔ content_idea_videos.
 *
 * History: a second FK (content_ideas.editing_source_video_id → videos)
 * made any bare embed fail with:
 *   "Could not embed because more than one relationship was found for
 *    'content_ideas' and 'content_idea_videos'"
 * That took down /revision (and any page that joins videos on ideas).
 *
 * Rules enforced here (static, no network):
 *  1. Never embed either table without an explicit !relationship hint.
 *  2. The only allowed hint for the videos-of-an-idea join is
 *     content_idea_videos_idea_id_fkey (or the column short form idea_id).
 *  3. Scan app/, lib/, AND components/.
 *  4. Catch multiline selects, aliased embeds, reverse embeds, and wrong FKs.
 *
 * Live schema check (second FK reintroduced) lives in
 * scripts/check-content-idea-video-schema.mjs + *.live.test.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_DIRS = ['app', 'lib', 'components']

/** FK that means "videos belonging to this idea" (the only join we want). */
export const ALLOWED_IDEA_TO_VIDEOS_HINTS = [
  'content_idea_videos_idea_id_fkey',
  'idea_id',
]

/** When embedding content_ideas FROM content_idea_videos, same FK (reverse view). */
export const ALLOWED_VIDEOS_TO_IDEA_HINTS = [
  'content_idea_videos_idea_id_fkey',
  'idea_id',
]

function sourceFiles(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') return []
      return sourceFiles(path)
    }
    if (!entry.name.match(/\.tsx?$/) || entry.name.match(/\.(test|spec)\.tsx?$/)) return []
    return [path]
  })
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function loc(root, file, index, source) {
  return `${relative(root, file)}:${lineAt(source, index)}`
}

function isCommentLine(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line)
}

function lineOf(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1
  const lineEnd = source.indexOf('\n', index)
  return source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
}

function windowBefore(source, index, size = 220) {
  return source.slice(Math.max(0, index - size), index + 50)
}

/**
 * Detailed findings (type + location + message).
 */
export function findContentIdeaVideoRelationshipFindings(root = process.cwd()) {
  const findings = []

  // Bare embed without any !hint (PGRST201 when 2+ FKs exist).
  const bareVideosEmbed = /(?:\b\w+\s*:\s*)?content_idea_videos\s*(?!!)\s*\(/g
  // Embed with a hint — validate allow-list (blocks reverse FKs).
  const hintedVideosEmbed =
    /(?:\b\w+\s*:\s*)?content_idea_videos\s*!\s*([A-Za-z0-9_]+)\s*\(/g
  const bareIdeasEmbed = /(?:\b\w+\s*:\s*)?content_ideas\s*(?!!)\s*\(/g
  const hintedIdeasEmbed =
    /(?:\b\w+\s*:\s*)?content_ideas\s*!\s*([A-Za-z0-9_]+)\s*\(/g

  for (const file of SOURCE_DIRS.flatMap((dir) => sourceFiles(join(root, dir)))) {
    const source = readFileSync(file, 'utf8')
    const hasFromIdeas = /\.from\(\s*['"]content_ideas['"]\s*\)/.test(source)
    const hasFromVideos = /\.from\(\s*['"]content_idea_videos['"]\s*\)/.test(source)

    // --- ideas → videos ---
    bareVideosEmbed.lastIndex = 0
    hintedVideosEmbed.lastIndex = 0
    let match
    while ((match = bareVideosEmbed.exec(source)) !== null) {
      const line = lineOf(source, match.index)
      if (isCommentLine(line)) continue
      // `.from('content_idea_videos')` is a table source, not an embed.
      if (/\.from\s*\(\s*['"]content_idea_videos['"]\s*\)/.test(line)) continue
      const win = windowBefore(source, match.index)
      const looksLikeSelect =
        /\.select\s*\(|select\s*[`'(]|videos\s*:/i.test(win) || hasFromIdeas
      if (!looksLikeSelect) continue
      findings.push({
        type: 'bare_videos_embed',
        location: loc(root, file, match.index, source),
        message:
          'Embed content_idea_videos without !foreign_key hint (PGRST201 risk). Use !content_idea_videos_idea_id_fkey',
      })
    }

    while ((match = hintedVideosEmbed.exec(source)) !== null) {
      const hint = match[1]
      if (!ALLOWED_IDEA_TO_VIDEOS_HINTS.includes(hint)) {
        findings.push({
          type: 'disallowed_videos_hint',
          location: loc(root, file, match.index, source),
          message: `Disallowed embed hint content_idea_videos!${hint} — use !content_idea_videos_idea_id_fkey (never reverse FKs like editing_source_video_id)`,
        })
      }
    }

    // --- videos → ideas (only when this file queries videos) ---
    if (!hasFromVideos) continue

    bareIdeasEmbed.lastIndex = 0
    hintedIdeasEmbed.lastIndex = 0
    while ((match = bareIdeasEmbed.exec(source)) !== null) {
      const line = lineOf(source, match.index)
      if (isCommentLine(line)) continue
      if (/\.from\s*\(\s*['"]content_ideas['"]\s*\)/.test(line)) continue
      const win = windowBefore(source, match.index)
      if (!/\.select\s*\(|select\s*[`'(]|idea\s*:/i.test(win)) continue
      findings.push({
        type: 'bare_ideas_embed',
        location: loc(root, file, match.index, source),
        message:
          'Embed content_ideas without !foreign_key hint from content_idea_videos. Use !content_idea_videos_idea_id_fkey',
      })
    }
    while ((match = hintedIdeasEmbed.exec(source)) !== null) {
      const hint = match[1]
      if (!ALLOWED_VIDEOS_TO_IDEA_HINTS.includes(hint)) {
        findings.push({
          type: 'disallowed_ideas_hint',
          location: loc(root, file, match.index, source),
          message: `Disallowed embed hint content_ideas!${hint} — use !content_idea_videos_idea_id_fkey`,
        })
      }
    }
  }

  return findings
}

/**
 * Back-compat API used by tests + older callers: list of "file:line" locations.
 */
export function findAmbiguousContentIdeaVideoEmbeds(root = process.cwd()) {
  return findContentIdeaVideoRelationshipFindings(root).map((f) => f.location)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  const findings = findContentIdeaVideoRelationshipFindings()
  if (findings.length > 0) {
    console.error('Ambiguous / disallowed PostgREST relationship embeds found:')
    for (const f of findings) {
      console.error(`- ${f.location}: ${f.message}`)
    }
    console.error('')
    console.error('Always use: videos:content_idea_videos!content_idea_videos_idea_id_fkey(...)')
    console.error('Never reintroduce a second FK between content_ideas and content_idea_videos.')
    process.exitCode = 1
  } else {
    console.log('PostgREST relationship embeds are explicit and use the allowed idea_id FK.')
  }
}
