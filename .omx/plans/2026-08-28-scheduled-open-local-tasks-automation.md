# 定时执行 Open 本地任务实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Orca 自动化在指定时间扫描指定项目/workspace 中的 `Open` 本地任务，并按现有子任务执行协议逐个启动 Agent；本阶段不实现延迟回复。

**Architecture:** 保留现有 `AutomationService` 的到点循环（`src/main/automations/service.ts:228-276`）作为唯一的定时入口，在到点时由主进程原子锁定本地任务批次，再通过扩展后的 dispatch envelope 把任务候选交给现有 Agent 启动链路。自动化 run 代表一次“扫描批次”，`LocalTaskRun` 代表批次中的具体任务；两者通过批次 ID 和任务 run ID 关联。首期复用现有桌面 renderer 启动能力，同时为 headless 路径保留明确的能力边界，避免把多个本地任务错误压缩成一个普通 automation session。

**Tech Stack:** TypeScript、Electron IPC/runtime RPC、现有 LocalTask file store、AutomationService、Vitest、renderer Agent launch helpers。

---

## 需求与边界

- 自动化需要选择一个明确的项目和 workspace 范围；不扫描所有项目。
- 候选任务只允许 `status === 'Open'`、`intakeState === 'ready'`、未归档、没有 `queued/running` 执行状态。
- `Done`、`Needs review`、Inbox、归档任务和正在执行的任务必须被排除。
- 一个自动化 run 可以包含 0 个或多个本地任务；不能假设一个 automation run 只有一个 terminal session。
- AI 继续使用现有本地任务 Prompt：读取任务上下文、按子任务顺序执行、需要人工决定时在原会话完整提问并等待回复，完成时调用 `report-completed`。
- 本阶段不增加“用户回复但下次执行”的持久化状态，也不改变 `Needs review` 的人工验收语义。
- `In progress` 本阶段不进入自动扫描范围；后续如需续跑，另立需求。

## 关键设计决定

### 推荐：AutomationService 负责选批次，renderer 负责启动任务

1. 在 `AutomationService` 中注入一个最小的 LocalTask batch coordinator 接口。
2. 到点后，按 automation 的 project/workspace 范围调用本地任务 store 的原子批次选择逻辑。
3. 先创建 automation run，再把 `localTaskBatchId`、候选 task/run ID 和候选数量放入 dispatch envelope。
4. renderer 收到 envelope 后，按现有 `runLocalTaskBatch` 的 workspace 串行规则启动每个候选任务。
5. 每个任务独立更新 `LocalTaskRun`；automation run 只汇总批次结果，不复用单 session 的字段表达多个任务。

选择这个方案的原因：候选选择必须在主进程完成，避免任务中心页面未打开时无法调度，也避免 UI 快照与 file store 不一致；Agent 启动先复用 renderer 现有能力，改动面小于把完整任务执行器迁移到主进程。

### 不采用：让固定 automation prompt 自己扫描任务文件

这种方式不需要改调度协议，但无法可靠实现原子抢占、任务 run 关联、重复执行保护和批次结果展示；也无法保证多个 Agent 不会抢同一任务。

## 文件边界

- 修改 `src/shared/automations-types.ts:118-127,135-170`：增加自动化目标模式、任务批次选择字段和批次结果关联字段；保持普通 prompt automation 向后兼容。
- 修改 `src/shared/local-task-types.ts:40-130`：为 `LocalTaskBatch`/`LocalTaskRun` 增加 automation 关联的可选字段，不能改变现有手动批次数据格式的读取兼容性。
- 修改 `src/main/local-tasks/file-store-batch-mutations.ts:18-90`：抽出可复用的 Open 任务候选筛选/批次创建逻辑；手动批量执行和自动化批次共用同一筛选规则。
- 修改 `src/main/local-tasks/store.ts`：暴露按 project/workspace 选择自动化批次的最小接口，并保证写入仍经过现有 file-store mutation/notification 路径。
- 新增 `src/main/automations/local-task-batch-coordinator.ts`：负责把 automation 范围转换为 LocalTask refs、创建批次、记录 automation run 关联；不负责启动终端。
- 修改 `src/main/automations/service.ts:246-339`：在 scheduled run 中识别本地任务模式、调用 coordinator、处理空批次和 dispatch 失败；普通 prompt automation 分支保持原行为。
- 修改 `src/shared/automations-types.ts` 中的 dispatch request/result，必要时新增 `src/shared/automation-local-task-batch.ts`：承载批次候选和汇总结果，避免把多个 session 塞进 `terminalSessionId`。
- 修改 `src/renderer/src/hooks/useAutomationDispatchEvents.ts:527-602`：识别本地任务批次 envelope，调用共享的任务执行器；普通 automation 仍使用 `automation.prompt`。
- 重构 `src/renderer/src/components/work-items/local-task-batch-runner.ts:33-123`：把“候选分组/任务 run 状态更新”和“具体 Agent launch”拆成可注入依赖，供手动按钮和自动化 dispatch 共用；不改变现有手动行为。
- 修改 `src/main/runtime/rpc/methods/automations.ts` 及 schema：校验目标模式和 project/workspace 范围，拒绝无范围的本地任务自动化。
- 修改 `src/renderer/src/components/automations/AutomationEditorDialog.tsx`、`AutomationEditorSettingsSidebar.tsx:123-188` 及相关 draft/schema：增加“执行 Open 本地任务”目标选择和范围提示；选择普通 prompt 时保持当前表单。

