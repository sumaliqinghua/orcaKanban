import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag, getOptionalStringFlag, getRepeatedStringFlag } from '../flags'
import { printResult } from '../format'
import { getLocalTaskContext } from '../local-task-context'

function formatLocalTask(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export const LOCAL_TASK_HANDLERS: Record<string, CommandHandler> = {
  'local-task current': async ({ client, json }) => {
    const result = await client.call('localTask.current', getLocalTaskContext())
    printResult(result, json, formatLocalTask)
  },
  'local-task update-description': async ({ client, flags, json }) => {
    const result = await client.call('localTask.updateDescription', {
      ...getLocalTaskContext(),
      description: getRequiredStringFlag(flags, 'description')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task subtask-create': async ({ client, flags, json }) => {
    const result = await client.call('localTask.createSubtask', {
      ...getLocalTaskContext(),
      title: getRequiredStringFlag(flags, 'title'),
      steps: getRepeatedStringFlag(flags, 'step')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task subtask-update': async ({ client, flags, json }) => {
    const status = getOptionalStringFlag(flags, 'status')
    const title = getOptionalStringFlag(flags, 'title')
    const result = await client.call('localTask.updateSubtask', {
      ...getLocalTaskContext(),
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
      ...getLocalTaskContext(),
      subtaskId: getRequiredStringFlag(flags, 'subtask'),
      stepId: getRequiredStringFlag(flags, 'step'),
      ...(status ? { status } : {}),
      ...(title ? { title } : {})
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task subtask-transfer': async ({ client, flags, json }) => {
    const result = await client.call('localTask.transferSubtask', {
      ...getLocalTaskContext(),
      subtaskId: getRequiredStringFlag(flags, 'subtask'),
      force: flags.has('force')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task report-completed': async ({ client, flags, json }) => {
    const result = await client.call('localTask.reportCompleted', {
      ...getLocalTaskContext(),
      latestOutput: getOptionalStringFlag(flags, 'output'),
      description: getOptionalStringFlag(flags, 'description'),
      titleSuggestion: getOptionalStringFlag(flags, 'title-suggestion')
    })
    printResult(result, json, formatLocalTask)
  },
  'local-task request-review': async ({ client, flags, json }) => {
    const result = await client.call('localTask.requestReview', {
      ...getLocalTaskContext(),
      question: getRequiredStringFlag(flags, 'question')
    })
    printResult(result, json, formatLocalTask)
  }
}
