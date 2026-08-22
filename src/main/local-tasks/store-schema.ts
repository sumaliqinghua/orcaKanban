export function createLocalTaskSchema(): string {
  return `
    CREATE TABLE IF NOT EXISTS local_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Open', 'In progress', 'Waiting', 'Needs review', 'Done')),
      workspace_id TEXT NOT NULL, workspace_label TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      archived_at INTEGER, title_source TEXT NOT NULL CHECK(title_source IN ('first-line', 'ai-suggestion', 'user')), waiting_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS local_task_sessions (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES local_tasks(id) ON DELETE CASCADE, workspace_id TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('working', 'idle', 'done')), latest_output TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
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
