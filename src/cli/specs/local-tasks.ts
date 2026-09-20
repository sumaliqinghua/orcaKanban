import type { CommandSpec } from '../command-spec'
import { GLOBAL_FLAGS } from '../args'

export const LOCAL_TASK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['local-task', 'dispatch'],
    summary: 'Create or continue a task Agent session without waiting for completion',
    usage:
      'orca local-task dispatch --task <id> --worktree id:<workspaceId> --agent <agent> --prompt <text> [--tag <text>] [--purpose execution|clarification|task-report] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'task', 'worktree', 'agent', 'prompt', 'tag', 'purpose']
  },
  {
    path: ['local-task', 'list'],
    summary: 'List registered local project tasks and their associated sessions',
    usage:
      'orca local-task list [--scope all-local-projects] [--project-id <id>] [--include-archived] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'scope', 'project-id', 'include-archived']
  },
  {
    path: ['local-task', 'session-tags'],
    summary: 'Replace session tags; omit --tag to clear them',
    usage: 'orca local-task session-tags --task <id> --session <id> [--tag <text> ...] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'task', 'session', 'tag']
  },
  {
    path: ['local-task', 'current'],
    summary:
      'Read parent goals and sibling subtask summaries; optionally read one reference session snapshot',
    usage: 'orca local-task current [--reference <subtask-id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'reference']
  },
  {
    path: ['local-task', 'update-description'],
    summary: 'Update the bound local task description',
    usage:
      'orca local-task update-description --description <text> [--expected-revision <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'description', 'expected-revision']
  },
  {
    path: ['local-task', 'subtask-create'],
    summary: 'Create a subtask and optional AI execution steps for the bound local task',
    usage: 'orca local-task subtask-create --title <text> [--step <text> ...] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'title', 'step']
  },
  {
    path: ['local-task', 'subtask-update'],
    summary: 'Update a subtask belonging to the bound local task',
    usage:
      'orca local-task subtask-update --subtask <id> [--status <status>] [--title <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'subtask', 'status', 'title']
  },
  {
    path: ['local-task', 'step-update'],
    summary: 'Update an AI execution step belonging to the bound local task',
    usage:
      'orca local-task step-update --subtask <id> --step <id> [--status <status>] [--title <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'subtask', 'step', 'status', 'title']
  },
  {
    path: ['local-task', 'report-completed'],
    summary: 'Report the current Agent session output and completion',
    usage:
      'orca local-task report-completed [--output <text>] [--description <text>] [--title-suggestion <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'output', 'description', 'title-suggestion']
  }
]
