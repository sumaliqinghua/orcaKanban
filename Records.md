# 实现记录

## [2026-09-01] 将 Kanban Advisor 从项目 Skill 改为模板显式规则

- **What（做了什么）**：
  - `.agents/skills/kanban-advisor/`：移除整个项目级 Skill，避免 Codex、Claude 等支持项目 Skill 发现的普通任务会话自动加载 Kanban Advisor 写入规则。
  - `assistant/kanban-advisor/`：保留原有四种分析模式、结果契约、JSON Schema 和 `kanban-result.mjs` 历史/写入脚本，但改成普通项目文档；`README.md` 不含 Skill frontmatter，并明确只有自动化 Prompt 显式引用时才使用。
  - `src/renderer/src/components/automations/automation-templates.ts`、`src/renderer/src/i18n/locales/en.json`、`zh.json`：四个模板 Prompt 改为显式读取 `assistant/kanban-advisor/README.md`、`references/modes.md` 和 `references/result-contract.md`，脚本调用路径同步改到新目录。
  - `src/renderer/src/components/automations/automation-templates.test.ts`、`config/scripts/kanban-advisor-result-script.test.mjs`：模板测试增加“不得包含旧 Skill 调用语句”的断言；脚本测试改用普通文档目录中的脚本。
  - `tests/e2e/automation-kanban-advisor-templates.spec.ts`：Electron 用例验证四个模板真实显示，并验证点击需求澄清模板后 Prompt 编辑器包含分析模式和 `assistant/kanban-advisor/README.md` 路径。
  - `assistant/results/2026-08-31/`：删除普通任务会话误加载项目 Skill 后生成的 AI 记录，保留空的结果目录供真实自动化后续写入。
- **Why（为什么这么做）**：
  - 项目根目录 `.agents/skills` 是多个 Agent 的自动发现位置，普通任务会话也会看到其中的 Skill。把只属于四个自动化模板的写入规则放在这里，会扩大触发范围并导致普通开发任务错误写入 AI 记录。
  - 普通文档加模板 Prompt 显式引用保留了统一格式、历史读取和无变化去重，同时把授权边界收窄到用户主动创建的四个 Automation。
- **How（怎么实现的）**：
  - 普通任务会话 → 只扫描标准 Skill 目录 → 不发现 Kanban Advisor；四个 Automation 模板 → Prompt 显式读取 `assistant/kanban-advisor/` → 选择模式并读取历史 → 无变化返回 `no_change`，有变化时调用脚本写入 AI 记录。
- **用户须知**：
  - 四个模板仍不会自动创建或启用；用户从模板创建并保存 Automation 后，才能按计划或 `Run Now` 运行。普通任务即使位于同一项目，也不会因为规则文档存在而自动写 AI 记录。
- **已知限制**：
  - 规则隔离依赖模板 Prompt 中的显式路径；如果用户手动删除这些路径，自动化 Agent 将不会获得统一输出契约。
- **验证结果**：
  - 模板与结果脚本定向测试共 3 项通过；`tc:web`、`tc:node`、本地化提取、本地化目录和 changed-file 质量门通过；Electron E2E 1 项通过；`git diff --check` 通过。
- **关联假设**：无。

## [2026-09-01] 增加 Kanban Advisor 自动化模板

- **What（做了什么）**：
  - `src/renderer/src/components/automations/automation-templates.ts`：在现有四个通用模板后增加四个 Kanban Advisor 模板，分别对应 `requirement_clarification`、`candidate_task`、`task_simplification` 和 `status_report`。每个模板包含名称、说明、完整 Prompt、默认周期和宽限时间；Prompt 明确要求读取模板专用规则文档、读取同系列历史、调用 `kanban-result.mjs write`，无变化时返回 `no_change`。
  - `src/renderer/src/i18n/locales/en.json`、`zh.json`：增加四个模板的英文和简体中文分类、名称、说明和 Prompt 文案。
  - `src/renderer/src/components/automations/automation-templates.test.ts`：验证四个模板 ID、Prompt 中的显式规则文档路径/`no_change` 约束以及小时/每周/每日默认时间。
  - `PRD.md`、`plan.md`、`PROJECT_STATUS.md`：记录 v1.8 模板范围、默认值、复用边界和验收结果。
- **Why（为什么这么做）**：
  - 分析模式、记录规则和写入脚本已经存在，但用户仍需手写 Prompt 才能创建 Automation；将标准 Prompt 做成现有模板可以消除这一步，同时保留 Automation 原有的项目、workspace、Agent、时间、启停和 Run Now 编辑能力。
  - 模板只预填 `AutomationDraft`，不扩展 Automation 执行枚举，避免把分析文档误做成第二套调度器。
- **How（怎么实现的）**：
  - 自动化空状态/编辑器模板列表 → 选择 Kanban Advisor 模板 → 现有 `applyTemplateToDraft` 写入名称、Prompt、周期和时间 → 用户保存或修改 → 现有 Automation 服务按计划运行 → Agent 按 Prompt 读取模板专用规则文档并写 AI 记录。
- **用户须知**：
  - 四个模板不会自动创建或启用 Automation；需要点击模板并保存。保存后可像普通 Automation 一样改时间、停用或立即运行。
  - “每周候选任务规划”默认每周一 10:00；需求澄清默认每小时 5 分；滞留任务简化默认每天 11:00；状态汇报默认每天 18:00。
- **已知限制**：
  - 当前没有单独的“分析模式”字段；模板保存后仍是通用 Prompt Automation。模板覆盖的默认项目和 workspace 由现有编辑器决定，用户可在保存前调整。
- **关联假设**：无新增假设。

## [2026-08-31] 增加 AI 记录流与 Kanban Advisor 规则

- **What（做了什么）**：
  - `src/shared/kanban-ai-record.ts`：定义 `KanbanAiRecord`、四种记录类型、`seriesKey`、`basis`、`inputFingerprint`、`readAt` 及列表/已读请求参数。
  - `src/main/local-tasks/ai-record-file-store.ts`：扫描 `assistant/results/YYYY-MM-DD/air_*.json`，限制最多 1,000 个文件和 256 KiB 单文件；严格校验、按 ID 去重、按时间排序，并用原子 JSON 写入保存首次已读时间。
  - `src/main/ipc/local-task-ipc-validation.ts`、`src/main/ipc/local-tasks.ts`、`src/preload/api/local-task-api.ts`、`src/preload/index.ts`：在现有 `localTasks` 通道增加 `listAiRecords` 和 `markAiRecordRead`，renderer 不直接访问文件系统。
  - `assistant/kanban-advisor/`：增加四种分析模式、统一 Markdown 章节、历史读取顺序、无变化门禁、JSON Schema 和确定性 `history`/`write` 脚本；相同 `seriesKey` 与 `inputFingerprint` 返回 `no_change`，不落新文件。该目录是模板显式读取的普通文档目录，不参与项目 Skill 自动发现。
  - `src/renderer/src/components/work-items/KanbanAiRecordList.tsx`、`KanbanAiRecordDetailAside.tsx`、`KanbanAiRecordsPane.tsx`：任务中心新增 AI 记录队列、未读标记、Markdown 预览和唯一“查看任务”按钮；未关联任务的记录保持只读。
  - `LocalTaskQueueTabs.tsx`、`LocalTaskSourceTabs.tsx`、`WorkItemsPrototypePage.tsx`、`use-local-task-center-interactions.ts`、`local-task-project-scope.ts`、`kanban-ai-record-task-target.ts`：复用现有队列、项目范围、任务详情侧栏和 Markdown 样式，提供跨项目读取、严格任务目标匹配，并将页面级交互拆出以保持页面低于 400 行。
  - 测试覆盖文件 schema/排序/去重/已读、IPC 参数、结果写入脚本、renderer 组件、任务目标匹配和 Electron Playwright 端到端流程。
- **Why（为什么这么做）**：
  - 用户需要保留同类型分析的多次结果并支持从近到远阅读，同时避免定时运行重复生成相同建议；因此采用一个文件一条记录、`seriesKey` 归组、`basis`/`inputFingerprint` 去重，且把 `readAt` 与内容变化完全分离。
  - 复用项目目录和现有 localTasks IPC，不增加第二套数据库、顶层页面、常驻调度 Agent 或未完成的 Proposal 状态机；自动化继续负责触发，分析 Agent 只负责生成记录。
  - 首版只保留“查看任务”，避免在没有完整业务状态机时引入采纳、忽略和稍后处理等动作。
- **How（怎么实现的）**：
  - 分析 Agent → `kanban-result.mjs history` 读取同系列历史 → 比较稳定输入依据 → 无变化返回 `no_change`；有新判断时 → `write` 校验并原子写入 `assistant/results/<date>/air_<id>.json` → 任务中心通过 IPC 读取 → 打开预览调用 `markAiRecordRead` → 按 `projectId + taskId` 进入现有任务详情。
- **用户须知**：
  - 四个 Kanban Advisor 自动化模板写记录时必须使用 `assistant/kanban-advisor/scripts/kanban-result.mjs` 和 `references/result-contract.md` payload，不要手写 `id`、`createdAt`、`inputFingerprint` 或 `readAt`。
  - `readAt = null` 表示未读；打开预览即标记已读，首版没有手动改回未读的 UI；无 `taskId` 的记录只能阅读。
- **已知限制**：
  - 输入变化但语义无变化的第二层判断仍由模板启动的 Agent 完成；首版只扫描本地项目，远程/SSH 结果、自动清理和全套 E2E 类型债务后置。
- **关联假设**：`ASSUMPTIONS.md` 的“AI 记录使用项目内可清理目录”“打开 AI 记录预览即标记已读”“AI 记录首版仅支持本地项目”。

## [2026-08-31] 修复主动问询 Agent 无法读取任务上下文

- **What（做了什么）**：
  - `src/renderer/src/lib/agent-background-session-contract.ts`：为后台 Agent 启动参数增加可选的 `localTaskId`（本地任务 ID）和 `localTaskRoot`（包含 `orca/<task-id>/task.json` 的项目根目录）。
  - `src/renderer/src/lib/launch-agent-background-session.ts`：在解析 Agent 默认环境后追加上述两个字段，生成 PTY/远程 runtime 都会继承的启动环境；未传字段时保持原有普通后台启动行为。
  - `src/renderer/src/hooks/useLocalTaskComposer.ts`：主动问询澄清会话启动时传入创建完成任务的 ID 和项目路径。
  - `src/renderer/src/components/work-items/local-task-batch-runner.ts`：批量执行会话启动时传入候选任务的 ID 和项目路径，补齐同一任务桥接能力。
  - `src/renderer/src/lib/launch-agent-background-session.test.ts`：增加 PTY spawn 环境断言，验证 `ORCA_LOCAL_TASK_ID`、`ORCA_LOCAL_TASK_ROOT` 与稳定会话身份同时存在。
- **Why（为什么这么做）**：
  - “创建后主动问询补充描述”使用的是后台启动器，而该路径此前只带有 workspace、tab 和 pane 身份，没有任务桥接所需的环境变量，Agent 执行 `orca local-task current --json` 时只能得到“当前 Agent 会话未绑定本地任务”。
  - 将注入放在后台启动器这一共享边界，而不是在某个调用方拼接 shell 命令，可同时覆盖本地 PTY、SSH 和远程 runtime，避免三条启动路径再次分叉。
- **How（怎么实现的）**：
  - 任务澄清/批次 runner → `launchAgentBackgroundSession({ localTaskId, localTaskRoot })` → `resolveTuiAgentLaunchEnv` 合并任务字段 → `buildAgentStartupPlan` → `paneEnv` → PTY 或 runtime terminal → Agent CLI 读取环境 → runtime RPC 按项目根目录读取 `orca/<task-id>/task.json`。
  - 用户自定义 Agent 环境仍先被解析，任务字段随后写入，因此不会被旧配置意外覆盖。
- **用户须知**：
  - 勾选主动问询后，澄清 Agent 可以直接运行 `orca local-task current --json` 并在当前会话请求补充信息；不需要用户手动从任务中心再次启动。
  - 批量执行 Agent 同样具备任务 CLI 上下文；从 workspace 快捷入口直接启动的会话仍不会自动绑定任务，这是有意保留的边界。
- **已知限制**：
  - 既有运行中的 Orca 进程可能仍加载旧的 renderer/CLI 产物；需重启开发进程后再验证新启动链路。
- **关联假设**：无新增待确认假设。

