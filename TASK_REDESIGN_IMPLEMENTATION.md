# 任务中心重构实现文档

日期：2026-09-05
目标分支：`kanban2`
参考分支：`kanban1`
状态：实现前设计，未修改业务代码。

## 1. 目标与边界

任务中心用于聚合研发目标、子任务和相关 AI 会话，让用户从一个任务入口了解当前状态并跳转到完整会话。

本次从同步后的 `main` 重新实现任务层，参考 `kanban1` 的界面构成和可复用交互。项目仍在开发阶段，不保留旧任务格式、旧字段、旧兼容读取、旧迁移逻辑或旧测试规则。

保留原 Orca 的 Project、workspace、Terminal、Agent Session、会话历史和实时运行状态能力。任务层不复制完整会话、不生成执行批次、不维护另一套 Agent 运行系统。

## 2. 领域关系

```text
Project
└── Workspace
    └── Task
        ├── Subtask 1 ↔ Session 1
        │   └── Steps
        ├── Subtask 2 ↔ Session 2
        │   └── Steps
        └── Subtask 3（尚未启动，无 Session）
```

### Task（任务）

任务是用户要推进的长期研发目标，例如“修复登录刷新失效”。任务创建时选择项目和 workspace；收件箱任务可以暂时没有项目和 workspace。

任务保存基础信息、父任务状态、归档信息、所属项目/workspace、子任务列表和会话索引。任务不保存验收要求、执行请求、批次、AI 摘要、完整会话内容或产物关系。

### Subtask（子任务）

子任务是任务内一项可单独说明和推进的工作，例如“比较无状态登录和 Token 刷新方案”。它可以先被记录，之后再启动会话。

每个子任务最多关联一个会话；一个执行会话只属于一个子任务。子任务保存标题、描述、状态、步骤和时间信息。一个会话发现相近工作时，更新当前子任务的描述和步骤，不自动创建新子任务。

### Session（会话）

会话是实际的 AI 对话和执行过程。任务中心只保存稳定会话 ID、当前 Terminal Tab ID、用途标题、Agent、workspace 和关联子任务；完整用户消息、AI 回复、工具调用、测试输出和运行状态继续由原 Orca 会话系统负责。

### Step（步骤）

步骤属于子任务，用于表达当前会话的执行计划。步骤状态有 `todo`（未开始）、`doing`（进行中）、`done`（完成）和 `canceled`（取消）。步骤不关联其他会话，不支持会话之间移交；需要另一个会话独立处理时，创建另一个子任务。

## 3. 持久化边界

### 3.1 软件持久化：任务主记录

任务、子任务、步骤、会话关系、任务状态和待审阅标记由 Orca 软件持久化，不能放在 Git 分支或 workspace 的 `task.json` 中。第一版复用现有 `orca-data.json` 对应的持久化 Store；数据量和查询需求不足以引入 SQLite。

建议的机器记录结构：

```ts
type PersistedTask = {
  id: string
  title: string
  description: string
  projectId: string | null
  projectPath: string | null
  workspaceId: string | null
  workspaceLabel: string | null
  status: 'Open' | 'In progress' | 'Needs review' | 'Done'
  archivedAt: number | null
  createdAt: number
  updatedAt: number
  subtasks: PersistedSubtask[]
}

type PersistedSubtask = {
  id: string
  taskId: string
  title: string
  description: string
  status: 'todo' | 'doing' | 'done' | 'canceled'
  session: PersistedTaskSession | null
  steps: PersistedTaskStep[]
  reviewed: boolean
  createdAt: number
  updatedAt: number
}

type PersistedTaskSession = {
  sessionId: string
  tabId: string | null
  title: string
  agentId: string | null
  workspaceId: string
  lastKnownState: 'working' | 'stopped' | 'disconnected' | 'unknown'
  reviewed: boolean
  createdAt: number
  updatedAt: number
}

type PersistedTaskStep = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done' | 'canceled'
  createdAt: number
  updatedAt: number
}
```

