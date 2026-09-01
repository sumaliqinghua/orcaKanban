# Result contract

将 JSON payload 传给 `assistant/kanban-advisor/scripts/kanban-result.mjs write`。写入脚本而不是 Agent 负责补充 `schemaVersion`、`id`、`createdAt`、`inputFingerprint`、`target.projectPath` 和 `readAt`。

```json
{
  "kind": "requirement_clarification",
  "seriesKey": "requirement_clarification:lt_task_184",
  "source": {
    "automationId": "automation_inbox_triage",
    "automationRunId": "run_20260831_1000",
    "agentId": "codex"
  },
  "target": {
    "projectId": "project_orca",
    "workspaceId": "workspace_kanban1",
    "taskId": "lt_task_184"
  },
  "title": "资源加载优化缺少目标平台",
  "summary": "代码中存在多套加载路径，需要先确认本轮优化对象。",
  "body": "## 当前判断\n\n...",
  "basis": {
    "taskUpdatedAt": 1788156300000,
    "latestSessionUpdatedAt": 1788156200000,
    "gitHead": "a83f72c",
    "goalsDigest": null
  }
}
```

## 字段说明

- `kind`：`modes.md` 中的模式标识。
- `seriesKey`：`modes.md` 中规定的稳定分组键。
- `source`：可选的自动化和 Agent 来源，每个值都可以是 `null`。
- `target.projectId`：必填的项目标识。
- `target.workspaceId`：关联 workspace 标识，或 `null`。
- `target.taskId`：关联任务标识，或 `null`；只有有任务 ID 的记录才能打开任务详情。
- `title`：列表标题，最多 1,000 个字符。
- `summary`：预览摘要，最多 10,000 个字符。
- `body`：使用对应模式规定章节的 Markdown，最多 100,000 个字符。
- `basis`：稳定输入版本；值只能是字符串、有限数字、布尔值或 `null`。

不要把 `readAt`、运行时间、会话 ID、生成文件名或其他每次运行都会变化的噪声放进 `basis`。