## 实施步骤

### Task 1：锁定共享类型和候选规则

- [ ] 为 automation 增加向后兼容的目标字段，例如 `executionMode: 'prompt' | 'open_local_tasks'`；默认值为 `prompt`。
- [ ] 为 `open_local_tasks` 增加 project/workspace scope，复用现有 `projectId`、`workspaceId`，禁止保存空 project。
- [ ] 为 automation run 增加 `localTaskBatchId`、`localTaskCount`、`localTaskCompletedCount`、`localTaskNeedsReviewCount`、`localTaskFailedCount` 等可选字段；普通 automation 保持 null/缺省。
- [ ] 为 LocalTaskRun 增加可选 `automationId`、`automationRunId` 字段，并保持旧 task.json 可解析。
- [ ] 抽出纯函数 `isOpenLocalTaskAutomationCandidate(task, scope)`，唯一允许条件为 `Open + ready + 未归档 + 非 queued/running + workspace 匹配`。
- [ ] 为纯函数补 Vitest：覆盖 Open、Done、Needs review、In progress、Inbox、归档、queued、running 和 workspace 不匹配。

### Task 2：实现主进程批次 coordinator

- [ ] 在 `src/main/local-tasks/file-store-batch-mutations.ts` 中让手动 `startBatch()` 与自动化入口共用候选判断和 stale queued run 清理逻辑。
- [ ] 在 `src/main/local-tasks/store.ts` 暴露 `startAutomationBatch({ projectId, workspaceId, automationId, automationRunId })`，写入所有候选 LocalTaskRun 的 automation 关联。
- [ ] 保证批次创建是逐任务写入前重新读取任务，并在写入时再次验证候选条件；重复调用不能把同一任务同时标记为两个 queued run。
- [ ] 新增 `local-task-batch-coordinator.ts`，将 store 返回的候选转换成 dispatch envelope 所需的最小数据：task ID、project path、workspace ID、run ID、workspace key。
- [ ] 为 coordinator 补测试：空批次、单 workspace 多任务、多个 workspace、重复 task ref、并发/陈旧 queued run、任务在扫描前变为 Needs review。

### Task 3：接入 AutomationService 的定时生命周期

- [ ] 在 `AutomationService` 的 scheduled path 中先解析 automation target；普通 `prompt` 路径保持现有 `requestDispatch()` 行为。
- [ ] 对 `open_local_tasks` 创建 automation run，并调用 coordinator；批次为空时将 run 标记为可解释的“无可执行 Open 任务”完成结果，不创建 Agent session。
- [ ] 将 batch ID 和候选数量写入 automation run；不要把第一个任务的 terminal session 冒充成整个批次的 session。
- [ ] 给 automation dispatch request 增加可选 `localTaskBatch` payload；旧 renderer/旧 host 收到未知可选字段时仍按普通 automation 兼容处理，或在能力不足时明确拒绝。
- [ ] 为 `service.test.ts` 增加：到点只选 Open、Done/Needs review/In progress 被排除、空批次、普通 prompt 不回归、批次创建失败和 dispatch 失败的状态断言。

### Task 4：复用现有任务 Agent 执行器

- [ ] 将 `local-task-batch-runner.ts` 中的任务候选分组、`updateRun`、settlement polling 和 Agent launch 依赖拆开；手动“全部执行”继续传入当前 renderer 依赖。
- [ ] 自动化 dispatch 使用 automation 的 `agentId`，每个候选使用自己的 `localTaskId`、`localTaskRoot`、task-specific prompt 和 LocalTaskRun ID。
- [ ] 每个任务独立处理 `queued → running → needs_review/failed`；一个任务失败不能阻止其他 workspace 的任务继续执行。
- [ ] 自动化 run 在所有候选都进入终态后汇总计数和输出；若有 `Needs review`，不能自动标记本地任务 Done，也不能自动调用验收。
- [ ] 为自动化执行器补测试：同 workspace 串行、不同 workspace 并行、任务启动失败、Agent prompt 投递失败、超时和重复 dispatch token。

