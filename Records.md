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

## [2026-08-24] 修复任务会话关联失败与误归档

- **What（做了什么）**：
  - `src/main/ipc/local-task-ipc-validation.ts`：允许 `localTasks:createSession` 接收项目路径，和文件 Store 的任务定位参数保持一致。
  - `src/main/ipc/local-task-ipc-validation.test.ts`：增加项目路径会话关联校验测试。
  - 任务 `lt_2e3f0eb9-eb32-4cd7-a866-7b76cea74347`：将外部 Agent 错误写入的 `archivedAt` 恢复为 `null`，保留其 `In progress` 状态和已完成子任务记录。
- **Why（为什么这么做）**：
  - Agent 已经启动但 IPC schema 拒绝 `projectPath`，导致真实 tab 存在而任务会话没有登记。
  - `archivedAt` 被误写后默认列表会隐藏任务，因此恢复该运行中任务，避免用户误以为任务丢失。
- **How（怎么实现的）**：
  - renderer → `localTasks:createSession({ taskId, projectPath, sessionId })` → zod schema → 文件 Store → `task.json`。
- **验证结果**：相关定向测试通过；提交 `7fcf55e09`。

## [2026-08-24] 修正任务状态视角、归档刷新和执行步骤展示

- **What（做了什么）**：
  - `mock-data.ts`：任务视角有子任务时以最新子任务状态为准，完成子任务映射为 `Needs review`；无子任务时才使用任务自身状态；Waiting 仍保留任务级优先级。
  - `work-item-pieces.tsx`：子任务卡片同时显示子任务状态和父任务状态，避免子任务 `Done` 被误解为父任务已验收。
  - `WorkItemsPrototypePage.tsx`：详情抽屉默认关闭；收到归档任务变更时立即从内存列表和选中项移除。
  - `local-task-view-model.ts`：保留 `archivedAt` 给界面事件过滤。
  - `LocalTaskDetailPanel.tsx`、`work-item-views.tsx`：执行步骤改为 `text-xs`，完成后保留勾选图标但不再划线。
  - `LocalTaskAgentPicker.tsx`：完成提示要求 Agent 将完整最终交付文本写入 `report-completed --output`，避免任务中心只显示一句摘要。
  - `mock-data.test.ts`：增加任务视角状态计算回归测试。
- **Why（为什么这么做）**：
  - 子任务视角中的 `Done` 是子任务完成，不等于父任务已经验收；任务视角必须按最新子任务计算并显示待验收。
  - 归档属于即时列表变更，不能等下一次进入任务中心才生效。
  - 详情页不应在每次进入任务中心时抢占用户视线；执行步骤是状态信息，划线会降低未读性。
- **验证结果**：42 个相关测试通过，Web 类型检查和 UI lint 通过。

## [2026-08-24] 自动记录 Agent 最后一条 assistant 输出

- **What（做了什么）**：
  - 增加 `localTasks:updateSessionOutput` IPC/preload 通道；文件 Store 更新会话输出和任务 `latestOutput`。
  - `useIpcEvents.ts` 在接受 `done` 状态时读取 `lastAssistantMessage` 并自动持久化，标记来源为 `agent-status`。
  - `reportCompleted` 不再覆盖同一会话已经保存的自动完整输出，避免最后显示为 Agent 自己写的短摘要。
  - 子任务视角列表直接展开显示各执行步骤；验收后的父任务 `Done` 优先于子任务 `done` 的 `Needs review` 推导。
- **Why（为什么这么做）**：任务详情需要显示真实会话最后一次 assistant 输出，而不是任务记录摘要；任务视角的父任务验收状态也必须稳定。
- **验证结果**：47 个相关测试通过，Electron 构建成功。

## [2026-08-24] 增加任务标签并同步 Agent 会话结束状态

- **What（做了什么）**：
  - `LocalTask.labels` 写入 `task.json`，详情支持逗号分隔编辑，任务中心顶部标签下拉同时筛选看板和列表，卡片显示标签。
  - 新增 `localTasks:updateSessionOutput`；Agent 状态进入 `done` 时即使没有 `lastAssistantMessage` 也会把关联会话标记为 done，避免运行中计数残留。
  - `In progress` 且已有会话的任务操作按钮显示“继续执行”。
- **验证结果**：47 个相关测试通过，Web 类型检查和 lint 通过。

