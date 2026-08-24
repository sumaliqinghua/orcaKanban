# 本地任务中心施工计划

本计划以 `PRD.md` v1.3 为准。当前产品名是“任务中心”，核心实体是 `LocalTask`（本地任务）、会话、子任务和 AI 执行步骤。每项都写明执行步骤和验收标准；`[x]` 已完成，`[~]` 进行中，`[ ]` 未开始。

## 依赖关系

```text
领域类型 → 项目任务文件 Store → IPC/preload → 真实任务页面
                                      ↓
                         状态流转/会话关联/验收
                                      ↓
                         Orca workspace/session 跳转
```

## 阶段 1：领域模型

- [x] 1.1 定义 `LocalTask`
  - **执行步骤**：定义任务 ID、`projectId`、标题、描述、五个状态、单一 workspace、归档时间、标题来源和首次 AI 标题建议。
  - **验收标准**：类型中没有 priority；状态只有 `Open`、`In progress`、`Waiting`、`Needs review`、`Done`。
- [x] 1.2 定义会话关联
  - **执行步骤**：为会话保存 task ID、session ID、workspace ID、标题、运行状态、最后输出和关联来源；支持一个任务多个会话、一个 session ID 只能归属一个任务。
  - **验收标准**：从任务中心创建的会话能关联任务；重复关联幂等；跨任务复用同一 session ID 被拒绝。
- [x] 1.3 定义子任务和 AI 执行步骤
  - **执行步骤**：定义子任务状态和步骤状态；用户只操作子任务完成/重新打开，可编辑 todo 步骤标题；AI 更新步骤状态。
  - **验收标准**：子任务可完成；步骤支持 todo/doing/done/canceled；用户编辑不会改变步骤状态，步骤归属目标子任务。
- [x] 1.4 收敛会话内问题规则
  - **执行步骤**：将追问、文档请求和问题修正视为会话内沟通；需要持续汇报时由 AI 创建子任务；新交付目标由用户从任务中心新建本地任务。
  - **验收标准**：不引入独立 issue 顶层表，不自动从追问创建新任务。
- [x] 1.5 固化标题和描述规则
  - **执行步骤**：创建时无自定义标题则取描述第一行；首次 AI 完成可生成一次标题并记录 `ai-suggestion`；用户编辑后来源为 `user`，后续 AI 只能更新描述。
  - **验收标准**：标题不会被后续 AI 报告覆盖；描述更新不改变标题。

## 阶段 2：项目任务文件

- [x] 2.1 创建任务目录和文件格式
  - **执行步骤**：在项目根目录创建 `orca/<task-id>/task.json`、`plan.json`、`prd.md`、`records.md`；任务状态全部写入 `task.json`。
  - **验收标准**：新任务文件可被 Git 追踪，其他 AI 不依赖 Orca 数据库即可读取。
- [x] 2.2 实现原子读写和文件监听
  - **执行步骤**：使用临时文件 + rename 原子写 JSON；任务中心扫描当前项目 `orca/`；监听外部修改并广播完整任务快照。
  - **验收标准**：重启或新 Store 实例可从项目文件恢复；手动编辑不会被覆盖。
- [x] 2.3 移除测试数据库实现
  - **执行步骤**：删除 SQLite schema、投影、迁移和步骤数据库辅助模块；不迁移现有测试数据库。
  - **验收标准**：运行时不创建或读取 `local-tasks.db`。
- [x] 2.4 实现文件版 `LocalTaskStore`
  - **执行步骤**：实现 create/list/get/update/archive/restore/accept、createSession、createSubtask、updateSubtask、AI updateStep/reportCompleted。
  - **验收标准**：状态和归属边界在 Store 层拒绝；Waiting 必须有原因；Done 只能通过 accept。

## 阶段 3：主进程 IPC 与 preload

- [x] 3.1 建立 renderer 可用 API
  - **执行步骤**：暴露 list/get/create/update/createSession/createSubtask/updateSubtask/accept/archive/restore；AI 专用步骤和完成报告不放进 preload API。
  - **验收标准**：renderer 只能通过 `window.api.localTasks` 访问任务，不直接操作项目文件。
- [x] 3.2 增加运行时参数校验
  - **执行步骤**：用 zod 检查 ID、文本长度、枚举值、数组长度和未知字段；再调用 Store 做实体归属校验。
  - **验收标准**：非法 payload 返回可读错误，不因异常参数让主进程崩溃。
- [x] 3.3 发布任务变更通知
  - **执行步骤**：写操作后向所有未销毁窗口发送完整任务快照；页面按 task ID upsert。
  - **验收标准**：多窗口不会重复插入，刷新后从项目任务文件恢复。

