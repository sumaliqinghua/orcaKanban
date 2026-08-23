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