## [2026-08-25] 修复任务标题和标签编辑、补齐创建标签

- **What（做了什么）**：
  - `LocalTaskDetailPanel.tsx`：标题和标签编辑按钮打开可见 Dialog；标题使用单行输入，标签使用逗号分隔输入，保存时去除空值、去重并限制最多 20 个。
  - `local-task-center-actions.ts`、`LocalTaskDetailAside.tsx`：编辑回调改为接收用户在 Dialog 中确认的值，再通过现有任务更新 IPC 写回文件。
  - `local-task-types.ts`、`local-task-ipc-validation.ts`、`store.ts`：创建任务参数增加 `labels`；主进程再次归一化标签后写入 `orca/<task-id>/task.json`，更新任务时沿用同一规则。
  - `LocalTaskWorkspaceFields.tsx`、`useLocalTaskComposer.ts`、`NewWorkspaceComposerModal.tsx`：创建本地任务增加标签输入；标签以原始输入字符串保留，避免用户输入逗号时光标跳动；进入新建 workspace 第二步时保留标签。
  - 回归测试覆盖 IPC 标签裁剪和文件 Store 的空值/重复值/空格归一化。
- **Why（为什么这么做）**：
  - Electron 渲染窗口中的 `window.prompt` 不稳定且用户看不到，因此按钮表现为无响应；Radix Dialog 能在应用内稳定显示并提供取消、保存和输入焦点。
  - 创建接口此前虽然支持更新标签，却没有接收创建标签，导致表单无法持久化；把标签从表单、类型、校验到文件 Store 全链路接通。
- **How（怎么实现的）**：
  - 详情：铅笔按钮 → Dialog 输入 → 用户保存 → `localTasks.update` → `task.json` → 变更广播 → 看板和详情刷新。
  - 创建：标签输入 → `useLocalTaskComposer` 保留原始文本 → 创建时拆分/去重 → IPC 校验 → Store 归一化 → `task.json`。
- **用户须知**：标签使用英文逗号分隔，最多 20 个；标题不能为空；取消 Dialog 不会修改任务。
- **已知限制**：当前仅支持逗号分隔的纯文本标签，不支持标签颜色或层级。
- **验证结果**：Web TypeScript 检查、定向 oxlint、17 个本地任务相关测试和 Electron 构建均通过；构建仅有既有动态导入和 CSS 伪元素警告。

## [2026-08-25] 在任务详情抽屉内显示关联会话

- **What（做了什么）**：
  - `LocalTaskDetailAside.tsx`：增加关联会话预览状态；点击会话后将抽屉从单栏扩展为左右两栏，左侧保留任务详情和验收操作，右侧显示实时终端或“没有可显示终端”的明确状态。
  - 复用 `dashboard-popout/AgentTerminalPanel` 和 `dashboard/useLiveDashboardSnapshot`，因此终端预览沿用智能体仪表盘已有的 PTY 实时输出、输入和终端主题能力。
  - `WorkItemsPrototypePage.tsx`、`local-task-center-actions.ts`：移除点击会话时激活主界面 tab 并关闭任务中心的旧行为；“打开 workspace”仍是显式跳转入口。
- **Why（为什么这么做）**：
  - 用户查看会话通常仍需要任务标题、子任务和验收状态作为上下文；直接跳转主界面会丢失任务详情，且返回成本高。
  - 复用仪表盘预览可以避免为任务中心另建一套终端连接协议，同时保持实时交互一致。
- **How（怎么实现的）**：
  - 会话点击 → 保存真实 tab ID → 从实时 dashboard snapshot 找到对应卡片 → `AgentTerminalPanel` 连接该 PTY → 右侧显示实时会话。
  - 找不到卡片（已结束、未挂载或合成会话）→ 显示不可用提示；点击关闭 → 清除预览并恢复单栏抽屉。
- **用户须知**：点击会话行本身不会离开任务中心；需要进入完整 workspace 时使用右侧预览顶部的“打开 workspace”。
- **已知限制**：已结束的会话没有实时终端，只能显示不可用提示；其最近输出仍可在任务详情底部查看。
- **验证结果**：18 个定向测试通过，Web TypeScript 检查、oxlint 和 Electron 构建通过。

## [2026-08-25] 补齐任务视角、会话历史和 plan.json 同步

