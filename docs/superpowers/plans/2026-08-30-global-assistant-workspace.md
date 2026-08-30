# Global Assistant Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每个 Orca profile 中增加一个持久的全局助理 workspace 与助理 tab，让助理基于 Orca 内部状态主动巡检、汇报、提出 proposal，并在用户确认后调用现有 LocalTask/Automation dispatcher 执行。

**Architecture:** 助理 workspace 是用户选择的普通 `FolderWorkspace`，只通过 profile 设置保存其稳定 ID；助理文件、proposal、报告和 handoff 由主进程文件存储负责。只读 snapshot、proposal 门禁和接受动作通过 runtime RPC/CLI 暴露，项目执行继续使用现有 LocalTask、AutomationRun、`startBatch` 和 Agent session。小时巡检与日报是 `reuseSession: false` 的普通系统 automation；interactive 助理会话在达到阈值时写 handoff 并创建新 tab/session。

**Tech Stack:** Electron 主进程、React renderer、TypeScript、runtime RPC、文件型 FolderWorkspace/LocalTask store、Vitest、Playwright CDP、pnpm。

---

## 范围、约束与文件边界

- 第一版只读取 Orca 内部项目、workspace、task、session、run、automation 和 Git 状态，不接入 GitHub、Linear、邮件、Slack 或其他外部连接器。
- 全局助理只读取状态、写入 `assistant/` 目录、生成报告/proposal/handoff 和调用现有接口；它不直接修改业务 workspace、不直接创建正式任务、不绕过 proposal 门禁。
- 每个 profile 只有一个 `assistantWorkspaceId: string | null`。路径、主机和可用性始终从 FolderWorkspace 权威记录解析。
- 新增文件按领域拆分：`src/shared/assistant-*` 放共享契约，`src/main/assistant/` 放聚合/持久化/门禁，`src/renderer/src/components/assistant/` 放 tab 工作台，避免把助理逻辑塞进通用 `helpers` 或无限增长的设置文件。
- 所有新持久化输入都兼容旧 profile/旧 JSON，运行时规范化后 `assistantWorkspaceId` 为 `string | null`；所有跨主机读取遵守 `live` / `unverifiable` / `exited` 证据词汇。
- 现有工作树中的未提交改动属于用户，本计划执行时不得 reset、checkout、格式化或覆盖无关文件。

## 目标数据流

```text
FolderWorkspace + GlobalSettings.assistantWorkspaceId
        |
        +--> AssistantFileStore (goals/decisions/reports/handoffs/proposals)
        +--> assistant.snapshot (read-only aggregate)
        +--> assistant-hourly / assistant-daily AutomationRun
        +--> Assistant tab (interactive session + workbench)

proposal.accept
        --> LocalTaskStore.create(Open)
        --> optional existing startBatch/dispatcher
        --> project workspace Agent
```

## 分阶段实施任务

### Task 1: 固化助理领域契约与 profile 持久化

**Files:**
- Create: `src/shared/assistant-types.ts`
- Modify: `src/shared/global-settings-types.ts`
- Modify: `src/main/persistence/applying-settings/settings-update.ts`
- Modify: `src/main/persistence/loading-store/normalize-loaded-global-settings.ts`
- Modify: `src/main/persistence/loading-store/prepare-loaded-profile-settings.ts`
- Modify: `src/main/persistence-settings-update.test.ts`
- Modify: `src/main/persistence-settings-ui-defaults.test.ts`
- Create: `src/main/assistant/assistant-contracts.test.ts`

- [ ] **Step 1: 写失败测试，先锁定共享类型和旧数据默认值。** 在 `src/main/assistant/assistant-contracts.test.ts` 覆盖 `AssistantSessionKind = interactive | hourly | daily`、`AssistantProposalStatus = proposed | accepted | rejected | snoozed`，并断言没有 `assistantWorkspaceId` 的旧 profile 规范化为 `null`，未知 proposal status 被拒绝而不是静默转成功。

```ts
expect(normalizeLoadedGlobalSettings({} as unknown as GlobalSettings).assistantWorkspaceId).toBeNull()
expect(parseAssistantProposalStatus('accepted')).toBe('accepted')
expect(parseAssistantProposalStatus('running')).toBeNull()
```

- [ ] **Step 2: 运行失败测试，确认新契约尚未存在。**