## 阶段 4：任务中心真实 UI

- [x] 4.1 从 Store 查询替换 mock 数据
  - **执行步骤**：页面接入 loading/error/empty 状态、项目目录扫描和变更订阅；创建表单写入任务文件。
  - **验收标准**：刷新或重启后任务不丢失；空状态仍可打开创建弹窗。
- [x] 4.2 实现子任务视角
  - **执行步骤**：默认将每个子任务拆成独立卡片/列表行，显示所属本地任务、来源会话和 AI 步骤数量。
  - **验收标准**：同一任务的多个子任务可出现在不同状态列；无子任务时显示明确空状态。
- [x] 4.3 实现本地任务视角
  - **执行步骤**：每个任务显示一张汇总卡片；状态使用任务级 Waiting/Needs review/Done，普通状态参考最新子任务。
  - **验收标准**：切换视角不写数据，两种视角状态解释一致。
- [x] 4.4 实现列表展开与快速创建
  - **执行步骤**：列表任务行支持展开子任务和 AI 步骤；标题行加号和右上角按钮都能连续创建任务。
  - **验收标准**：连续创建多个任务不离开列表；任务创建时可从所选项目 workspace 下拉选择已有 workspace，或选择“新建 workspace”进入第二步；已有 workspace 路径不会创建新 worktree。
- [x] 4.5 实现详情抽屉
  - **执行步骤**：展示标题、描述、状态、workspace、子任务、AI 步骤、关联会话和最近一次输出；todo 步骤可编辑文字但状态只读；支持收起/展开。
  - **验收标准**：不显示 priority、验收证据面板、活动时间线；会话/workspace 操作有明确入口。
- [x] 4.6 实现标题编辑与任务操作
  - **执行步骤**：标题通过用户编辑按钮更新；提供开始执行、Waiting/继续、要求修改、验收通过、归档；AI 标题只在首次完成时生成。
  - **验收标准**：用户标题编辑优先；归档从默认视图隐藏且可恢复。

## 阶段 5：状态和会话生命周期

- [x] 5.1 创建与执行启动
  - **执行步骤**：创建为 Open；任务模式直接绑定所选项目现有 workspace，不调用工作树创建；没有 workspace 时使用 `local + 当前 HEAD`；详情在会话数为 0 时显示“启动任务”，复用现有 Agent 菜单创建真实 tab 并写入会话，已有会话时显示“从任务中心新建关联会话”。
  - **验收标准**：创建任务不会出现 Fetching base branch 或新 branch；选择 Agent 后生成真实 tab ID 关联；不会复用旧 workspace 的 session，也不会创建无法跳转的合成 session；一个任务可以有多个会话。
- [x] 5.2 Waiting
  - **执行步骤**：用户或 AI 写入等待原因；继续时清理原因并恢复 In progress。
  - **验收标准**：没有等待原因不能进入 Waiting，Waiting 原因在详情可见。
- [x] 5.3 AI 完成到 Needs review
  - **执行步骤**：AI 报告最后输出、描述和标题建议；检查全部子任务和步骤完成/取消后设置 Needs review。
  - **验收标准**：未完成步骤保持 In progress；AI 不能设置 Done。
- [x] 5.4 用户验收到 Done
  - **执行步骤**：只有任务处于 Needs review 时允许 accept；要求修改回到 In progress 并继续原任务。
  - **验收标准**：Done 只能由用户验收产生；Done 任务仍可继续追问而不自动改状态。
- [x] 5.5 跳转现有 Orca surface
  - **执行步骤**：任务详情的 workspace 按钮调用现有 workspace 激活流程；真实 session ID 可聚焦终端 tab；合成的本地 session 显示未连接提示。
  - **验收标准**：可用 workspace/session 能离开任务中心并定位目标；不可用目标有可读错误。
- [x] 5.6 接入 session-bound Agent task bridge
  - **执行步骤**：为任务 Agent 注入 `ORCA_LOCAL_TASK_ID`；通过 `orca local-task` CLI 调用 runtime RPC；在主进程复用 `LocalTaskStore` 完成 current、描述、子任务、步骤和完成报告；校验当前 session/workspace 归属并广播变更。
  - **验收标准**：从任务中心启动的 Agent 能读取当前任务、创建子任务、更新 AI 步骤和报告完成；跨任务、跨 workspace 或已开始步骤标题修改被拒绝；首次调用可幂等登记真实 tab。