- **What（做了什么）**：默认切换任务视角；关联会话增加首次提示/最近输出展开；终端关闭后扫描 Agent Session History 并复用工作树恢复；会话保存 `initialPrompt`；Store 写入任务时同步 `plan.json` 子任务和步骤；外部已删除任务的重复归档按幂等成功处理。
- **Why（为什么这么做）**：任务中心默认应先展示任务状态；终端关闭后仍需保留会话上下文并支持恢复；空的 `plan.json` 会误导其他 AI 认为没有计划。
- **How（怎么实现的）**：请求 → `initialPrompt`；完成事件 → `latestOutput`；Store 写 `task.json` → 同步写 `plan.json.subtasks`；无实时卡片时通过 `aiVault.listSessions(scopePaths)` 匹配历史并调用现有 `handleResume`。
- **用户须知**：旧会话没有 `initialPrompt` 时显示默认提示；恢复依赖 Agent Session History 扫描结果。
- **验证结果**：21 个定向测试、Web TypeScript 检查和 oxlint 通过。

补充：`plan.json` 同步只替换 `subtasks`，会保留用户或其他 AI 写入的 `owner`、`notes` 等自定义字段。

## [2026-08-25] 修复历史会话恢复并支持详情侧栏调宽

- **What（做了什么）**：`LocalTaskDetailAside.tsx` 的历史会话匹配增加 `cwd` 条件；旧会话没有首次提示或标题变化时，也能按任务项目路径找到并调用现有恢复启动逻辑。详情抽屉左边缘增加拖拽分隔条，宽度限制在 360-720px；会话预览打开时保留左侧宽度。
- **Why（为什么这么做）**：旧会话通常没有任务中心保存的 `initialPrompt`，标题也可能被 Agent 自动生成，之前匹配失败后只打开 workspace，没有真正恢复会话。
- **How（怎么实现的）**：点击恢复 → `aiVault.listSessions({ scopePaths: [projectPath] })` → 优先匹配同项目 `cwd`，再匹配首次提示/标题 → `handleResume` → 创建恢复终端并激活目标 workspace。
- **执行功能说明**：顶部“执行当前任务”是批量执行入口，需要选择 Agent；只处理符合条件的 Open 任务。自动/定时执行尚未完成。
- **验证结果**：任务相关定向测试、Web TypeScript 检查和 work-items oxlint 通过。

## [2026-08-25] 修复批量执行入口、会话恢复可见性和标签候选

- **What（做了什么）**：
  - `LocalTaskCenterHeader.tsx`、`WorkItemsPrototypePage.tsx`：批量执行按钮使用候选任务自身的 workspace，不再错误依赖当前激活 workspace；没有候选时标题提示可执行条件。
  - `LocalTaskDetailAside.tsx`：历史恢复成功后显式激活任务 workspace并关闭事项中心，确保排队创建的恢复终端可见。
  - `LocalTaskDetailPanel.tsx`、`LocalTaskLabelSuggestions.tsx`：标签编辑弹窗根据当前逗号片段过滤已有标签，显示最多 8 个快捷候选，点击后追加到输入框。
- **Why（为什么这么做）**：批量任务可能绑定了后台 workspace，用户当前激活的 workspace 为空不应让按钮变灰；恢复会话必须完成“创建恢复终端 + 激活目标 workspace”两步；已有标签应能复用，减少重复输入。
- **验证结果**：14 个相关测试、Web TypeScript 检查和 work-items oxlint 通过。

## [2026-08-25] 修复批量会话启动和活跃会话误恢复

- **What（做了什么）**：
  - `local-task-batch-runner.ts`：批量启动每个任务前先激活任务绑定的 workspace，再创建 Agent tab；创建任务会话时保存完整批量提示作为 `initialPrompt`。
  - `LocalTaskDetailAside.tsx`：运行中的任务会话点击“打开工作树查看会话”，不会再调用历史恢复；只有 idle/done 会话才允许 `resume`，避免 Codex 的 active writer 冲突。
- **Why（为什么这么做）**：此前批量 runner 只创建 tab，不激活后台 workspace，任务进入 `In progress` 后用户看不到实际会话；对运行中的 Codex 会话执行 resume 会触发 `thread already has an active writer`。
- **验证结果**：21 个本地任务定向测试、Web TypeScript 检查和 work-items oxlint 通过。

## [2026-08-25] 统一由 Agent 状态主导任务状态