### Task 5：补自动化编辑器和运行历史展示

- [ ] 在 automation editor 增加目标选择：普通 Prompt / Open 本地任务；选择后显示项目和 workspace 范围说明。
- [ ] 对本地任务模式隐藏不适用的“新建 workspace 每次运行”选项；首期只允许已有 workspace，避免任务路径和任务归属在每次运行变化。
- [ ] 在 AutomationDetail/run history 中显示“扫描了 N 个 Open 任务、完成 M、Needs review K、失败 L”，不把批次误显示成单个终端会话。
- [ ] 当运行目标不支持本地任务批次时，显示明确错误并保留普通 automation 的可用性。
- [ ] 为 editor draft、schema、detail 展示补 renderer 测试。

### Task 6：验证兼容性和发布边界

- [ ] 运行共享类型、local-task mutation、automation service、runtime RPC、renderer automation dispatch 的定向测试。
- [ ] 运行 TypeScript 类型检查、lint 和项目既有构建命令。
- [ ] 手工验证：创建两个 Open ready 任务和一个 Needs review 任务，设置同一项目/workspace 的定时 automation，确认只启动两个 Open 任务。
- [ ] 手工验证：同一 workspace 的两个任务按顺序执行；不同 workspace 可并行；任务进入 Needs review 后只等待人工处理。
- [ ] 手工验证：普通 prompt automation 的新建、run now、reuse session 和历史展示不受影响。
- [ ] 明确记录 headless serve：如果首期只支持 renderer，必须在 schema/运行历史中拒绝或标记不支持，不能静默丢任务；headless 批次执行另立后续计划。

## 验收标准

1. 保存一个 `open_local_tasks` automation 后，指定时间到达时，系统只会锁定满足 `Open + ready + 未归档 + 非 queued/running + scope 匹配` 的任务。
2. `Done`、`Needs review`、`In progress`、Inbox、归档、已排队和运行中的任务都不会创建新的 LocalTaskRun。
3. 同一任务在一次调度或并发调度中最多只有一个活动 queued/running run。
4. 一个 automation run 可以正确展示 0、1 或多个任务的结果，不依赖单一 `terminalSessionId`。
5. 每个任务的 Agent 都能读取完整任务和子任务上下文，并通过现有 CLI/RPC 报告完成或请求 review。
6. 任务请求 review 后保持 `Needs review`，不会被下一次自动扫描再次启动，也不会被自动验收。
7. 普通 prompt automation 的现有创建、定时、手动运行、session reuse、precheck 和历史记录测试全部通过。
8. renderer 不可用时行为可解释：要么由明确支持的 headless dispatcher 执行，要么记录不支持原因；不能出现 automation run 已完成但本地任务没有 run 的情况。

## 风险与缓解

- **批次选择与 automation run 不是同一事务。** 通过 coordinator 先创建带 automation 关联的 LocalTaskRun，再写入 automation run 关联；失败时回滚/标记孤儿 queued run，并增加重启恢复测试。
- **旧客户端不理解新目标字段。** 新字段保持可选；对不具备能力的客户端使用能力协商或明确 `skipped_unavailable`，不把本地任务模式降级成普通 prompt。
- **多个任务无法由单 session 字段表达。** automation run 只保存批次汇总和 batch ID，具体终端/输出留在 LocalTaskRun/session 中。
- **手动批次和定时批次规则漂移。** 两者共用同一个纯候选函数和批次 mutation，不在 renderer 另写筛选条件。
- **任务路径/workspace 不可用。** 批次在启动前再次检查 workspace；单任务失败只影响该任务，汇总中显示失败数。
- **headless 路径误报成功。** 首期若不实现 headless 批次，必须在调度前显式拒绝并记录原因；不能复用单任务 headless prompt 伪装成批次支持。

## 验证命令

计划执行阶段至少运行以下定向验证：

```bash
pnpm exec vitest run --config config/vitest.config.ts src/main/local-tasks src/main/automations/service.test.ts src/main/runtime/rpc/methods/automations.test.ts
pnpm exec vitest run --config config/vitest.config.ts src/renderer/src/components/work-items src/renderer/src/hooks
pnpm run typecheck
pnpm lint
pnpm build
```

## 后续明确不包含的内容

- 用户回复的 `immediate` / `next_run` 选择。
- 延迟回复持久化、回复队列和 Needs review 的自动重开。
- 自动处理 `In progress` 任务。
- 自动验收或将任务直接改成 `Done`。
- 让一个 automation prompt 自由扫描所有项目的任务文件。
- headless 多任务执行，除非单独完成 dispatcher 能力和跨进程 session 关联设计。
