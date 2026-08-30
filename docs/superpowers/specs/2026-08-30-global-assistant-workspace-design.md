# 全局主动助理 Workspace 设计

日期：2026-08-30

状态：已确认，待实施计划

## 1. 目标

在 Orca 现有“多会话 + 本地任务 + 自动化调度”能力之上，增加一个全局主动助理。助理的体验类似 Siri：用户可以查询、汇报、分析、规划和调度；助理按周期主动巡检并汇报，但不擅自改变用户的工作计划。

第一版权限基线为：

- 在用户明确授权的业务 workspace 中，现有项目 Agent 可以实际改代码、运行测试和完成任务；
- 全局助理只负责读取状态、形成判断、提出建议、生成报告，并调用既有任务/调度能力；
- 删除、发布、外部消息、生产环境等高风险动作不由助理自动执行。

## 2. 已确认的产品决策

### 2.1 信息范围

第一版只使用 Orca 内部信息，不接入外部代码托管、项目管理、邮件、日历或即时通讯系统。

助理可读取：

- 已登记的本机项目和 workspace；
- Open、In progress、Needs review、Done 任务；
- 任务 session、task run、automation run 和已有摘要；
- 失败、阻塞、待验收和重复执行信号；
- 工作区 Git 状态；
- 助理 workspace 中的目标、决策、报告、handoff 和 proposal。

### 2.2 长期方向

长期上下文采用项目级目标/原则，而不是一个无限增长的总任务或散落在 automation prompt 中的隐含规则。

每个项目可以维护少量目标、优先级、约束和禁止事项。全局助理基于这些目标提出建议，但不能未经确认修改目标或正式优先级。

### 2.3 建议门禁

全局助理发现新工作时只生成 proposal，不自动创建正式任务。用户确认后才进入任务池。

proposal 提供两个确认动作：

1. **接受并加入待办**：创建 `Open` 任务，等待现有每小时调度；
2. **接受并立即调度**：创建任务后立即调用现有 `startBatch`，在目标 workspace 启动项目 Agent。

两个动作都必须先显示任务预览。接受操作按 `proposalId` 幂等，同一 proposal 不能创建两个正式任务。

### 2.4 主动节奏

- 每小时巡检一次；
- 每天生成一次日报和明日安排；
- 仅在有新建议、阻塞、失败、待验收或日报时产生需要用户关注的通知；
- 没有变化的巡检只保存简短运行结果，不制造空 proposal。

## 3. 总体架构

```text
一个全局 assistant workspace
        |
        +-- 交互 session（用户主动聊天）
        +-- 每小时 automation -> 一次巡检 session
        +-- 每日 automation   -> 一次汇报 session
        |
        +-- goals / decisions / reports / handoffs / proposals

助理 Agent
  -> 读取只读状态快照
  -> 查询、汇报、分析、规划
  -> 写 proposal/report/handoff
  -> 用户确认后调用既有 local-task / automation / dispatch API

项目 Agent
  -> 在目标项目 workspace 中执行代码、测试和调研
  -> 更新现有任务、run、session 和交付报告
```

全局助理是规划和调用层，不是所有项目的总控终端。确定性调度器继续负责扫描、排序、认领、并发、重试、恢复和审计；项目 Agent 继续负责实际工作。

## 4. Assistant Workspace

### 4.1 身份和创建

assistant workspace 是用户首次配置时选择的一个普通 `FolderWorkspace`。它可以是空目录，也可以是已有的轻量项目目录；不要求初始化 Git。

每个 Orca profile 只允许一个全局 assistant workspace。profile/global settings 保存该 workspace 的稳定引用，例如 `assistantWorkspaceId` 或等价的 `WorkspaceKey`；workspace 路径始终从 FolderWorkspace 权威记录解析，不重复维护第二份路径真相。

不新增新的 workspace 类型。现有 `FolderWorkspace`、workspace tab 持久化、恢复和主机归属规则继续生效。

如果用户删除、移动或失去该 folder 的访问权，助理进入“需要重新选择 workspace”状态；后台 automation 不应在未知目录中继续写入。

### 4.2 文件职责

助理可以在所选 folder 中维护如下约定目录；这些是默认布局，不要求用户手动创建：

```text
assistant/
  goals.md
  decisions.md
  reports/
  handoffs/
  proposals/
```

职责固定为：

- `goals.md`：全局和项目目标、优先级原则、禁止事项；
- `decisions.md`：用户确认过的长期决策；
- `reports/`：每日汇报和重要巡检报告；
- `handoffs/`：会话轮换时的压缩上下文；
- `proposals/`：等待确认、已接受或已拒绝的建议。

第一版只允许助理自动写入 `assistant/` 目录；对该 workspace 其他文件的修改仍按普通任务处理，不由助理隐式取得额外权限。

## 5. Session 模型与上下文控制

### 5.1 三类 session

尽量复用现有 Agent session 和 tab，不建立第二套聊天运行时：