- **What（做了什么）**：
  - `file-store-mutations.ts`：创建新会话时，无论任务原来是 `Needs review` 还是 `Done`，都先进入 `In progress`；任意一个 Agent 完成事件写入最后输出时，任务进入 `Needs review`，不再因为会话结束自动进入 `Waiting`。
  - `local-task-view-model.ts`：任务只要存在已结束会话就优先显示 `Needs review`；没有已结束会话且有 `working` 会话时才显示 `In progress`。
  - `work-item-pieces.tsx`：详情底部移除“等待/继续”和“要求修改”状态操作，主状态交互只保留“开始执行”和“验收通过”；旧 `Waiting` 状态仍可读取显示以兼容既有任务文件。
- **Why（为什么这么做）**：智能体仪表盘的运行态是当前最及时的事实来源；用户不应手动维护 Waiting/继续/要求修改等中间状态，任务只需由启动、Agent 运行/结束和用户验收驱动。
- **How（怎么实现的）**：创建会话 → `In progress`；任意 session 结束 → `Needs review`；没有结束会话但存在 `working` → `In progress`；用户验收 → `Done`。
- **用户须知**：Agent 结束但没有完成报告时也会进入 `Needs review`，用户可直接验收；旧任务文件中的 `Waiting` 不会被破坏，但新 UI 不再提供设置入口。
- **验证结果**：21 个本地任务定向测试、Web TypeScript 检查和 work-items oxlint 通过。

## [2026-08-26] 审查 BallsOutProj 本地任务工作流

- **What（做了什么）**：新增 `docs/local-task-workflow-review.md`，基于 `/Users/lmy/proj/Tile/BallsOutProj/orca` 的 7 个任务文件和当前 Store/批次/UI 调用链，记录实际矛盾、重复字段、缺失动作和修复优先级。
- **关键发现**：存在已归档但会话仍 working 的隐藏任务；存在 In progress 但无会话的孤儿任务；同一请求被登记为两个 working 会话；旧 task.json 与 plan.json 不一致；“开始执行”按钮只改状态而不启动 Agent；批次生命周期由 renderer 轮询，关闭 Orca 后可能留下 queued/running。
- **结论**：当前文件方案适合作为上下文载体，但还缺一致性诊断、停止/取消、启动失败展示、重启恢复和请求去重。

## [2026-08-26] 收敛任务状态和启动入口

- **What（做了什么）**：任务状态收敛为 `Open`、`In progress`、`Needs review`、`Done`；移除 `Waiting`/`waitingReason`；详情底部移除只改状态、不启动 Agent 的“开始执行”；批次 queued/running 和工作会话显示 `In progress`；任意会话结束进入 `Needs review`；同一任务同一首条提示的重复 working 会话复用；运行中任务禁止归档。
- **Why（为什么这么做）**：状态按钮与真实 Agent 启动脱节会制造假进度；Waiting 与 Needs review 重叠；重复点击会产生重复 Agent；运行中归档会让任务从列表消失。
- **How（怎么实现的）**：Agent 启动/批量启动 → working session → In progress；任意 session 结束 → Needs review；用户验收 → Done；归档前检查 working session。
- **用户须知**：启动 Agent 请使用“启动任务/新建关联会话”或顶部批量入口；本轮不保留旧 Waiting 文件兼容。
- **验证结果**：23 个本地任务定向测试、Web TypeScript 检查和 oxlint 通过。

## [2026-08-26] 增加会话当前问题和轮次小结

- **What（做了什么）**：会话增加 `currentPrompt` 和最多 30 条 `turns`；Agent working 状态更新当前问题，done 状态追加“用户问题 + Agent 小结”；任务详情和右侧预览统一显示当前问题及轮次历史，移除首次提示/最近轮次展示。
- **Why（为什么这么做）**：用户主要需要快速知道每个会话当前在解决什么，以及之前每轮聊过什么；复制完整 transcript 或引入交互段都会增加复杂度。
- **How（怎么实现的）**：Agent 状态 prompt → `currentPrompt`；Agent done + 最终回复 → `turns[]`；任务详情/预览 → `LocalTaskSessionTurnHistory`。
- **用户须知**：会话仍通过现有任务 ID + session ID 关联；只有 Orca 接收到 Agent 状态事件的会话会自动记录轮次。
- **验证结果**：24 个本地任务定向测试、Web TypeScript 检查和 oxlint 通过。

