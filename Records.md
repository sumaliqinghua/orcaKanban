# 实现记录

## [2026-08-22] 事项中心低保真原型

- **What（做了什么）**：
  - `src/shared/ui-chrome-types.ts`：新增 `work-items` 顶层视图值，代表独立的事项中心页面。
  - `src/shared/top-level-view.ts`：把 `work-items` 加入顶层视图校验白名单。
  - `src/renderer/src/store/slices/ui.ts`：新增事项中心打开、关闭和返回来源状态，支持从侧边栏进入独立页面。
  - `src/renderer/src/lib/right-sidebar-visibility.ts`：事项中心按全页视图处理，不显示 workspace 右侧栏。
  - `src/renderer/src/app-shell/AppWorkspaceShell.tsx`：挂载新的 `WorkItemsPrototypePage` 页面 chunk。
  - `src/renderer/src/components/sidebar/SidebarNav.tsx`：新增“事项中心”导航入口和 mock 事项数量徽标；原有“Tasks”入口仍保留，用于外部工单。
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`：新增 mock 事项中心页面，包含：
    - Linear 风格看板和列表双视图；
    - `Open`、`In progress`、`Waiting`、`Needs review`、`Done` 五个状态列；
    - “研发事项 / 外部工单”标签切换；
    - 搜索、项目筛选占位、归档筛选入口；
    - 事项卡片的优先级、步骤数量、会话数量、运行中会话和 workspace 摘要；
    - 事项详情抽屉，展示描述、执行步骤、关联会话、单一 workspace、diff/commit/测试证据、最近总结和活动时间线；
    - 执行步骤勾选、Waiting/继续、验收通过、要求修改和新建事项弹窗等 mock 交互。
- **Why（为什么这么做）**：
  - 先以独立页面验证“研发事项是否比 workspace 更适合作为第一公民”，避免接入真实 Tasks 数据后难以区分问题来自产品结构还是数据源。
  - 采用看板 + 列表而不是多维表格，重点展示多个 AI 目标的状态、步骤、会话和验收证据。
  - 详情面板固定在右侧，模拟用户从全局事项管理进入当前事项验收的主要路径。
- **How（怎么实现的）**：
  - 侧边栏点击 → `openWorkItemsPage()` → `activeView = 'work-items'` → `AppWorkspaceShell` 挂载 mock 页面。
  - 页面 mock 数据 → 状态列/列表 → 选择事项 → 详情抽屉 → 步骤、Waiting、验收和要求修改在内存中更新。
  - 页面没有调用真实 IPC、数据库、workspace 创建或 agent 会话接口。
- **用户须知**：
  - 这是独立于现有外部 Tasks 页的原型入口；“Tasks”仍表示外部工单浏览。
  - 所有数据均为 mock，刷新页面后恢复初始状态，不会创建真实事项或修改 workspace。
- **已知限制**：
  - 页面当前固定显示详情抽屉，尚未实现关闭详情或响应式窄屏布局。
  - `新建事项` 表单只展示交互，不会把输入写入列表。
  - 事项、步骤和会话没有真实持久化。
  - Electron CDP 9359 被另一份开发实例占用，因此本轮未完成自动截图验证。
- **关联假设**：`ASSUMPTIONS.md` 中“原型先作为独立顶层视图”“原型使用固定 mock 数据”“当前 workspace 只展示一个”。

## [2026-08-22] 原型评审后的信息收敛

- **What（做了什么）**：
  - `mock-data.ts`：移除优先级、测试/commit/diff 字段和会话归属字段；执行步骤改为事项级列表，并增加执行分组和最近会话最后输出。
  - `work-item-pieces.tsx`：步骤状态改为只读展示；只有未开始步骤显示“编辑”，不再允许用户点击完成；移除验收证据、活动时间线和独立总结区；会话区标注“仅从事项中心关联”。
  - `WorkItemsPrototypePage.tsx`：列表移除优先级列；步骤编辑改为编辑未开始步骤标题；事项详情通过 workspace 入口查看真实对话。
  - `PRD.md`：新增 v0.3，明确事项级步骤、执行轮次、显式会话关联和 workspace 验收入口。
- **Why（为什么这么做）**：
  - 优先级和独立验收证据不是当前个人使用的核心信息，增加了看板噪声。
  - 执行步骤是 AI 计划的只读投影，用户勾选会破坏状态真相；用户只需要调整未执行计划。
  - 不同会话的步骤仍属于同一研发事项，使用执行分组保留初始实现、文档整理、问题修正等上下文，不引入复杂子任务树。
  - workspace 是验收真实上下文的入口，详情页不再复制一套 diff/测试证据面板。
- **How（怎么实现的）**：A 会话创建事项级步骤 → B 会话从事项中心显式关联 → B 新增或调整事项级步骤并标记新的执行分组 → 事项继续统一展示步骤流 → 用户打开 workspace 查看对话和代码。
- **用户须知**：步骤完成圆点只读；未开始步骤的“编辑”是唯一可编辑步骤操作；从 workspace 直接创建的会话默认不进入事项关联列表；详情抽屉可收起，收起后看板恢复完整宽度。
- **已知限制**：mock 使用浏览器 `prompt` 编辑步骤；“打开 workspace”目前只是原型按钮，不会真的切换 workspace。

## [2026-08-22] 增加跟进项与列表展开步骤

- **What（做了什么）**：
  - `mock-data.ts`：新增 `FollowUp` 数据，执行步骤通过 `followUpId` 归属于跟进项；示例覆盖初始实现、文档整理和问题修正。
  - `work-item-pieces.tsx`：详情中的执行步骤按跟进项分组展示，每组显示跟进项状态和关联会话；跟进项可发起“提升为新事项”。
  - `work-item-views.tsx`：新增列表视图组件；列表行支持展开，直接查看事项下各跟进项及其执行步骤。
  - `WorkItemsPrototypePage.tsx`：接入列表展开状态和“提升为新研发事项”确认弹窗。
  - `PRD.md`：新增 v0.4，定义 `WorkItemThread` 跟进项以及从跟进项创建新研发事项的用户确认流程。
- **Why（为什么这么做）**：
  - 追问、文档请求、问题修正本质上是当前研发事项内的跟进，不应直接污染全局事项列表，也不应和外部 issue 同名。
  - 执行步骤按跟进项归组，既能看到不同会话产生的工作，又保持所有步骤属于同一个研发事项。
  - 列表展开让用户无需打开详情抽屉就能检查事项的当前执行计划。
- **How（怎么实现的）**：事项 → 跟进项 → 显式关联会话 → AI 执行步骤；AI 只能建议提升，用户确认后才创建新的研发事项。
- **用户须知**：跟进项不是新的顶层事项；“提升为新事项”会保留原事项历史，并把当前会话摘要作为新事项上下文。

## [2026-08-23] 统一为本地任务与会话子任务

- **What（做了什么）**：
  - `mock-data.ts`：将 mock 模型改为 `LocalTask` 语义：本地任务包含多个会话子任务，每个子任务拥有 AI 只读执行步骤；任务 workspace 固定为 `local + HEAD` 或具体 local 分支示例。
  - `work-item-pieces.tsx`：任务卡片突出“最新子任务”；详情页允许用户完成/取消完成子任务，执行步骤只显示 AI 处理中、AI 已完成、AI 已取消或待执行，不提供用户勾选或编辑步骤操作；会话按钮可跳转查看会话。
  - `work-item-views.tsx`：列表展开显示本地任务下的会话子任务和 AI 执行步骤。
  - `WorkItemsPrototypePage.tsx`：创建弹窗改为本地任务命名，说明创建时绑定 workspace，未选时使用 `local + 当前 HEAD`；移除“提升为新事项”流程。
  - `PRD.md`：新增 v0.5，定义本地任务、会话子任务、AI 执行步骤、任务创建上下文和标题生成规则。
- **Why（为什么这么做）**：
  - 面板的汇报单位应是会话产出的最新子任务，而不是抽象的跟进项或执行分组。
  - 用户可以判断和完成子任务，但 AI 生成的执行步骤必须保持只读，避免人为伪造 AI 进度。
  - 新目标直接从看板或右上角新建本地任务，原会话继续原任务，不再提供容易混淆的自动提升入口。
- **How（怎么实现的）**：本地任务 → 关联会话 → 会话创建子任务 → AI 维护子任务执行步骤 → 面板汇报最新子任务 → 点击子任务展开详情或跳转会话。
- **用户须知**：创建本地任务时确定 workspace 上下文；未选择时默认为 `local + 当前 HEAD`。未执行前标题取输入第一行；首次执行后 AI 生成一次标题建议，之后 AI 只更新描述，标题由用户编辑。

## [2026-08-23] 增加子任务/本地任务双视角与快速创建

- **What（做了什么）**：
  - `mock-data.ts`：补充任务状态汇总函数；本地任务的汇总状态在任务视角中依据最新子任务状态展示。
  - `work-item-pieces.tsx`：新增子任务卡片，显示子任务状态、所属本地任务、来源会话和 AI 执行步骤数量。
  - `work-item-views.tsx`：新增“子任务视角”看板和列表；子任务视角每个子任务独立进入状态列，任务视角每个本地任务显示一张汇总卡片。
  - `WorkItemsPrototypePage.tsx`：增加视角切换控件，默认子任务视角；列表标题行保留快速加号；新建任务后切换到 `In progress` 会在 mock 中自动创建“自动创建会话”。
- **Why（为什么这么做）**：
  - 子任务是会话实际汇报的进度单位，默认展示它能让用户看到 AI 当前到底在做什么。
  - 任务视角适合快速观察整体目标，状态取最新子任务，避免两套看板互相矛盾。
  - 快速加号适合连续记录多个本地任务，创建和执行解耦；真正进入 In progress 时才自动建立会话。
- **How（怎么实现的）**：本地任务 → 子任务视角平铺 → 点击子任务回到本地任务详情 → 用户完成子任务 / AI 更新执行步骤；任务视角 → 按最新子任务计算任务状态；新建任务 → Open → In progress → mock 自动会话。
- **用户须知**：当前自动会话和任务数据仅存在内存，用于验证流程；没有连接真实 agent。

## [2026-08-23] 完成本地任务真实链路与生命周期

- **What（做了什么）**：
  - `src/shared/local-task-types.ts`：将当前领域契约固定为 `LocalTask`、`LocalTaskSession`、子任务和 AI 执行步骤；增加 session 关联来源、AI 首次标题建议、描述更新、验收和归档参数；不暴露 priority、Canceled 或独立 issue 顶层实体。
  - `src/main/local-tasks/store-schema.ts`：创建 `local_tasks`、`local_task_sessions`、`local_task_subtasks`、`local_task_steps` 和 schema version 表；增加 `title_suggestion`、`association_source` 旧库迁移；开启外键约束。
  - `src/main/local-tasks/store.ts`、`store-read.ts`、`store-projection.ts`：实现用户数据目录 `local-tasks.db` 的任务 CRUD、会话唯一关联、子任务/步骤读写、Waiting 原因校验、AI 完成到 Needs review、首次 AI 标题生成、用户验收 Done、归档恢复和最新输出投影。
  - `src/main/ipc/local-tasks.ts`、`local-task-ipc-validation.ts`：为 renderer API 增加运行时 zod 校验；所有任务写入在主进程完成；AI 步骤/完成报告保持主进程 handler，不从 preload 暴露。
  - `src/preload/api/local-task-api.ts`、`src/preload/index.ts`：暴露 list/get/create/update/createSession/createSubtask/updateSubtask/accept/archive/restore 和变更订阅。
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`、`LocalTaskCreateDialog.tsx`、`local-task-view-model.ts`：页面从真实 IPC 查询任务，支持 loading/error/empty、当前 Project/workspace 上下文、快速创建、标题编辑、双视角、列表展开、状态操作和变更 upsert；创建表单正确区分标题和描述。
  - `LocalTaskDetailPanel.tsx`、`LocalTaskDetailAside.tsx`、`LocalTaskCenterHeader.tsx`、`local-task-center-actions.ts`：拆分详情、页面头部和任务操作职责；详情展示最近一次会话输出、只读 AI 步骤、关联会话和 workspace 跳转；真实 workspace/tab ID 可调用现有 Orca 激活流程。
  - `src/main/local-tasks/store.test.ts`：覆盖创建、标题、workspace 多任务、会话唯一性、子任务、AI 步骤、Waiting、Needs review、Done、归档恢复和旧库迁移。
  - `src/main/ipc/local-task-ipc-validation.test.ts`：覆盖 IPC 必填字段、未知字段、长度和步骤状态校验。
  - `PRD.md`、`plan.md`、`PROJECT_STATUS.md`：统一当前产品名、数据归属、状态规则、后置能力和施工进度。
