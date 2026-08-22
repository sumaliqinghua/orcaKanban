import type SyncDatabase from '../sqlite/sync-database'

export const LOCAL_TASK_SCHEMA_VERSION = 2

export function createLocalTaskSchema(): string {
  return `
    CREATE TABLE IF NOT EXISTS local_task_schema (
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Open', 'In progress', 'Waiting', 'Needs review', 'Done')),
      workspace_id TEXT NOT NULL, workspace_label TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      archived_at INTEGER, title_source TEXT NOT NULL CHECK(title_source IN ('first-line', 'ai-suggestion', 'user')), title_suggestion TEXT, waiting_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS local_task_sessions (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES local_tasks(id) ON DELETE CASCADE, workspace_id TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('working', 'idle', 'done')), latest_output TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      association_source TEXT NOT NULL DEFAULT 'task-center' CHECK(association_source IN ('task-center', 'explicit'))
    );
    CREATE TABLE IF NOT EXISTS local_task_subtasks (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES local_tasks(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES local_task_sessions(id) ON DELETE SET NULL, title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'done')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_task_steps (
      id TEXT PRIMARY KEY, subtask_id TEXT NOT NULL REFERENCES local_task_subtasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'done', 'canceled')), updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_tasks_project_status ON local_tasks(project_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_local_task_sessions_task ON local_task_sessions(task_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_local_task_subtasks_task ON local_task_subtasks(task_id, updated_at);
  `
}

export function migrateLocalTaskSchema(db: SyncDatabase.Database): void {
  const schemaRows = db.prepare('SELECT version FROM local_task_schema LIMIT 1').all() as {
    version: number
  }[]
  const version = schemaRows[0]?.version ?? 1
  const columns = db.prepare('PRAGMA table_info(local_tasks)').all() as { name: string }[]

  if (!columns.some((column) => column.name === 'title_suggestion')) {
    db.exec('ALTER TABLE local_tasks ADD COLUMN title_suggestion TEXT')
  }
  const sessionColumns = db.prepare('PRAGMA table_info(local_task_sessions)').all() as {
    name: string
  }[]
  if (!sessionColumns.some((column) => column.name === 'association_source')) {
    db.exec(
      "ALTER TABLE local_task_sessions ADD COLUMN association_source TEXT NOT NULL DEFAULT 'task-center'"
    )
  }

  if (schemaRows.length === 0) {
    db.prepare('INSERT INTO local_task_schema (version) VALUES (?)').run(LOCAL_TASK_SCHEMA_VERSION)
  } else if (version < LOCAL_TASK_SCHEMA_VERSION) {
    db.prepare('UPDATE local_task_schema SET version = ?').run(LOCAL_TASK_SCHEMA_VERSION)
  }
}
