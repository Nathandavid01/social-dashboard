import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_DIRS = ['app', 'lib']

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    if (!entry.name.match(/\.tsx?$/) || entry.name.match(/\.(test|spec)\.tsx?$/)) return []
    return [path]
  })
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length
}

export function findAmbiguousContentIdeaVideoEmbeds(root = process.cwd()) {
  const ambiguous = []

  for (const file of SOURCE_DIRS.flatMap((dir) => sourceFiles(join(root, dir)))) {
    const source = readFileSync(file, 'utf8')
    const checks = [
      {
        applies: /\.from\(\s*['"]content_ideas['"]\s*\)/.test(source),
        pattern: /(?:\b\w+:)?content_idea_videos\s*\(/g,
      },
      {
        applies: /\.from\(\s*['"]content_idea_videos['"]\s*\)/.test(source),
        pattern: /(?:\b\w+:)?content_ideas\s*\(/g,
      },
    ]

    for (const check of checks) {
      if (!check.applies) continue
      let match
      while ((match = check.pattern.exec(source)) !== null) {
        ambiguous.push(`${relative(root, file)}:${lineAt(source, match.index)}`)
      }
    }
  }

  return ambiguous
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  const ambiguous = findAmbiguousContentIdeaVideoEmbeds()
  if (ambiguous.length > 0) {
    console.error('Ambiguous PostgREST relationship embeds found:')
    for (const location of ambiguous) console.error(`- ${location}`)
    console.error('Name the intended relationship with an explicit !foreign_key hint.')
    process.exitCode = 1
  } else {
    console.log('PostgREST relationship embeds are explicit.')
  }
}
