# 本地任务工作流审查

日期：2026-08-26

## 当前规则

任务状态有五个值：

- `Open`：任务已创建，但还没有 Agent 运行。
- `In progress`：没有已结束会话，且至少有一个 Agent 会话正在运行。
- `Needs review`：任意一个关联 Agent 会话已经结束，等待用户查看和验收。
- `Done`：用户验收通过。
- `Waiting`：旧任务文件仍可读取，但新界面不再提供设置入口。

状态优先级是：

```text
Done > Needs review（任意会话结束） > In progress（仅有运行中会话） > Open
```

子任务和执行步骤只表示 AI 的执行进度，不直接决定父任务是否验收。会话状态是 `working`、`idle` 或 `done`；`idle`/`done` 都表示该会话本轮已经结束。

## 实际文件审查

扫描目录：`/Users/lmy/proj/Tile/BallsOutProj/orca`，共 7 个任务。

发现的问题：

1. `lt_0b195155-ad9e-42e6-908a-fe7d5ade525e` 同时是 `In progress`、`executionState=running`、会话 `working`，但 `archivedAt` 已有值。默认列表会把它隐藏，造成“正在运行的任务消失”。
2. `lt_e129f215-310e-453d-9eb1-77818009f8d5` 是 `In progress`，但 `sessions=[]` 且 `executionState` 为空。它是没有真实 Agent 归属的孤儿状态。
3. `lt_b97a2c2d-cfe6-4231-9d55-5d93464befb1` 对同一条 YooAsset 问题登记了两个 `working` 会话，说明重复点击或重复关联没有被业务层去重。
4. `lt_2e3f0eb9-eb32-4cd7-a866-7b76cea74347` 的两个会话都已 `done`，但文件仍是 `In progress`，说明旧版本写入没有在读取时完全修复父任务状态。
5. 多个任务的 `task.json` 已有子任务，但同目录 `plan.json` 仍是空数组。原因是这些文件在“每次 Store 写入同步 plan”之前创建，当前代码只保证后续写入会同步，不会自动修复历史文件。
6. 部分旧任务没有 `intakeState`、`executionState`、`runs` 等新字段。读取器会填默认值，因此页面能打开，但原文件本身并不完整，其他 AI 直接读取文件时会得到不同结论。

## 多余或重复

1. 父任务同时把状态写在 `task.json.status`、`executionState`、`runs[].status`、`sessions[].status`，其中多个字段可以互相矛盾。它们适合分别表达“用户验收状态”“一次批次运行状态”“会话状态”，但当前 UI 没有始终区分这三层。
2. 子任务既写入 `task.json.subtasks`，又写入 `plan.json.subtasks`。这是为了让其他 AI 读取计划，但会产生双写和冲突风险；至少应明确 `task.json` 是运行快照，`plan.json` 是可读计划，不能让两边都成为独立真相。
3. `prd.md`、`records.md` 和 `latestOutput` 都可能保存相似的完成说明。它们的职责应固定：PRD 只放需求，records 只放追加式实现记录，latestOutput 只放本轮最后回复。
4. `Waiting`、`waitingReason`、`requestReview(needs_input)` 表达的都是“等待用户”，但 UI 现在只保留 `Needs review`，旧字段仍留在模型中，容易让 AI 和用户误以为还有一套可操作的等待流程。

## 缺失项

1. **开始执行没有真正启动 Agent**：详情页的“开始执行”当前只把任务写成 `In progress`；真正创建会话的是 Agent 选择菜单或“执行当前任务”批量入口。这会造成按钮语义误导。
2. **没有统一的停止/取消动作**：Agent 卡死、误启动或用户不想继续时，任务中心没有停止当前会话、取消批次、释放 `executionRun` 的入口。
3. **没有启动失败的显式 UI**：批量 runner 的失败会写入 run，但详情主要展示任务状态和最后输出，用户不容易看到“为什么没有启动”。
4. **没有重启恢复机制**：批量执行由 renderer 轮询等待，Orca 关闭或 renderer 重载后，`queued/running` 运行记录可能长期停留，缺少主进程恢复或超时回收。
5. **没有文件修复/一致性检查**：需要一个只读诊断或修复动作，检查 `archivedAt` 与 working 会话冲突、任务状态与会话状态冲突、`task.json` 与 `plan.json` 不一致，并给出明确修复策略。
6. **没有可靠的会话去重键**：当前主要按 tab/session ID 去重，无法识别同一个用户请求被重复启动两个 Agent；应增加一次请求 ID 或启动令牌。
7. **没有完整的验收摘要结构**：`latestOutput` 是一段自由文本，尚未结构化记录变更文件、测试命令、失败项、待确认项，导致“Needs review”页面仍需用户读长文本。

## 建议优先级

### 立即修复

- 启动时或读取任务时自动清理“已归档但仍有 working 会话”的矛盾，至少在 UI 显示异常而不是静默隐藏。
- 把“开始执行”改为真正打开 Agent 选择并创建会话，或改名为“标记为执行中”；不应保留含义不一致的按钮。
- 增加一个运行失败/孤儿任务提示，避免 `In progress` 没有会话。

### 第二阶段

- 将任务状态、运行状态、会话状态拆成三个清晰区域；父任务状态只走 `Open -> In progress -> Needs review -> Done`。
- 主进程负责批次生命周期和恢复，renderer 只负责展示，不用页面存活维持 12 小时轮询。
- 为会话启动增加请求 ID，防止重复关联和重复启动。

### 后置能力

- `orca doctor` 或任务中心诊断页，输出文件一致性检查和可恢复建议。
- 将 `latestOutput` 拆成结构化交付报告，同时保留 Markdown 原文。
- 跨机器/远程 workspace 的任务索引和历史会话映射。

## 本轮结论

当前文件方案可以作为任务上下文真相，但还不是完整的可靠任务系统。最主要的风险不是字段数量，而是“多处状态写入 + 没有一致性修复 + renderer 持有批次生命周期”。