## [2026-08-27] 实现最小子任务会话归属模型

- **What（做了什么）**：
  - `local-task-types.ts`：增加子任务会话归属移交参数；子任务仍只保留现有勾选/步骤状态，不新增 Proposed、Ready、Blocked 等状态。
  - `subtask-progress-mutations.ts`：AI 更新子任务或步骤时校验执行会话；未绑定子任务由首次修改它的会话自动认领，其他会话直接拒绝。
  - `subtask-session-assignment.ts`、`store.ts`：增加显式子任务移交；原会话仍为 working 时普通移交拒绝，只有带 force 的用户确认路径才能移交。
  - `local-task-ipc-validation.ts`、`local-tasks.ts`、preload：新增 `localTasks:transferSubtask` IPC，负责面板和主进程之间的显式移交。
  - `runtime/rpc/methods/local-tasks.ts`：`current` 返回当前会话负责、未绑定、其他会话负责三组子任务；Agent 只能通过自身会话更新归属范围内的子任务。
  - `cli/specs/local-tasks.ts`、`cli/handlers/local-tasks.ts`、`handler-group-manifest.ts`：新增 `orca local-task subtask-transfer --subtask <id> [--force]`，让 AI 在用户确认后移交子任务。
  - `LocalTaskSubtaskCreateDialog.tsx`：面板支持新增子任务；已有会话时选择执行会话或新建 Agent 会话；没有会话时允许暂不绑定；新建会话会自动绑定新子任务。
  - `LocalTaskSubtaskSessionSelect.tsx`、`LocalTaskSubtaskBlock.tsx`：子任务行展示执行会话，支持更换归属和运行中会话的二次确认。
  - `local-task-agent-prompt.ts`、`LocalTaskAgentPicker.tsx`、批量 runner：每次追问要求先读取全部子任务，优先调整步骤，只有独立功能才新建子任务，并按当前会话归属顺序执行。
- **Why（为什么这么做）**：用户需要一个任务下预先准备多个功能，同时允许某个功能反复对话调整和中途插入新功能；增加复杂子任务状态或依赖图会提高理解成本。单一执行会话归属足以防止两个 Agent 同时改同一子任务。
- **How（怎么实现的）**：用户新增/AI 创建子任务 → 绑定一个 sessionId（或暂不绑定）；Agent 读取全量子任务 → 优先更新自己负责/未绑定项；遇到其他会话归属 → 拒绝并请求确认；确认后 `subtask-transfer` 修改归属；步骤完成继续使用原勾选模型。
- **用户须知**：一个会话可以按列表顺序处理多个自己负责的子任务；一个子任务同一时间只归属一个会话。需要换会话时，从子任务行选择新会话；原会话运行中会出现确认弹窗。
- **已知限制**：当前没有子任务依赖图和自动调度；子任务顺序由列表顺序决定，用户通过新增顺序和会话归属控制执行；完整会话 transcript 仍需在终端/会话历史查看。
- **验证结果**：27 个领域/RPC 测试、3 个子任务面板 DOM 测试、Agent 提示词测试、Web TypeScript、oxlint 和 Electron 构建通过。

## [2026-08-27] 用实时智能体状态修复陈旧 working 会话

- **What（做了什么）**：
  - `local-task-view-model.ts`：新增实时会话校正；task.json 标为 working 但智能体仪表盘没有对应 tab 的会话，在 15 秒启动宽限后投影为 done，任务转为 Needs review、运行中数量归零。
  - `WorkItemsPrototypePage.tsx`：订阅 `useLiveDashboardSnapshot`，任务卡片、筛选、详情和批量候选统一使用实时校正后的视图模型。
  - `local-task-center-actions.ts`：归档时提交当前实时 working 会话 ID。
  - `local-task-types.ts`、IPC 校验、preload、`store.ts`：归档接口接受可选实时会话证据；真实运行会话继续拒绝归档，没有实时证据的残留 working 会话在归档前写为 done。