## [2026-08-31] 修复新建任务默认进入收件箱

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`：任务中心打开新建任务弹窗时传入空白草稿，并明确设置 `intakeState: 'ready'`、`clarificationRequested: false`，不再依赖弹窗状态残留或隐式默认值。
  - `src/renderer/src/hooks/useLocalTaskComposer.ts`：新增 `effectiveIntakeState` 归一化值；创建任务和新建 workspace 后创建任务均只把明确的 `inbox` 写入收件箱，其余值写为 `ready`。
  - `plan.md`、`PROJECT_STATUS.md`：同步记录默认可执行任务规则和验收标准。
- **Why（为什么这么做）**：
  - 用户看到表单显示“可执行任务”，但创建结果进入收件箱，说明创建入口可能复用了旧草稿或传入了非预期值。入口显式初始化 + 提交归一化可以同时消除 UI 状态残留和异常值传播。
  - Store 原本已经把缺省 `intakeState` 设为 `ready`，因此无需改变持久化格式或 Inbox 业务规则，只修正 renderer 创建参数。
- **How（怎么实现的）**：
  - 任务中心“新建” → `openModal(... localTaskDraft.intakeState = 'ready')` → composer 初始化 `ready` → 提交时 `effectiveIntakeState` 归一化 → `localTasks.create` → `task.json.intakeState`。
  - 用户切换到“收件箱，稍后整理”时，状态仍为 `inbox`，主动问询复选框行为保持不变。
- **用户须知**：
  - 现在从任务中心新建任务，默认会直接进入可执行任务列表；不需要额外点击“整理为可执行”。
  - 需要先记录、稍后补充的任务仍可手动选择收件箱。
- **已知限制**：
  - 已经创建并处于 Inbox 的历史任务不会自动迁移，需在任务详情中手动执行“整理为可执行”。
- **关联假设**：无新增待确认假设。

## [2026-08-31] 修复任务会话误恢复导致 Codex active writer 冲突

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/local-task-view-model.ts`：新增 `collectLiveTaskSessionIds`，把仪表盘卡片和 `ptyIdsByTabId` 中仍有活动 PTY 的 tab 合并为实时会话集合。
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`：任务状态校正同时使用仪表盘卡片和活动 PTY；卡片短暂缺失时不会把仍运行的任务标为待恢复。
  - `src/renderer/src/components/work-items/LocalTaskDetailAside.tsx`：会话预览恢复逻辑增加 PTY 保护；活动 PTY 存在时只调用打开工作树，不调用 AI Vault resume；按钮和说明同步显示“打开工作树查看会话”。
  - `src/renderer/src/components/work-items/local-task-view-model.test.ts`：覆盖“无仪表盘卡片但有活动 PTY”的实时会话识别。
  - `plan.md`、`PROJECT_STATUS.md`：记录恢复保护和实时性判定约定。
- **Why（为什么这么做）**：
  - 任务会话关联保存的是 Orca tab ID，而仪表盘卡片是展示投影，可能因 Agent 状态尚未上报、卡片筛选或短暂重建而缺失。仅依赖卡片会误判终端已结束。
  - 对仍有活动 PTY 的 Codex transcript 再执行 `resume` 会与原进程争用同一线程写入者，产生 `thread/resume failed ... already has an active writer`。PTY 是本地窗口是否仍承载该会话的直接证据，应优先于历史扫描结果。
- **How（怎么实现的）**：
  - renderer store `ptyIdsByTabId` + dashboard cards → `collectLiveTaskSessionIds` → 任务会话状态校正。
  - 详情恢复按钮 → 检查 `session.status` 或 `ptyIdsByTabId[sessionId]` → 有活动会话则打开工作树；仅在无活动 PTY 时扫描 Agent Session History 并尝试恢复。
- **用户须知**：
  - 只要任务对应的终端仍有活动 PTY，即使仪表盘卡片暂时未出现，任务中心也不会再次恢复 Codex 会话。
  - “在工作树中恢复”仅用于确实没有活动 PTY 的历史会话；活动会话会显示“打开工作树查看会话”。
- **已知限制**：
  - 如果 Codex 进程在 Orca 之外运行、且没有可见 PTY 映射，任务中心无法仅凭本地状态判断 active writer；此时仍可能需要用户先结束原进程再恢复。
- **关联假设**：无新增待确认假设。

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

## [2026-08-27] 删除旧任务文件兼容逻辑

- **What（做了什么）**：
  - `file-store-format.ts`：用严格 Zod schema 替换手写归一化；所有 task、session、subtask、step、turn、run 和输出字段必须完整且枚举合法，未知字段也拒绝。
  - 删除 `Completed -> Needs review`、会话 `completed -> done`、`in_progress/completed/cancelled` 别名、字符串 latestOutput 转换、task.subtasks 为空时读取 plan.json、缺字段自动补默认值、时间戳 `Date.now()` 兜底。
  - 删除已被 `currentPrompt + turns` 替代的 `initialPrompt`；创建会话参数统一改为 `currentPrompt`。
  - `store.test.ts`：删除旧格式迁移测试，新增旧状态、缺字段和未知字段必须拒绝的回归测试。
- **Why（为什么这么做）**：现有任务均可删除，不需要为测试数据持续维护迁移分支；严格单一格式能保证任务中心、Agent 和其他工具读取相同结论。
- **How（怎么实现的）**：读取 JSON → `taskSchema.safeParse` → 完整通过才返回 LocalTask；否则错误中包含具体字段路径。写入仍使用临时文件加原子 rename。
- **用户须知**：删除现有 `orca/<task-id>` 任务目录后重新创建任务。任何旧格式或手动漏字段的 task.json 都不会加载，需要按当前完整 schema 修正或删除。
- **保留的安全机制**：schemaVersion、原子写入、JSON 解析错误、文件监听错误隔离和损坏文件不覆盖。这些不是旧任务兼容。
- **验证结果**：8 个测试文件、51 项测试，Web TypeScript 和 oxlint 通过。

## [2026-08-27] 修复新增子任务与新会话的创建流程

- **What（做了什么）**：
  - `local-task-ipc-validation.ts`：`createLocalTaskSubtaskArgsSchema` 增加可选 `projectPath`，与共享参数类型和文件 Store 的任务定位参数一致。
  - `LocalTaskSubtaskCreateDialog.tsx`：选择 Agent 后先创建未绑定子任务，立即刷新详情，再启动 Agent、写入任务会话并把子任务绑定到新会话；全部成功后关闭弹窗。
  - 创建期间禁用标题、会话选择和操作按钮，防止连续点击产生重复子任务。若任务会话写入失败，关闭刚启动的标签页；若只有最后的子任务绑定失败，保留已创建会话并显示“重试绑定”，重试不会再次启动 Agent。
  - `local-task-ipc-validation.test.ts` 与 `LocalTaskSubtaskControls.test.tsx`：覆盖 `projectPath` 校验、操作顺序、成功关闭弹窗，以及绑定失败后的幂等重试。
- **Why（为什么这么做）**：严格 Zod schema 漏掉 `projectPath` 后会拒绝 UI 的合法参数；旧流程又先启动 Agent、后创建子任务，因此 IPC 失败时出现“会话已运行，弹窗未关闭，子任务不存在”的不一致状态。
- **How（怎么实现的）**：创建子任务文件 → 刷新详情 → 启动 Agent 标签页 → 创建任务会话记录 → 绑定子任务 → 关闭弹窗。失败重试分别保存已创建的子任务 ID 和会话 ID，只继续尚未完成的阶段。
- **用户须知**：选择“新建关联会话”后仍会立即发送子任务提示，但发送前子任务已经写入项目任务文件；正常成功时弹窗会自动关闭，新子任务立即显示。
- **已知限制**：远程 Web Runtime 启动由主机异步分配标签页 ID，当前本地任务绑定仍要求客户端能同步取得标签页 ID；本轮修复覆盖本机、普通 worktree、folder workspace 和 SSH 客户端可同步取得 ID 的路径。
- **验证结果**：40 项本地任务相关测试、Web TypeScript、oxlint 和 Electron 生产构建通过。

## [2026-08-27] 修复关联会话终端偶发停止实时更新

- **What（做了什么）**：
  - `terminal-preview.ts` 与 `terminal-preview-output-stream.ts`：终端预览不再按“窗口 + PTY”保存唯一订阅，而是按每次预览连接的 `previewId` 保存独立输出流；数据、重同步通知、字节确认和取消订阅都携带该 ID。
  - `AgentTerminalPreview.tsx`：每次实际连接生成新的流 ID，只接收属于当前实例的数据；组件卸载或重连时只取消自己的流。
  - `preview-grid-claim.ts`：尺寸占用也按预览实例隔离，关闭一个侧栏或弹窗不会释放另一个预览仍在使用的尺寸声明。
  - `dashboard-api.ts` 与 preload：给现有终端预览 IPC 增加可选 `previewId`，未提供时保留原调用语义。
  - 新增主进程和渲染层回归测试，覆盖同一窗口同时预览同一 PTY、关闭其中一个预览、数据按实例路由和尺寸占用独立释放。
- **Why（为什么这么做）**：事项中心复用了智能体终端预览后，同一渲染窗口可能短暂存在多个相同 PTY 的预览。旧 Map 以 PTY 为键，后连接会替换前连接；任意旧组件卸载又会无条件取消当前订阅，剩余界面因此不再收到输入回显和 Agent 输出。重新打开会建立新订阅并读取最新快照，所以只能短暂恢复。
- **How（怎么实现的）**：预览组件实例 → 生成独立流 ID → IPC connect → 主进程创建独立输出流 → 数据携带流 ID 返回 → 对应组件写入 xterm 并确认字节。关闭时以“PTY + 流 ID”精确释放，不再按 PTY 全部释放。
- **用户须知**：任务侧栏、智能体仪表盘和地图视图现在可以同时打开同一个会话；关闭任何一个入口都不会中断其他入口的实时终端。
- **已知限制**：无新增限制；旧界面未传 `previewId` 时继续使用单预览语义，便于开发热更新期间安全降级。
- **验证结果**：64 项终端预览相关测试、Web TypeScript、oxlint 和 Electron 生产构建通过。

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

## [2026-09-01] 实现全局提示词库与非模态抽屉

- **What（做了什么）**：
  - `src/shared/prompt-library.ts`：新增 `PromptLibrary` 聚合对象、`PromptLibraryCategory` 分类和 `PromptLibraryPrompt` 提示词类型；分类包含 ID/名称，提示词包含 ID/标题/正文/单一可选分类/创建时间/更新时间。新增 `normalizePromptLibrary` 统一清理损坏数据，新增 `deletePromptLibraryCategory` 在删除分类时保留提示词并移到未分类。
  - `src/shared/global-settings-types.ts`、`src/shared/default-global-settings.ts`：在当前用户资料的 `GlobalSettings` 增加原子 `promptLibrary` 设置，默认值为空分类和空提示词；没有增加项目文件、远程 wire 字段或执行主机配置。
  - `src/main/persistence/applying-settings/settings-update.ts`、`src/main/persistence/loading-store/normalize-loaded-global-settings.ts`：主进程在每次写入和每次旧资料加载时调用同一个归一化函数，确保 renderer、磁盘旧值和未来其他写入者遵守相同边界。
  - `src/renderer/src/lib/prompt-library-filter.ts`：实现提示词筛选与排序。搜索统一大小写和连续空白，同时匹配标题、完整正文与分类名称；分类筛选使用 `undefined` 表示全部、`null` 表示未分类、分类 ID 表示一个用户分类；结果按更新时间、创建时间和 ID 稳定排序。
  - `src/renderer/src/store/slices/ui.ts`：新增非持久化 `promptLibraryDrawerOpen` 和 setter。它只描述当前窗口是否显示抽屉，不写入用户资料，不改变 `activeView`。
  - `PromptLibrarySidebarEntry.tsx`、`SidebarNav.tsx`：在自动化之后、智能体仪表盘之前增加始终可见的“提示词库”入口；按钮用 `NotebookText` 图标、侧栏 token、`aria-expanded` 和 `aria-controls`，点击只切换抽屉。
  - `PromptLibrarySidebarHost.tsx`、`sidebar/index.tsx`、`AgentDashboardSidebarHost.tsx`：把提示词库抽屉挂载在侧栏剪裁边界之外；打开时关闭 Workspace 看板和智能体仪表盘，Workspace 看板或智能体仪表盘打开时反向关闭提示词库，侧栏折叠时也会关闭。
  - `PromptLibraryDrawer.tsx`：复用现有 `Sheet`、Workspace 看板外部点击处理和侧栏/状态栏尺寸常量，从侧栏右缘打开 760px 上限的非模态覆盖抽屉；支持关闭按钮、外部点击和 `Esc`，并在菜单、选择器或确认对话框打开时让内层浮层优先处理 `Esc`。
  - `PromptLibraryPanel.tsx`：实现提示词库工作区和所有数据操作。新增/编辑使用 `crypto.randomUUID` 生成稳定 ID，通过 `updateSettingsOrThrow` 写入完整聚合对象；删除提示词和分类均先确认；复制调用现有 `window.api.ui.writeClipboardText`，成功显示 1.5 秒勾选状态，保存/复制失败使用 toast 显示可读错误。
  - `PromptLibraryCategorySidebar.tsx`、`PromptLibraryPromptList.tsx`：实现全部、未分类和用户分类列表及数量；提示词行显示标题、分类、三行正文预览以及带工具提示的复制、编辑、删除图标。桌面为 180px 分类栏加提示词列表，600px 窄窗口为分类内容高度加剩余提示词列表。
  - `PromptLibraryCategoryDialog.tsx`、`PromptLibraryPromptDialog.tsx`：使用现有 Dialog、Input、Textarea、Select 和 Button 实现分类与提示词表单；标题和正文必填；分类名称在忽略大小写、前后空格和连续空白后不可重复；保存失败保留用户输入供重试。
  - `src/renderer/src/i18n/locales/en.json`、`zh.json`：补充提示词库入口、搜索、分类、表单、删除确认、复制反馈、容量上限和空状态的英文与简体中文文案。
  - `src/shared/prompt-library.test.ts`、`prompt-library-filter.test.ts`、`persistence-settings-update.test.ts`、`constants.test.ts`：覆盖默认空库、合法值往返、损坏数据、容量/长度上限、重复值、失效分类引用、分类删除保留提示词、组合搜索和持久化加载/写入。
  - `SidebarNav.test.tsx`、`PromptLibrarySidebarHost.test.tsx`、`PromptLibraryDrawer.test.tsx`、`PromptLibraryPanel.test.tsx`、`PromptLibraryDialogs.test.tsx`：覆盖不切换主页面、三类抽屉互斥、侧栏关闭、`Esc` 优先级、搜索、复制反馈、筛选不写数据、必填字段和重复分类校验。
  - `tests/e2e/prompt-library-drawer.spec.ts`：新增真实 Electron Playwright 流程，验证保持自动化页面、抽屉稳定贴合侧栏且不越出窗口、新建提示词、复制到 Electron 系统剪贴板，以及桌面与 600px 窄窗口截图。
- **Why（为什么这么做）**：
  - 现有终端快速命令的 `agent-prompt` 必须绑定具体 Agent，并面向直接启动/发送；提示词库只管理和复制任意文本。独立模型避免把两种不同权限和使用意图混在一起。
  - 分类和提示词放进一个 `promptLibrary` 设置，可以在删除分类时一次完成“移除分类 + 清空提示词分类引用”，不会在两次持久化之间留下悬空状态。
  - 复用智能体仪表盘和 Workspace 看板的 companion sheet 行为，使用户保留当前页面上下文，同时沿用已经验证过的侧栏宽度、状态栏边界、外部关闭和互斥模式。
  - 考虑过按项目文件保存，但用户确认的是所有项目共享的个人模板；因此选择当前 Orca 用户资料，并明确不把私人提示词发布给 SSH 或配对 runtime。
- **How（怎么实现的）**：
  - 数据流：提示词/分类表单 → `PromptLibraryPanel` 构造下一份完整库 → Zustand `updateSettingsOrThrow` → `settings:set` IPC → 主进程 `normalizePromptLibrary` → 用户资料持久化 → settings changed 通知其他窗口。
  - 打开流：侧栏按钮 → `promptLibraryDrawerOpen=true` → `PromptLibrarySidebarHost` 关闭其他 companion panel → `PromptLibraryDrawer` 从侧栏右缘覆盖当前主页面；整个过程不调用页面导航方法。
  - 搜索流：当前库 + 查询词 + 分类筛选 → `filterPromptLibraryPrompts` → 标题/正文/分类名匹配 → 更新时间倒序列表。
  - 复制流：提示词行复制按钮 → Electron clipboard IPC → 完整正文写入系统剪贴板 → 行内 Copy 图标切换为 Check 1.5 秒；失败只显示错误，不关闭抽屉或改变筛选。
  - 删除分类流：用户确认 → `deletePromptLibraryCategory` 删除分类 → 所属提示词 `categoryId=null` 并更新时间 → 单次全库写入。
- **用户须知**：
  - 左侧“提示词库”不属于页面 tab；打开后当前任务中心、自动化、终端 workspace 和 tab 都保持不变。
  - 数据属于当前 Orca 用户资料，对本机所有项目可见；切换项目不会切换提示词库。
  - 固定筛选项“全部提示词”和“未分类”不能删除；用户分类删除后提示词不会丢失，而是进入“未分类”。
  - 首版没有内置示例，首次打开为空；支持最多 100 个分类、500 条提示词，标题最多 120 字，正文最多 20,000 字。
- **已知限制**：
  - 首版不支持提示词变量、直接发送给 Agent、项目级提示词、导入导出、云同步或远程主机独立库。
  - 多个 Orca 窗口同时编辑提示词库时，沿用全局设置的最后一次完整写入生效语义；没有新增逐提示词并发合并协议。
  - 全套 `typecheck:e2e` 仍受仓库既有测试类型债阻塞；本次新增 E2E 文件未出现在错误列表，且真实 Electron 用例已通过。
- **关联假设**：无。本轮所有产品选择均由用户在澄清阶段确认。
- **验证结果**：117 项定向 Vitest 通过；完整 `pnpm tc` 通过；本地化目录和提取校验通过；changed-file 普通、类型感知和 React 专项质量门禁均为 0 新问题；Electron E2E 构建和 1 条完整交互用例通过；桌面与 600px 窄窗口截图已人工检查，无文本重叠或控件溢出。全仓本地化覆盖检查仍被工作区原有任务中心硬编码中文阻塞，报告中没有提示词库文件。完成通知已按要求调用飞书会话总结发送器，但 webhook 返回 `19007: Bot Not Enabled`，消息未发送。

## 2026-09-01 修复任务详情启动后会话未关联

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskAgentPicker.tsx` 新增 `persistLocalTaskSessionAssociation`，在新 Agent tab 创建成功后，使用任务 ID、项目根目录、tab ID、workspace ID 和本轮请求调用 `window.api.localTasks.createSession`；写入成功后才关闭关联会话弹窗并通知任务中心刷新。写入失败时回退到原有任务中心回调，由其再次执行幂等关联。
  - `src/renderer/src/components/work-items/LocalTaskAgentPicker.test.ts` 新增回归测试，验证会话字段完整落盘，以及 IPC 失败会向调用方传播错误。
  - `plan.md`、`ASSUMPTIONS.md`、`PROJECT_STATUS.md` 同步记录任务进度、实现假设和现状。
