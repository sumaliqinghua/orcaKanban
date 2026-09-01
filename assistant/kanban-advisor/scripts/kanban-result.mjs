#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const kinds = new Set([
  'requirement_clarification',
  'candidate_task',
  'task_simplification',
  'status_report'
])
const maxFileBytes = 256 * 1024
const maxFiles = 1000
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const filePattern = /^air_[A-Za-z0-9-]+\.json$/

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

function flags(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      fail(`Invalid argument: ${flag ?? ''}`)
    }
    values.set(flag.slice(2), value)
  }
  return values
}

function required(values, name) {
  const value = values.get(name)?.trim()
  if (!value) {
    fail(`--${name} is required`)
  }
  return value
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

function fingerprint(basis) {
  return `sha256:${createHash('sha256').update(stableStringify(basis)).digest('hex')}`
}

function resultRoot(projectRoot) {
  return join(resolve(projectRoot), 'assistant', 'results')
}

function files(projectRoot) {
  const root = resultRoot(projectRoot)
  if (!existsSync(root)) {
    return []
  }
  const paths = []
  const dates = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left))
  for (const date of dates) {
    for (const entry of readdirSync(join(root, date), { withFileTypes: true })) {
      if (!entry.isFile() || !filePattern.test(entry.name)) {
        continue
      }
      paths.push(join(root, date, entry.name))
      if (paths.length >= maxFiles) {
        return paths
      }
    }
  }
  return paths
}

function readRecord(path) {
  try {
    if (statSync(path).size > maxFileBytes) {
      return null
    }
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return value?.schemaVersion === 1 && typeof value.seriesKey === 'string' ? value : null
  } catch {
    return null
  }
}

function history(projectRoot, seriesKey, limit) {
  return files(projectRoot)
    .map(readRecord)
    .filter((record) => record?.seriesKey === seriesKey)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit)
}

function nullableText(value, name) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${name} must be a non-empty string or null`)
  }
  return value.trim()
}

function text(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${name} must be a non-empty string`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    fail(`${name} exceeds ${maxLength} characters`)
  }
  return trimmed
}

function validateBasis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('basis must be an object')
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!key.trim() || key.length > 200) {
      fail('basis keys must be 1-200 characters')
    }
    if (entry !== null && !['string', 'number', 'boolean'].includes(typeof entry)) {
      fail(`basis.${key} must be a string, finite number, boolean, or null`)
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      fail(`basis.${key} must be finite`)
    }
  }
  return value
}

function payload(value, projectRoot) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('input must be an object')
  }
  if (!kinds.has(value.kind)) {
    fail('kind is unsupported')
  }
  const source = value.source ?? {}
  const target = value.target ?? {}
  return {
    kind: value.kind,
    seriesKey: text(value.seriesKey, 'seriesKey', 1_000),
    source: {
      automationId: nullableText(source.automationId, 'source.automationId'),
      automationRunId: nullableText(source.automationRunId, 'source.automationRunId'),
      agentId: nullableText(source.agentId, 'source.agentId')
    },
    target: {
      projectId: text(target.projectId, 'target.projectId', 1_000),
      projectPath: resolve(projectRoot),
      workspaceId: nullableText(target.workspaceId, 'target.workspaceId'),
      taskId: nullableText(target.taskId, 'target.taskId')
    },
    title: text(value.title, 'title', 1_000),
    summary: text(value.summary, 'summary', 10_000),
    body: { format: 'markdown', content: text(value.body, 'body', 100_000) },
    basis: validateBasis(value.basis)
  }
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

const [command, ...argv] = process.argv.slice(2)
const values = flags(argv)
const projectRoot = required(values, 'project-root')

if (command === 'history') {
  const limit = Number(values.get('limit') ?? '5')
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    fail('--limit must be 1-50')
  }
  print(history(projectRoot, required(values, 'series-key'), limit))
} else if (command === 'write') {
  const input = JSON.parse(readFileSync(required(values, 'input'), 'utf8'))
  const normalized = payload(input, projectRoot)
  const inputFingerprint = fingerprint(normalized.basis)
  const latest = history(projectRoot, normalized.seriesKey, 1)[0] ?? null
  if (latest?.inputFingerprint === inputFingerprint) {
    print({ outcome: 'no_change', seriesKey: normalized.seriesKey, latestRecordId: latest.id })
    process.exit(0)
  }
  const createdAt = Date.now()
  const id = `air_${randomUUID()}`
  const record = {
    schemaVersion: 1,
    id,
    ...normalized,
    createdAt,
    inputFingerprint,
    readAt: null
  }
  const date = new Date(createdAt).toISOString().slice(0, 10)
  atomicJson(join(resultRoot(projectRoot), date, `${id}.json`), record)
  print({ outcome: 'written', record })
} else {
  fail('Command must be history or write')
}