```bash
pnpm test src/main/assistant/assistant-contracts.test.ts src/main/persistence-settings-ui-defaults.test.ts
```

预期：`assistant-contracts.test.ts` 因类型、解析函数和规范化字段尚未定义而失败；不修改其他用户文件。

- [ ] **Step 3: 写最小共享实现。** 在 `src/shared/assistant-types.ts` 定义 `AssistantSessionKind`、`AssistantProposalStatus`、`AssistantEvidenceState`、`AssistantProposal`、`AssistantReportIndexEntry`、`AssistantHandoff` 和解析函数；在 `GlobalSettings` 增加：

```ts
/** null 表示尚未选择；失效引用必须由恢复逻辑清空并要求重新选择。 */
assistantWorkspaceId: string | null
```

在 loading normalization 中把缺失/非法值规范化为 `null`，在 settings update 中只接受 `string | null`，保留其他设置字段不变。

- [ ] **Step 4: 运行相关持久化与契约测试。**

```bash
pnpm test src/main/assistant/assistant-contracts.test.ts src/main/persistence-settings-update.test.ts src/main/persistence-settings-ui-defaults.test.ts
```

预期：所有测试通过，旧 profile 保留原有设置，新字段稳定持久化。

- [ ] **Step 5: 提交领域契约切片。**

```bash
git add src/shared/assistant-types.ts src/shared/global-settings-types.ts src/main/persistence/applying-settings/settings-update.ts src/main/persistence/loading-store/normalize-loaded-global-settings.ts src/main/persistence/loading-store/prepare-loaded-profile-settings.ts src/main/assistant/assistant-contracts.test.ts src/main/persistence-settings-update.test.ts src/main/persistence-settings-ui-defaults.test.ts
git commit -m "feat: persist global assistant workspace setting"
```

### Task 2: 创建、选择与恢复普通 FolderWorkspace

**Files:**
- Create: `src/main/assistant/assistant-workspace-service.ts`
- Create: `src/main/runtime/rpc/methods/assistant-workspace.ts`
- Create: `src/main/runtime/rpc/methods/assistant-workspace-schemas.ts`
- Modify: `src/main/runtime/rpc/methods/index.ts`
- Modify: `src/main/ipc/settings.ts`
- Modify: `src/renderer/src/components/settings/Settings.tsx`
- Create: `src/renderer/src/components/settings/AssistantWorkspaceSettingsPane.tsx`
- Create: `src/renderer/src/components/settings/AssistantWorkspaceSettingsPane.test.tsx`
- Modify: `src/renderer/src/store/slices/settings.ts`
- Create: `src/renderer/src/lib/assistant-workspace-routing.ts`
- Create: `src/main/assistant/assistant-workspace-service.test.ts`

- [ ] **Step 1: 写失败测试，定义选择与恢复边界。** 测试 `selectAssistantWorkspace(folderWorkspaceId)` 只接受存在、未归档且可访问的 FolderWorkspace；选择成功写入 `assistantWorkspaceId`，删除/失效后返回 `{ status: 'needs_selection' }` 并清空设置；业务项目 workspace 和助理 workspace 的 ID 不得混用。

```ts
expect(await service.selectAssistantWorkspace('folder-1')).toEqual({ status: 'ready', workspaceId: 'folder-1' })
expect(await service.reconcile()).toEqual({ status: 'needs_selection', workspaceId: null })
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-workspace-service.test.ts
```

预期：服务尚未定义而失败。

- [ ] **Step 3: 实现主进程服务与 RPC。** `assistant-workspace-service.ts` 复用已有 FolderWorkspace catalog/host resolution；不另存路径。RPC 提供 `assistantWorkspace.status`、`assistantWorkspace.select`、`assistantWorkspace.clear`，参数用 zod 严格校验。失效路径只返回状态，不启动后台写入。

- [ ] **Step 4: 实现设置页入口。** 在 Settings 增加“全局助理 workspace”区块：未配置时使用现有 folder picker/composer 选择普通目录，已配置时显示名称、路径、host、可用性和“重新选择”；保存后只更新 `assistantWorkspaceId`，不创建特殊 workspace 类型。组件遵循 `docs/STYLEGUIDE.md` 和 `main.css` token。

- [ ] **Step 5: 运行服务、RPC 与组件测试。**

```bash
pnpm test src/main/assistant/assistant-workspace-service.test.ts src/renderer/src/components/settings/AssistantWorkspaceSettingsPane.test.tsx
pnpm tc
```