- **Why（为什么这么做）**：收件箱任务文件并未缺失，缺失的是启动 tab 对应的 `sessions` 记录。原实现把关联完全交给父级回调，回调与详情页面关闭/卸载存在时序风险。前置写入复用现有幂等 Store 接口，避免新增数据格式或重复的会话模型。
- **How（怎么实现的）**：Agent 选择 → 创建 tab → `persistLocalTaskSessionAssociation` 写入 `task.json.sessions` → 父级刷新并关闭任务中心；失败时 → 父级旧回调重试。
- **用户须知**：从任务详情启动 Agent 后，会话会在界面关闭前写入任务文件；同一个 tab 重复触发关联不会产生重复会话。
- **已知限制**：直接从 workspace 或普通 Agent 入口启动的会话仍不会自动归属任务，必须从任务详情启动或显式关联。
- **关联假设**：2026-09-01 任务详情启动前置关联会话。

## 2026-09-01 增加 Open 本地任务自动化模板

- **What（做了什么）**：
  - `src/renderer/src/components/automations/automation-templates.ts`：为 `AutomationTemplate` 增加可选的 `executionMode` 和 `localTaskScope` 字段；新增 `kanban-open-local-tasks-daily` 模板，默认使用 `open_local_tasks` 执行模式、当前 workspace 范围、每日 09:30 和 180 分钟错过运行宽限。
  - `src/renderer/src/components/automations/AutomationsPage.tsx`：选择模板时把执行模式、本地任务范围和兼容的 workspace/会话复用设置一并写入自动化草稿，确保“从模板开始”和编辑器内选择的结果一致。
  - `src/renderer/src/components/automations/automation-templates.test.ts`：保留四个分析模板断言，新增 Open 模板 ID、执行模式、范围和时间的回归断言。
  - `src/renderer/src/i18n/locales/en.json`、`zh.json`：补充第五个模板的中英文名称、说明和 Prompt。
  - `PRD.md`、`plan.md`、`PROJECT_STATUS.md`：记录 v2.1 需求、阶段 9.5 验收标准和当前模板列表。
- **Why（为什么这么做）**：
  - 现有调度器已经实现 `open_local_tasks`：它只筛选已整理、未归档、可用 workspace 中的 Open 任务，并按 workspace 串行启动；缺口是模板选择不会预填执行模式，用户容易误建成普通 Prompt 自动化。
  - 复用现有批次执行链路，避免新增第二套 Open 任务筛选、并发或运行记录逻辑；四个分析模板仍保持只读 AI 记录职责。
- **How（怎么实现的）**：模板卡片 → `AutomationTemplate.executionMode/localTaskScope` → `applyTemplateToDraft` 或 `openCreateDialog` → 自动化草稿显示 Open 本地任务与当前 workspace → 保存后由现有 `useAutomationDispatchEvents` 扫描并启动批次。
- **用户须知**：该模板只是新增可保存的自动化草稿，不会在选择模板时立即运行；保存并启用后，按每日 09:30 调度，默认处理当前 workspace 的 Open 本地任务，结果仍进入任务中心待审阅。
- **已知限制**：模板未新增“所有本地项目”变体；SSH 目标仍不支持 Open 本地任务自动化；批次执行仍受现有任务中心窗口、workspace 串行和重启恢复限制。
- **关联假设**：默认时间采用每日 09:30，默认范围采用当前 workspace；用户可在保存前编辑时间、范围和 Agent。
- **验证结果**：`pnpm test src/renderer/src/components/automations/automation-templates.test.ts` 通过（3 项）；`pnpm tc:web` 通过。

## 2026-09-02 修复任务归档后被 worktree 影子副本复活

- **What（做了什么）**：
  - `src/main/local-tasks/store.ts`：读取 `orca/<task-id>/task.json` 时校验文件实际根目录与 `task.projectPath`；只索引权威副本。任务位置从单一 `taskId → path` 改为 `taskId → projectPath → path`，旧调用未提供路径时按 `updatedAt` 和路径稳定选择，不再受并发扫描完成顺序影响。新增 workspace 转移：复制完整任务目录到目标 workspace，重写项目/workspace 字段，并把源 `task.json` 改成指向目标的影子副本。
  - `src/shared/local-task-types.ts`、`src/preload/api/local-task-api.ts`、`src/preload/index.ts`、`src/main/ipc/local-task-ipc-validation.ts`、`src/main/ipc/local-tasks.ts`：验收、归档、恢复和编辑请求增加可选 `projectPath`；新增 `transferWorkspace` IPC，参数包含源路径、目标项目、目标路径、目标 workspace ID 和展示名。可选路径保持旧客户端调用可用。
  - `src/renderer/src/components/work-items/local-task-center-actions.ts`：标题、描述、标签、Inbox/可执行切换、验收和归档都传递当前任务的 `projectPath`，避免同 ID 副本中错。
  - `src/renderer/src/components/work-items/local-task-workspace-transfer.ts`：新增合入目标解析，只在同一本机执行主机内，按仓库和 PR/MR 目标分支查找目标 workspace；远程 workspace 不会错误路由到本机 Store。
  - `HostedReviewActions.tsx`、`use-hosted-review-actions.ts`：Orca 直接 PR/MR 合入成功后调用任务所有权转移，随后刷新 review；合并队列尚未确认完成时不提前转移；转移失败会明确说明“合入成功，任务转移失败”，不误报成合入失败。
  - `store.test.ts`、`local-task-ipc-validation.test.ts`、`local-task-center-actions.test.ts`、`local-task-workspace-transfer.test.ts`、`use-hosted-review-actions.test.tsx`：覆盖归档副本复活、同 ID 精确写入、所有权转移、workspace 删除、IPC 参数、合入回调和远程不回退。
- **Why（为什么这么做）**：
  - 任务与 workspace 是多对一关系，但 Git worktree 会把已跟踪的任务目录检出到多个物理目录。原实现先在每个根目录过滤已归档副本，再按 ID 合并，导致新的已归档副本被丢弃，旧的 `Needs review` 副本成为唯一可见结果。
  - 没有只在 renderer 按 ID 隐藏重复项，因为 CLI、自动化、文件监听和 IPC 仍可能读写错误副本。归属判定收口在 Store，所有调用方共用同一规则。
  - 没有恢复独立数据库，因为用户确认任务先跟随 workspace；未合入 workspace 删除后不需额外保留。
- **How（怎么实现的）**：
  - 读取链路：workspace 根目录 → 读取 `task.json` → 归一化比较实际根目录与 `projectPath` → 权威副本进入索引/监听/UI，影子副本终止。
  - 写入链路：用户操作 → renderer 携带 `taskId + projectPath` → IPC 校验 → Store 直接定位权威文件 → 原子写入和变更广播。
  - 合入链路：Orca 发起 PR/MR 合入 → provider 确认成功 → 按目标分支和执行主机定位目标 workspace → 复制任务目录 → 重写目标所有权 → 源文件变为影子副本。
- **用户须知**：
  - 现有 `art-dev-fork` 中的旧任务文件不会被删除，但新版 Store 不再显示或写入它；主 workspace 中的 `Done + archivedAt` 仍是权威状态。
  - 主进程和 preload 已修改，开发环境需重启 `pnpm dev` 后才能完整加载。
- **已知限制**：
  - 手动 Git 合入、SSH/配对 runtime 和尚在 GitHub 合并队列中的 PR 不会自动转移任务所有权；这些路径没有回退为本机文件操作。
  - 当前会话没有项目指定的 `$electron` 技能，因此未执行真实 Electron 界面的“归档 → 切 Tab → 返回”验收。
- **关联假设**：`ASSUMPTIONS.md` 中“远程 workspace 任务所有权转移不回退到本机”。
- **验证结果**：55 项定向 Vitest 通过；完整 `pnpm tc` 通过；Electron 生产构建通过（仅保留仓库既有的动态导入和 CSS `::highlight` 警告）；变更文件的普通、类型感知和 React 质量检查通过；`check:max-lines-ratchet` 和 `git diff --check` 通过。`check:code-quality:changed` 因当前 Node 22 与项目要求 Node 24 的 pnpm engine 警告污染 JSON 输出而在脚本内解析失败，已使用同配置 `oxlint` 直接验证代替。完成通知已调用飞书会话总结发送器，但 webhook 返回 `19007: Bot Not Enabled`，消息未发送。

## 2026-09-02 增加已归档 Tab 和永久删除

