# Analysis modes

Use one mode per record. The mode determines the stable grouping key and the Markdown sections.

## Requirement clarification

- `kind`: `requirement_clarification`
- `seriesKey`: `requirement_clarification:<taskId>`
- Read: task description, prior user answers, related session summaries, and relevant Git HEAD.
- Body sections: `当前判断`, `已有信息`, `需要确认`, `建议补充描述`.
- Write only when a new ambiguity, answer, code constraint, or materially better description appears.

## Candidate task

- `kind`: `candidate_task`
- `seriesKey`: `candidate_task:<projectId>`
- Read: project goals, confirmed decisions, recently completed work, existing Open tasks, and Git HEAD.
- Body sections: `建议任务`, `为什么现在做`, `验收标准`, `风险与依赖`.
- Do not repeat a task already proposed or already present in the task list.

## Task simplification

- `kind`: `task_simplification`
- `seriesKey`: `task_simplification:<taskId>`
- Read: task description, age, status, latest session/output, previous simplifications, and Git HEAD.
- Body sections: `卡住原因`, `最小可决策问题`, `建议的新描述`, `仍需用户决定`.
- Write only when the smaller framing changes or new evidence explains why the task remains stuck.

## Status report

- `kind`: `status_report`
- `seriesKey`: `status_report:<projectId>`
- Read: task status changes, recent runs, failures, review items, goals, decisions, and Git HEAD.
- Body sections: `已完成`, `进行中`, `阻塞与风险`, `待处理`.
- Write only when at least one reported fact or decision item changed.