- **interactive session**：助理 tab 中用户与助理的交互会话；
- **hourly session**：每小时 automation 创建的新会话，完成巡检后结束；
- **daily session**：每日 automation 创建的新会话，完成日报后结束。

每小时和每日 automation 使用 `reuseSession: false`。它们共享 assistant workspace，但不共享同一条无限增长的 transcript。

### 5.2 交互会话轮换

interactive session 满足任一条件时轮换：

- 达到配置的对话轮次阈值；
- 接近当前 Agent 的上下文限制；
- 主题明显从一个工作周期切换到另一个工作周期；
- 用户点击“开始新一轮”。

轮换前由旧 session 生成 handoff，至少包含：

```text
当前目标
已确认决策
不可违反的约束
已发现事实
未决问题
下一步建议
```

新 session 只读取 handoff、最新状态快照和最近相关报告，不加载完整旧 transcript。旧 session 继续通过 AI Vault 和 automation run 历史查看。

### 5.3 Tab 行为

- assistant workspace 中提供一个明显的“助理”交互 tab；
- 巡检/日报 tab 可在完成后自动关闭，也可保留为历史入口；
- tab 关闭不影响后台 automation；
- 有新 proposal、失败、阻塞或日报时，复用现有未读/通知机制；
- 用户点击历史记录时，从对应 AutomationRun/session 恢复查看，而不是复制全文到交互 session。

## 6. 只读状态快照与调用接口

### 6.1 Snapshot

为 Siri 式查询提供一个统一的只读聚合入口，建议暴露为 CLI/RPC 等价能力：

```text
orca assistant snapshot --json
```

快照由主进程组合现有数据，至少包含：

- 项目、workspace 及其可用性；
- 各项目任务状态和优先级；
- 最近 session 摘要和 task run 结果；
- automation 最近运行、下次运行和失败原因；
- Git dirty、未提交或无法确认状态；
- 最近日报、决策、handoff 和未处理 proposal；
- 数据时间戳、来源和“无法验证”的原因。

快照默认只读、可截断、带稳定排序，并明确区分 `live`、`unverifiable`、`exited` 等执行证据，不把失联误判为进程死亡。

### 6.2 Proposal 接口

助理写 proposal 时使用结构化记录，而不是只输出自由文本。建议字段：

```text
proposalId
sourceAutomationRunId
createdAt
projectId
workspaceId
title
description
whyNow
priority
acceptanceCriteria
risks
estimatedScope
status: proposed | accepted | rejected
acceptedTaskId
acceptedRunId
```

接受 proposal 的主进程接口必须：

- 重新读取 proposal 和目标 workspace；
- 校验 proposal 尚未处理；
- 校验目标项目仍存在且有权限；
- 创建正式 `Open` 任务；
- 若用户选择立即调度，再调用现有 batch/dispatcher；
- 将 taskId/runId 回写 proposal；
- 对重复请求返回已有结果。

助理 Agent 不直接调用任意 IPC，不直接修改目标项目，也不绕过 proposal 门禁创建正式任务。

## 7. 自动化与执行流程

### 7.1 两条系统 automation

系统为 assistant workspace 配置两条普通 automation：

```text
assistant-hourly
  executionMode: prompt
  workspaceMode: existing
  workspaceId: assistant workspace
  reuseSession: false
  周期：每小时

assistant-daily
  executionMode: prompt
  workspaceMode: existing
  workspaceId: assistant workspace
  reuseSession: false
  周期：每天
```

automation 的创建、启停、运行历史和失败处理复用现有 Automation/AutomationRun。是否需要额外的 `runPurpose` 字段，应在实施时优先尝试通过现有 automation ID、标题和来源投影完成；只有现有投影不足以支持 UI 筛选时才增加可选字段。

### 7.2 每小时巡检

巡检 session：

1. 读取 `assistant snapshot --json`；
2. 读取目标/决策/handoff 和最近报告；
3. 找出阻塞、失败、待验收、重复、长期未处理和明显遗漏；
4. 生成零个或多个 proposal；
5. 写入简短巡检报告；
6. 结束 session 并记录 AutomationRun。

巡检不得执行项目代码，不得直接创建任务，不得将项目状态强行改为 Done。

### 7.3 每日报告

日报 session 读取当天和前一工作周期的快照及报告，固定输出：

```text
今日完成
当前进行中
阻塞与风险
你做出的决策
明日建议
待你确认的事项
```

日报是面向决策的摘要，技术验证、测试命令和失败原文作为辅助证据引用，不以长日志替代结论。

### 7.4 Proposal 接受后的执行

```text
用户点击接受
  -> 显示最终任务预览
  -> 主进程幂等创建 Open 任务
  -> [加入待办] 结束
  -> [立即调度] 调用现有 startBatch/dispatcher
  -> 项目 Agent 在目标 workspace 执行
  -> 项目 Agent 更新任务、run、session 和交付报告
  -> 助理在下次巡检/日报中读取结果
```