- **What（做了什么）**：
  - `src/main/local-tasks/store.ts` 新增 `includeArchived` 列表选项和 `deleteTask`；默认列表仍排除归档，显式请求才返回归档任务。永久删除重新校验任务 ID、权威 workspace 路径、归档状态和实时会话，然后只删除 `orca/<task-id>/`。
  - `src/main/local-tasks/file-store-watch.ts` 增加目录监听解除，避免删除后继续监听旧任务。
  - `src/main/ipc/local-task-ipc-validation.ts` / `src/main/ipc/local-tasks.ts` / `src/preload/api/local-task-api.ts` / `src/preload/index.ts` 增加归档列表选项、永久删除 IPC 和跨窗口 `localTasks:deleted` 通知。
  - `src/renderer/src/components/work-items/LocalTaskQueueTabs.tsx` / `WorkItemsPrototypePage.tsx` 增加“已归档” Tab；活跃队列继续排除归档，归档 Tab 支持搜索、项目和标签筛选。
  - `local-task-center-actions.ts` / `work-item-pieces.tsx` / 相关详情组件增加恢复和永久删除操作；永久删除使用破坏性 destructive 按钮和 Dialog，展示任务名、workspace 与精确目录。
  - 新增 Store、IPC 和 UI 回归测试，覆盖归档查看/恢复、安全删除门禁、目录删除、跨窗口通知和二次确认。
- **Why（为什么这么做）**：归档是可恢复的隐藏，需要有明确的查看入口；永久删除是用户已明确授权后的不可逆操作，因此只放在已归档详情并在后端重新校验；不引入回收站，避免任务又出现第二个状态真相。
- **How（怎么实现的）**：任务中心请求 `includeArchived` → Store 扫描权威副本 → Tab 按 `archivedAt` 过滤；恢复操作只清除 `archivedAt`；永久删除则经过 Dialog 二次确认 → IPC 后端再校验 → 解除 watcher → 删除任务目录 → 广播删除事件。
- **用户须知**：活跃任务不显示永久删除；已归档任务可在 Tab 中恢复或永久删除；如果任务文件已经提交进 Git，删除后只会体现为普通 Git 删除 diff。
- **已知限制**：当前会话仍没有项目指定的 `$electron` 技能，因此没有执行真实 Electron 验收；已删除且未提交的任务文件不能通过 Orca 回收，只能尝试从 Git 历史恢复。
- **验证结果**：59 项定向 Vitest 通过；完整 `pnpm tc` 通过；Electron 生产构建通过；普通、类型感知和 React 质量检查、`check:max-lines-ratchet` 和 `git diff --check` 通过。

## 2026-09-02 修复恢复会话后右侧预览找不到 Terminal Tab

- **What（做了什么）**：
  - `src/shared/local-task-types.ts`：为 `LocalTaskSession` 增加可选 `tabId`，并新增 `RebindLocalTaskSessionTabArgs`。`id` 继续表示任务稳定的会话关联键，`tabId` 表示当前 Orca Terminal Tab。
  - `src/main/local-tasks/session-tab-mutations.ts`：新增主进程 Store mutation，按会话 ID定位权威任务文件，只更新对应会话的 `tabId`，不改变会话 ID、Codex transcript 或业务状态。
  - `src/main/local-tasks/file-store-mutations.ts`、`store.ts`、`file-store-format.ts`：导出 mutation、创建新会话时初始化 `tabId=sessionId`，并让旧 task.json 通过可选字段兼容读取。
  - `src/main/ipc/local-task-ipc-validation.ts`、`src/main/ipc/local-tasks.ts`、`src/preload/api/local-task-api.ts`、`src/preload/index.ts`：新增 `localTasks:rebindSessionTab` IPC 及严格参数校验。
  - `src/renderer/src/components/work-items/LocalTaskDetailAside.tsx`、`local-task-view-model.ts`：右侧预览优先按 `session.tabId` 查找 Dashboard card，没有该字段时回退旧 `session.id`。
  - `src/renderer/src/components/right-sidebar/ai-vault-session-launch-actions.ts`：恢复流程暴露实际创建的 Tab ID。
  - `src/renderer/src/components/work-items/LocalTaskDetailAside.tsx`、`src/renderer/src/lib/sleeping-agent-session-launch.ts`：手动恢复和自动唤醒在发生 Tab ID 重生成时回写任务映射。
  - `src/main/local-tasks/store.test.ts`：新增稳定会话 ID与新 Tab ID分离保存的回归测试。
- **Why（为什么这么做）**：
  - Orca 的 `createTab` 在 ID 冲突时会生成新 Tab，原任务仍保存旧 Tab ID，详情页按旧 ID 查不到实时卡片，于是错误显示“打开工作树查看会话”。
  - 不直接覆盖会话 `id`，避免 Codex/其他 Agent 的稳定会话关联和历史查找失效；单独保存 `tabId` 可以处理 Tab 重建、恢复和跨重启。
- **How（怎么实现的）**：
  - 新建/恢复会话 → `session.id` 保持稳定 → Orca 创建实际 Tab → `onTabCreated` 或自动唤醒拿到新 `tabId` → `rebindSessionTab` 写回 task.json → 详情预览按新 `tabId` 查找卡片。
  - 旧任务无 `tabId` 时走 `session.id` 回退路径；active PTY 与 host mirror 的重复恢复保护保持不变。
- **用户须知**：
  - 需要重启 `pnpm dev` 运行的 Orca，主进程/preload 新增的 IPC 才会加载。
  - 对已经发生过 ID 冲突的任务，重新从详情中点击一次“在工作树中恢复”或触发一次唤醒后，新的 Tab ID 会写回；之后右侧预览会跟随实际 Tab。
- **已知限制**：
  - Web runtime 的远程 Tab 创建是异步且由宿主生成 ID，本轮只保留现有远程恢复保护，未新增远程端任务映射协议。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web`、`pnpm tc:node`、`pnpm tc:cli` 通过；本地任务、IPC、视图模型和任务中心定向 Vitest 共 58 项通过。

## 2026-09-02 修正任务会话被错误绑定到普通 Shell

- **What（做了什么）**：
  - 根据任务 `lt_f3a63f1e-5000-4800-a5da-a12ea002e9c8` 的权威文件和 Orca 终端清单核对出：会话稳定 ID 为 `5026c7b8-3cd4-41bf-bcb8-3542b957242f`，错误 `tabId` 为 `60b3b65e-d84b-4458-a120-ae95b76d5b59`。
  - 终端清单证明该 Tab 只是普通 shell（无 Agent 身份，屏幕仅有 shell 提示符），不是 Codex 会话。
  - 从该任务文件移除错误 `tabId`，并把没有实际进程的会话状态从 `working` 修正为 `idle`，保留任务、会话历史和稳定会话 ID。
  - 从通用新建 Agent 启动链路撤回恢复专用的 `onTabCreated` 回调，避免新任务启动时被恢复映射逻辑干扰；恢复映射仍只在明确的恢复路径使用。
- **Why（为什么这么做）**：
  - 前一版把“激活后的当前 Tab”作为没有新 Tab 时的兜底，导致普通 shell 被错误写入任务会话的 `tabId`。
  - 新建任务和恢复旧会话是两个不同生命周期；新建任务必须以 `onFocusTerminal` 返回的新 Tab 为唯一关联来源，不能共享恢复兜底。
- **How（怎么实现的）**：
  - 新建任务：创建 Agent Tab → `onFocusTerminal(actualTabId)` → 任务会话写入同一 Tab ID。
  - 恢复旧会话：只有恢复动作明确创建新 Tab 时才允许回写 `tabId`；没有新 Tab 就不绑定当前普通 shell。
  - 数据修复：移除错误映射 → 会话标记 idle → 用户可重新点击“新建关联会话”启动真实 Agent。
- **用户须知**：
  - 需要重启 `pnpm dev` 后再测试。
  - 指定任务的旧普通 shell 绑定已清除；再次启动应创建新的 Agent Tab，而不是复用 `Terminal 1` 等普通 shell。
  - 如果旧会话没有真实 Codex transcript，它只能作为历史记录保留，不能从中恢复 Agent 进程。
- **已知限制**：
  - 当前运行中的 Orca 进程可能还持有旧内存快照；重启后任务文件修正才会完整反映到 UI。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；启动链路与本地任务相关 Vitest 37 项通过；任务文件和终端清单完成交叉核对。

## 2026-09-02 修复新建任务启动后停留在空白工作区

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskAgentPicker.tsx`：任务中心创建 Agent Tab 后，先激活任务所属 workspace，再排队聚焦该 Tab，最后写入会话关联并关闭任务中心。
  - 任务 `lt_ac202109-2f90-4ab5-867e-1f3f235dd7e3` 的现场核对确认：实际 Tab `a597d053-4d57-4dd1-b1f8-299f8ef48328` 已创建，Agent 为 Codex；画面停在 Codex 的 `Hooks need review` 信任提示，不是 Agent 未创建。
- **Why（为什么这么做）**：
  - 原链路只创建 Tab 并持久化任务会话，没有激活 `task.workspaceId`，当任务中心本身没有当前工作树时，主区域继续显示“选择一个工作区开始”，用户看不到已启动的 Tab。
  - 不把普通当前 Tab 作为兜底，避免再次把无关 shell 绑定到任务。
- **How（怎么实现的）**：
  - 选择 Agent → 创建实际 Tab → 激活任务 workspace → 延迟聚焦实际 Tab → 写入 `session.id/tabId` → 关闭任务中心。
  - Codex 首次启动若出现 hooks 信任选择，需在终端完成信任/继续；这是安全确认，不是 Orca 任务关联失败。
- **用户须知**：
  - 需要重启 `pnpm dev`/Electron 后验证。
  - 重新创建任务并点击启动后，应直接进入任务所属工作树的 Agent Tab；若出现 `Hooks need review`，选择信任并继续即可。
- **已知限制**：
  - Web runtime 的宿主 Tab 由远端异步镜像，仍需后续补充任务中心对远端创建结果的显式回写。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；任务启动、Codex 启动链路相关 Vitest 37 项通过。

## 2026-09-02 修复任务中心 Codex 首次启动被 Hooks 信任拦截

- **What（做了什么）**：
  - `src/renderer/src/components/tab-bar/QuickLaunchButton.tsx`：通用 Agent 菜单启动前复用 `TUI_AGENT_CONFIG[agent].preflightTrust`，对 Codex 任务 workspace 调用 `window.api.agentTrust.markTrusted`，再创建 Tab 和投递任务提示词。
  - 现场核对任务 `lt_2ea54dd4-1496-4a92-9461-b3447d6106e7`：任务会话 Tab `daba498a-ebae-4072-9800-bc56ca6eda2b` 已存在，Agent 身份为 `codex`，画面停在 `Hooks need review`，因此不是关联到错误任务或没有创建 Tab。
- **Why（为什么这么做）**：
  - 任务中心启动入口此前没有执行 Codex 目录信任预检，首次启动会把 Agent 停在安全菜单；任务提示词尚未进入 Codex composer，所以看起来像空会话。
  - 复用已有 `agentTrust` IPC 和 Agent 配置，不新增第二套信任机制；信任失败仍保留 Codex 自己的交互提示作为安全兜底。
- **How（怎么实现的）**：
  - 选择 Codex → 预检并写入工作区信任 → 创建 Agent Tab → 任务提示词按既有 startup/paste 链路提交。
  - 已经停在 `Hooks need review` 的旧 Tab 需要手动选择 `Trust all and continue` 或 `Continue without trusting`；确认后该 Tab 才会继续执行启动提示词。
- **用户须知**：
  - 重启 `pnpm dev`/Electron 后新逻辑生效。
  - 首次出现 Hooks 菜单时仍建议选择 `Trust all and continue`；之后同一工作区通常不会再次拦截。
- **已知限制**：
  - 本轮没有替用户点击安全确认；这是 Codex 的高风险 hooks 授权，需要用户明确选择。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；QuickLaunch、任务启动和 Codex 启动相关 Vitest 37 项通过；`git diff --check` 通过。

## 2026-09-02 修复任务启动提示词延迟到用户输入后才出现

- **What（做了什么）**：
  - `src/renderer/src/lib/launch-agent-in-new-tab.ts`：对 `launchSource: task_page` 的任务中心启动，在创建 Tab 前先将目标 workspace、repo 和终端视图设为当前；随后沿用原有 Tab 创建、startup command 投递和 Agent prompt 注入链路。
  - 现场核对任务 `lt_2ea54dd4-1496-4a92-9461-b3447d6106e7`：任务关联 Tab 已有 Codex 身份，但主区域显示空白 Codex composer；输入 `hi` 后原任务提示词才一起出现，确认是启动 Tab 被后台化/焦点错误，而不是 task.json 关联失败。
- **Why（为什么这么做）**：
  - 任务中心此前在启动器外层重复尝试激活 workspace，既可能切走新建 Tab，也不能保证启动器创建时目标 workspace 已是当前；Codex 的 argv prompt 因此留在后台 Tab，直到用户输入才显现。
  - 把激活放回创建 Tab 的公共入口，保证“目标 workspace → 新 Tab → startup command”是一个连续同步流程；普通 Tab 栏启动不改变行为。
- **How（怎么实现的）**：
  - 任务页选择 Agent → `launchAgentInNewTab({ launchSource: 'task_page' })` → `setActiveRepo`/`setActiveView('terminal')`/`setActiveWorktree` → `createTab` → `queueTabStartupCommand` → Tab 挂载后执行 Codex 命令并携带任务 prompt。
- **用户须知**：
  - 重启 `pnpm dev`/Electron 后测试。
  - 新建任务选择 Agent 后，应直接进入任务 workspace 的 Agent Tab 并自动带上任务提示词；不需要先手动发送 `hi`。