- **Why（为什么这么做）**：
  - 用户的核心痛点是多个 workspace/会话并行时缺少任务第一公民，因此任务状态必须独立于 workspace 状态持久化。
  - AI 步骤和 Done 状态分别由 AI 与用户控制，避免 renderer 直接伪造验收结果；Waiting 需要原因，保证状态可解释。
  - 标题只在首次 AI 完成时生成一次，用户编辑后进入 `user` 来源，避免后续会话静默覆盖用户命名；描述承担后续现状更新。
  - 使用独立 `local-tasks.db` 而不是仓库 `.orca/`，避免多 worktree、无 Git 文件夹和 workspace 删除造成状态分叉。
- **How（怎么实现的）**：
  - 创建：任务中心表单 → `localTasks:create` → zod 校验 → `LocalTaskStore.create` → SQLite → 变更广播 → 页面 upsert。
  - 执行：用户设置 In progress → Store 创建关联 session → AI 通过主进程创建子任务和步骤 → AI `reportCompleted` 检查步骤 → Needs review → 用户 `accept` → Done。
  - 验收：任务详情 → 打开 workspace 查看真实对话/diff/test；真实 session ID → 现有 terminal tab 激活；合成 `lts_*` ID 明确提示尚未连接终端。
- **用户须知**：
  - 当前任务数据真实保存，不再是 mock；任务创建时会绑定当前 workspace，没有可用 workspace 时使用 `local + 当前 HEAD`。
  - 任务中心 renderer API 不含 AI 步骤更新和完成报告；后续 agent bridge 必须在主进程调用 Store 并复用同一生命周期规则。
  - 归档是隐藏操作而不是状态；Waiting、Needs review、Done 是正式状态。