- [x] 5.7 关联会话使用用户本轮请求
  - **执行步骤**：已有会话时打开输入对话框，用户填写本轮独立请求后再选择 Agent；以该请求作为新会话 prompt 和会话标题；仅注入一次简短任务上下文和渐进式 CLI 帮助。
  - **验收标准**：新会话不重复发送原任务描述；空请求不能启动；用户输入可以是方案咨询、代码 review 或修正要求。
- [x] 5.8 兼容外部 AI 任务文件
  - **执行步骤**：读取时将 `Completed` 映射到 `Needs review`，归一化旧会话状态和字符串 latest output；任务 JSON 没有子任务时读取同目录 `plan.json` 的子任务和步骤。
  - **验收标准**：外部 AI 修改后的任务文件不会让任务中心崩溃；状态可继续验收；不覆盖原始文件。
- [x] 5.9 修复真实会话关联参数
  - **执行步骤**：允许 renderer 将任务项目路径传入 `createSession` IPC；补充 schema 回归测试；恢复本次误写归档时间的运行中任务。
  - **验收标准**：Agent 终端可继续运行时，任务中心能完成真实 tab 与任务文件的会话关联，任务不会因参数校验错误消失。
- [x] 5.10 修正任务视角与详情默认行为
  - **执行步骤**：任务视角按最新子任务推导状态；归档变更事件即时移除卡片；进入任务中心默认不打开详情；步骤文字提高字号且不对完成步骤划线；Agent 完成提示要求保存完整最终交付文本。
  - **验收标准**：最新子任务完成时任务视角显示 `Needs review`；归档后无需切页即可消失；详情需点击卡片才打开；步骤保留勾选图标但不划线。
- [x] 5.11 自动记录 Agent 最后一条完整输出
  - **执行步骤**：在 Agent 状态进入 `done` 时读取 `lastAssistantMessage`，通过任务文件 Store 更新对应会话和任务的最近输出；标记为 `agent-status`，避免后续简短 report 摘要覆盖完整回复。
  - **验收标准**：任务详情显示会话最后一条 assistant 回复；Agent 不调用任务 CLI 时也能记录；同轮 report 摘要不会覆盖自动记录的完整输出。
- [x] 5.12 任务标签与会话结束状态
  - **执行步骤**：任务文件增加标签字段；详情支持编辑；看板/列表共用标签筛选；Agent done 事件即使没有输出文本也结束关联会话。
  - **验收标准**：标签可持久化、快速筛选；结束 Agent 后运行中计数归零，任务按钮显示继续执行而不是开始执行。

## 阶段 6：测试与交付

- [x] 6.1 Store 和迁移测试
  - **执行步骤**：覆盖创建、标题、workspace 多任务、会话唯一性、子任务、AI 步骤、Waiting、Needs review、Done、归档恢复和旧库迁移。
  - **验收标准**：`src/main/local-tasks/store.test.ts` 定向测试全部通过。
- [x] 6.2 IPC 校验测试
  - **执行步骤**：覆盖必填字段、未知字段、长度和步骤枚举；Store 继续负责生命周期校验。
  - **验收标准**：`local-task-ipc-validation.test.ts` 全部通过。
- [x] 6.3 lint、构建和文档
  - **执行步骤**：运行定向 oxlint、web/node 类型检查、Electron 构建和 diff 检查；更新 PRD、PROJECT_STATUS、Records、ASSUMPTIONS。
  - **验收标准**：本次改动无 lint/build 错误；仓库既有类型错误单独记录，不冒充本地任务错误。
- [x] 6.4 Agent bridge 回归测试
  - **执行步骤**：覆盖 current 会话登记、子任务/步骤更新、完成到 Needs review、跨 workspace 拒绝和已开始步骤编辑拒绝；验证 CLI handler/spec 注册一致。
  - **验收标准**：`src/main/runtime/rpc/methods/local-tasks.test.ts` 和相关 CLI/Store 测试全部通过。

## 后置，不阻塞本期交付

- [ ] 文件级写入锁和租约；
- [ ] 从 workspace/Agent Dashboard 反向打开本地任务；
- [ ] 将会话创建真正接入各 agent provider 的启动器；
- [ ] provider hook 自动汇报（任务提示和 CLI bridge 已完成，自动从 provider 事件推断步骤仍后置）；
- [ ] 跨项目任务索引、远程同步、外部工单双向状态和正式依赖图。

## 当前进度

核心本地任务中心已完成：项目任务文件、双视角任务面板、会话/子任务/步骤生命周期、验收归档、当前 workspace 和可用 session 跳转入口、运行时校验及测试均已实现。后置列表是明确不纳入本期的能力，不影响本地任务面板可用。