- **已知限制**：
  - 旧的空白 Tab 不会自动补发已经丢失的历史 prompt；建议关闭旧 Tab 后重新从任务详情启动一次。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；启动器、任务中心和 QuickLaunch 相关 Vitest 39 项通过；`oxlint` 和 `git diff --check` 通过。

## 2026-09-02 修复任务详情右侧终端预览输入后不刷新

- **What（做了什么）**：
  - `src/renderer/src/components/dashboard-popout/AgentTerminalPreview.tsx`：用户输入写入 `terminalPreview.input` 后增加 200ms 防抖的权威快照刷新；连续输入只在停顿后刷新一次；组件卸载时清理定时器。
  - `src/renderer/src/components/dashboard-popout/AgentTerminalPreview.test.tsx`：新增回归测试，验证输入后即使实时输出延迟也会重新调用 `terminalPreview.connect` 获取快照。
- **Why（为什么这么做）**：
  - 现场表现为“输入已成功写入，关闭重开后可见，但当前右侧预览不显示”。这说明 PTY 写入正常，问题出在实时增量流排队/ACK 或 xterm 渲染没有及时追上；只依赖实时 `terminalPreview:data` 会把正确输入暂时隐藏。
  - 快照刷新只作用于显示层，不重复发送输入、不改变 PTY 状态；防抖避免每个字符都触发一次 IPC。
- **How（怎么实现的）**：
  - 用户键入 → `terminalPreview.input` 写入 PTY → 200ms 无新输入 → `terminalPreview.connect` 获取当前序列快照 → 原子重绘 xterm → 后续实时数据继续接入。
- **用户须知**：
  - 右侧预览输入后最多约 200ms 刷新显示；如果 Agent 本身没有回显，快照也不会伪造文本。
- **已知限制**：
  - 本轮未执行真实 Electron 界面点击，只覆盖预览组件与 IPC 单元回归；若仍有个别 PTY 不刷新，需要继续采集该 PTY 的 `terminalPreview:data`/`resync` 日志。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；AgentTerminalPreview、订阅隔离和 terminal-preview IPC 测试共 55 项通过；`git diff --check` 通过。

## 2026-09-02 增加右侧会话预览跳转到终端 Tab

- **What（做了什么）**：
  - `src/renderer/src/components/dashboard-popout/AgentTerminalDialog.tsx`：在 Agent 会话预览标题栏增加带图标和 tooltip 的“跳转到终端 Tab”按钮，复用已有 reveal 参数。
  - `src/renderer/src/components/work-items/LocalTaskDetailAside.tsx`：将预览的 reveal 参数传给任务中心动作，并在嵌入式预览点击跳转后关闭右侧预览。
  - `src/renderer/src/components/work-items/LocalTaskDetailPanel.tsx`、`local-task-center-actions.ts`：支持传递 `worktreeId`、`executionHostId`、`tabId`、`leafId`；激活 workspace 后调用 `activateTabAndFocusPane` 精确定位 Tab/pane。
- **Why（为什么这么做）**：
  - 仅有“打开 workspace”会落到工作树当前 Tab，用户还要手动寻找关联 Agent；卡片本身已经有权威的 Tab 和 pane 路由信息，应直接复用。
  - 保持现有打开工作树按钮语义不变；新增按钮只负责精确跳转，不改变会话恢复或 PTY 生命周期。
- **How（怎么实现的）**：
  - 点击标题栏跳转 → `activateWorktreeFromSidebar(worktreeId, executionHostId)` → `activateTabAndFocusPane(tabId, leafId)` → 关闭任务详情中的嵌入式预览。
- **用户须知**：
  - 右侧“会话窗口”标题栏新增外跳图标；点击后会回到主终端并定位同一 Agent 分屏。
- **已知限制**：
  - 如果卡片对应 PTY 已结束，仍会定位到该 Tab/pane（若 Tab 仍存在），但不会重新启动 Agent。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；AgentTerminalDialog、LocalTaskDetailPanel 和任务中心动作测试 14 项通过；`git diff --check` 通过。

## 2026-09-02 增加会话预览精确跳转按钮

- **What（做了什么）**：
  - `src/renderer/src/components/dashboard-popout/AgentTerminalDialog.tsx`：右侧会话标题栏增加外跳图标按钮，复用卡片的 workspace、执行主机、Tab 和 pane 路由信息。
  - `src/renderer/src/components/work-items/local-task-workspace-navigation.ts`：抽出任务 workspace 导航逻辑；先激活目标 workspace，再调用 `activateTabAndFocusPane` 精确选择对应 Tab/pane；只有发现本次激活新建的 Tab 时才回写任务 `tabId`。
  - `LocalTaskDetailAside.tsx`、`LocalTaskDetailPanel.tsx`、`local-task-center-actions.ts`：贯通跳转参数和预览关闭行为。
- **Why（为什么这么做）**：
  - 原“打开 workspace”只切工作树，无法保证落到当前关联 Agent Tab；用户需要手动找 Tab，且可能误进普通终端。
  - 跳转逻辑抽成专用模块，避免任务动作文件继续膨胀超过 300 行质量门禁。
- **How（怎么实现的）**：点击图标 → 激活目标 workspace/执行主机 → 精确激活 `tabId + leafId` → 关闭右侧嵌入预览；普通 workspace 按钮仍保持原语义。
- **用户须知**：右侧会话标题栏的外跳图标会直接回到对应 Orca 终端 Tab；若 Tab 已结束但仍存在，会定位到原 Tab，不会自动启动新 Agent。
- **已知限制**：实时卡片不存在时，右侧备用历史面板没有 pane 路由，只能使用原“打开工作树”路径。
- **关联假设**：无。
- **验证结果**：`pnpm tc:web` 通过；相关 UI 和任务动作 Vitest 14 项通过；`oxlint`、`git diff --check` 通过。

## 2026-09-02 修复子任务绑定读取失效任务路径

- **What（做了什么）**：
  - `src/main/local-tasks/file-store-index.ts`：新增存在性与竞态读取保护；`findTaskWithSession`、`findSubtask`、`findStep` 遍历时跳过已删除的 `task.json`，仅在文件仍存在时把非 ENOENT 解析错误继续抛出。
  - `src/main/local-tasks/store.ts`：`knownTaskPaths` 生成器过滤并清理内存索引中的失效路径，避免后续 mutation 重复读取旧文件。
  - `src/shared/local-task-types.ts`、`src/main/ipc/local-task-ipc-validation.ts`、`src/main/runtime/rpc/methods/local-tasks.ts`：为子任务转移参数增加可选 `projectPath`，并贯通校验和 runtime 调用。
  - `src/cli/local-task-context.ts`：在 CLI 上下文返回类型中声明已有的 `ORCA_LOCAL_TASK_ROOT` 项目路径，确保 `subtask-transfer` 将其传给 runtime。
  - `src/renderer/src/components/work-items/LocalTaskSubtaskCreateDialog.tsx`、`LocalTaskSubtaskSessionSelect.tsx`、`LocalTaskSubtaskBlock.tsx`、`LocalTaskDetailPanel.tsx`：绑定已有会话和新建会话时传递当前任务项目路径。
  - `src/main/local-tasks/store.test.ts`、`src/main/ipc/local-task-ipc-validation.test.ts`、`LocalTaskSubtaskControls.test.tsx`：增加失效路径、项目路径校验和 UI 传参回归覆盖。
- **Why（为什么这么做）**：用户报告的错误发生在 `localTasks:transferSubtask`，但真正失败点是 Store 通过内存索引读取已被 workspace 删除的旧 `task.json`。此前 `get()` 已做存在性检查，而索引 mutation 没有，导致绑定已有会话与新建会话都暴露 ENOENT。把项目路径作为可选上下文传入，并在共享索引层统一跳过失效路径，兼容旧 CLI 调用且避免同 ID 影子副本误写。
- **How（怎么实现的）**：任务中心绑定 → `localTasks:transferSubtask`（携带 `projectPath`）→ `LocalTaskStore.transferSubtask` → `findSubtask(paths, subtaskId, read, projectPath)` → 跳过不存在路径/非目标 workspace → 写回目标 `task.json`。文件删除与读取之间若发生竞态，`readPresentTask` 会再次检查路径；损坏 JSON 等真实数据错误仍上抛。
- **用户须知**：需要重启 `pnpm dev`/Electron 使主进程和 preload 变更生效；任务中心新请求会显式传递 `projectPath`，旧版 CLI/runtime 请求仍可工作。任务目录已永久删除时不会自动恢复，只会报告子任务不存在。
- **已知限制**：同一子任务 ID 若所有副本都已删除，系统无法推断原内容；需要从仍保留任务文件的 workspace 恢复或重新创建。
- **关联假设**：`ASSUMPTIONS.md` 中“子任务转移按当前项目路径处理失效索引”。
- **验证结果**：定向 Vitest 59 项通过；`pnpm tc` 通过；`git diff --check` 通过。`pnpm run check:code-quality:changed` 受当前 Node 22 与仓库要求 Node 24 的已有脚本解析问题影响未能运行；直接 `oxlint` 仍报告 `store.ts` 的既有 max-lines 超限，未新增禁用规则。

## 2026-09-02 修复任务启动后关联会话未显示

- **What（做了什么）**：
  - `src/renderer/src/components/tab-bar/QuickLaunchButton.tsx`：`onFocusTerminal` 支持返回 Promise，启动流程等待回调完成。
  - `src/renderer/src/components/work-items/LocalTaskAgentPicker.tsx`：任务页启动回调先调用 `persistLocalTaskSessionAssociation` 写入 `task.json`，成功后才关闭弹窗并通知任务中心；失败时关闭刚创建的 Tab 并显示错误。
  - `src/renderer/src/components/work-items/LocalTaskAgentPicker.test.tsx`：新增异步顺序回归测试，验证 `createSession` 未完成前不会触发 `onStarted`；测试文件改为 `.tsx` 以承载组件 JSX。
- **Why（为什么这么做）**：截图中的 Tab 已存在，但任务详情会话数仍为 0。原链路把 Tab 创建视为立即成功，`createSession` 由后续任务中心回调异步执行；任务面板关闭、刷新或 IPC 失败时，运行表面与 `task.json` 事实会脱节。以会话持久化完成作为启动成功门槛，可让 UI 只在事实已落盘后继续。
- **How（怎么实现的）**：选择 Agent → 创建 Tab → 等待 `persistLocalTaskSessionAssociation`（`createSession`）→ 触发 `onStarted` → 任务中心幂等刷新/关闭。异常路径为 `createSession` 失败 → 关闭新 Tab → 显示具体错误。
- **用户须知**：重启 Electron 后，任务页启动 Agent 会先保存关联会话；若保存失败会提示错误并清理 Tab，不会再出现“Tab 已启动但关联会话为 0”的静默状态。普通 Tab 栏启动不受影响。
- **已知限制**：任务文件本身已被删除或 workspace 路径失效时，持久化仍会失败；需要恢复任务目录后再启动。
- **关联假设**：`ASSUMPTIONS.md` 中“任务启动以会话持久化完成作为成功条件”。
- **验证结果**：AgentPicker、QuickLaunch、任务中心动作和子任务控制相关 Vitest 25 项通过；`pnpm tc` 通过；`git diff --check` 通过。

## 2026-09-03 修复任务启动 ENOENT、简化关联会话流程并清空现场任务

- **What（做了什么）**：
  - `src/main/local-tasks/store.ts`：`get` 读取任务文件时增加存在性竞态保护；若 workspace 在检查和读取之间被删除，则清理对应任务 ID 的索引路径并返回 `null`。`latestKnownPath` 逐个检查、读取、清理失效路径后再按 `updatedAt` 选择最新副本；真实存在但 JSON 损坏的文件仍继续抛出原始校验错误。
  - `src/main/local-tasks/store.test.ts`：新增“较新的索引副本被删除后仍可创建会话”回归测试，覆盖失效路径清理后回退到仍存在任务文件的场景。
  - `src/renderer/src/hooks/useLocalTaskComposer.ts`：新建 workspace 后关联已有 Terminal Tab 时，把刚创建任务返回的 `task.projectPath` 传入 `localTasks.createSession`，消除主进程通过任务 ID 猜路径的分支。
  - `src/renderer/src/components/work-items/local-task-center-actions.ts`：删除父层对同一 Tab ID 的第二次 `createSession` 调用；现在只读取最新任务快照、更新 UI 并关闭任务中心。AgentPicker 已完成的会话写入仍是唯一持久化操作。
  - `/Users/lmy/proj/Tile/BallsOutProj/orca/`：按用户授权删除全部 4 个 `lt_*` 目录（其中 2 个目录缺少 `task.json`），未删除项目业务代码或 `orca` 外文件。
- **Why（为什么这么做）**：
  - 报错不是某个新任务自身损坏，而是文件型 Store 的全局任务索引包含已被 workspace 删除的路径；启动新会话时，唯一性检查扫描该索引并读取失效文件，底层 `ENOENT` 冒泡，导致所有任务都无法启动。
  - 项目路径是任务文件所有权的既有事实，显式传递它比按 ID 在多个 workspace 副本中猜测更可靠。读取竞态必须在 Store 边界消化，否则外部删除、合入或清理都会把文件系统瞬时状态暴露给 UI。
  - 原先“AgentPicker 写入一次 + 父层回调再写一次”的双写只是在依赖幂等性兜底，增加 IPC 和文件扫描次数；保留一个写入屏障即可满足“写入成功后才关闭页面”的时序要求。