- **已知限制**：真实 provider session 启动、AI context 注入、workspace/Agent Dashboard 反向任务入口、文件锁和远程同步仍是后置项。
- **关联假设**：`ASSUMPTIONS.md` 中“本地数据库为状态真相”“文件锁后置”“任务创建绑定当前 workspace”。

## [2026-08-23] 复用工作树创建器与真实 Agent 启动

- **What（做了什么）**：
  - `NewWorkspaceComposerModal.tsx`：增加任务创建模式；复用原有项目和运行环境选择器，增加可选任务标题和必填任务描述；任务模式直接绑定所选项目已有主 workspace，不调用工作树创建；普通工作树模式保持原行为。
  - `LocalTaskAgentPicker.tsx`、`QuickLaunchButton.tsx`：任务详情复用现有 Agent 菜单；选择 Agent 后调用 `launchAgentInNewTab`，不再生成无法跳转的 `lts_*` 合成会话。
  - `local-task-center-actions.ts`：真实 tab 创建后写入任务会话关联并返回终端；移除“自动创建会话”的假记录。
  - `WorkItemsPrototypePage.tsx`、`LocalTaskCenterHeader.tsx`：新建任务改为打开工作树创建器；Workspace 看板按钮发送现有切换事件并关闭任务中心；移除无响应的归档占位按钮。
  - `LocalTaskDetailAside.tsx`：扩大收起/展开按钮热区并固定 `size-9`，避免只有图标局部可点击。
  - `work-item-views.tsx`、`work-item-pieces.tsx`：列表整行可点击，保留展开按钮独立操作；看板和列表不再显示内部任务 ID，只展示任务/子任务标题。
  - 删除 `LocalTaskCreateDialog.tsx`，不再使用旧的独立本地任务弹窗。