`lastKnownState` 是展示缓存，不能替代原 Orca 的实时状态；`reviewed` 表示用户已经处理该会话停止或异常的结果，不表示逐行阅读进度。

### 3.2 项目上下文文件

任务转为可执行并选择项目/workspace 后，创建或移动：

```text
<projectRoot>/orca/<task-id>/
├── prd.md
├── plan.md
└── records.md
```

- `prd.md`：任务背景、目标和范围。
- `plan.md`：准备做什么、研究方向、暂不执行的想法和可读计划。
- `records.md`：已经做了什么、事实、结论、验证和遗留问题。

这三个文件不参与任务状态、子任务状态和会话关系判断，也不反向覆盖软件持久化。不存在 `task.json` 和 `plan.json`。当前分支缺少文件时，任务仍保留，界面提示上下文文件不可用。

### 3.3 收件箱

收件箱任务的 `projectId`、`projectPath` 和 `workspaceId` 可以为空。主记录先由软件持久化；上下文文件可以暂不创建，或放在软件管理的临时目录。

用户执行“转为可执行”时：

```text
选择项目和 workspace
→ 创建/移动 prd.md、plan.md、records.md
→ 更新软件任务记录的项目和 workspace
→ 允许启动任务会话
```

## 4. 状态规则

### 4.1 任务状态

系统根据任务和所有关联会话聚合状态：

```text
Done > In progress > Needs review > Open
```

- `Done`：用户确认任务完成，最高优先级。
- `In progress`：至少一个关联会话仍在运行。
- `Needs review`：没有运行中的关联会话，但存在停止、断连、窗口关闭或未知状态且尚未 reviewed 的会话。
- `Open`：任务尚未启动任何会话。

多个会话并行时，运行中的会话优先：实现会话运行、审查会话停止时，任务显示 `In progress`，同时显示“待查看数量”。所有会话都停止后，任务显示 `Needs review`。

窗口关闭、网络断开和连接无法确认均进入待审阅提醒。它们只能显示为“需要检查”，不能直接宣称远程进程已经退出，也不能自动启动重复会话。

### 4.2 子任务状态

- `todo`：已记录但尚未开始。
- `doing`：关联会话已经启动或会话明确开始处理。
- `done`：会话或用户明确完成该子任务。
- `canceled`：用户明确取消该子任务。

子任务完成不会自动把任务设为 `Done`。任务只有在用户确认整个目标完成后才进入 `Done`。

### 4.3 会话状态

会话实时状态复用原 Orca：运行中、已停止、断连、未知。任务层只保存最近已知值用于启动和重启后的展示；重新连接后以原 Orca 实时事实刷新。

## 5. 核心用户流程

### 5.1 创建并启动任务

1. 用户填写任务标题和描述。
2. 选择项目和 workspace；收件箱可以暂时跳过。
3. 软件创建任务主记录。
4. 已选择项目时创建 `prd.md`、`plan.md`、`records.md`。
5. 用户点击“启动任务”。
6. 软件创建默认子任务，例如使用任务标题作为初始标题。
7. 软件创建 Agent 会话并写入会话索引。
8. 激活对应 workspace 和 Terminal Tab。
9. 发送任务上下文和首次用户请求。
10. 会话确认启动后，子任务变为 `doing`，任务聚合为 `In progress`。

### 5.2 新建关联会话

1. 用户在任务详情点击“新建关联会话”。
2. 用户输入本轮独立 prompt，并选择 Agent。
3. 软件创建新的子任务和会话一一对应记录。
4. 新会话继承任务项目/workspace；不重复发送原任务描述作为本轮用户请求。
5. 任务详情刷新子任务、会话和待查看数量。

### 5.3 会话处理相近工作

Agent 首先读取当前子任务描述、步骤、`prd.md`、`plan.md` 和 `records.md`。如果新请求仍属于当前子任务：

- 更新当前子任务描述或步骤。
- 不创建新子任务。
- 保留同一会话的连续讨论。