预期：选择、失效恢复和 UI 空/已配置状态通过，TypeScript 检查通过。

- [ ] **Step 6: 提交 workspace 切片。**

```bash
git add src/main/assistant src/main/runtime/rpc/methods src/main/ipc/settings.ts src/renderer/src/components/settings/Settings.tsx src/renderer/src/components/settings/AssistantWorkspaceSettingsPane.tsx src/renderer/src/store/slices/settings.ts src/renderer/src/lib/assistant-workspace-routing.ts
git commit -m "feat: configure assistant on a folder workspace"
```

### Task 3: Assistant 文件存储与只读 snapshot

**Files:**
- Create: `src/main/assistant/assistant-file-store.ts`
- Create: `src/main/assistant/assistant-snapshot.ts`
- Create: `src/main/runtime/rpc/methods/assistant.ts`
- Create: `src/main/runtime/rpc/methods/assistant-schemas.ts`
- Modify: `src/main/runtime/rpc/methods/index.ts`
- Create: `src/cli/handlers/assistant.ts`
- Create: `src/cli/specs/assistant.ts`
- Modify: `src/cli/specs/index.ts`
- Modify: `src/cli/handler-group-manifest.ts`
- Create: `src/main/assistant/assistant-snapshot.test.ts`
- Create: `src/cli/handlers/assistant.test.ts`

- [ ] **Step 1: 写失败测试，锁定目录布局、排序与证据状态。** 测试第一次写入自动创建 `assistant/goals.md`、`decisions.md`、`reports/`、`handoffs/`、`proposals/`；snapshot 按稳定 ID/时间排序，项目不可访问时标记 `unverifiable`，不能转换为 `exited` 或成功。

```ts
expect(await files.ensureLayout(root)).toEqual(expect.objectContaining({ reportsDir: expect.stringContaining('assistant/reports') }))
expect(snapshot.projects[0].evidence.state).toBe('unverifiable')
expect(snapshot.generatedAt).toBeGreaterThan(0)
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-snapshot.test.ts src/cli/handlers/assistant.test.ts
```

预期：因文件 store、snapshot 聚合器和 CLI handler 尚未定义而失败。

- [ ] **Step 3: 实现文件 store。** 用 `path.join` 解析助理目录；只允许自动写入 `assistant/` 下的文件；proposal 使用一个文件一个 JSON 记录，报告/handoff 使用 Markdown 加 sidecar index；写入采用临时文件后 rename，重复 `reportId`/`proposalId` 返回已有记录。

- [ ] **Step 4: 实现 snapshot 聚合器。** 读取现有 project/repo、FolderWorkspace、LocalTaskStore、Automation/AutomationRun、session 摘要和 Git 状态；输出 `generatedAt`、`sources[]`、`projects[]`、`tasks[]`、`automationRuns[]`、`git[]`、`assistantFiles`、`proposals[]`。各来源失败单独记录 `unverifiableReason`，限制每类结果数量并保证稳定排序。

- [ ] **Step 5: 暴露 RPC 与 CLI。** `assistant.snapshot` 为只读 RPC；CLI 实现：

```bash
orca assistant snapshot --json
```

CLI 输出只打印 JSON，不把主进程异常吞成空数组；缺少 assistant workspace 时返回 `status: "needs_selection"` 和可读错误。

- [ ] **Step 6: 运行测试与类型检查。**

```bash
pnpm test src/main/assistant/assistant-snapshot.test.ts src/cli/handlers/assistant.test.ts
pnpm tc
```

预期：snapshot 字段、截断、排序、证据词汇与 CLI/RPC 投影全部通过。

- [ ] **Step 7: 提交 snapshot 切片。**

```bash
git add src/main/assistant src/main/runtime/rpc/methods src/cli/handlers/assistant.ts src/cli/specs/assistant.ts src/cli/specs/index.ts src/cli/handler-group-manifest.ts
git commit -m "feat: expose read-only assistant snapshot"
```

### Task 4: 系统 hourly/daily automation 与报告输出

**Files:**
- Create: `src/main/assistant/assistant-automation-service.ts`
- Create: `src/main/assistant/assistant-automation-prompts.ts`
- Modify: `src/main/automations/service.ts`
- Modify: `src/main/automations/dispatch-run.ts`
- Modify: `src/shared/automations-types.ts` only if existing projection cannot identify source without an optional field
- Modify: `src/renderer/src/components/automations/AutomationsPage.tsx`
- Create: `src/main/assistant/assistant-automation-service.test.ts`
- Modify: `src/main/automations/service.test.ts`

