import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag, getOptionalStringFlag, getRepeatedStringFlag } from '../flags'
import { printResult } from '../format'
import { resolveLocalTaskContext } from '../local-task-context'

function formatLocalTask(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export const LOCAL_TASK_HANDLERS: Record<string, CommandHandler> = {
  'local-task dispatch': async ({ client, flags, json }) => {
    const result = await client.call(
      'localTask.dispatch',
      {
        taskId: getRequiredStringFlag(flags, 'task'),
        worktree: getRequiredStringFlag(flags, 'worktree'),
        agent: getRequiredStringFlag(flags, 'agent'),
        prompt: getRequiredStringFlag(flags, 'prompt'),
        tag: getOptionalStringFlag(flags, 'tag'),
        purpose: getOptionalStringFlag(flags, 'purpose') ?? 'execution'
      },
      { timeoutMs: 120_000 }
    )
    printResult(result, json, formatLocalTask)
  },
  'local-task list': async ({ client, flags, json }) => {
    const result = await client.call('localTask.list', {
      scope: getOptionalStringFlag(flags, 'scope') ?? 'all-local-projects',
      projectId: getOptionalStringFlag(flags, 'project-id'),
      includeArchived: flags.get('include-archived') === true
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task session-tags': async ({ client, flags, json }) => {
    const result = await client.call('localTask.setSessionTags', {
      taskId: getRequiredStringFlag(flags, 'task'),
      sessionId: getRequiredStringFlag(flags, 'session'),
      tags: getRepeatedStringFlag(flags, 'tag')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task current': async ({ client, flags, json }) => {
    const referenceSubtaskId = getOptionalStringFlag(flags, 'reference')
    const result = await client.call('localTask.current', {
      ...(await resolveLocalTaskContext(client)),
      ...(referenceSubtaskId ? { referenceSubtaskId } : {})
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task update-description': async ({ client, flags, json }) => {
    const expectedRevisionFlag = getOptionalStringFlag(flags, 'expected-revision')
    const expectedRevision =
      expectedRevisionFlag === undefined ? undefined : Number(expectedRevisionFlag)
    if (expectedRevision !== undefined && !Number.isInteger(expectedRevision)) {
      throw new Error('expected-revision must be an integer')
    }
    const result = await client.call('localTask.updateDescription', {
      ...(await resolveLocalTaskContext(client)),
      description: getRequiredStringFlag(flags, 'description'),
      ...(expectedRevision === undefined ? {} : { expectedRevision })
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task subtask-create': async ({ client, flags, json }) => {
    const result = await client.call('localTask.createSubtask', {
      ...(await resolveLocalTaskContext(client)),
      title: getRequiredStringFlag(flags, 'title'),
      steps: getRepeatedStringFlag(flags, 'step')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task subtask-update': async ({ client, flags, json }) => {
    const status = getOptionalStringFlag(flags, 'status')
    const title = getOptionalStringFlag(flags, 'title')
    const result = await client.call('localTask.updateSubtask', {
      ...(await resolveLocalTaskContext(client)),
      subtaskId: getRequiredStringFlag(flags, 'subtask'),
      ...(status ? { status } : {}),
      ...(title ? { title } : {})
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task step-update': async ({ client, flags, json }) => {
    const status = getOptionalStringFlag(flags, 'status')
    const title = getOptionalStringFlag(flags, 'title')
    const result = await client.call('localTask.updateStep', {
      ...(await resolveLocalTaskContext(client)),
      subtaskId: getRequiredStringFlag(flags, 'subtask'),
      stepId: getRequiredStringFlag(flags, 'step'),
      ...(status ? { status } : {}),
      ...(title ? { title } : {})
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task report-completed': async ({ client, flags, json }) => {
    const result = await client.call('localTask.reportCompleted', {
      ...(await resolveLocalTaskContext(client)),
      latestOutput: getOptionalStringFlag(flags, 'output'),
      description: getOptionalStringFlag(flags, 'description'),
      titleSuggestion: getOptionalStringFlag(flags, 'title-suggestion')
    })
    printResult(result, json, formatLocalTask)
  }
}