只有用户明确提出独立方向，或工作需要独立查看、独立完成和独立审阅，才创建新的子任务和会话。

### 5.4 会话停止、断连和审阅

1. 原 Orca 会话系统报告停止、窗口关闭或连接异常。
2. 任务层更新该会话的最近已知状态。
3. 如果没有其他运行会话，任务聚合为 `Needs review`；如果还有运行会话，任务保持 `In progress` 并增加待查看数量。
4. 用户打开会话查看完整记录。
5. 用户点击“已处理/继续/重新启动”之一后，清除该会话的 `reviewed` 提醒；继续执行时创建新一轮会话或复用原会话，按实际 Agent 能力决定。

### 5.5 用户确认任务完成

1. 用户在任务详情点击“完成任务”。
2. 软件要求没有仍在运行的会话，或明确提示用户正在运行的会话会被保留。
3. 任务状态写为 `Done`。
4. 关联子任务不强制全部改为 `done`，但界面提示仍有未完成子任务时需要用户确认。
5. 用户随后手动执行 Git 合入；任务文件随项目上下文进入主线。

### 5.6 永久删除

永久删除必须由用户确认，并同时删除：

- 软件任务主记录。
- 子任务、步骤和会话索引。
- 项目 `orca/<task-id>/prd.md`、`plan.md`、`records.md`。
- 收件箱或软件临时目录中该任务的上下文文件。

不删除原 Orca Agent 的完整会话日志和业务代码；会话历史由原系统管理，业务代码由 Git 管理。

## 6. 代码模块建议

从 `main` 建立 `kanban2` 的新实现，模块边界建议如下：

- `src/shared/task-center-types.ts`：任务、子任务、步骤、会话索引和状态类型。
- `src/main/persistence/...`：任务持久化，复用现有 `PersistedState` 和 Store 保存机制。
- `src/main/task-center/`：任务聚合状态、子任务更新、会话关联、上下文文件创建/移动/删除。
- `src/main/ipc/task-center.ts`：主进程校验和 IPC 方法。
- `src/preload/api/task-center-api.ts`：渲染层最小接口。
- `src/renderer/src/components/task-center/`：参考 `kanban1` 的看板、列表、详情抽屉、会话跳转和待查看提示。
- 原 Agent Session、Terminal、workspace、transcript 模块：继续复用，不在任务模块复制实现。

任务持久化接口应尽量小：

```text
listTasks(scope)
getTask(taskId)
createTask(input)
updateTask(taskId, patch)
createSubtask(taskId, input)
updateSubtask(taskId, patch)
updateSubtaskStep(taskId, subtaskId, stepId, patch)
attachSession(taskId, subtaskId, sessionRef)
markSessionReviewed(taskId, subtaskId)
acceptTask(taskId)
archiveTask(taskId)
deleteTask(taskId)
ensureContextFiles(taskId, projectPath)
```

启动 Agent、激活 workspace、创建 Terminal Tab 和恢复会话继续调用 Orca 现有启动器，不由任务 Store 直接创建进程。

## 7. 实施阶段

1. 新建 `kanban2` 分支并确认与同步后的 `main` 一致。
2. 删除任务分支中的旧本地任务模块、旧 CLI、旧 IPC、旧测试和兼容字段；不迁移旧任务数据。
3. 实现新的软件持久化类型和任务 Store。
4. 实现项目上下文文件创建、更新、缺失提示、收件箱转可执行和永久删除。
5. 实现任务、子任务、步骤和会话关联的 IPC 与 Agent CLI/RPC。
6. 复用原 Orca 启动器，完成首次启动和新建关联会话。
7. 接入原 Agent/Terminal 实时状态，完成任务状态聚合、断连提醒和待查看数量。
8. 参考 `kanban1` 重建任务中心 UI，优先完成列表、详情、子任务、会话跳转和完整会话阅读。
9. 增加定向单元测试和 Electron Playwright 流程测试。
10. 暂不接入旧批次执行、旧自动化模板、旧 AI 记录流和旧任务兼容逻辑；第一版核心闭环稳定后再重新评估。