- [ ] **Step 1: 写失败测试，定义系统 automation 的幂等创建。** 使用稳定 creation keys `assistant-hourly:<workspaceId>` 和 `assistant-daily:<workspaceId>`；重复 reconcile 不产生第二条 automation；两条 automation 的 `workspaceMode: existing`、`workspaceId` 指向 assistant workspace、`reuseSession: false`，小时与日报的 rrule 按 profile timezone 计算。

```ts
expect(automations.filter((a) => a.name === 'assistant-hourly')).toHaveLength(1)
expect(hourly.reuseSession).toBe(false)
expect(daily.workspaceId).toBe('folder-assistant')
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-automation-service.test.ts
```

- [ ] **Step 3: 实现 automation reconcile。** 复用现有 `AutomationCreateInput`、creationKey、schedule 计算和 owner fencing；如果现有标题/ID 投影足够，不添加 `runPurpose`。assistant workspace 失效时暂停/禁用两条系统 automation，并将原因写入状态，不在未知目录运行。

- [ ] **Step 4: 编写巡检与日报 prompt。** hourly prompt 固定要求读取 `orca assistant snapshot --json`、goals、decisions、最近报告，只写 proposal/report，不创建 LocalTask；daily prompt 固定输出“今日完成/当前进行中/阻塞与风险/你做出的决策/明日建议/待你确认的事项”六段，并引用证据缺口。

- [ ] **Step 5: 接入运行结果投影。** 复用 AutomationRun outputSnapshot、错误和通知；没有新建议、阻塞、失败、待验收或日报时只保存短结果，不创建通知卡片。非法 Agent 输出保存原文并标记人工检查。

- [ ] **Step 6: 运行测试。**

```bash
pnpm test src/main/assistant/assistant-automation-service.test.ts src/main/automations/service.test.ts
pnpm tc
```

预期：幂等创建、失效暂停、`reuseSession: false`、六段日报和非法输出处理通过。

- [ ] **Step 7: 提交 automation 切片。**

```bash
git add src/main/assistant src/main/automations src/shared/automations-types.ts src/renderer/src/components/automations/AutomationsPage.tsx
git commit -m "feat: schedule assistant inspections and daily reports"
```

### Task 5: Proposal schema、门禁与接受后的 LocalTask/dispatcher 调用

**Files:**
- Create: `src/main/assistant/assistant-proposal-service.ts`
- Create: `src/main/assistant/assistant-proposal-service.test.ts`
- Modify: `src/main/runtime/rpc/methods/assistant.ts`
- Modify: `src/main/runtime/rpc/methods/assistant-schemas.ts`
- Modify: `src/shared/local-task-types.ts` only if a proposal source reference is required for display
- Modify: `src/main/local-tasks/store.ts`
- Modify: `src/main/runtime/rpc/methods/local-tasks.ts`
- Modify: `src/main/local-tasks/file-store-mutations.ts`
- Modify: `src/main/local-tasks/file-store-batch-mutations.ts`
- Modify: `src/main/automations/dispatch-run.ts`
- Create: `src/main/assistant/assistant-proposal-rpc.test.ts`

- [ ] **Step 1: 写失败测试，覆盖 proposal 幂等门禁。** 测试 `accept(proposalId, mode)` 在 `mode = backlog | dispatch_now` 时先重新读取 proposal、目标项目和 workspace；重复接受返回同一个 `taskId`/`runId`；被拒绝、已接受、目标删除或无权限时不创建新任务。

```ts
const first = await service.accept('proposal-1', 'backlog')
const second = await service.accept('proposal-1', 'backlog')
expect(second.taskId).toBe(first.taskId)
expect(store.list()).toHaveLength(1)
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-proposal-service.test.ts src/main/assistant/assistant-proposal-rpc.test.ts
```

- [ ] **Step 3: 实现结构化 proposal。** 持久化 `proposalId`、`sourceAutomationRunId`、`projectId`、`workspaceId`、`title`、`description`、`whyNow`、`priority`、`acceptanceCriteria`、`risks`、`estimatedScope`、`status`、`acceptedTaskId`、`acceptedRunId`；提供 list/show/snooze/reject/accept。