- **Why（为什么这么做）**：Agent 终端可能已关闭但完成事件未写回 task.json，导致任务永久显示 In progress、详情误报正在运行并禁止归档；智能体仪表盘已有更准确的实时状态。
- **How（怎么实现的）**：实时 dashboard cards → tab ID 集合 → 校正 WorkItem sessions；用户归档 → 传递实时 working ID → Store 仅阻止真实运行会话，并收敛陈旧文件状态。
- **用户须知**：刚创建的会话在仪表盘卡片出现前有 15 秒宽限；超过宽限仍没有实时卡片时会被视为已结束。归档会把其文件状态从 working 写为 done。
- **验证结果**：8 个测试文件、50 项测试，Web TypeScript、oxlint 和 Electron 构建全部通过。

## [2026-08-25] 规划异步员工模式

- **What（做了什么）**：
  - `PRD.md`：新增 v1.5 需求版本，定义 Inbox（收件箱）和 `intakeState`（需求整理状态），区分 `Open` 与“已授权自动执行”；增加一次性 `scheduled_once`、空闲自动 `idle_auto`、手动 `manual` 三种执行方式；规定 `idle_auto` 在 ready 后等待 10 分钟，默认全局并发数为 2，允许共享 workspace 并行。
  - `PRD.md`：定义主进程调度器、任务索引、`LocalTaskRun` 运行记录、硬优先级队列和同优先级内的 AI 辅助排序；AI 排序失败时回退到按时间的确定性排序。
  - `PRD.md`：定义集中待审阅入口。AI 正常交付、主动请求用户决策和执行失败都进入 `Needs review`，通过 `reviewKind` 分为 `delivery`、`needs_input`、`execution_failed`；只有用户验收才能进入 `Done`，继续执行或重试创建新的运行记录。
  - `plan.md`：新增阶段 7 的 11 项 checklist，覆盖领域字段、Inbox、一次性计划、索引、运行记录、并发和排序、真实 Agent 会话、待审阅 UI、测试和文档交付；所有条目初始为 `[ ]`。
  - `PROJECT_STATUS.md`：记录阶段 7 已完成需求拆分但尚未编码，并把 Inbox、调度和运行记录列为当前已知缺口。
  - `ASSUMPTIONS.md`：记录一次性异步执行边界、10 分钟冷却、默认并发数、关闭 Orca 的行为和统一待审阅规则。
- **Why（为什么这么做）**：
  - 用户的核心目标是降低并行任务的等待和心智成本，让 AI 先完成可独立工作的内容，用户集中处理汇报与决策。因此 Inbox、自动执行队列和待审阅区必须是三个不同阶段，而不是把所有内容塞进现有状态列。
  - 先用“立即执行 → 指定时间 → 空闲候选”的硬顺序保证可解释性，再允许 AI 只在空闲候选内部排序，避免模型判断异常导致未授权任务被启动。
  - 每次尝试单独保存运行记录，才能支持失败重试、回答澄清问题和多轮修改，同时保留完整决策历史。
- **How（怎么实现的）**：
  - 任务流：快速记录 → Inbox → 补充描述/项目/workspace/执行方式 → `Open + ready` → 调度队列 → 真实 Agent 会话 → `Needs review` → 用户验收/回答/重试。
  - 调度流：项目任务文件 → 主进程任务索引 → 候选过滤 → 硬优先级排序 → 可选 AI 细排 → 原子认领 `LocalTaskRun` → 启动 Agent。
  - 待审阅流：Agent 输出/请求决策/失败 → 记录 `reviewKind` 和运行摘要 → 集中待审阅列表 → `Done` 或创建下一次运行。
- **用户须知**：
  - `Open` 不等于自动执行；Inbox 任务不会启动 AI；必须整理为 `ready` 并明确选择 `scheduled_once` 或 `idle_auto`。
  - 10 分钟是 idle_auto 的创建后冷却时间，不是“全局 10 分钟没有会话”才执行；Orca 关闭期间不保证执行，重新打开不静默补跑。
  - 当前只完成文档和计划，阶段 7 尚未改变运行行为；代码实现完成前，任务仍只能手动启动。
- **已知限制**：
  - 当前计划不包含周期性计划、常驻后台执行服务、强制 workspace 锁、任务依赖图、无限重试和多人共享收件箱。
  - AI 排序器的具体调用模型和成本控制尚未实现，必须保留确定性降级路径。
- **关联假设**：`ASSUMPTIONS.md` 的“异步员工模式的执行边界”和“AI 输出统一进入待审阅”。

## [2026-08-25] 改为批量执行当前任务

