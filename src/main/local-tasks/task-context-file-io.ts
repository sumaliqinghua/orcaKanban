import { appendFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)
}

export function writeJson(path: string, value: unknown): void {
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function appendRecord(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `\n${content.trim()}\n`, 'utf8')
}