项目 Agent 的执行体系不变：继续使用现有 workspace 绑定、LocalTaskRun、LocalTaskSession、子任务、request-review 和 report-completed 约定。

## 8. 失败、恢复和幂等

### 8.1 助理运行失败

- assistant workspace 不可用：本轮暂停，标记 automation run 失败或不可用，并提示重新选择 workspace；
- Agent session 创建失败：记录 AutomationRun 失败，不写 proposal；
- 输出不是合法结构：保存原始输出，标记需要人工检查，不产生任务副作用；
- 快照部分不可用：允许生成带证据缺口的报告，但不得把未知当成正常或成功。

### 8.2 项目执行失败

- 项目 Agent 启动失败或服务端返回 429：目标任务保持 `Open`，对应 run 记录原始错误；
- 立即调度失败不回滚已创建的任务；用户可稍后从任务详情重试；
- 项目 Agent 失败不改变 proposal 为完成；助理在下一次巡检中将其作为失败/待处理事项。

### 8.3 重启与重复请求

- Orca 重启后，依靠现有 automation/run 持久化和主进程恢复机制继续判断状态；
- 无法确认外部 session 结果时，不直接判定成功或失败；
- proposal 接受、任务创建和立即调度均使用 proposalId/请求键幂等；
- 同一小时巡检或日报因重试重复到达时，不产生重复报告或重复 proposal。

## 9. 复用与最小新增面

必须优先复用：

- `FolderWorkspace` 和 workspace session/tab 持久化；
- Agent session 创建、状态、恢复和 AI Vault 历史；
- Automation、AutomationRun、schedule 和通知；
- LocalTask、LocalTaskRun、LocalTaskSession、子任务和交付报告；
- 现有 `startBatch`、automation dispatcher 和 IPC/RPC 校验；
- 现有 Git/workspace 状态读取能力。

建议的最小新增面：

1. profile/global setting：一个 `assistantWorkspaceId`/`WorkspaceKey`；
2. assistant workspace 初始化和重新选择流程；
3. assistant snapshot 只读聚合入口；
4. proposal 文件 schema、列表、接受/拒绝/稍后处理操作；
5. assistant tab 工作台 UI；
6. interactive session handoff/轮换策略；
7. 与两条系统 automation 的绑定和结果投影。

不新增：

- 第二套任务数据库；
- 独立的 PlannerRun 生命周期；
- 一个永远存活的超级 Agent session；
- 一个绕过现有调度器的项目执行通道；
- 默认外部连接器或外部消息发送能力。

## 10. 交互验收标准

### Workspace 和 tab

- 首次配置可以选择一个普通 folder 作为 assistant workspace；
- 重启 Orca 后 assistant workspace 和助理 tab 可以恢复；
- assistant workspace 不绑定某个业务项目；
- assistant tab 关闭不影响小时巡检和日报。

### 查询和汇报

- 助理可以回答最近任务、当前阻塞、最近失败和今日完成情况；
- 每小时巡检产生可追踪的 AutomationRun；
- 每日报告包含固定六段内容；
- 数据不可用时显示证据缺口，不虚构状态。

### Proposal 和执行

- 助理可以生成 proposal，但不能直接创建正式任务；
- 接受 proposal 前能看到项目、workspace、描述、验收标准和风险；
- “加入待办”和“立即调度”都可用；
- 重复点击不会创建重复任务或重复 run；
- 立即调度失败时任务仍为 `Open`，并能看到原始错误；
- 项目 Agent 仍在目标 workspace 中执行，助理 workspace 不被当成目标执行目录。

### 上下文控制

- hourly/daily 不复用旧 session；
- interactive session 可生成 handoff 并开启新一轮；
- 新会话不需要载入完整旧 transcript；
- 历史 session 仍可通过 AI Vault/AutomationRun 查看。

## 11. 实施顺序建议

1. 先完成 assistant workspace 的 profile 配置、普通 folder 选择和恢复；
2. 增加只读 snapshot，验证跨项目聚合数据和不可验证状态表达；
3. 接入两条系统 automation，先只生成报告，不产生 proposal；
4. 增加 proposal schema 和接受幂等，接通“加入待办”；
5. 接通“立即调度”，复用现有 startBatch/dispatcher；
6. 实现 assistant tab 工作台和未读/待决策卡片；
7. 增加 interactive handoff/轮换；
8. 最后补齐重启恢复、失败注入、重复点击和跨项目回归测试。

## 12. 延后决策

以下问题不阻塞第一版设计，实施时再决定：

- assistant workspace 是否需要专门的图标或侧边栏分组；
- proposal 文件是否由 JSON 单文件改成 JSONL/SQLite 索引；
- 是否需要显式的 `assistantRunPurpose` 字段；
- 是否允许用户配置小时巡检和日报的具体时区/时间；
- 是否在后续版本接入 GitHub/GitLab/Linear 等外部只读数据源。