- **What（做了什么）**：
  - `PRD.md`：新增 v1.6 变更历史，移除单任务 `scheduled_once`、`idle_auto`、`scheduledAt`、`eligibleAt` 和 10 分钟冷却；改为任务中心“执行当前所有任务”按钮。
  - `PRD.md`：把批次定义为按钮点击时捕获的任务快照，只筛选 `Open + ready + 未归档 + workspace 可用 + 无同任务运行中记录`；Inbox、Waiting、In progress、Needs review、Done、归档和 workspace 不可用任务排除。
  - `PRD.md`：定义按 workspace 分组的执行模型：每个 workspace 一个串行 worker，同一 workspace 前一任务结束后才启动下一任务，不同 workspace 的 worker 并行；批次开始前由 AI 在候选快照内排序，失败时按 `createdAt` 降级。
  - `plan.md`：将阶段 7 从定时调度改为批次服务，调整领域字段、批次快照、workspace 队列、AI 排序和测试验收任务。
  - `PROJECT_STATUS.md`、`ASSUMPTIONS.md`：同步记录 v1.6 的批次执行边界和当前尚未实现状态。
- **Why（为什么这么做）**：
  - 用户的核心工作流是先集中准备一批小任务，再明确点击一次让 AI 处理，不需要为每个任务设置时间或等待 10 分钟；移除单任务时间配置能降低准备成本和误启动风险。
  - workspace 是代码上下文的自然隔离边界。同 workspace 串行可以避免两个 Agent 同时修改同一套代码，不同 workspace 并行则保留批量处理效率。
  - 批次快照保证按钮点击后新增的任务不会悄悄混入当前执行，用户可以通过下一次点击明确授权。
- **How（怎么实现的）**：
  - 批次流：点击按钮 → 读取当前任务 → 过滤 Open/ready → AI 只在候选内排序 → 按 workspace 分组 → 每组串行启动真实 Agent → 不同组并行 → 每次尝试写入 `LocalTaskRun`。
- **用户须知**：
  - Inbox 仍是需求整理入口，不会被“执行当前所有任务”启动；整理为 ready 后也不会自行启动，必须点击按钮或单独开始任务。
  - 同一 workspace 的任务不会同时运行；不同 workspace 可以同时运行。批次中途关闭 Orca 不保证剩余任务继续执行，重新打开后可以再次点击按钮。
  - 当前只更新文档和计划，v1.6 尚未改变运行行为。
- **已知限制**：
  - 当前不支持单任务定时、周期计划、常驻后台调度、跨批次长期队列、无限重试和正式任务依赖图。
- **关联假设**：`ASSUMPTIONS.md` 的“异步员工模式的执行边界”和“AI 输出统一进入待审阅”。

## [2026-08-25] 实现批次执行和 Inbox 第一轮闭环

- **What（做了什么）**：
  - `src/shared/local-task-types.ts`：增加 Inbox 整理状态、执行状态、待审阅原因、批次运行记录和批量 IPC 参数类型；旧任务读取时由文件格式层补齐默认值。
  - `src/main/local-tasks/file-store-format.ts`：读取旧 `task.json` 时归一化 `intakeState`、执行状态、reviewKind 和 runs，保留外部 AI 写入文件的兼容性。
  - `src/main/local-tasks/file-store-mutations.ts`、`store.ts`：新增批次快照创建、按任务原子认领 `LocalTaskRun`、运行状态更新；Agent 会话结束时将批次任务自动推进为 `Needs review / delivery`；报告完成不再要求所有步骤先完成。
  - `src/main/ipc/local-task-ipc-validation.ts`、`local-tasks.ts`、`src/preload/api/local-task-api.ts`、`src/preload/index.ts`：新增 `localTasks:startBatch` 和 `localTasks:updateRun`，并校验批次引用、Agent 和运行状态。
  - `src/main/runtime/rpc/methods/local-tasks.ts`、`src/cli/specs/local-tasks.ts`、`src/cli/handlers/local-tasks.ts`：新增 `localTask.requestReview` / `orca local-task request-review --question`，让 Agent 在需求不清时停止并进入 `Needs review / needs_input`。
  - `src/renderer/src/components/work-items/local-task-batch-runner.ts`：复用现有 Agent 启动器，按 workspace 分组；同组串行、不同组并行，创建真实会话并轮询运行结束。
  - `WorkItemsPrototypePage.tsx`、`LocalTaskCenterHeader.tsx`、`QuickLaunchButton.tsx`：增加“执行当前任务”Agent 选择入口、批次候选过滤和全部/收件箱/待审阅筛选。
  - `LocalTaskWorkspaceFields.tsx`、`NewWorkspaceComposerModal.tsx`、`useLocalTaskComposer.ts`：创建任务时可选择直接进入 ready 或先放入 Inbox。
  - `store.test.ts`、`local-task-ipc-validation.test.ts`、`runtime/rpc/methods/local-tasks.test.ts`：覆盖批次快照、Inbox 排除、运行完成进入 review、IPC 校验和 Agent 请求用户决策。