- [ ] **Step 4: 实现“加入待办”。** 由主进程调用现有 LocalTaskStore 创建 `status: Open`、`intakeState: ready`、正确 projectPath/workspaceId 的任务；不要把 assistant workspace 作为目标工作目录；写回 `acceptedTaskId`。

- [ ] **Step 5: 实现“立即调度”。** 先完成任务创建，再调用现有 `startBatch`/dispatcher；调度失败保留 Open 任务，写入原始错误与可重试状态，写回 `acceptedRunId`（若已有 run）；不回滚任务。

- [ ] **Step 6: 暴露严格 RPC 并运行测试。**

```bash
pnpm test src/main/assistant/assistant-proposal-service.test.ts src/main/assistant/assistant-proposal-rpc.test.ts src/main/local-tasks/store.test.ts
pnpm tc
```

预期：proposal 门禁、预览所需字段、重复点击、目标失效和 429/启动失败语义通过。

- [ ] **Step 7: 提交 proposal 切片。**

```bash
git add src/main/assistant src/main/runtime/rpc/methods/assistant.ts src/main/runtime/rpc/methods/assistant-schemas.ts src/main/local-tasks src/main/automations/dispatch-run.ts src/shared/local-task-types.ts
git commit -m "feat: gate assistant proposals through local tasks"
```

### Task 6: 助理 tab 工作台与通知投影