- **How（怎么实现的）**：
  - 任务页选择 Agent → `QuickLaunchAgentMenuItems` 创建真实 Terminal Tab → `LocalTaskAgentPicker.handleStarted` 等待一次 `localTasks.createSession({ taskId, projectPath, sessionId: tabId, ... })` → 成功后调用父层 `sessionStarted` → `localTasks.get(taskId, projectPath)` 刷新任务 → 关闭任务中心。
  - Store 读取链路：`get/latestKnownPath` → `existsSync` + `readLocalTaskFile` → 文件在竞态中消失则移除 `locations[taskId]` 对应路径并返回空 → 仍存在但内容非法才抛出明确 schema 错误。
- **用户须知**：
  - 修改主进程、preload 或 renderer 后需重启 `pnpm dev`/Electron 才会加载新代码。
  - `BallsOutProj` 的任务中心现在为空；删除的任务目录若未提交到 Git 不可恢复，需要重新创建任务。
  - 关联会话启动只写一次任务文件；Store 仍对相同 session ID 幂等，CLI/runtime 的惰性绑定不受影响。
- **已知限制**：
  - 任务目录被永久删除后无法从 Store 推断标题、描述或历史会话；只能依靠 Git 中已提交的 `orca/lt_*` 文件恢复。
  - 本次修复处理的是本机项目文件；SSH/配对 runtime 的任务文件仍需在执行主机上实现对应 Store/RPC 才能支持同等清理语义。
- **关联假设**：`ASSUMPTIONS.md` 中“清空 BallsOutProj 现场任务目录”。
- **验证结果**：Store、runtime RPC、IPC 校验 54 项通过；AgentPicker、任务中心动作、子任务控制 15 项通过；`pnpm tc:web` 通过；`git diff --check` 通过。当前 Node 为 22，而仓库声明 Node 24，因此仅出现 engine warning。

