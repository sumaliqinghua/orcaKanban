# Kanban Advisor 模板规则

这是四个自动化模板使用的显式规则文档。普通 Agent 不会自动加载它；只有自动化 Prompt 明确要求读取本目录时才使用。它用于分析任务和项目状态，不修改任务状态、描述、代码或执行队列。

## Workflow

1. 从 [references/modes.md](references/modes.md) 选择一个分析模式。
2. Build the mode's stable `seriesKey` and read recent history with:

   ```bash
   node assistant/kanban-advisor/scripts/kanban-result.mjs history \
     --project-root . --series-key "<seriesKey>" --limit 5
   ```

3. 先读最新记录；只有最新记录不能解释当前结论或未决问题时，才继续读更早记录。
4. 将当前任务、会话、Git、目标和决策证据与最新记录比较。`readAt`、自动化运行编号、运行时间、会话编号和输出文件时间不算内容变化。
5. 没有新的结论、问题、风险或建议时，不写记录，只返回简短的 `no_change`。
6. 有实质变化时，按 [references/result-contract.md](references/result-contract.md) 创建 payload，再通过脚本写入；不要手写结果 JSON。

   ```bash
   node assistant/kanban-advisor/scripts/kanban-result.mjs write \
     --project-root . --input <payload.json>
   ```

脚本负责校验 payload、计算 `inputFingerprint`、生成记录字段并拒绝完全重复的输入。`readAt` 由 Orca 界面维护，自动化不要编辑它。

## Boundaries

- 记录只是分析产物，不是任务，也不代表获得了执行权限。
- 不创建正式任务、不把 Inbox 改成 ready、不启动项目 Agent、不修改项目代码。
- 远程或 SSH 状态不可用时标记为 `unverifiable`，不能推断为已退出、失败或完成。
- 缺少证据时在 Markdown 正文中明确写出，不要编造结论。
