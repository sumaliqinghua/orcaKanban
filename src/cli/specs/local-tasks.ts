import type { CommandSpec } from '../command-spec'
import { GLOBAL_FLAGS } from '../args'

export const LOCAL_TASK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['local-task', 'current'],
    summary: 'Read the local task bound to the current Agent session',
    usage: 'orca local-task current [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['local-task', 'update-description'],
    summary: 'Update the bound local task description',
    usage: 'orca local-task update-description --description <text> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'description']
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
    path: ['local-task', 'subtask-transfer'],
    summary: 'Transfer a subtask to the current Agent session after user confirmation',
    usage: 'orca local-task subtask-transfer --subtask <id> [--force] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'subtask', 'force']
  },
  {
    path: ['local-task', 'request-review'],
    summary: 'Pause the current Agent session and request a user decision',
    usage: 'orca local-task request-review --question <text> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'question']
  },
  {
    path: ['local-task', 'report-completed'],
    summary: 'Report the current Agent session output and completion',
    usage:
      'orca local-task report-completed [--output <text>] [--description <text>] [--title-suggestion <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'output', 'description', 'title-suggestion']
  }
]
