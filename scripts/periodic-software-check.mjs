#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { appendFileSync, closeSync, mkdirSync, openSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logDir = '/Users/ericperez/Library/Logs'
const logFile = join(logDir, 'nate-media-software-check.log')
const lockFile = join(logDir, 'nate-media-software-check.lock')
const maxOutput = 12000

mkdirSync(logDir, { recursive: true })
let lockFd
try {
  lockFd = openSync(lockFile, 'wx')
} catch {
  process.exit(0)
}

const started = new Date()
const results = []

function run(label, command, args) {
  try {
    const output = execFileSync(command, args, {
      cwd: repo,
      env: process.env,
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    results.push({ label, ok: true, output: output.slice(-maxOutput) })
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? ''
    const stderr = error?.stderr?.toString?.() ?? error?.message ?? ''
    results.push({ label, ok: false, output: `${stdout}\n${stderr}`.slice(-maxOutput) })
  }
}

run('typecheck', './node_modules/.bin/tsc', ['--noEmit'])
run('unit tests', './node_modules/.bin/vitest', ['run', '--exclude', '**/.claude/**', '--exclude', '**/*.live.test.ts'])
run('merge gate', './node_modules/.bin/tsx', ['scripts/merge-gate.mjs'])
run('diff check', 'git', ['diff', '--check'])

const failed = results.filter((result) => !result.ok)
const lines = [
  `\n[${started.toISOString()}] Nate Media software check`,
  `Repository: ${repo}`,
  ...results.map((result) => `\n${result.ok ? 'PASS' : 'FAIL'} ${result.label}\n${result.output.trim()}`),
  `\nResult: ${failed.length ? `${failed.length} discrepancy(s) detected` : 'all checks passed'}`,
]
appendFileSync(logFile, `${lines.join('\n')}\n`)
closeSync(lockFd)
unlinkSync(lockFile)
process.exit(failed.length ? 1 : 0)