- **Why（为什么这么做）**：
  - Agent 选择、workspace 创建和终端启动已有成熟流程，任务中心只需要提供任务上下文并记录真实 tab，而不是复制一套不完整的启动器。
  - 任务创建必须选择项目和已有 workspace，复用工作树窗口的选择界面但不复用其创建提交动作，避免任务先创建、环境后补齐造成的上下文分叉。
  - 合成 session 没有真实终端可跳转，属于用户明确反馈的死路，因此改为只有真实 tab 启动后才写会话关联。
- **How（怎么实现的）**：
  - 任务中心“新建” → `openModal('new-workspace-composer', { localTaskMode: true })` → 选择项目/workspace/Agent → 创建工作树 → `localTasks.create` → 若存在 Agent tab 则 `localTasks.createSession(sessionId=tabId)`。
  - 详情“启动任务” → Agent 菜单 → `launchAgentInNewTab` → tab ID → `localTasks.createSession` → 关闭任务中心回到终端。
- **用户须知**：任务描述是创建任务模式下的必填字段；任务标题可留空，仍按后端首次输入规则处理。任务状态进入 In progress 不会伪造会话，必须从 Agent 菜单选择具体 Agent。
- **已知限制**：远程 paired runtime 可能暂时没有本地 tab ID，provider 返回真实 tab 快照后再补关联；Agent 菜单依赖当前 workspace 可用的检测结果。
- **关联假设**：`ASSUMPTIONS.md` 中“任务创建绑定当前 workspace”“文件锁后置”。