## 8. 验收场景

- 创建任务并选择项目/workspace，自动生成三份 Markdown。
- 启动任务，自动创建第一个子任务和会话，并进入 `In progress`。
- 同一任务创建方案比较、代码审查和现状讲解三个关联会话。
- 一个会话运行、一个会话停止时，显示 `In progress` 和待查看数量。
- 所有会话停止后，显示 `Needs review`。
- 关闭窗口或断开网络后，显示需要检查的待审阅状态，不自动重复启动。
- 相近请求更新现有子任务描述和步骤，不创建重复子任务。
- 独立方向创建新的子任务和会话。
- 暂不执行的方向可以先写入 `plan.md`；需要长期跟踪时创建无会话的子任务，之后再启动对应会话。
- 切换分支、切换 worktree 或删除执行目录，软件任务仍存在；缺失 Markdown 只显示上下文不可用。
- 任务完成后用户确认 `Done`，随后手动合入主线。
- 永久删除同时移除软件记录和三份项目上下文文件，但不删除 Agent 原始会话日志和业务代码。

## 9. `kanban1` 已有能力盘点

下面是对 `kanban1` 实现的补充盘点。它们分为“第一版保留”“按新模型重做”和“暂不带入”，不能直接把旧模块整体复制到 `kanban2`。

### 9.1 第一版保留并重做

| `kanban1` 能力                  | 新实现要求                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 任务中心顶层入口                | 保留独立任务中心，与外部工单入口分开；任务列表、详情抽屉和 workspace 跳转保留                                |
| 看板/列表两种视图               | 保留；看板可按任务或子任务视角查看，默认任务视角                                                             |
| 项目筛选                        | 保留全部项目和单项目筛选；软件主记录可直接按项目索引，不再扫描每个 worktree 的 `task.json`                   |
| 收件箱/可执行/待审阅/已归档筛选 | 保留，但数据来自软件任务状态和会话聚合；收件箱任务可没有项目/workspace                                       |
| 搜索、标签、标签筛选            | 保留标签和全文搜索；标签属于软件任务记录，不写入 Markdown 状态                                               |
| 新建任务选择项目/workspace      | 保留；收件箱入口允许跳过，转可执行时再选择                                                                   |
| 任务详情编辑标题、描述、标签    | 保留；用户可编辑，AI 只通过任务命令提出或执行已授权的上下文更新                                              |
| 启动 Agent 菜单                 | 保留 Agent 选择、workspace 激活、创建 Tab、发送初始任务上下文                                                |
| 关联会话入口                    | 保留；用户输入独立 prompt，创建一个新子任务和一个新会话，不重复发送原任务描述                                |
| 会话预览和跳转终端              | 保留；实时卡片存在时嵌入预览，否则跳转到 workspace/终端或恢复原会话                                          |
| 会话恢复后的 Tab 重绑定         | 保留稳定 `sessionId` 与可变 `tabId` 的分离；恢复新 Tab 后更新软件会话索引                                    |
| 文件监听和任务变更广播          | 保留用于三份 Markdown 的外部变化提示和任务数据实时刷新，但软件主记录不再依赖文件监听发现                     |
| 原子文件写入                    | 保留用于 `prd.md`、`plan.md`、`records.md`，避免半写文件；不再用于任务状态 JSON                              |
| 删除保护                        | 保留归档确认、永久删除确认和路径边界检查；删除同时移除软件任务记录及项目三份 Markdown，不删除 Agent 原始日志 |
| session-bound Agent CLI/RPC     | 保留 `current`、更新子任务、更新步骤、报告当前工作等能力；删除旧的会话移交、批次报告和兼容参数               |

### 9.2 需要重新定义后再实现