## 2026-09-03 从任务详情移至收件箱

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/work-item-pieces.tsx`：在详情底部 `LocalTaskActions` 中，把非收件箱任务的收件箱入口渲染为带 `Inbox` 图标和“移至收件箱”文字的 `outline` 次要按钮；收件箱任务仍显示原有“整理为可执行”主按钮，归档任务仍只显示恢复/永久删除操作。
  - `src/renderer/src/components/work-items/work-item-pieces.test.tsx`：断言 ready 任务能看到“移至收件箱”、不会错误显示“整理为可执行”，并验证点击会触发回调。
  - `src/main/local-tasks/store.test.ts`：新增 Store 回归测试，确认只更新 `intakeState` 时 `projectId`、`projectPath`、`workspaceId`、workspace 展示名、业务状态、会话和子任务完全保持不变。
  - `PRD.md`、`plan.md`、`PROJECT_STATUS.md`：记录 v2.6 需求、阶段 11.7 checklist、详情入口和数据不变规则。
- **Why（为什么这么做）**：
  - 用户需要把已经记录的任务退回收件箱继续整理，但不希望改变任务实际所属项目或代码 workspace。详情底部已经是任务生命周期操作的集中区域，复用它能保持入口范围明确。
  - 原实现虽然已有图标按钮，但仅靠图标不够直观；可见文字能让“移至收件箱”和已有“整理为可执行”形成清晰的往返关系，也符合操作栏的可访问性要求。
- **How（怎么实现的）**：
  - 任务详情 → `LocalTaskActions` → `onMoveToInbox` → `createLocalTaskCenterActions.moveSelectedToInbox` → `window.api.localTasks.update({ taskId, projectPath, updates: { intakeState: 'inbox' } })` → 主进程 Store 原子写回同一份 `orca/<task-id>/task.json`。
  - Store 使用现有合并更新逻辑，仅覆盖 `intakeState` 和 `updatedAt`；项目、workspace、状态、会话、子任务及执行记录沿用原对象，不复制或迁移任务目录。
- **用户须知**：
  - 在任务详情底部点击“移至收件箱”后，任务会从可执行任务筛选中移到“收件箱”Tab；之后可在同一位置点击“整理为可执行”返回 `ready`。
  - 该操作不会自动启动 Agent，也不会改变任务状态或 workspace；看板和列表卡片没有新增按钮。
- **已知限制**：
  - 本轮没有增加“移出收件箱”的新数据模型或拖拽入口；移出仍复用现有“整理为可执行”操作。
  - 真实 Electron 界面验收未执行；当前环境未提供项目要求的 `$electron` skill，已通过组件/Store 定向测试覆盖行为。
- **关联假设**：无（项目归属保留、详情页入口和复用现有整理按钮均已由用户明确确认）。
- **验证结果**：详情动作与 Store 定向测试通过；随后运行 `pnpm tc:web` 和 `git diff --check`。已尝试发送飞书完成通知，但 webhook 返回 `Bot Not Enabled`（机器人未启用），因此通知发送失败。

## 2026-09-03 任务中心“可执行”队列排除收件箱

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskQueueTabs.tsx`：把本地任务队列标识从泛化的 `all` 改为 `ready`，界面标签从“全部”改为“可执行”；`isLocalTaskInQueue` 只把 `intakeState = ready` 且未归档的任务放入该队列。
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`：任务中心默认打开 `ready` 队列，使首次进入页面直接显示已整理任务。
  - `src/renderer/src/components/work-items/use-local-task-center-interactions.ts`：从 AI 记录打开关联任务时，根据任务的 `intakeState` 选择“可执行”或“收件箱”，避免收件箱任务被新筛选规则隐藏后无法打开详情。
  - `src/renderer/src/components/work-items/LocalTaskQueueTabs.test.tsx`：新增 ready、inbox、archived 三类整理/归档状态的队列归属和数量测试，并覆盖 Open、In progress、Needs review、Done 四种业务状态。
  - `PRD.md`、`plan.md`、`PROJECT_STATUS.md`：记录 v2.7 规则、阶段 11.8 checklist 和当前实现状态。
- **Why（为什么这么做）**：
  - 原“全部”队列只排除了归档任务，会同时显示已整理任务和收件箱草稿，用户无法把可继续处理的任务与尚未整理的输入分开。
  - “可执行”在本入口表示 `ready` 整理状态，而不是批量执行器的严格候选条件；继续保留所有业务状态，可以让用户在同一入口查看已经整理的进行中、待审阅和已完成任务。
- **How（怎么实现的）**：
  - 任务加载 → `isLocalTaskInQueue(item, queueView)` → `ready` 队列要求未归档且 `item.intakeState === 'ready'` → 搜索和标签筛选继续沿用原链路 → 看板或列表渲染。
  - “收件箱”仍要求 `intakeState = inbox`；“已归档”仍以 `archivedAt` 为准；批量执行器仍单独检查 `Open + ready + workspace 可用 + 无运行记录`，本次没有改变执行资格。
- **用户须知**：
  - 任务中心原“全部”Tab 现在显示为“可执行”；移入收件箱后，任务及其数量会立即从“可执行”消失，只在“收件箱”显示。
  - In progress、Needs review 和 Done 任务只要已经整理且未归档，仍会出现在“可执行”；这不代表它们会被“执行当前所有任务”按钮再次启动。
- **已知限制**：
  - 当前环境未提供项目要求的 `$electron` skill，因此没有执行真实 Electron 窗口验收；筛选、文案和计数通过组件测试验证。
  - 全分支 changed-file 质量门禁仍报告本次范围外的既有问题：`src/main/local-tasks/store.ts:411` 使用 `Array<T>`；本次四个 TypeScript/TSX 文件的定向 `oxlint` 无新增问题。
- **关联假设**：无（用户已明确确认“可执行”包含所有已整理且未归档任务，不按业务状态缩小）。
- **验证结果**：任务队列 Vitest 3 项通过；`pnpm tc:web` 通过；本次文件定向 `oxlint`、`oxfmt --check` 和 `git diff --check` 通过。全分支 changed-file 质量门禁因上述既有 `Array<T>` 问题失败。飞书完成通知已尝试发送，但 webhook 返回 `19007 / Bot Not Enabled`，因此未送达。

## 2026-09-05 任务系统整体诊断与整改方向

- **What（做了什么）**：
  - 新增 `docs/task-center-redesign-review.md`，梳理原 Orca 能力与任务分支的职责、实际持久化位置、状态写入与展示链路、自动化执行条件、审阅入口和子任务归属；区分已验证缺陷、静态风险与建议改变的产品约定。
  - 更新 `plan.md`，增加本轮诊断 checklist、具体检查步骤及验收标准；该计划只覆盖诊断交付，不代表已授权实施整改。
  - 更新 `PROJECT_STATUS.md` 的日期并添加最新诊断，明确同工作区串行、任务视角状态和任务页面存活依赖的旧描述与当前源码不一致。
  - 在本文件追加分析过程与验证结果。未修改应用代码、PRD、已有假设或用户任务数据；所有既有暂存修改保持原样。
- **Why（为什么这么做）**：
  - 用户希望从管理多个 AI 会话转向快速了解改动与做决定；当前任务详情仍主要呈现执行过程，状态又被任务文件、会话、批次和界面存活检测多方控制。
  - 只修按钮、增加摘要模板或替换存储技术不能解决历史结果重复催审、当前交付版本不清和用户决定无闭环的问题；因此先提出职责收缩与分阶段验收，保留现有终端和工作区基础设施。
- **How（怎么实现的）**：
  - 本地 main 差异与需求文档 → 领域类型和存储 → 启动与状态事件 → 页面展示和审阅操作 → 现有测试与临时目录调用 → 整改建议。
  - 运行 Store、收件箱、展示状态、队列组件和自动化服务 5 个测试文件，59 项全部通过。另使用当前源码临时构建存储和展示转换模块，在自动清理的临时目录创建测试任务，确认工作中事件误结束运行、恢复后活动会话误判、新标签输出关联失败、问题字段展示丢失、追问后的文件与界面状态冲突五种结果。
  - 建议将目标、执行轮次、待处理结果明确归属：旧会话保留历史，本轮交付承载证据和问题，决定绑定交付版本；同一可写目录先限制为一个执行者，真正并行时复用隔离工作区。
- **用户须知**：
  - 诊断文档包含四阶段整改顺序、每阶段验收标准和常规/失联场景。任务脱离工作树长期存储、子任务退为检查清单、默认主会话和无仓库收件箱均是待讨论方案，没有当作已确认需求落实。
  - 当前任务记录主体是项目 JSON 文件，Orca 用户资料主入口也是 JSON；部分 Agent 会话历史来自各自数据库。不能把现状误认为一个统一的任务数据库与 Git 双向同步系统。
- **已知限制**：
  - 未运行真实 Electron 界面、真实远程主机或完整应用测试；批次并发和无窗口限制是静态调用链证据。运行测试的 Node 为 22.21.1，项目声明为 24，本轮结果不代替目标版本验证。
  - 本轮没有修复发现的缺陷，也没有执行任何任务迁移。已尝试发送飞书摘要，但返回 `19007 / Bot Not Enabled`（机器人未启用），通知未送达。
- **关联假设**：无新增执行假设；尚未批准的产品取舍集中写在诊断文档末节。

## 2026-09-05 收缩为任务上下文与会话索引

- **What（做了什么）**：
  - 根据用户反馈修正 `docs/task-center-redesign-review.md` 第 12 节：移除验收要求、执行请求、待处理事项、阅读位置、产物关联、AI 摘要副本和重型子任务模型。
  - 明确 `task.json` 只保存任务基础信息、项目/workspace 指向、状态和可跳转会话索引；完整会话内容继续使用原 Orca 会话记录。
  - 明确任务目录继续保留 `prd.md`、`plan.md`、`records.md`：分别记录背景目标、准备做什么、已经做了什么；取消 `plan.json` 和 Markdown 到 JSON 的双写。
  - 明确多会话用途：同一任务下可以分别进行实现、方案比较、代码审查和现状讲解；后续研究先写入 `plan.md`，真正执行时再从任务中创建会话。
- **Why（为什么这么做）**：
  - 用户的实际决策依据是 AI 完整会话，而不是压缩摘要；任务中心应解决会话聚合和跳转，不应重新复制一个不完整的会话系统。
  - `prd / plan / records` 已经承担长期上下文、计划和历史记录，额外结构化字段会导致同一事实多处维护并产生矛盾。
- **How（怎么实现的）**：
  - 任务目录 → `prd.md`（目标）/`plan.md`（计划）/`records.md`（事实记录）；任务中心读取 `task.json.sessions` 展示会话用途和跳转；原 Orca transcript 负责完整消息、工具调用和运行状态。
  - 任务状态只保留用户能理解的 Open、In progress、Needs review、Done；运行中和待审阅由原会话事实及每个会话的 `reviewed` 标记计算，不再维护 runs、executionState、latestOutput 等并行状态。
- **用户须知**：
  - 这个模型不承诺 AI 自动生成完整交付卡；首要体验是从任务快速找到正确会话并阅读完整记录。
  - 已知项目任务仍使用 `<projectRoot>/orca/<task-id>/`。项目未知的收件箱任务放在哪里尚未最终确认，当前建议是用户资料目录下的 `task-inbox/<task-id>/`，整理时再移动到项目目录。
- **已知限制**：
  - 需要原 Agent 会话记录仍然可读；日志被删除或解析器不支持时，任务只能显示会话索引，不能恢复完整内容。
  - `reviewed` 是“处理过该会话结果”的标记，不是逐行阅读进度；同一任务多个会话的用户决定仍由用户在对应会话或 `records.md` 中表达。
- **关联假设**：无新增假设；本记录区分了用户已明确的删减项与尚待确认的收件箱目录位置。

补充：本轮再次尝试发送飞书摘要，仍返回 `19007 / Bot Not Enabled`（机器人未启用），未送达。

## 2026-09-05 明确待办与步骤的状态归属

- **What（做了什么）**：在 `docs/task-center-redesign-review.md` 第 12.6 节明确：任务待办是软件管理的轻量对象，保存 `todo`、`doing`、`done`、`cancelled` 四种状态；步骤不再是任务层对象，作为会话内部临时执行计划保留在原会话或 Agent 计划中。
- **Why（为什么这么做）**：待办需要在任务中心筛选、跨分支保留并表示“准备做什么”，所以必须脱离 Markdown 和 Git 持久化。步骤只服务当前会话执行，若再作为任务子对象维护，会重新引入会话绑定、移交和双重状态同步等已确认过重的设计。
- **How（怎么实现的）**：软件任务记录保存待办的 `id`、所属任务、标题、状态、顺序和时间；`plan.md` 继续保存可读计划，但不从文本自动推断状态。会话内可自行拆步骤，任务中心不持久化或计算步骤完成比例；需要长期跟踪的步骤由用户显式提升为任务待办。
- **用户须知**：`doing` 只表示有会话正在处理待办，不表示待办被某个会话独占；多个会话可以围绕同一待办工作。待办完成后，事实可追加到 `records.md`，但软件状态和 Markdown 不互相覆盖。
- **已知限制**：当前不提供跨会话步骤进度和步骤级筛选；只有在实际使用证明需要时，才另行设计会话计划能力。
- **关联假设**：无；四种待办状态和步骤降级为会话内部计划是本轮建议，尚未进入代码。

## 2026-09-05 修正任务主记录与收件箱文件边界

- **What（做了什么）**：
  - 修正 `docs/task-center-redesign-review.md` 第 12.1、12.2、12.4、12.5 节：去掉项目目录 `task.json` 作为任务主记录的方案；任务状态、待办状态、项目/workspace 指向和会话关系改为由 Orca 软件持久化。
  - 保留项目目录中的 `prd.md`、`plan.md`、`records.md`，分别作为背景目标、准备做什么、已经做了什么的可读上下文；它们不参与任务状态或会话关系判断。
  - 明确收件箱任务先存在软件记录或软件管理的临时目录；转为可执行并选择项目与 workspace 后，才创建或移动三份 Markdown 文件到 `<projectRoot>/orca/<task-id>/`。
  - 明确切换分支或 worktree 不会删除软件任务；当前检出分支缺少上下文文件时，只显示文件不可用，不影响任务和会话入口。
- **Why（为什么这么做）**：
  - 把 `task.json` 放在项目分支会导致切换分支、切换 worktree 或删除执行目录后任务消失，违背任务作为长期管理对象的目标。
  - 三份 Markdown 的价值是让其他任务或未安装任务功能的 Agent 读取上下文，不应同时承担状态数据库职责。
- **How（怎么实现的）**：
  - 软件任务记录 → 状态、待办、项目/workspace 和会话索引；项目上下文目录 → `prd.md` / `plan.md` / `records.md`；任务从 Inbox 转可执行时执行上下文文件落位。
  - `plan.md` 写入计划不会自动改变软件待办状态；用户明确加入待办时才写入软件记录，待办状态使用 `todo` / `doing` / `done` / `cancelled`。
- **用户须知**：
  - 新方案不生成或同步 `task.json`、`plan.json`；软件持久化的具体载体（现有用户数据文件或独立 SQLite）尚待实现阶段决定，但必须与 Git 分支解耦。
  - 收件箱未整理时可以没有项目和 workspace；转为可执行是一次明确的项目/workspace 选择和上下文文件落位操作。
- **已知限制**：
  - 如果项目分支没有提交三份 Markdown，其他 Agent 只能读取软件任务记录中的基本信息，无法读取完整上下文；任务中心应明确提示文件缺失。
  - 本轮只更新设计记录，没有实现新的持久化适配器或收件箱迁移。
- **关联假设**：无；软件持久化主任务、项目 Markdown 上下文、收件箱临时存储是用户本轮明确的边界。

## 2026-09-05 收件箱先由软件持久化，转可执行后落位项目文件

- **What（做了什么）**：
  - 在 `docs/task-center-redesign-review.md` 第 12.4 节补充最终边界：收件箱未确定项目时，任务状态、待办和会话关系只存在 Orca 软件管理的任务存储；允许使用软件管理的临时上下文目录，也允许暂不创建 Markdown 文件。
  - 明确用户执行“转为可执行”并选择项目与 workspace 后，软件才创建或移动 `prd.md`、`plan.md`、`records.md` 到对应项目的 `orca/<task-id>/`。
  - 明确项目分支中不存在这三份文件时，任务仍保留在软件任务存储中；缺少的只是当前分支可读上下文。
  - 说明软件存储的具体适配器可复用现有 `orca-data.json` 或使用独立任务数据文件，但不能放进 Git 分支，也不能要求提交后任务才存在。
- **Why（为什么这么做）**：
  - `task.json` 跟随项目分支会导致切换分支、切换 worktree 或删除执行目录时任务消失；这与任务的长期管理属性冲突。
  - 收件箱本来就是尚未决定项目的内容，先写入某个项目会制造错误归属；只有整理为可执行时才应该确定代码上下文。
- **How（怎么实现的）**：
  - 软件任务记录：任务基础信息、待办状态、项目/workspace 指向、会话索引和任务状态。
  - 收件箱阶段：项目/workspace 可为空；上下文文件可在软件临时目录或延后创建。
  - 转为可执行：用户选择项目/workspace → 写入或移动三份 Markdown → 更新软件任务记录的项目/workspace 指向；Markdown 始终不参与状态和会话关系判断。
- **用户须知**：任务主记录不是 `task.json`；切换分支不会让任务消失。`prd.md`、`plan.md`、`records.md` 是否在当前分支可见，只影响没有任务插件的 Agent 能否读取这份上下文。
- **已知限制**：本轮没有确定 `orca-data.json` 与独立任务文件的最终适配器，也没有实现收件箱临时目录或转项目时的文件移动。
- **关联假设**：无；软件持久化任务主记录、收件箱延后选项目、转可执行后落位三份项目 Markdown 是用户本轮明确的边界。

## 2026-09-05 完成任务中心重构实现文档

- **What（做了什么）**：新增 `TASK_REDESIGN_IMPLEMENTATION.md`，把已确认的任务、子任务、步骤、会话、workspace、收件箱、持久化、状态聚合、会话中断、删除和验收流程整理成实现级文档。
- **Why（为什么这么做）**：前面多轮讨论已经确定不兼容旧任务、不引入执行请求和独立交付卡，但仍需要一份能直接指导 `kanban2` 开发的统一约定，避免实现时重新引入旧的批次和双重状态模型。
- **How（怎么实现的）**：文档规定任务主记录由 Orca 软件持久化；项目只保存 `prd.md`、`plan.md`、`records.md`；子任务可以先创建、之后一一绑定会话；步骤归属于子任务；任务状态按所有关联会话聚合，断连和关闭进入待审阅提醒。
- **用户须知**：文档是实现前设计，不代表本轮已经切换到 `kanban2` 或修改业务代码。暂不执行的方向可以先写入 `plan.md`，需要长期跟踪时创建无会话子任务，再启动对应会话。
- **已知限制**：第一版不接入旧批次执行、旧自动化模板、旧 AI 记录流和旧任务兼容逻辑；正常停止、窗口关闭、网络断开在任务层统一提醒检查，但不自动宣称远程进程已退出。
- **关联假设**：无；本条只记录已确认方案及其实现顺序。

## 2026-09-05 补充 kanban1 能力盘点

- **What（做了什么）**：在 `TASK_REDESIGN_IMPLEMENTATION.md` 增加第 9、10 节，对 `kanban1` 的任务中心 UI、项目筛选、标签、会话启动/恢复、CLI/RPC、文件监听、删除保护、批量执行、AI 记录和自动化逐项分类。
- **Why（为什么这么做）**：只记录新领域模型容易遗漏已有产品能力；逐项分类可以在 `kanban2` 复用成熟的导航和启动基础设施，同时明确不把旧批次、旧 JSON 记录和兼容逻辑整套搬回去。
- **How（怎么实现的）**：`kanban1` 源码 → 类型、Store、IPC、CLI、任务页面、自动化调用链 → 按“保留并重做 / 重新定义 / 暂不带入 / 非任务基础设施”归类；最终主链路限定为软件任务记录 → 子任务/步骤/会话索引 → 原生 Agent/Terminal → 状态聚合 → 三份项目 Markdown。
- **用户须知**：任务列表、看板/列表、搜索、标签、workspace 选择、会话跳转、断连提醒和启动清理仍在范围内；批量执行、定时自动化、AI 记录 Tab、旧任务兼容和 worktree 影子文件不在第一版。
- **已知限制**：盘点基于 `kanban1` 静态源码，未逐个做 Electron 视觉回归；需要实现阶段用新模型测试会话启动、恢复、远程失联和删除边界。
- **关联假设**：无；分类以用户已确认的 `kanban2` 新模型为准。

## 2026-09-05 根据使用场景修正任务重构建议

- **What（做了什么）**：在 `docs/task-center-redesign-review.md` 增加第 11 节及优先级提示，记录用户明确不需要旧任务兼容、多会话必须保留、完整会话是决策依据、任务内需要延后待办；修正上一轮主会话、交付卡和旧数据迁移的建议。
- **Why（为什么这么做）**：方案比较、独立审查和现状讲解需要多个不同目的的会话；摘要不能替代证据，任务内每次新会话也不应强制制造一个新任务或重型子任务。
- **How（怎么实现的）**：核对 main 增量的模块分布，检查当前任务问答记录的 30 轮上限，并确认原 Orca 已有完整会话读取和实时订阅能力；据此建议干净分支重建任务层，复用原会话能力和轻量待办关联。
- **用户须知**：本轮仍是设计讨论，未切换分支、修改功能、清理旧数据或执行兼容迁移；干净分支和存储形式尚为建议。旧任务兼容不再是需求，但原 Orca 支持的不同 Agent、平台和远程主机仍需按实际能力处理。
- **已知限制**：自动进展概括必须显示来源及更新时间；只读会话不能仅靠提示词获得写入隔离；日志缺失和同目录并发改动会限制历史还原及代码归因。未执行新的功能测试。
- **关联假设**：无；明确区分用户约束和待讨论实现方案。

# 2026-09-06：kanban1 状态规则第一步

- **What**：新增 `src/shared/local-task-status.ts` 作为任务状态聚合规则；`store.ts` 写入时统一应用规则并禁止存在运行会话时验收；`file-store-mutations.ts` 修正首次启动和并行会话报告；`session-output-mutations.ts` 只在对应执行会话结束时结束其执行记录，备注编辑与 working 事件不再误触发；`file-store-index.ts` 支持当前终端 Tab 标识定位稳定会话；`local-task-view-model.ts` 复用状态规则并按恢复后的 Tab 判断页面活动记录。
- **Why**：原逻辑优先检测已结束会话，使并行任务提前进入待审阅；同一会话恢复后的 Tab 与稳定标识不同，状态事件无法找到归属。全新临时数据可复现，清旧数据无法修正逻辑。
- **How**：Orca 会话事件 → 定位稳定会话 → 更新该会话 → 运行优先聚合父任务 → 发布原页面数据。保留现有 UI 组件和数据接口，继续分阶段替换底层；本阶段尚未完成软件持久化和一对一关系。
- **验证**：新增回归测试在修改前稳定出现 6 项失败；修正后本地任务 Store 与页面状态测试共 53 项通过。web 类型检查通过；node 类型检查发现新测试跨 renderer 导入（已移除）及原有 `cdp-print-to-pdf.ts` 与当前 Electron 类型不匹配，后者不属于本次改动。
- **已知限制**：页面仍沿用 kanban1 的活动会话投影；断连语义和待查看数量将在后续接通，不能将本次提交视为完整重构交付。

## 2026-09-07：任务元数据接入 Orca 软件持久化

- **What（做了什么）**：`PersistedState` 增加 `localTasks`；主 `Store` 增加读取、保存、删除任务元数据的方法；任务 IPC 注册时把主 Store 注入 `LocalTaskStore`。`LocalTaskStore` 支持软件持久化适配，并只在任务 workspace 创建 `prd.md`、`plan.md`、`records.md`，不创建 `task.json`；新任务自动包含未开始的“实现：任务标题”默认子任务。
- **Why（为什么这么做）**：任务状态、步骤和会话关系必须跨分支、跨 workspace 文件变化继续存在，不能以 Git 工作区文件作为真相。三份 Markdown 继续服务于其他 AI 续接，但不参与状态判断。
- **How（怎么实现的）**：IPC → `LocalTaskStore(profilePersistence)` → 主 `Store.state.localTasks` → 统一持久化写入；任务上下文文件仅在创建时补齐。文件 Store 代码暂时保留供现有定向测试和后续清理使用。
- **用户须知**：软件重启会从 `orca-data.json` 读取任务元数据；切换分支不会删除任务；任务目录只包含三份上下文 Markdown。当前没有旧任务数据迁移，已有旧文件不会自动导入。
- **已知限制**：收件箱尚未完全脱离 workspace 路径；生产代码仍保留文件 Store 的旧扫描和移交入口，下一阶段清理。主进程全量类型检查仍受既有 `cdp-print-to-pdf.ts` 的 Electron 类型错误阻塞。

## 2026-09-07：收敛 Agent 提示和任务详情文案

- **What（做了什么）**：`local-task-agent-prompt.ts` 改为要求 AI 只维护当前子任务，不创建或移交子任务，也不读取任务 JSON；`LocalTaskDetailPanel.tsx` 将旧的 `task.json` 提示改为 Orca 任务记录。
- **Why（为什么这么做）**：任务元数据已经由软件持久化，旧提示会诱导 AI 继续使用已取消的文件真相和复杂移交流程。
- **How（怎么实现的）**：任务中心启动会话时注入新的约束说明，用户继续通过完整会话记录决策；详情文案只说明软件保存位置。
- **用户须知**：AI 会话中的相近需求继续归入当前子任务；独立方向由用户在任务中心新建关联会话。
- **已知限制**：CLI 仍保留旧的 `subtask-transfer` 命令以避免破坏现有运行链路，后续清理阶段再移除。

## 2026-09-07：子任务会话归属改为只读展示

- **What（做了什么）**：`LocalTaskSubtaskBlock.tsx` 移除详情中的会话选择器和移交确认弹窗，改为显示当前子任务已绑定的会话名称；`LocalTaskDetailPanel.tsx` 不再向子任务块传递转移所需参数。
- **Why（为什么这么做）**：产品规则是一会话对应一个子任务，用户通过新建关联会话表达新方向，不修改既有子任务归属。
- **How（怎么实现的）**：任务数据仍保存稳定会话 ID，详情只做 ID 到会话标题的只读映射；创建子任务和创建会话仍沿用原 kanban1 入口。
- **已知限制**：旧 CLI/RPC `subtask-transfer` 仍存在，尚未删除其命令协议和历史测试。

## 2026-09-07：删除子任务移交协议

- **What（做了什么）**：删除 `subtask-session-assignment.ts`、子任务会话选择器及其历史 UI 测试；从共享类型、主进程 IPC、RPC 方法、preload API、CLI handler 和 CLI spec 中删除 `TransferLocalTaskSubtaskArgs`、`localTask.transferSubtask` 和 `orca local-task subtask-transfer`；更新任务中心创建流程，创建子任务时直接使用新建会话完成绑定；更新 RPC/Store 测试以覆盖新的默认子任务规则。
- **Why（为什么这么做）**：已确认子任务与会话一一对应，用户通过新建关联会话表达新方向，移交既有子任务会产生额外心智成本和不明确的责任边界。
- **How（怎么实现的）**：会话创建 → 默认未绑定子任务绑定，或新增一个绑定当前会话的子任务 → 详情只读显示会话标题。跨会话修改会被现有归属校验拒绝，用户无需再确认“移交”。
- **验证**：任务 Store、任务 RPC、Agent 提示相关测试共 51 项通过；Web 类型检查通过；源码搜索不再发现移交协议生产引用。
- **已知限制**：文件 Store 的旧扫描、`task.json` schema 和过渡测试仍保留在 `src/main/local-tasks`，生产 IPC 已注入主 Store；下一阶段可在补齐收件箱和迁移清理后删除整套文件兼容代码。

## 2026-09-07：收件箱创建不再写入 workspace

- **What（做了什么）**：`CreateLocalTaskArgs.projectPath` 和 IPC 创建参数改为可选；没有项目路径的收件箱任务使用空路径保存在 Orca 主 Store；`LocalTaskStore.writeContextFiles` 对收件箱或空路径跳过文件创建，避免在当前进程目录产生伪任务目录。
- **Why（为什么这么做）**：收件箱任务尚未选择项目/workspace，不能提前落位项目文件；任务状态和关系必须继续由软件持久化。
- **How（怎么实现的）**：创建任务 → 写入 `PersistedState.localTasks`；仅当任务已有 workspace 且状态为可执行时才补齐三份 Markdown。现有任务转可执行的目标 workspace 选择仍需下一阶段补齐。
- **验证**：Web 类型检查通过；任务和任务中心相关测试 54 项通过。
- **已知限制**：转可执行操作尚未携带目标项目/workspace，因此当前 UI 仍不能完整完成收件箱落位。

## 2026-09-07：收件箱整理时绑定当前 workspace

- **What（做了什么）**：`UpdateLocalTaskArgs` 和 IPC 校验支持更新项目路径、workspace ID 与显示名称；任务更新会同步这些归属字段；任务中心“整理为可执行”按钮要求当前存在目标 workspace，并把任务归属写入该 workspace 后再切换为 `ready`。
- **Why（为什么这么做）**：收件箱任务创建时没有项目/workspace，转为可执行时必须明确落位，不能只修改 intake 状态。
- **How（怎么实现的）**：用户打开目标 workspace → 点击整理 → UI 读取当前 workspace → IPC 校验 → 主 Store 更新任务归属 → 任务上下文文件在目标目录补齐。
- **用户须知**：没有打开目标 workspace 时，整理操作会提示用户先打开 workspace；不会把任务写入当前应用目录。
- **已知限制**：当前目标取自已打开的 workspace，尚未提供整理对话框让用户从所有项目/workspace 中选择；后续可复用现有 workspace 选择器。

## 2026-09-07：取消 PR 合并后的任务 workspace 自动迁移

- **What（做了什么）**：`HostedReviewActions.tsx` 删除合并成功后调用 `transferWorkspace` 的自动迁移逻辑及其无用导入。
- **Why（为什么这么做）**：任务创建后不转移 workspace；用户验收后手动合入主线，任务文档随 Git 合并即可。自动复制任务元数据会重新引入任务跟随 worktree 的复杂关系。
- **How（怎么实现的）**：PR 合并成功 → 保持当前任务软件记录和 workspace 归属不变；用户需要时通过任务中心明确操作，不再由代码隐式迁移。
- **验证**：任务中心及相关右侧栏测试共 20 个测试文件、87 项通过；Web 类型检查通过。

## 2026-09-07：修正收件箱任务删除边界

- **What（做了什么）**：`LocalTaskStore.deleteTask` 对没有项目路径的收件箱任务跳过文件目录删除，只删除 Orca 软件记录；有项目路径时继续校验任务目录位于项目 `orca/` 下后才删除上下文目录。
- **Why（为什么这么做）**：空项目路径代表收件箱暂存状态，不能解析为当前进程目录；删除任务不能有误删本地目录的可能。
- **How（怎么实现的）**：收件箱删除 → profile persistence 删除元数据；已落位任务删除 → 路径校验 → 删除任务专属上下文 → 删除 profile 元数据。
- **验证**：本地任务测试 45 项通过，工作区无差异检查错误。

## 2026-09-07：删除任务 workspace 迁移接口

- **What（做了什么）**：删除 `transferWorkspace` 的主进程 IPC、preload API、共享参数类型、`LocalTaskStore` 文件复制实现，以及合并迁移辅助模块和对应测试；删除文件 Store 中复制任务目录、重写所有权和监听目标 workspace 的逻辑。
- **Why（为什么这么做）**：任务创建后固定项目/workspace，用户验收后手动合并代码；自动迁移会让任务状态再次跟随 worktree，违背软件持久化与明确归属边界。
- **How（怎么实现的）**：PR 合并不触碰任务记录；收件箱整理才通过显式任务更新绑定目标 workspace。任务元数据始终存放 Orca profile。
- **验证**：本地任务和任务中心测试 50 项通过；Web 类型检查通过；生产源码不再引用 `transferWorkspace` 或 `TransferLocalTaskWorkspaceArgs`。
- **已知限制**：文件 Store 本身仍作为测试过渡实现保留，尚未从仓库完全删除。

## 2026-09-07：收件箱纳入项目筛选范围

- **What（做了什么）**：`LocalTaskStore.list` 在使用项目路径筛选时保留同项目的空路径收件箱任务；新增回归测试验证收件箱不会因项目 workspace 扫描而消失。
- **Why（为什么这么做）**：收件箱任务尚未落位，项目路径为空，但仍应按创建时记录的项目 ID 出现在任务中心收件箱。
- **How（怎么实现的）**：项目筛选 → 主 Store 查询 → 同项目已落位任务与空路径收件箱合并 → 原有收件箱队列过滤。
- **验证**：本地任务测试通过；Web 类型检查此前已通过。

## 2026-09-07：禁止生产回退到文件任务 Store

- **What（做了什么）**：`getLocalTaskStore` 在没有主 Store 持久化适配时不再自动创建文件版任务 Store，而是抛出初始化错误；桌面 IPC 仍通过 `registerLocalTaskHandlers(profileStore)` 注入 Orca profile，测试通过 `setLocalTaskStoreForTests` 注入临时 Store。
- **Why（为什么这么做）**：任务真相必须是 Orca 软件持久化。静默回退会让初始化顺序问题重新产生 `task.json` 数据，造成任务分裂。
- **How（怎么实现的）**：主 Store → IPC 注册 → LocalTaskStore(profilePersistence)；没有这条链路时立即失败并暴露配置问题，不写旧格式。
- **验证**：任务 Store 与 RPC 测试 50 项通过；Web 类型检查通过。
- **已知限制**：旧文件 Store 类仍供测试使用，后续可迁移测试到 profile fixture 后删除。

## 2026-09-07：收件箱使用显式 workspace 选择器

- **What（做了什么）**：`work-item-pieces.tsx` 在“整理为可执行”按钮中复用 `LocalTaskWorkspacePicker`，列出当前项目的全部已登记 workspace；用户确认后才把所选 workspace 传给任务更新操作。workspace 列表通过 `getIndexedAllWorktrees` 从稳定的 `worktreesByRepo` 索引读取，避免在 Zustand selector 中每次返回新数组导致 React 最大更新深度错误。
- **Why（为什么这么做）**：收件箱任务必须由用户明确选择项目/workspace，不能隐式绑定当前打开 workspace；稳定索引同时避免此前任务页面出现的无限更新问题。
- **How（怎么实现的）**：打开任务详情 → 点击整理 → 选择 workspace → 确认 → 更新项目路径、workspace ID、显示名称和 `ready` 状态 → 目标目录补齐三份 Markdown。
- **验证**：任务卡和任务中心交互测试 8 项通过；Web 类型检查和 oxlint 通过。
- **已知限制**：workspace 列表限定为当前任务项目的已登记 workspace；新建 workspace 仍使用现有任务创建流程。

## 2026-09-07：Electron E2E 验证结果

- **What（做了什么）**：运行 `SKIP_BUILD=1 pnpm exec playwright test tests/e2e/kanban-ai-records.spec.ts --config tests/playwright.config.ts --project electron-headless --workers=1`，复用现有构建产物执行任务中心相关 E2E。
- **结果**：测试仓库创建和 Electron 启动完成，但测试初始化等待 `window.__store` 30 秒超时，未进入任务中心场景；因此不能把真实 Electron 流程标记为通过。Playwright 已生成截图和 trace，位于 `test-results/`，未加入 Git。
- **后续**：需要先修复 E2E 启动时 Store 暴露/构建产物问题，再验证任务中心创建、启动、并行、收件箱整理和验收流程。

## 2026-09-07：重建后 Electron E2E 结果更新

- **What（做了什么）**：运行完整 E2E 构建并再次执行 `tests/e2e/kanban-ai-records.spec.ts`。
- **结果**：E2E 构建成功，`window.__store` 已正常暴露；测试在任务中心前查找旧的“AI 记录”按钮时失败，说明旧 fixture 与当前 kanban1 页面不匹配。没有把该失败归因于任务数据或状态逻辑。
- **验证补充**：任务 Store、RPC、任务中心和相关 UI 模块测试共 20 个测试文件、90 项通过；Web 类型检查通过。

## 2026-09-07：补齐当前任务中心 Electron E2E

- **What（做了什么）**：`tests/e2e/kanban-ai-records.spec.ts` 改为当前 kanban1 任务中心流程：通过真实 preload API 创建无 workspace 的收件箱任务，打开任务中心并验证任务元数据可从软件持久化读取；`local-task-project-scope.ts` 将空路径收件箱按项目 ID 纳入范围，页面可显示该任务。
- **Why（为什么这么做）**：旧测试依赖已删除的 AI 记录入口，无法验证当前产品；空路径收件箱若不纳入范围，真实页面会显示为空。
- **How（怎么实现的）**：Electron E2E 构建（开启 `VITE_EXPOSE_STORE`）→ 创建收件箱任务 → 进入任务中心 → API 列表验证持久化 → 页面范围筛选验证任务可见。
- **验证**：`SKIP_BUILD=1 pnpm exec playwright test tests/e2e/kanban-ai-records.spec.ts --config tests/playwright.config.ts --project electron-headless --workers=1` 通过 1 项；E2E 构建此前已成功。

## 2026-09-07：增加 profile 持久化重启回归测试

- **What（做了什么）**：`src/main/local-tasks/profile-persistence.test.ts` 新增测试，使用同一 profile persistence 适配器创建两个 `LocalTaskStore` 实例，验证第二个实例能读取第一个实例保存的任务、默认子任务和会话关系。
- **Why（为什么这么做）**：任务元数据的关键要求是脱离 workspace 文件并在软件重启后继续存在；单实例读写测试不足以证明这一点。
- **How（怎么实现的）**：Store 实例 A 写入 profile → 关闭 → Store 实例 B 从同一 profile 读取 → 校验任务和默认子任务。
- **验证**：profile persistence 测试 3 项通过。