## [2026-08-23] 修复后台创建竞态与任务上下文注入

- **What（做了什么）**：
  - `worktree-creation-completion.ts`、`worktree-creation-pending-surface.ts`：为后台工作树创建增加进程内完成回调和 pending surface 拆分；回调在工作树真实创建、终端 tab 初始化后才执行。
  - `worktree-creation-flow.ts`、`useComposerState.ts`：任务模式注册后台完成回调并接收准确的 `worktreeId`、`primaryTabId`、`startupTerminalTabId`；任务模式跳过 base branch 预取和命名 base branch，直接以当前 HEAD 创建。
  - `NewWorkspaceComposerModal.tsx`：使用完成回调创建任务和真实会话，避免读取创建前的旧 active workspace/tab。
  - `LocalTaskAgentPicker.tsx`：启动 Agent 时注入任务标题、任务 ID、任务描述，以及读取/更新子任务和 AI 步骤的工作要求。
- **Why（为什么这么做）**：
  - 快速工作树创建是后台异步流程，立即执行任务回调会把旧 workspace 的 session 误关联到新任务，触发“Session is already associated with another local task”。
  - 任务模式不需要从远端命名 branch 建立基线，默认使用当前 HEAD，避免无意义的 Fetching base branch 和 `refs/heads/...` 误绑定。
- **How（怎么实现的）**：
  - 任务提交 → 后台创建工作树 → 创建并激活真实 tab → completion callback → 写入 `LocalTask.workspaceId` → 如存在启动 tab 再写入 `LocalTaskSession`。
  - 详情启动 → Agent 菜单 → `launchAgentInNewTab` → structured task prompt → tab ID → 任务会话关联。
- **已知限制**：Agent 目前收到的是结构化任务提示，完整 `localTasks.current/updateStep/reportCompleted` 工具仍需后续接入 provider tool bridge。

## [2026-08-23] 任务创建不再创建 worktree

- **What（做了什么）**：`NewWorkspaceComposerModal` 的 `localTaskMode` 现在绕过 `submitQuick` 和后台 worktree creation，使用所选项目的现有主 workspace（没有主 workspace 时再回退当前同项目 workspace 或 `local`），直接写入本地任务。
- **Why（为什么这么做）**：`Local Mac + 项目根目录` 表示执行环境/项目选择，不代表要求新建一个 `redfish` 分支。任务和 worktree 是不同实体，任务创建不应隐式产生新 worktree。
- **How（怎么实现的）**：任务描述校验 → 读取 selected repo → 选择现有主 workspace → `localTasks.create`；之后用户从任务详情的 Agent 菜单明确启动会话。
- **用户须知**：普通“创建工作树”仍会 Fetch base branch 并创建分支；任务中心“创建本地任务”不会显示 Fetching base branch，也不会产生新的 `refs/heads/<name>`。