| `kanban1` 能力                            | 新规则                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocalTaskSessionTurn` 最近 30 轮问答缓存 | 不再复制为任务摘要；任务详情直接复用原生 transcript，必要时只保留最近用户请求作为展示缓存                                                   |
| `report-completed` / `request-review`     | 不再驱动一套独立父任务状态；会话停止、异常和用户处理由原会话状态加任务聚合规则决定。Agent 可追加 `records.md`，但不能用自由文本覆盖任务事实 |
| `latestOutput`                            | 删除；完整输出来自原会话记录                                                                                                                |
| `reviewKind` / `reviewQuestion`           | 删除；用户问题保留在原会话中，任务只显示该会话需要查看                                                                                      |
| 子任务会话归属                            | 保留一对一关系，但取消跨会话强制移交和 `force` 规则；要由另一个会话处理就创建另一个子任务                                                   |
| 标签和任务状态                            | 保留用户可见能力，但状态由任务聚合规则计算，不能由任意 Agent 输出直接写回                                                                   |
| 任务报告按钮                              | 不作为独立“报告会话”模型；如果用户要现状讲解，直接新建一个有明确标题的子任务和关联会话                                                      |

### 9.3 第一版暂不带入

| `kanban1` 能力                                                   | 暂不带入原因                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 批量执行当前所有任务、`LocalTaskRun`、执行批次                   | 会话启动和运行事实应先稳定；旧实现实际同时启动候选，且与“同 workspace 串行”约定不一致              |
| `open_local_tasks` 定时自动化                                    | 依赖 renderer 派发，容易把旧批次和自动化状态重新带入；核心任务闭环稳定后再设计                     |
| Kanban Advisor AI 记录流                                         | 它是另一套项目 JSON 记录、系列去重和已读模型；第一版先让用户读完整会话，不把分析文章和任务状态混合 |
| 旧 `assistant/results` 扫描和 AI 记录 Tab                        | 暂不删除原 Orca 其他能力，但不作为新任务模型的必需入口                                             |
| 旧 `associationSource` 分类                                      | 新模型只需会话用途标题和一对一子任务关联；自动化、澄清、任务报告等来源分类不再创建特殊会话种类     |
| workspace 所有权转移、影子 `task.json`、按 worktree 复制任务目录 | 软件主记录已脱离 worktree；Git 合入只带三份 Markdown                                               |
| 旧格式严格兼容、历史字段默认值和迁移读取                         | 项目开发阶段不需要旧任务兼容；新 Store 只读新格式                                                  |

### 9.4 仍需保留的非任务基础设施

以下不是任务系统功能，但 `kanban1` 为任务启动修正过的 Orca 基础设施可能仍有价值，实施时需要逐项回归，而不是按文件名删除：

- Agent 启动完成后再发送 prompt，避免 Tab 尚未 ready 时丢失首条任务请求。
- Agent 启动或关联写入失败时关闭刚创建的 Tab，避免出现无任务归属的孤儿会话。
- 当前终端标签 ID 与 Agent 稳定会话 ID 分离，恢复后更新映射。
- 终端预览订阅隔离，多个详情入口查看同一 PTY 时互不取消。
- workspace 激活、repo 激活、执行主机和 Terminal leaf 的精确跳转。
- 远程执行的失联语义遵循 `live` / `unverifiable` / `exited`，客户端不能把断连当作远程进程已退出。

## 10. 实施前最终删减清单

开始 `kanban2` 编码前，应从新实现中排除这些旧概念：

```text
task.json / plan.json
LocalTaskRun / batchId / executionState
latestOutput / session turns summary
reviewKind / reviewQuestion
associationSource 特殊会话类型
subtask-transfer / force ownership
旧任务格式兼容和迁移
Kanban Advisor 记录作为任务状态
```

保留的最小主链路是：

```text
软件任务记录
  → 任务 / 子任务 / 步骤 / 会话索引
  → Orca 原生 Agent Session 与 Terminal
  → 任务状态聚合和待审阅提醒
  → 项目 prd.md / plan.md / records.md 上下文
```