- **Why（为什么这么做）**：
  - 用户明确授权的是一批任务，而不是每个任务的时间计划；批次快照把授权边界固定在按钮点击时，避免新任务悄悄混入。
  - workspace 是代码环境的自然串行边界；同组串行避免同时改同一工作树，不同组并行保留批量效率。
  - `request-review` 让 Agent 用结构化桥接请求用户决策，不依赖解析自然语言，也不会把需要确认的问题伪装成完成结果。
- **How（怎么实现的）**：
  - 批次链路：任务中心筛选 `Open + ready` → 主进程创建批次和 queued runs → renderer 按 workspace worker 启动真实 tab → `createSession` 关联任务 → Agent done 回写 output → Store 将 run 和任务设为 `Needs review`。
  - 决策链路：Agent → `orca local-task request-review --question` → runtime RPC 归属校验 → 文件 Store 写入 `reviewKind = needs_input`/问题 → 任务中心待审阅筛选。
- **用户须知**：
  - 当前“执行当前任务”仍需要任务中心窗口可用；批次只处理点击时的候选快照，不支持单任务定时或自动后台补跑。
  - 同 workspace 任务由 renderer 串行等待前一任务结束；不同 workspace 可同时启动。Inbox 任务不会进入批次，需整理为 ready。
  - Agent 可以通过 `orca local-task request-review --question "..."` 暂停并请求用户决策；正常结束会自动进入 `Needs review`。
- **已知限制**：
  - AI 批次排序尚未接入，目前按任务创建时间降级；批次进度和待审阅详情仍在补充；应用重启后的 queued/running 恢复策略尚未实现。
- **关联假设**：`ASSUMPTIONS.md` 的“异步员工模式的执行边界”和“AI 输出统一进入待审阅”。

## [2026-08-25] 补齐批次重试和 Inbox 整理操作

- **What（做了什么）**：
  - `src/main/local-tasks/file-store-batch-mutations.ts`：将批次专用 Store 逻辑从通用文件变更模块拆出；下一次批量执行会识别上一次遗留的 queued run，将其标记为失败并创建新的运行记录，避免任务永久卡在队列中。
  - `src/main/local-tasks/store.test.ts`：增加中断批次重试测试，验证旧 run 保留为失败、新 run 重新进入 queued。
  - `work-item-pieces.tsx`、`LocalTaskDetailAside.tsx`、`local-task-center-actions.ts`：Inbox 任务详情增加“整理为可执行”操作，写入 `intakeState = ready`，不会直接启动 Agent。
- **Why（为什么这么做）**：
  - 批次执行依赖 renderer 窗口，窗口中途关闭后 queued 任务不能被下一批次永久排除；保留旧失败记录同时创建新 run，既可重试又不丢失中断历史。
  - Inbox 必须有明确的整理出口，否则用户只能创建但无法下达任务；单独的 ready 操作把“需求整理”和“批次授权”继续分开。
- **How（怎么实现的）**：
  - 重试链路：再次点击批次 → Store 发现旧 queued run → 写入 `failed`/错误原因 → 创建新 `LocalTaskRun` → 按 workspace 重新排队。
  - Inbox 链路：详情操作 → `localTasks.update({ intakeState: 'ready' })` → 文件 Store 原子写入 → 任务进入下一次批次候选，但不会自动启动。
- **用户须知**：
  - 关闭窗口不会自动续跑旧批次；下一次点击批量执行时，未启动的 queued 任务会作为可重试任务重新认领。
  - Inbox 任务必须先点击“整理为可执行”，然后再点击“执行当前任务”。
- **已知限制**：AI 批次排序、批次进度详情和完整端到端测试仍在阶段 7 后续任务中。
- **关联假设**：`ASSUMPTIONS.md` 的“异步员工模式的执行边界”。