## [2026-08-23] 增加任务 workspace 两步选择

- **What（做了什么）**：
  - `useLocalTaskComposer.ts`、`LocalTaskWorkspaceFields.tsx`：新增任务字段和 workspace 选择状态；下拉展示当前项目已有 workspace，优先当前活动 workspace，并提供“新建 workspace…”选项。
  - `NewWorkspaceComposerModal.tsx`：已有 workspace 直接创建任务；选择新建时保留任务标题/描述，切换到第二步完整工作树创建表单，创建完成后再绑定任务。
  - `NewWorkspaceComposerCard.tsx`：任务已有 workspace 模式隐藏名称/分支/Agent/高级工作树字段；普通工作树模式保持原表单。
- **Why（为什么这么做）**：`Local Mac` 是运行环境，已有本地 HEAD 和 worktree 都是可绑定 workspace，不应默认创建新 worktree；只有用户明确选择“新建 workspace”时才执行工作树创建。
- **How（怎么实现的）**：项目选择 → workspace 下拉 → 已有 workspace：`localTasks.create`；新建 workspace：保留任务草稿 → 创建工作树 → completion callback → `localTasks.create`。
- **用户须知**：本地 HEAD 是合法 workspace，不要求任务必须使用新 worktree；普通工作树创建入口与任务创建入口的行为现在明确分开。
## [2026-08-23] 接入 session-bound Agent 本地任务工具桥接
- **What（做了什么）**：
  - `src/main/runtime/rpc/methods/local-tasks.ts`：新增 `localTask.current`、`localTask.updateDescription`、`localTask.createSubtask`、`localTask.updateSubtask`、`localTask.updateStep`、`localTask.reportCompleted` 六个 runtime RPC 方法。方法从任务 Agent 的环境上下文接收任务、会话和 workspace 标识，检查任务/会话/步骤归属；首次 `current` 可幂等创建真实 tab 的任务会话；跨 workspace 操作和修改已开始步骤标题会被拒绝；写入后广播完整任务快照。
  - `src/main/runtime/rpc/methods/index.ts`：将六个方法加入统一 RPC 注册表，使本地 CLI 和运行时调用可以发现它们。
  - `src/main/local-tasks/store.ts`：增加任务描述更新入口，继续复用 SQLite Store 作为唯一状态真相。
  - `src/main/local-tasks/change-notifications.ts`、`src/main/ipc/local-tasks.ts`：抽取并复用任务变更广播，保证 renderer IPC 和 Agent RPC 使用相同刷新通道。
  - `src/cli/local-task-context.ts`、`src/cli/specs/local-tasks.ts`、`src/cli/handlers/local-tasks.ts`：新增 `orca local-task` 命令组。命令包括读取当前任务、更新描述、创建/更新子任务、更新 AI 步骤和报告完成；任务 ID 不接受命令行参数，只从 `ORCA_LOCAL_TASK_ID`、`ORCA_TAB_ID`/`ORCA_PANE_KEY`、`ORCA_WORKTREE_ID` 读取。
  - `src/cli/args.ts`、`src/cli/specs/index.ts`、`src/cli/handler-group-manifest.ts`：注册命令、重复 `--step` 参数和命令组路由；补齐 `--title-suggestion` 规格。
  - `src/renderer/src/lib/launch-agent-in-new-tab.ts`、`QuickLaunchButton.tsx`、`LocalTaskAgentPicker.tsx`：从任务中心启动 Agent 时注入任务 ID，并在启动提示中给出实际 CLI 命令、状态取值及文档边界。任务提示明确要求完成后报告输出，但不自动创建 `PRD.md`、`plan.md`、`PROJECT_STATUS.md`、`Records.md` 或 `task.json`。
  - `src/relay/remote-cli-env.ts`、`src/main/pty/wsl-orca-env.ts`：将任务 ID 透传到 SSH/WSL 终端环境，避免跨执行宿主后 CLI 丢失任务上下文。
  - `src/main/runtime/rpc/methods/local-tasks.test.ts`：新增 RPC 回归测试，覆盖会话惰性登记、子任务/步骤更新、完成进入 Needs review、跨 workspace 拒绝和已开始步骤标题修改拒绝。