**Files:**
- Modify: `src/shared/tab-types.ts`
- Modify: `src/renderer/src/store/terminals/terminal-tab-creation.ts` or the existing unified-tab creation module used by `createUnifiedTab`
- Modify: `src/renderer/src/store/slices/tabs.ts`
- Create: `src/renderer/src/components/assistant/AssistantWorkbench.tsx`
- Create: `src/renderer/src/components/assistant/AssistantWorkbench.test.tsx`
- Create: `src/renderer/src/components/assistant/AssistantHeader.tsx`
- Create: `src/renderer/src/components/assistant/AssistantProposalList.tsx`
- Create: `src/renderer/src/components/assistant/AssistantConversationPane.tsx`
- Create: `src/renderer/src/lib/ensure-assistant-tab.ts`
- Modify: `src/renderer/src/components/tab-bar/tab-bar-item-surface.tsx`
- Modify: `src/renderer/src/components/tab-bar/tab-bar-item-model.ts`
- Modify: `src/renderer/src/components/TerminalWorkbenchContainer.tsx`
- Create: `src/renderer/src/hooks/useAssistantSnapshot.ts`
- Create: `src/renderer/src/hooks/useAssistantNotifications.ts`
- Modify: `src/renderer/src/i18n/locales/zh.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

- [ ] **Step 1: 写失败测试，锁定 assistant tab 的持久化与布局。** 测试 assistant tab 是一个可恢复的 unified tab，不绑定业务项目；关闭 tab 不影响 automation；工作台左侧显示 proposal/阻塞/失败/待验收/风险，右侧显示对话，顶部显示助理状态、上次/下次巡检和待决策数。

```tsx
expect(screen.getByText('待决策')).toBeInTheDocument()
expect(screen.getByText('上次巡检')).toBeInTheDocument()
expect(screen.getByTestId('assistant-conversation-pane')).toBeInTheDocument()
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/renderer/src/components/assistant/AssistantWorkbench.test.tsx
```

- [ ] **Step 3: 扩展 unified tab 类型与恢复。** 增加 `contentType: 'assistant'` 与稳定 `entityId: assistantWorkspaceId`；补齐 tab hydration、tab search、close 和 active-tab 分支。只允许一个 assistant tab，重复 `ensureAssistantTab()` 返回现有 tab 并激活，不创建重复 tab。

- [ ] **Step 4: 实现工作台。** 通过 `callRuntimeRpc` 获取 snapshot/proposals/runs；proposal 卡片先显示项目、workspace、描述、验收标准和风险，再提供“接受并加入待办”“接受并立即调度”“拒绝”“稍后处理”；所有颜色、间距和按钮使用现有 shadcn/token。

- [ ] **Step 5: 接入通知和历史入口。** 复用现有 unread/notification hooks：只有新 proposal、阻塞、失败、待验收或日报才标记 attention；点击历史 run 打开对应 AutomationRun/session，不复制全文到 interactive transcript。

- [ ] **Step 6: 运行 renderer 类型、单元和 UI 检查。**

```bash
pnpm test src/renderer/src/components/assistant/AssistantWorkbench.test.tsx src/renderer/src/store/slices/tabs-hydration.test.ts
pnpm tc:web
pnpm run check:code-quality:changed
```

预期：tab 恢复/关闭、工作台布局、proposal 动作和通知投影通过。

- [ ] **Step 7: 使用 Electron + Playwright CDP 做人工验收。** 启动 dev Orca，选择 assistant FolderWorkspace，打开助理 tab，验证重启后仍存在、左/右布局可见、长 proposal 文本不会挤压对话区、不可用 workspace 显示重新选择提示。记录截图或失败步骤后再继续。

- [ ] **Step 8: 提交 tab/UI 切片。**

```bash
git add src/shared/tab-types.ts src/renderer/src/store src/renderer/src/components/assistant src/renderer/src/components/tab-bar/tab-bar-item-surface.tsx src/renderer/src/components/tab-bar/tab-bar-item-model.ts src/renderer/src/components/TerminalWorkbenchContainer.tsx src/renderer/src/hooks src/renderer/src/i18n/locales/zh.json src/renderer/src/i18n/locales/en.json
git commit -m "feat: add persistent assistant workbench tab"
```

### Task 7: Interactive session handoff 与 hourly/daily session 隔离

**Files:**
- Create: `src/main/assistant/assistant-session-policy.ts`
- Create: `src/main/assistant/assistant-session-policy.test.ts`
- Create: `src/renderer/src/lib/assistant-session-continuation.ts`
- Modify: `src/renderer/src/lib/launch-agent-in-new-tab.ts`
- Modify: `src/renderer/src/lib/launch-agent-session-continuation.ts`
- Modify: `src/renderer/src/lib/automation-session-reuse.ts`
- Modify: `src/renderer/src/components/assistant/AssistantConversationPane.tsx`
- Create: `src/renderer/src/components/assistant/AssistantSessionControls.tsx`
- Create: `src/renderer/src/components/assistant/AssistantSessionControls.test.tsx`

- [ ] **Step 1: 写失败测试，锁定轮换阈值和 handoff 内容。** 测试轮次/上下文接近阈值或用户点击“开始新一轮”时生成 Markdown handoff，至少包含当前目标、已确认决策、不可违反约束、已发现事实、未决问题、下一步建议；新 session 只接收 handoff + 最新 snapshot + 最近报告。

```ts
expect(handoff).toContain('当前目标')
expect(nextLaunch.prompt).toContain('assistant snapshot --json')
expect(nextLaunch.prompt).not.toContain(oldTranscript)
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-session-policy.test.ts src/renderer/src/components/assistant/AssistantSessionControls.test.tsx
```

- [ ] **Step 3: 实现 session policy。** interactive 使用可配置默认阈值；hourly/daily 始终传 `reuseSession: false`；轮换写入 `assistant/handoffs/<timestamp>-<sessionId>.md`，保留旧 session 在 AI Vault/AutomationRun 中可查。

- [ ] **Step 4: 接入现有 launch/continuation。** 复用 `launchAgentInNewTab` 和 `launchAgentSessionContinuation`，只替换 prompt 来源与 assistant workspace 绑定，不创建第二套聊天运行时；新 tab 的 workspace 必须是 assistant FolderWorkspace。

- [ ] **Step 5: 运行测试与类型检查。**

```bash
pnpm test src/main/assistant/assistant-session-policy.test.ts src/renderer/src/components/assistant/AssistantSessionControls.test.tsx src/renderer/src/lib/automation-session-reuse.test.ts
pnpm tc:web
```

预期：上下文轮换、旧 transcript 不复制、hourly/daily 不复用和 tab 关闭独立性通过。

- [ ] **Step 6: 提交 session 切片。**

```bash
git add src/main/assistant src/renderer/src/lib/assistant-session-continuation.ts src/renderer/src/lib/launch-agent-in-new-tab.ts src/renderer/src/lib/launch-agent-session-continuation.ts src/renderer/src/lib/automation-session-reuse.ts src/renderer/src/components/assistant
git commit -m "feat: rotate assistant sessions with handoffs"
```

### Task 8: 重启恢复、失败注入、幂等回归与交付验证

**Files:**
- Create: `src/main/assistant/assistant-recovery.ts`
- Create: `src/main/assistant/assistant-recovery.test.ts`
- Modify: `src/main/assistant/assistant-workspace-service.ts`
- Modify: `src/main/assistant/assistant-automation-service.ts`
- Modify: `src/main/assistant/assistant-proposal-service.ts`
- Create: `src/main/assistant/assistant-end-to-end.test.ts`
- Create: `docs/superpowers/specs/2026-08-30-global-assistant-workspace-operational-notes.md`

- [ ] **Step 1: 写失败测试，覆盖重启和异常边界。** 注入 workspace 不可访问、Agent session 创建失败、非法 JSON、snapshot 部分失败、目标项目删除、429、立即调度失败、重复 hourly run、重复 proposal 点击；断言不产生任务副作用或错误地把 `unverifiable` 判成失败。

```ts
expect(await recover({ workspace: 'missing' })).toEqual({ status: 'needs_selection' })
expect(await acceptTwice('proposal-1', 'dispatch_now')).toEqual(expect.objectContaining({ taskId: 'task-1' }))
expect(store.listTasks()).toHaveLength(1)
```

- [ ] **Step 2: 运行失败测试。**

```bash
pnpm test src/main/assistant/assistant-recovery.test.ts src/main/assistant/assistant-end-to-end.test.ts
```

- [ ] **Step 3: 实现恢复与保守失败语义。** 启动时 reconcile assistant workspace 与两条 system automation；未知目录暂停写入；非法 assistant 输出保存原文并标记人工检查；立即调度失败保留 Open task；无法确认远端/终端状态时只标记 `unverifiable`；重复 run/proposal 通过 creationKey/proposalId 去重。

- [ ] **Step 4: 运行完整验证。**

```bash
pnpm test src/main/assistant src/main/automations src/main/persistence-settings-update.test.ts src/renderer/src/components/assistant
pnpm tc
pnpm tc:web
pnpm run check:code-quality:changed
```

预期：助理相关测试、自动化回归、类型检查和 changed-file quality check 全部通过；失败时继续定位，不能以“测试正常”替代实际输出。

- [ ] **Step 5: 用 Electron + Playwright CDP 做端到端验收。** 验证首次选择普通 folder、重启恢复、snapshot 查询、hourly/daily AutomationRun、proposal 预览、加入待办、立即调度、重复点击幂等、调度失败仍为 Open、助理 workspace 不成为项目执行目录、assistant tab 关闭不影响后台 automation。

- [ ] **Step 6: 写运维说明并提交最终切片。** 在 operational notes 中记录 assistant workspace 目录约定、系统 automation 名称、证据状态、恢复/重选路径、proposal 状态机和测试命令；然后提交：

```bash
git add src/main/assistant docs/superpowers/specs/2026-08-30-global-assistant-workspace-operational-notes.md
git commit -m "test: verify assistant recovery and idempotency"
```

## Spec Coverage 自审

- workspace 身份、普通 FolderWorkspace、profile 持久化和失效重选：Task 1-2。
- `assistant/` 文件布局、只读 snapshot、稳定排序、数据时间戳和 `unverifiable`：Task 3。
- 每小时巡检、每日六段日报、`reuseSession: false`、空巡检不通知：Task 4。
- proposal 结构、预览、拒绝/稍后/接受、加入待办/立即调度和 proposalId 幂等：Task 5-6。
- 助理 tab、工作台优先布局、通知与历史入口：Task 6。
- interactive handoff、旧 transcript 不复制、session 轮换：Task 7。
- 失败、重启、恢复、429、非法输出、跨项目执行目录与端到端验收：Task 8。
- “助理只调用，项目 Agent 执行”的边界在 Task 3-5、Task 7 的接口和测试中明确保护；没有新增第二套任务数据库、PlannerRun 或常驻超级 Agent。

## Placeholder 与类型一致性检查

- 计划中没有 `TBD`、`TODO`、“补充测试”或未定义的待实现占位。
- proposal 状态统一使用 `proposed | accepted | rejected | snoozed`；session 类型统一使用 `interactive | hourly | daily`；执行入口统一指向现有 LocalTaskStore 与 `startBatch`/dispatcher。
- 新增的 `assistantWorkspaceId` 始终是 `string | null`，路径不在 settings 中重复存储；FolderWorkspace ID 和 unified tab entity ID 的关系在 Task 2 与 Task 6 中保持一致。
