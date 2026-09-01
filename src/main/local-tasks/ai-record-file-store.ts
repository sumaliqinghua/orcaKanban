import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { readNodeFileSyncWithinLimit } from '../../shared/node-bounded-file-reader'
import {
  KANBAN_AI_RECORD_KINDS,
  type KanbanAiRecord,
  type ListKanbanAiRecordsArgs,
  type MarkKanbanAiRecordReadArgs
} from '../../shared/kanban-ai-record'
import { writeJson } from './file-store-format'

export const KANBAN_AI_RECORD_ROOT_SEGMENTS = ['assistant', 'results'] as const
export const MAX_KANBAN_AI_RECORD_FILES = 1_000
export const MAX_KANBAN_AI_RECORD_FILE_BYTES = 256 * 1_024

const DATE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RECORD_FILE_PATTERN = /^air_[A-Za-z0-9-]+\.json$/
const text = z.string().trim().min(1)
const timestamp = z.number().finite().nonnegative()
const nullableText = text.nullable()
const basisValue = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
const recordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: text,
  kind: z.enum(KANBAN_AI_RECORD_KINDS),
  seriesKey: text,
  createdAt: timestamp,
  source: z.strictObject({
    automationId: nullableText,
    automationRunId: nullableText,
    agentId: nullableText
  }),
  target: z.strictObject({
    projectId: text,
    projectPath: text,
    workspaceId: nullableText,
    taskId: nullableText
  }),
  title: text.max(1_000),
  summary: text.max(10_000),
  body: z.strictObject({
    format: z.literal('markdown'),
    content: text.max(100_000)
  }),
  basis: z.record(z.string().trim().min(1).max(200), basisValue),
  inputFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  readAt: timestamp.nullable()
})

function recordRoot(projectPath: string): string {
  return join(resolve(projectPath), ...KANBAN_AI_RECORD_ROOT_SEGMENTS)
}

function recordFiles(projectPath: string): string[] {
  const root = recordRoot(projectPath)
  if (!existsSync(root)) {
    return []
  }
  const dates = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && DATE_DIRECTORY_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left))
  const files: string[] = []
  for (const date of dates) {
    const directory = join(root, date)
    const datedFiles = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && RECORD_FILE_PATTERN.test(entry.name))
      .map((entry) => join(directory, entry.name))
    files.push(...datedFiles.slice(0, MAX_KANBAN_AI_RECORD_FILES - files.length))
    if (files.length >= MAX_KANBAN_AI_RECORD_FILES) {
      break
    }
  }
  return files
}

function readRecord(path: string): KanbanAiRecord | null {
  try {
    const raw = readNodeFileSyncWithinLimit(path, MAX_KANBAN_AI_RECORD_FILE_BYTES).buffer.toString(
      'utf8'
    )
    return recordSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export function listKanbanAiRecords(args: ListKanbanAiRecordsArgs): KanbanAiRecord[] {
  const projectPath = resolve(args.projectPath)
  const byId = new Map<string, KanbanAiRecord>()
  for (const path of recordFiles(args.projectPath)) {
    const record = readRecord(path)
    if (
      !record ||
      record.target.projectId !== args.projectId ||
      record.target.projectPath !== projectPath
    ) {
      continue
    }
    const current = byId.get(record.id)
    if (!current || record.createdAt > current.createdAt) {
      byId.set(record.id, record)
    }
  }
  return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt)
}

export function markKanbanAiRecordRead(
  args: MarkKanbanAiRecordReadArgs,
  readAt: number = Date.now()
): KanbanAiRecord {
  const projectPath = resolve(args.projectPath)
  for (const path of recordFiles(args.projectPath)) {
    const record = readRecord(path)
    if (
      !record ||
      record.id !== args.recordId ||
      record.target.projectId !== args.projectId ||
      record.target.projectPath !== projectPath
    ) {
      continue
    }
    if (record.readAt !== null) {
      return record
    }
    const updated = { ...record, readAt }
    writeJson(path, updated)
    return updated
  }
  throw new Error(`Kanban AI record not found: ${args.recordId}`)
}