- **Why（为什么这么做）**：
  - 原先 Agent 只收到自然语言要求，没有可执行的任务 API，因此真实任务会一直停在 `In progress`，数据库中也没有子任务、步骤和最后输出。
  - 把写入集中到 runtime RPC → `LocalTaskStore`，既复用已有状态流转和 SQLite 事务边界，也避免 renderer 直接伪造 AI 进度或 Done 状态。
  - 任务上下文从当前终端环境读取，调用方不能通过 `--task-id` 任意改写别的任务；首次调用允许幂等登记是为了覆盖“Agent 已经执行第一条命令但 renderer 回调尚未写会话”的启动竞态。
- **How（怎么实现的）**：
  - 启动链路：任务详情 → Agent 菜单 → `launchAgentInNewTab` → 注入 `ORCA_LOCAL_TASK_ID` → Agent 执行 `orca local-task current`。
  - 更新链路：CLI handler → `RuntimeClient.call` → runtime RPC schema/归属校验 → `LocalTaskStore` → `localTasks:changed` 广播 → 任务中心 upsert。
  - 完成链路：Agent 更新步骤 → `report-completed` → Store 检查所有步骤为 `done/canceled` → 全部完成则 `Needs review`，否则保持 `In progress`；`Done` 仍只能由用户验收。
- **用户须知**：
  - 只有从任务中心启动的 Agent 自动拥有任务上下文；从 workspace 直接新建的会话不会自动归属本地任务。
  - `current`、`update-description`、`subtask-create`、`subtask-update`、`step-update`、`report-completed` 是 Agent 可执行命令；步骤状态可用 `todo`、`doing`、`done`、`canceled`，子任务状态可用 `todo`、`doing`、`done`。
  - 任务数据库仍位于 Orca 用户数据目录的 `local-tasks.db`；项目文档只有在用户明确要求时才由 Agent 维护。
- **已知限制**：provider hook 目前不会自动从每条模型输出推断步骤，Agent 需要按提示主动调用 CLI；文件锁、provider 自动汇报和 `.orca/tasks/` 镜像仍是后置能力。
- **关联假设**：`ASSUMPTIONS.md` 的“本地数据库作为任务状态真相”“文件锁后置”“Agent 通过当前会话绑定任务工具”。
## [2026-08-23] 将本地任务真相迁移到项目文件
- **What（做了什么）**：
  - `src/main/local-tasks/file-store-format.ts`：新增任务文件格式和原子写入工具，任务目录固定为项目根目录 `orca/<task-id>/`，包含 `task.json`、`plan.json`、`prd.md`、`records.md`。
  - `src/main/local-tasks/store.ts`：将 `LocalTaskStore` 从 SQLite 改为项目文件 Store；任务、会话、子任务、步骤、状态和最新输出全部写入 `task.json`；完成报告追加到 `records.md`；读取时重新扫描项目文件；监听外部文件变化并广播任务快照。
  - 删除 `store-schema.ts`、`store-read.ts`、`store-projection.ts`、`store-step-mutations.ts`：不再创建、读取或迁移 `local-tasks.db`，旧测试数据按用户要求不保留。
  - `src/shared/local-task-types.ts`、preload/IPC 校验：增加 `projectPath`，让任务文件位置成为任务创建和 Agent 上下文的一部分。
  - `useLocalTaskComposer.ts`、`WorkItemsPrototypePage.tsx`、任务视图模型：创建任务时传入当前项目路径，任务中心按当前项目扫描 `orca/`。
  - `launch-agent-in-new-tab.ts`、`QuickLaunchButton.tsx`、`LocalTaskAgentPicker.tsx`、SSH/WSL 环境透传：向 Agent 注入 `ORCA_LOCAL_TASK_ROOT`，CLI 可从当前项目任务目录读取上下文。
  - `package.json`：`pnpm dev` 启动前先执行 `build:cli`，避免 Electron 已更新但 `orca local-task` 仍使用旧 CLI。
- **Why（为什么这么做）**：
  - 用户的任务上下文需要跟项目 Git 一起提交，让其他 worktree、协作者和其他 AI 不依赖某台机器的 Orca 数据库。
  - 不同 worktree 不共享同一任务目录；workspace 删除后，只要文件已提交，任务历史仍可从项目和 Git 恢复。
  - `project_status.md` 是跨任务共享文件，多个 Agent 并行更新容易冲突，因此不再由任务系统自动维护。
  - 用户或 Agent 手动修改任务文件是合法上下文，系统只重新读取，不自动恢复或覆盖；JSON 损坏时显示错误。
- **How（怎么实现的）**：
  - 创建：任务表单携带项目路径 → `LocalTaskStore.create` → 创建 `orca/<task-id>/` → 原子写入 `task.json` 和初始化文档。
  - Agent：任务中心启动 → 注入 `ORCA_LOCAL_TASK_ID`/`ORCA_LOCAL_TASK_ROOT` → `orca local-task` → runtime RPC → 文件 Store → `task.json` → 变更广播。
  - 外部修改：文件监听 → 重新读取 `task.json` → 发送 `localTasks:changed` → 任务中心更新卡片。
- **用户须知**：
  - 新任务文件会进入项目 Git 工作区，是否提交由用户按正常 Git 流程决定。
  - Agent 会自行判断是否需要修改 `prd.md`、`plan.json`、`records.md`；不会自动更新共享 `project_status.md`。
  - 任务状态查看不再依赖 `~/Library/Application Support/orca-dev/local-tasks.db`。
- **已知限制**：当前只扫描任务中心选中的本地项目路径；远程 SSH 项目的文件写入和跨项目全局索引仍是后置能力。
- **关联假设**：`ASSUMPTIONS.md` 的“任务上下文跟随项目文件”和“Agent 通过当前会话绑定任务工具”。
## [2026-08-23] 修正关联会话输入与外部任务文件兼容
- **What（做了什么）**：
  - `LocalTaskAgentPicker.tsx`：首次启动任务仍直接选择 Agent；已有会话时先打开输入框，用户填写本轮独立请求，再选择 Agent；prompt 只保留任务标题/ID/描述、用户请求、`current`/`--help` 渐进式提示和直接读取 `task.json` 的兜底，不再重复发送整套命令清单或共享项目状态文件说明。
  - `local-task-center-actions.ts` 及详情面板类型：会话创建时把用户请求作为会话标题，并把项目路径传入文件 Store。
  - `file-store-format.ts`：兼容外部 AI 写入的 `Completed` 状态、`completed` 会话、字符串 latest output；任务 JSON 没有子任务时从 `plan.json` 投影已完成子任务和步骤。
  - `store.test.ts`：增加真实问题形状的回归测试，验证任务中心能继续显示待验收、已完成会话、最近输出和 plan 步骤。
  - `package.json` 已在前一提交中让 `pnpm dev` 启动前构建 CLI；本轮验证 `orca local-task --help` 和 `current --help` 均可用。
- **Why（为什么这么做）**：
  - 追问、方案讨论和代码 review 是当前任务下的新会话请求，不应复制原始任务 prompt；用户必须能表达这一次具体想让 AI 做什么。
  - Agent 不需要一次记住所有命令，先读任务、需要操作时再查帮助；CLI 暂时不可用时仍可直接读取项目任务文件。
  - 项目文件可能由其他 AI 直接修改，任务中心应容忍等价状态表达，不因一个非正式枚举值让整个任务列表不可用。
- **How（怎么实现的）**：
  - 关联会话：任务详情 → 输入本轮请求 → 选择 Agent → prompt 注入用户请求 →真实 tab → 以请求首行创建会话标题。
  - 文件读取：`task.json` → 状态/会话/输出归一化 → 若 subtasks 为空则读取 `plan.json` → 任务面板快照。
- **已知限制**：已经运行的旧生产 Orca 进程仍可能使用旧 CLI，必须重启新的 `pnpm dev` 实例；文件格式兼容只在读取时归一化，不回写用户原文件。
