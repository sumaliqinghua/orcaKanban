# 实现记录

## [2026-09-17] 后台刷新不再重建任务详情

- **What（做了什么）**：
  - `WorkItemsPrototypePage.tsx`：仅首次无数据加载显示全页加载；已有数据时加载错误显示在页面内并提供重试。详情从完整任务集合按选中编号查找，取消筛选第一条回退。主动切换项目时清理选择与展开状态。
  - `use-local-task-center-data.ts`：提取原页面加载和事件订阅。按项目编号、目录排序后稳定加载范围；同内容的新数组不重新加载。请求序号使较早请求和已离开范围的请求失效；对比请求前后任务对象，保留期间收到的更新；记录删除任务身份，防止旧列表恢复它。暂缺任务保留至明确删除或离开范围。
  - `work-item-views.tsx`：四种任务/子任务列表与看板允许没有选中任务，不再依赖隐式选中第一条。
  - `WorkItemsPrototypePage.test.tsx`：8 项页面回归覆盖队列移出、详情节点和草稿保留、刷新失败、相同目录、事件优先、请求乱序、列表暂缺、删除与首次加载竞态。
- **Why（为什么这么做）**：原页面每次加载都移除详情，导致内部会话预览和草稿重置；详情依赖筛选结果，又会自动切到另一条。只减少刷新次数无法解决必要刷新和筛选变化，因此同时稳定加载范围、组件挂载和选中任务。
- **How（怎么实现的）**：任务事件 → 更新对应缓存 → 原详情接收新数据；必要全量刷新 → 保留界面 → 仅接纳有效请求并合并未被事件更新的任务。项目目录内容变化才重订阅和加载；前端不推断远程进程状态。
- **用户须知**：无需新增配置。后台更新不打断详情；主动关闭、切换任务或项目仍正常工作；删除通知移除对应任务并提示，不跳到另一条。
- **验证**：修复前四项页面回归失败，修复后新增 8 项及相邻测试共 24 项通过；本轮文件 oxlint 与格式检查通过。测试替换了详情子组件，验证父页面不卸载详情及草稿节点；不能代替真实终端预览和滚动验收。
- **已知限制**：完整前端类型检查仍有其他模块错误；未找到项目要求的 electron 技能，未执行真实 Electron 界面验收。缓存任务若漏收删除通知，可能保留至重新进入页面。
- **关联假设**：ASSUMPTIONS.md「列表暂缺不视为任务删除」。

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

## 2026-09-07：profile 模式停用文件监听

- **What（做了什么）**：`LocalTaskStore` 在注入 Orca profile persistence 时不再创建 `LocalTaskFileWatchers`，所有 workspace 文件监听调用改为可选；只有旧文件测试模式仍初始化监听器。
- **Why（为什么这么做）**：任务元数据已由软件持久化，生产模式监听项目 `task.json` 没有业务意义，还会保留旧文件 Store 的副作用。
- **How（怎么实现的）**：`LocalTaskStore(profilePersistence)` → watcher 为 `null` → 任务读写只走 profile；无 profile 的历史测试模式继续保持原行为。
- **验证**：任务 Store 与 RPC 测试 51 项通过；旧文件 Store 仍因测试需要保留。

## 2026-09-07：限制可执行任务必须有 workspace

- **What（做了什么）**：`LocalTaskStore.create` 拒绝没有项目路径的 `ready` 任务；`inbox` 任务仍允许空路径；新增 profile persistence 回归测试覆盖该边界。
- **Why（为什么这么做）**：没有项目/workspace 的任务无法启动 AI 会话，必须先作为收件箱暂存，避免出现状态为可执行但没有执行位置的任务。
- **How（怎么实现的）**：创建请求 → 判断 intake 状态 → `ready` 无路径立即报错，`inbox` 写入 profile → 整理时再绑定 workspace。
- **验证**：本地任务测试 47 项通过；Web 类型检查此前已通过。

## 2026-09-07：抽离任务上下文文件写入工具

- **What（做了什么）**：新增 `task-context-file-io.ts`，集中提供原子写入、JSON 写入和记录追加；`ai-record-file-store.ts` 与任务完成记录改用该模块；`file-store-format.ts` 不再承载通用写文件函数。
- **Why（为什么这么做）**：AI 记录属于独立文件功能，不应依赖包含 `task.json` schema 和任务扫描的旧文件 Store 模块；抽离后可以继续清理旧格式而不影响 AI 记录。
- **How（怎么实现的）**：AI 记录/任务记录 → `task-context-file-io` → 指定上下文目录；旧任务 JSON 解析只保留给过渡测试。
- **验证**：本地任务测试 47 项通过；格式检查通过。

## 2026-09-07：迁移生命周期和收件箱测试到 profile fixture

- **What（做了什么）**：`session-lifecycle.test.ts` 和 `store-inbox.test.ts` 不再创建无持久化的文件 Store，改用内存 profile 适配器；`file-store-index.ts` 识别 `profile:<taskId>` 虚拟路径，不再调用文件存在性检查后错误丢弃任务。
- **Why（为什么这么做）**：核心状态测试应验证 Orca profile 真相，而不是旧 `task.json` 文件；虚拟路径修复保证会话、步骤和收件箱更新在 profile 模式正常工作。
- **How（怎么实现的）**：测试 profile 适配器保存任务数组 → `LocalTaskStore(profilePersistence)` → mutation index 使用虚拟任务路径 → 状态更新和会话关联。
- **验证**：会话生命周期 4 项、收件箱 1 项通过；相关任务测试继续通过。

## 2026-09-07：删除旧文件 Store 历史测试

- **What（做了什么）**：删除 `src/main/local-tasks/store.test.ts`。该文件的测试全部围绕 `task.json`、`plan.json`、跨 workspace 复制、目录监听和旧文件索引，已不再代表当前产品；保留 `profile-persistence.test.ts`、`session-lifecycle.test.ts`、`store-inbox.test.ts` 和 RPC/UI 测试覆盖软件持久化下的核心行为。
- **Why（为什么这么做）**：旧测试会把已经取消的文件真相和 workspace 跟随关系继续当作验收标准，阻碍删除旧代码并误导后续开发。
- **How（怎么实现的）**：移除旧测试 → 运行剩余任务测试 → 以 profile fixture 验证创建、会话、状态、收件箱和重启恢复。
- **验证**：任务 Store、RPC、任务中心和相关 UI 测试 19 个文件、58 项通过。
- **已知限制**：`file-store-format.ts` 和 `file-store-watch.ts` 仍被 `LocalTaskStore` 的无 profile 过渡分支使用，下一阶段删除。

## 2026-09-07：旧测试清理后的最终回归

- **What（做了什么）**：删除旧 `store.test.ts` 后重新运行任务 Store、RPC、任务中心和相关 UI 测试，确认 profile 持久化、状态聚合、会话绑定、收件箱和页面行为仍有覆盖。
- **验证**：19 个测试文件、58 项通过；Web 类型检查通过；工作区干净。
- **当前边界**：唯一仍直接构造无 profile `LocalTaskStore` 的是 RPC 单元测试，它通过测试专用 setter 注入临时实例，不代表生产回退路径。

## 2026-09-07：旧文件 Store 实现删除与验证边界

- **What（做了什么）**：删除 `file-store-format.ts`、`file-store-watch.ts`、`legacy-task-file-paths.ts`；`LocalTaskStore` 只保留 profile persistence 和上下文 Markdown 写入；RPC、生命周期、收件箱测试均使用 profile fixture。
- **验证**：任务相关测试 5 个文件、18 项通过；Web 类型检查通过；源码不再引用旧文件 Store 模块。
- **E2E 边界**：Electron E2E 已验证构建、Store 暴露和 profile API 创建收件箱任务；当前页面加载后收件箱队列按钮未稳定出现，完整 UI 整理流程尚未作为通过证据。

## 2026-09-07：拆分旧任务文件路径与上下文路径

- **What（做了什么）**：新增 `task-context-paths.ts` 保存 `orca/<task-id>` 和三份 Markdown 的路径常量；新增 `legacy-task-file-paths.ts` 单独保存旧 `task.json` 路径；旧监听改用拆分后的路径模块。
- **Why（为什么这么做）**：为最终删除旧 `task.json` schema 做依赖切分，避免路径和文件格式继续混在一个模块中。
- **How（怎么实现的）**：上下文文件路径 → `task-context-paths`；历史 JSON 路径 → `legacy-task-file-paths`；旧监听仅保留历史分支。
- **验证**：本地任务测试 13 项通过；Web 类型检查通过。
- **已知限制**：`file-store-format.ts` 仍被旧 Store 读写分支引用，尚未删除。

## 2026-09-07：任务 Store 构造必须注入持久化

- **What（做了什么）**：`LocalTaskStore` 构造函数改为必须接收 `LocalTaskProfilePersistence`，所有任务测试和生产单例均显式注入 profile 适配器；不再允许无参数构造。
- **Why（为什么这么做）**：从类型层面阻止新代码意外创建没有软件持久化的任务 Store，避免未来重新引入旧文件真相。
- **How（怎么实现的）**：主 Store → profile persistence adapter → `LocalTaskStore`；测试使用内存适配器，生产 IPC 使用 Orca profile。
- **验证**：本地任务与 RPC 测试 18 项通过；Web 类型检查通过。
- **已知限制**：旧文件分支代码仍在类内部，下一步可在确认无调用后删除。

## 2026-09-07：删除旧文件 Store 实现

- **What（做了什么）**：删除 `file-store-format.ts`、`file-store-watch.ts` 和 `legacy-task-file-paths.ts`；`LocalTaskStore` 删除无 profile 文件扫描、JSON 写入、路径索引、目录监听和旧格式恢复分支，只保留 Orca profile persistence；所有 RPC/生命周期测试使用显式 profile fixture。
- **Why（为什么这么做）**：旧文件格式不再是任务真相，继续保留可执行分支会让后续代码误用 `task.json`，并维护两套状态来源。
- **How（怎么实现的）**：主 Store → profile persistence → `LocalTaskStore` → mutation modules；任务上下文文件通过独立路径和 IO 模块写入，AI 记录不依赖任务 JSON schema。
- **验证**：本地任务和 RPC 测试 18 项通过；Web 类型检查通过；源码搜索不再发现旧文件 Store 模块引用。主进程全量类型检查仅剩既有 `cdp-print-to-pdf.ts` Electron 类型错误。
- **已知限制**：保留 `task-context-paths.ts` 与 `task-context-file-io.ts`，它们只负责三份 Markdown 和 AI 记录文件，不保存任务状态。

## 2026-09-07：修复任务中心空状态遮蔽收件箱

- **What（做了什么）**：`WorkItemsPrototypePage.tsx` 的空状态判断改为仅在没有任何任务和 AI 记录时显示；当任务存在但当前队列为空时，仍渲染本地任务来源、收件箱和其他队列标签。
- **Why（为什么这么做）**：收件箱任务不属于默认“可执行”队列，旧判断使用 `selected === null` 直接显示“还没有本地任务”，导致收件箱实际存在却无法进入。
- **How（怎么实现的）**：任务数据存在 → 保留任务中心导航和队列标签 → 用户切换到收件箱 → 查看任务；只有任务总数为零才显示空状态。
- **验证**：Electron E2E 构建后，收件箱任务页面测试通过 1 项；任务中心模块测试继续通过。

## 2026-09-07：收件箱整理流程 Electron E2E 通过

- **What（做了什么）**：扩展 `tests/e2e/kanban-ai-records.spec.ts`，覆盖收件箱标签、任务卡、详情抽屉、“整理为可执行”按钮和 workspace 选择器。
- **验证**：重建 E2E 产物后测试通过 1 项；页面空状态修复和空路径项目范围规则均在真实 Electron 中生效。

## 2026-09-07：并行会话状态 Electron E2E 通过

- **What（做了什么）**：`tests/e2e/kanban-ai-records.spec.ts` 新增场景，通过真实 preload IPC 创建任务和两个会话，依次停止会话并验收任务。
- **How（怎么实现的）**：两个会话运行时任务为 `In progress`；停止一路仍为 `In progress`；停止全部后为 `Needs review`；用户验收后为 `Done`。
- **验证**：该 E2E 文件两项测试均通过；任务模块测试和 Web 类型检查保持通过。

## 2026-09-07：删除本地任务 request-review 链路

- **What（做了什么）**：
  - `src/cli/specs/local-tasks.ts`、`src/cli/handlers/local-tasks.ts`、`src/cli/handler-group-manifest.ts`：删除 `orca local-task request-review --question` 的命令定义、参数处理和延迟加载注册键；旧命令不再被 CLI 识别。
  - `src/main/runtime/rpc/methods/local-tasks.ts`、`src/main/local-tasks/store.ts`、`src/main/local-tasks/file-store-batch-mutations.ts`：删除 `localTask.requestReview` RPC、Store 入口及其 mutation，不再由 Agent 主动把会话改为 `idle` 或复制问题。
  - `src/shared/local-task-types.ts`、`src/main/local-tasks/file-store-mutations.ts`、`src/main/local-tasks/session-output-mutations.ts`：删除 `LocalTaskReviewKind`、`reviewKind`、`reviewQuestion` 和相关写入；正常交付、运行失败仍通过会话、`executionState`、`LocalTaskRun.status` 与 `error` 保留事实。
  - `local-task-agent-prompt.ts`、`local-task-clarification-prompt.ts`：改为要求 Agent 在原会话直接完整提问并等待，不再额外调用任务命令保存副本。
  - 同步删除 RPC 请求审阅测试、任务 fixture 中的旧字段，并更新 `PRD.md`、`plan.md`、`ASSUMPTIONS.md`、`PROJECT_STATUS.md` 和自动化计划。
- **Why（为什么这么做）**：原命令只把会话中已经存在的问题复制到任务字段，并另外维护一套待审阅原因。当前任务模型以原始会话为决策依据，并已能根据会话是否运行聚合 `In progress` 或 `Needs review`，因此不需要第二份问题或状态通道。
- **How（怎么实现的）**：Agent 在原会话提问→会话运行时任务为 `In progress`→会话停止或结束→`resolveLocalTaskStatus` 将任务聚合为 `Needs review`→用户打开原会话回答或验收。
- **用户须知**：旧 `request-review` 命令和 RPC 直接失效，没有别名、过渡期或旧字段读取兼容；需要用户决定的内容必须保留在完整会话回复中。
- **已知限制**：任务中心不再单独标注“等待回答”、“正常交付”或“执行失败”；要了解待处理内容，应打开对应原会话。运行失败的具体错误仍保存在 `LocalTaskRun.error` 中。
- **关联假设**：`ASSUMPTIONS.md` 中“AI 输出统一进入待审阅”已标记为被本次决策推翻。
- **验证**：本地任务、Prompt 和 CLI manifest 定向测试 6 个文件、28 项通过；CLI、Web 和 Node 类型检查通过；CLI 构建成功，`local-task --help` 不再列出旧命令，直接调用返回 `Unknown command: local-task request-review`。命令运行时使用 Node 22.21.1，仓库要求 Node 24；该 engine 警告导致 `check:code-quality:changed` 的 JSON 解析脚本失败。直接 oxlint 检查其余 15 个改动源码文件通过；`store.ts` 仅触发 HEAD 已存在的 `max-lines`，本轮已将它从 347 行缩短到 339 行，未添加禁用规则。

## 2026-09-07：收窄子任务 Agent 上下文

- **What（做了什么）**：
  - `local-task-agent-prompt.ts`：将 `buildTaskPrompt(WorkItem, request)` 收窄为 `buildLocalTaskSubtaskPrompt(request)`；Prompt 只输出一次本轮子任务目标和执行约束，不再嵌入父任务标题、ID 或完整描述。
  - `LocalTaskAgentPicker.tsx`、`LocalTaskSubtaskCreateDialog.tsx`：启动任务、新建关联会话和新建子任务会话都只把本轮目标传给 Prompt 构造模块；新建子任务不再额外包装“请执行子任务”前缀。
  - `src/shared/local-task-types.ts`、`src/main/runtime/rpc/methods/local-tasks.ts`：新增收窄的 `LocalTaskCurrentContext` 返回类型。`localTask.current` 只返回父任务 ID/标题、当前会话 ID/标题/状态，以及 `assignedSubtasks`（当前会话负责的子任务列表）。
  - `src/cli/specs/local-tasks.ts`：命令说明改为“读取当前 Agent 会话负责的子任务上下文”。
  - `local-task-agent-prompt.test.ts`、`local-tasks.test.ts`：新增断言，确认子任务目标只出现一次，RPC 不返回父任务描述或其他会话的子任务。
- **Why（为什么这么做）**：父任务是组织和导航容器，其完整描述不一定与每个子任务相关。默认注入会重复文本、浪费上下文，并可能让 Agent 错把父任务全部范围当成本轮任务。
- **How（怎么实现的）**：用户本轮输入→精简 Prompt→Agent 调用 `local-task current`→RPC 在 Store 内完成会话归属过滤→只返回当前会话负责的子任务。过滤集中在 RPC 模块的接口 seam，调用方无法误取完整父任务。
- **用户须知**：子任务确实需要父任务某段背景时，应将该段必要信息显式写入本轮请求；不再自动获得父任务全文。
- **已知限制**：现有数据模型仍允许一个会话关联多个子任务，因此返回字段使用复数 `assignedSubtasks`；它只包含当前会话的内容，不会混入其他会话。
- **关联假设**：无，本轮按用户确认的上下文边界实施。
- **验证**：定向 Vitest 7 个文件、31 项通过；Web、CLI、Node 类型检查通过；18 个受影响源码文件的 oxlint 通过；CLI 构建成功，`local-task --help` 显示收窄后的 `current` 说明。

## 2026-09-09 提示词自动化基础能力规划与任务会话标签
- **What（做了什么）**：
  - `plan.md` 增加本轮自动化改造 checklist，记录了普通提示词自动化、Open 批次复用、会话标签、CLI 查询和验证依赖。
  - `PRD.md` 增加确认后的三类自动化边界：Open 自动执行、长期未 review 解释、Inbox 需求梳理；明确每轮新建调度会话、派发后不等待、不写 AI 记录。
  - `CONTEXT.md` 新增“调度会话”“任务关联会话”“会话标签”“派发完成”四个领域术语定义。
  - `src/shared/local-task-types.ts` 为本地任务会话增加可选 `tags`；创建和更新会话参数支持标签。
  - `src/main/local-tasks/file-store-mutations.ts` 在创建会话时规范化标签；`session-output-mutations.ts` 支持只更新标签而不结束会话、不更新消息时间和不改变任务状态。
  - `src/main/ipc/local-task-ipc-validation.ts` 接受会话标签数组。
  - `src/shared/local-task-session-tags.ts` 增加按同一任务关联会话的标签和 `updatedAt` 选择最近会话函数。
  - `src/main/runtime/rpc/methods/local-task-catalog.ts` 增加只读本机项目任务目录查询和任务内会话标签替换 RPC；`local-tasks.ts` 注册这些方法。
  - `src/cli/specs/local-tasks.ts`、`src/cli/handlers/local-tasks.ts`、`src/cli/handler-group-manifest.ts`、`src/cli/args.ts` 增加 `orca local-task list` 和 `orca local-task session-tags`，支持 JSON 查询和重复 `--tag`。
  - 新增 `src/main/local-tasks/session-tags.test.ts`，并扩展本地任务 RPC 测试，覆盖标签持久化、清空、跨任务拒绝、仅列本机项目。
- **Why（为什么这么做）**：标签属于会话而不是任务，能支持用户手动增删和自动化按任务内标签复用；列表查询复用现有 profile Store 和运行时 repo 注册，过滤 SSH 远程项目，避免提示词自行遍历不可靠路径。
- **How（怎么实现的）**：任务创建/更新 → profile 持久化会话 `tags`；CLI/RPC 查询 → 返回任务及会话；自动化提示词后续使用 `tag + session.updatedAt` 选择会话。标签元数据更新不会触发“会话完成”语义。
- **用户需要知道的**：CLI 标签命令替换整个标签集合；省略 `--tag` 会清空标签。当前尚未上线三类模板的实际派发和标签编辑界面。
- **已知限制**：尚未接入从提示词调度会话调用“启动任务 Agent”及已结束会话恢复；当前 `localTask.list` 依赖运行时注册的本机 repo；历史会话没有标签时不会自动猜测用途。
- **关联假设**：会话标签字符串继续由自动化提示词约定，不固化到源码枚举。


## 2026-09-09 自动化模板与标签界面续做
- **What（做了什么）**：`automation-templates.ts` 将旧收件箱模板改为 Inbox 会话梳理，将候选规划改为长期 Needs review 解释，并移除旧滞留简化和每日状态汇报模板；新提示词约定 `automation:inbox-clarification` 与 `automation:stale-review` 标签，输出留在关联会话，不写 AI 记录。`LocalTaskSessionHistory.tsx`、`LocalTaskDetailAside.tsx` 增加标签输入和失焦保存，视图模型同步标签。
- **Why（为什么这么做）**：符合用户确认的三个目标和标签由提示词约定的边界。
- **How（怎么实现的）**：会话详情 → 标签文本 → `updateSessionOutput({ tags })` → profile Store 持久化；模板提示词 → 标签约定 → 任务内最近会话选择。
- **用户需要知道的**：删除的是模板入口，不删除已有自动化配置和历史会话；旧 ID 的已保存自动化仍可运行。
- **已知限制**：尚无统一组合 RPC 将查任务、查标签、判断忙碌、创建/恢复、关联和返回串联给调度会话。

## 2026-09-09 任务派发与原会话恢复接口

- **What（做了什么）**：
  - `src/main/runtime/rpc/methods/local-task-catalog.ts` 新增 `localTask.dispatch`，组合任务查询、标签选择、实时 Agent 状态、创建关联和提交提示词；同一任务并发派发互斥。`localTask.sessionContext` 根据当前终端查回任务关联，供恢复后的会话调用任务工具。
  - `local-task-host-scope.ts` 复用项目和文件夹工作区的执行主机判定，本机目录查询排除远程任务。
  - `src/cli/specs/local-tasks.ts`、`handlers/local-tasks.ts`、`handler-group-manifest.ts` 暴露 `local-task dispatch`；`local-task-context.ts` 在没有任务环境变量时查询已保存的会话归属。
  - `src/shared/local-task-types.ts`、`src/main/ipc/local-task-ipc-validation.ts` 添加可选 `providerSession`，表示 Agent 自身的对话身份；`file-store-mutations.ts` 保存该身份，`session-output-mutations.ts` 更新时保留它；`local-task-agent-turn-persistence.ts` 从 Agent 状态事件中采集身份。恢复复用 `ensureAgentSession`，不根据标题猜测。
  - `file-store-mutations.ts` 首次执行允许在已有辅助讨论会话时绑定原未绑定主子任务。
  - `automation-templates.ts` 的三个任务模板均使用普通提示词自动化，明确调用 CLI 派发；`AutomationsPage.tsx` 应用这些模板时选用已有 workspace 和每轮新会话；`dispatch-run.ts` 将 `{{automation.agentId}}` 替换为配置所选 Agent。`useAutomationDispatchEvents.ts` 保留包含任务派发命令的调度终端以供回看。
  - `LocalTaskSessionHistory.tsx` 分开标签和备注的保存状态，并显示标签保存错误。
  - `local-task-dispatch.test.ts` 覆盖首次关联后提交、空闲继续、身份恢复、并发去重；自动化 service 测试覆盖 Agent 参数替换。
- **Why（为什么这么做）**：复用运行时的主机归属、Agent 创建、恢复和输入能力，避免再建立一套启动系统；将模型可能重复发出的请求收敛到任务内的互斥操作。
- **How（怎么实现的）**：自动化触发 → 新调度会话 → CLI 任务目录 → 派发接口 → 标签匹配 → 检查空闲或按原生身份恢复 → 保存关联 → 发送本轮请求 → 返回。只等待启动就绪和请求送达，不等待工作结束。
- **用户须知**：`--purpose` 的 `execution` 用于 Open 实现，`clarification` 用于需求讨论，`task-report` 用于解释待验收现状；后两种不会参与任务执行状态聚合。`--tag` 是提示词指定的会话查找标签，不是写死的用途枚举。修改自动化 Agent 后若匹配对话仍属于另一 Agent，派发会跳过。
- **验证**：37 项核心测试及22项原自动化派发回归通过，全量 `pnpm tc` 和定向 oxlint 通过。CLI 构建成功；全局开发 CLI 链接安装因权限失败，可使用项目内包装器。
- **已知限制**：真实 Electron 和真实 Agent 端到端未验证；缺少原生身份的旧对话跳过；未绑定具体 workspace 的 Inbox 无法派发，任务仍未完整验收。标签保存后的会话排序使用现有消息更新时间，元数据修改不推进该时间。

- **最终验证补充**：新增本机主工作区路径派发测试；38 项相关测试通过。派发命令等待 Agent 进入可接收输入状态后立即返回，不等待任务完成；所有未定义会话身份或无法确认状态的情况保守跳过。

## 2026-09-10：修复旧 Orca Dev runtime 与 local-task CLI 版本错位

- **What（做了什么）**：
  - `src/cli/local-task-context.ts`：`resolveLocalTaskContext` 调用 `localTask.sessionContext` 时，仅对返回 `method_not_found` 且消息明确包含该方法名的旧 runtime 错误做兼容转换，抛出 `runtime_compatibility`，并附带停止旧进程、运行 `pnpm dev`、等待 runtime ready、重新创建 Agent 会话三步恢复建议；其他错误原样继续抛出。
  - `src/cli/format.ts`：开发 CLI（`ORCA_DEV_CLI_INVOCATION=1` 或存在 `ORCA_DEV_REPO_ROOT`）遇到 `runtime_unavailable` 时提示从仓库根目录运行 `pnpm dev`；生产 CLI 仍提示 `orca open`。
  - `src/cli/local-task-context.test.ts`：新增旧 runtime 方法缺失和无关 runtime 错误透传测试。
  - `plan.md`：新增并完成阶段 11.9 checklist。
- **Why（为什么这么做）**：源码已注册 `localTask.sessionContext`，但长时间运行的 Electron Dev 进程可能仍使用旧 RPC 清单；直接显示 `Unknown method` 无法告诉 Agent 如何恢复。兼容层只匹配精确方法名，避免吞掉真正的参数、任务或连接错误，也不猜测任务 ID、不写任务数据。
- **How（怎么实现的）**：Agent CLI → `resolveLocalTaskContext` → 旧 runtime 返回 `method_not_found` → 精确识别 → `runtime_compatibility` + 恢复步骤；runtime 不可达 → 根据 dev/production 环境输出对应启动命令。新 runtime 和带 `ORCA_LOCAL_TASK_ID` 的会话路径不改变。
- **用户须知**：代码修复不会自动杀掉旧 Electron 进程或删除 profile；遇到兼容提示时必须重启目标仓库的 `pnpm dev`，并新建 Agent 会话以获得新 runtime/CLI 环境。`runtime_compatibility` 是 CLI 本地恢复错误码，表示版本能力不匹配，不代表任务不存在。
- **已知限制**：当前兼容层只能提示恢复，不能从 CLI 安全地重启用户的 Electron 进程；已有终端可能继续携带旧环境变量，仍需新建会话。
- **关联假设**：沿用 `ASSUMPTIONS.md` 中“旧的已运行生产 Orca 进程可能仍使用不含 `local-task` 的 CLI；重启新的 `pnpm dev` 后会先构建 CLI”的现有记录。
- **验证**：`src/cli/local-task-context.test.ts` 与 `src/cli/format-recovery.test.ts` 共 7 项通过；`pnpm run tc:cli`、定向 `oxlint`、`git diff --check` 通过。验证环境 Node 22.21.1，项目声明 Node 24，因此命令输出保留 engine warning。

## 2026-09-12：修复任务关联会话错跳和过期蓝色运行标记

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/local-task-workspace-navigation.ts` 的 `openLocalTaskWorkspace`（从任务详情打开所属工作区）删除“激活后恰好多出一个终端就把它绑定为原会话”的推断。指定会话时按其当前终端标识查找并主动聚焦；原终端缺失或身份冲突时保留任务详情并提示恢复。会话自己的工作区优先于父任务工作区。
  - `local-task-center-actions.ts` 删除导航时写入新终端绑定的回调；普通打开工作区不再修改持久化会话关联。
  - 新增 `local-task-session-resume.ts`：`resumeLocalTaskSession`（恢复任务中的一段原始对话）要求原生会话身份和支持恢复的 Agent 类型。调用已有 `terminal.ensureAgentSession`，即由执行主机查找现有实例或恢复指定原始会话；收到确切终端后调用现有 `rebindSessionTab` 更新当前终端映射，再返回导航目标。配对运行时在主机执行并拉取其终端列表，SSH 由本机控制层路由给执行主机，无法确认所有者时拒绝用当前工作区替代。
  - 新增 `local-task-session-identity.ts`：`localTaskSessionMatchesTab`（核对终端是否承载目标对话）复用原生会话身份比较，优先核对当前 Agent 状态，无当前记录时核对休眠记录；当前终端报告另一段对话时不采用旧休眠身份覆盖它。实时预览额外核对具体窗格，避免同一终端内的其他对话混入。旧记录没有原生身份时，打开仍以原终端绑定为依据；自动恢复则明确拒绝猜测。
  - `mock-data.ts` 中的任务视图类型和 `local-task-view-model.ts` 的 `localTaskToViewModel` 增加原生身份透传，字段来自已有持久化数据；没有新建数据库字段。
  - `local-task-view-model.ts` 的 `collectLiveTaskSessionIds`（收集正在工作的会话）只接受仪表盘工作状态；`reconcileWorkItemSessionLiveness`（计算任务详情展示状态）不再把已完成卡片和普通终端当工作证据，核对身份后以实时状态覆盖旧状态。新启动且没有实时证据的会话保留既有 15 秒启动宽限；主机所有权非本机或未知、且没有卡片证据时展示无法确认，而非推断结束。已完成表示会话未在工作，不等于用户已经验收任务。
  - 新增 `use-local-task-session-liveness.ts`：集中订阅会话和执行主机状态，每 15 秒推动启动宽限到期后的重算，避免没有新事件时蓝点永久保留；组件卸载后清理定时器。`WorkItemsPrototypePage.tsx` 调用此模块，并将校正后的同一份数据传给列表和详情，保持原文件在行数限制内。
  - `LocalTaskDetailAside.tsx` 的会话预览移除按“继续”等提示词扫描前 200 条历史的恢复逻辑；恢复期间禁止重复点击，失败明确显示并保持详情。只对匹配身份且仍有实时终端的会话提供打开操作；保留的已结束卡片没有实时终端时提供恢复入口。切换会话重建预览实例，清除前一会话的错误状态。
  - `LocalTaskDetailPanel.tsx` 为状态点增加可读名称：运行中、已结束、空闲、无法确认；颜色沿用原界面。`LocalTaskSessionTurnHistory.tsx` 将无条件出现的“当前正在解决”改为“最近请求”，不再把历史提示包装成正在执行。
  - 验证文件：新增 `local-task-workspace-navigation.test.ts` 覆盖聚焦原终端和不绑定新增无关终端；新增 `local-task-session-resume.test.ts` 覆盖精确身份恢复、无身份短提示拒绝、配对主机路由、主机失败不改绑定以及旧工作区不替换为当前工作区；新增 `local-task-session-identity.test.ts` 覆盖错误对话、正确对话、窗格隔离和无证据终端；扩展 `local-task-view-model.test.ts` 覆盖空闲、已完成、远程缺失、新一轮工作和同终端不同对话。`tests/e2e/local-task-session-recovery.spec.ts` 使用独立用户资料与真实 Electron/IPC，验证状态、错误提示和打开原终端。
  - 文档：`plan.md` 记录步骤与验收；`PRD.md` 顶部新增身份恢复和状态约束；`ASSUMPTIONS.md` 记录旧数据缺身份的保守处理；`PROJECT_STATUS.md` 顶部更新当前修复及验证边界。
- **Why（为什么这么做）**：三个回归在旧逻辑下明确失败：已完成卡片被算成工作中、打开工作区不聚焦原会话、新增普通终端被写为旧会话绑定。提示词相同和终端创建时间接近都不能证明是同一对话，因此改用原生身份和执行主机的既有恢复接口。没有再实现一套提示词匹配、进程扫描或恢复命令生成逻辑。
- **How（怎么实现的）**：任务关联记录 → 核对原生对话身份 → 已有原终端则精确聚焦；无实时终端则交给所属主机查找或恢复 → 主机返回终端标识 → 写入任务终端映射 → 刷新配对主机终端快照（如适用）→ 聚焦返回的原会话。状态链路为仪表盘实时状态 + 会话身份 + 执行主机归属 → 任务视图校正 → 列表及详情统一展示。两个具体场景：原会话绑定终端 A，激活工作区新增 B 时，不会把 B 写入原会话；两段对话最后都收到“继续”时，恢复只提交已保存的原生对话标识，缺失就报错。
- **用户须知**：没有新增配置、依赖或通信字段；需使用本工作区新构建才能生效。本轮不重启现有 Orca、不自动恢复用户真实业务会话、不按猜测修改历史关联；原生身份缺失的旧记录不能自动恢复。旧主机缺少现有恢复接口时显示失败，不能用模糊匹配降级。启动宽限检查间隔为 15 秒，界面无其他事件时可在 15–30 秒内清除启动后仍无运行证据的蓝点；收到明确完成状态时无需等待。
- **验证**：31 项定向测试通过；Node 24 下 `pnpm tc:web`（前端类型检查）与 `pnpm run check:code-quality:changed HEAD`（仅本轮改动的风格、类型感知和 React 质量检查）通过。真实 Electron 的 Playwright 界面测试通过并产生截图，已检查错误文本正常显示。第一次界面测试由于夹具未设置标题而定位失败，明确设置会话标题后通过。默认整分支检查的 5 项历史问题位于未修改测试文件，未扩散修复范围。
- **已知限制**：未执行用户给出的真实会话恢复，也未在真实 SSH 主机或手机配对环境验收恢复过程；远程路由和失败行为有自动测试。没有安装项目提到的 `$electron` 技能，界面验证使用仓库已有 Playwright Electron/CDP 框架。既有历史记录若连原生身份也被污染，不能仅靠终端映射自动重建真实关系。
- **关联假设**：`ASSUMPTIONS.md` 的“[2026-09-12] 历史恢复需要明确原生身份”。

## 2026-09-12 补充：待审阅任务继续聊天恢复进行中

## 2026-09-12：任务完成或归档后关闭关联终端

- **What（做了什么）**：`local-task-center-actions.ts` 在 `acceptSelected`（验收任务）和 `archiveSelected`（归档任务）的持久化成功回调中，读取任务会话保存的 `tabId`，调用现有 `closeTab`（关闭终端页签）并使用清理原因；同一页签只关闭一次。持久化失败不会关闭页签。
- **Why（为什么这么做）**：任务完成或归档后，关联终端已不再需要继续占用界面和运行资源；把关闭动作放在成功回调后可避免任务未完成却提前关闭。
- **How（怎么实现的）**：验收/归档成功 → `replaceTask` 更新任务 → 收集关联会话 `tabId` → `closeTab(tabId, { reason: 'cleanup' })`。没有 `tabId` 的历史会话被跳过，其他任务的页签不会被扫描或关闭。
- **用户须知**：验收通过或归档成功后，关联终端会自动从页签栏消失；此前已关闭的页签不会恢复。恢复任务后新建或重新绑定的页签会在下一次完成/归档时关闭。
- **已知限制**：本轮测试覆盖动作层和类型检查，未额外启动 Electron 测试关闭页签的视觉效果；关闭仍复用已有页签关闭流程和其资源清理机制。
- **验证**：`local-task-center-actions.test.ts` 6 项通过，`pnpm tc:web` 通过，`git diff --check` 通过。

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/local-task-view-model.ts` 已在本轮修改为先读取匹配会话的实时状态，再处理历史结束状态；`local-task-view-model.test.ts` 补强从 Needs review（待审阅）→ In progress（进行中）→ Needs review 的往返断言，并同时核对会话 working（蓝色工作标记）和活动会话数量。
  - `src/renderer/src/hooks/ipc-events/local-task-agent-turn-persistence.ts` 的 `persistLocalTaskAgentTurn`（将已经接收的 Agent 事件保存到任务会话）新增明确工作/完成状态识别。原来无提示词的工作事件会被直接忽略，或只保存原生身份却不保存工作状态；现在 working 和 done（完成）都能在提示词为空时保存。未解析出会话所属终端时仍不写入。
  - 新增相邻 `local-task-agent-turn-persistence.test.ts`，先复现两种状态遗漏并观察失败，再验证修复、无提示词完成和无所属终端不写入。
  - `src/main/local-tasks/session-lifecycle.test.ts` 在恢复终端映射用例中增加待审阅后重新工作、持久化读取仍为进行中、再次结束回待审阅的断言；主存储原有工作优先聚合无需修改。
  - `tests/e2e/local-task-session-recovery.spec.ts` 增加真实 Electron 测试：通过真实接口创建已经完成的任务会话，向仪表盘所用状态源输入继续工作与完成事实，断言用户可见的关联会话蓝点、父任务进行中和结束后待审阅状态。不向真实业务 Agent 发送聊天消息。
  - `plan.md`、`PRD.md` 与 `PROJECT_STATUS.md` 补充用户明确提出的状态往返要求。
- **Why（为什么这么做）**：仪表盘正确而任务错误有两层原因：任务视图原本只校正 working 历史，跳过 done 历史；事件持久化又把提示词当作开始工作的必要条件。仅刷新页面不能补齐缺失的保存事件，因此同时修复显示和持久化入口。
- **How（怎么实现的）**：Agent 发出 working → 已有事件处理器确认归属 → 即使提示词未送达也保存会话工作状态 → 原有父任务聚合进入进行中；与此同时任务视图直接复用匹配身份的仪表盘事实 → 蓝点和父任务标签同步更新。done 到达后使用既有结束处理回到待审阅。等待用户输入的状态不冒充实际工作蓝点。
- **用户须知**：没有新增配置。继续原关联会话即可触发，不需要新建任务或手动切状态；任务报告和澄清辅助会话仍不参与父任务执行状态聚合。已更新源码仍需运行新构建生效。
- **验证**：补充的四个测试文件共 26 项通过，包含事件批处理回归；前端类型和本轮代码质量检查结果在本节后续验收记录中补齐。
- **已知限制**：界面验证使用可控状态输入，没有让真实业务 Agent 执行用户项目任务；跨主机真实联调未覆盖。
- **关联假设**：无新增假设，用户已明确要求待审阅任务继续聊天恢复进行中。
- **最终验收**：26 项相关测试通过；Node 24 下前端类型检查、本轮 19 个代码文件质量检查通过；两项真实 Electron 界面测试通过，总耗时 56.4 秒。状态用例在不更新历史完成记录的情况下直接改变仪表盘事实，用户可见的蓝点和父任务状态仍正确往返，验证任务不再依赖旧文件状态。
- **通知记录**：在用户替换 AGENTS.md 之前按旧约定尝试发送飞书通知，返回 Bot Not Enabled（机器人未启用），未发送成功；用户的新规则已取消该通知要求，后续未再发送。


## 2026-09-12：最近Kanban会话与用户工作流复盘

- **What（做了什么）**：新增 `docs/kanban-workflow-review-2026-09-12.md`，分析9个任务、10条关联会话、8份原始对话及相关项目记录，以热更失败、卡关交付、快照语义、广告对照组、视觉教程与Push咨询六组案例提出改进；新增 `docs/kanban-workflow-code-audit-2026-09-12.md`，逐路径核查创建/澄清/派发/恢复/验收与归档。更新 `plan.md` 和 `PROJECT_STATUS.md`，标明现有恢复对真实记录仍有身份缺口。
- **Why（为什么这么做）**：仅看任务状态会把服务失败误读为仍在执行，仅看总结会把记忆整理提示误读为用户请求；必须以原始消息与事件核对。开发版样本有5条原生身份但全部10条缺智能体类型，证明恢复条件尚不完整。
- **How（怎么实现的）**：只读任务profile的localTasks字段 → 以会话身份/任务编号定位原始记录 → 排除规则与环境注入 → 核对用户请求、最终答复、失败事件 → 与当前调用链交叉核查 → 按软件改进和用户操作分别给建议。原始证据均在报告中保留路径和定位；未复制认证信息或完整profile。
- **用户须知**：重点是服务错误可见、回写与交付分离、完整身份、减少重复确认；用户可采用短任务模板、不可变行为矩阵、真实复现样本和清晰验证分工。报告是本地调查产物，当前仓库忽略这两份docs路径，尚未提交或强制纳入版本控制。
- **验证与限制**：只读核对样本计数、精确原文和代码位置，未运行业务测试或真实Agent；当前终端没有orca CLI，因此无法核实运行中状态。批量并行/双子任务等属于静态风险，不声明现场发生率；PRD未变更，因为建议尚未获用户采纳为开发需求。没有发送外部通知。


## 2026-09-13：主动工作流与持续学习整改方案

## 2026-09-13：三类会话失败标记与自动继续（首轮实现）

## 2026-09-13：修复合入 main 后开发启动失败

- **What（做了什么）**：`src/renderer/src/app-shell/AppWorkspaceShell.tsx` 将旧的 `../components/TaskPage` 动态导入改为当前文件实际位置 `../components/task-page/TaskPage`。
- **Why（为什么这么做）**：`pnpm dev` 在 web client 构建阶段报 `UNRESOLVED_IMPORT`，原因是合入 main 后 TaskPage 已移动目录，但 kanban1 保留了旧引用。
- **验证**：`pnpm run build:web` 已成功；`pnpm dev` 已重新启动 Electron Vite 开发进程。CSS `::highlight` 和大 chunk 仍是构建警告，不阻断启动。`/usr/local/bin/orca-dev` 权限警告也不阻断，项目使用 `out/bin` wrapper。

- **What（做了什么）**：`transcript-turn-lifecycle.ts` 从 Codex `task_complete` 事件提取嵌套错误文本；`local-task-session-retry.ts` 只识别 429 限流、503 服务繁忙、指定流断开三类错误，定义 30 秒、2 分钟、5 分钟退避和最多三次的状态显示；`session-retry-controller.ts` 在发送前再次检查原会话身份、当前任务和终端可写状态，发送“继续”，对发送结果不确定时停止盲重试；`session-retry-monitor.ts` 通过主进程单例监听原始会话，避免多个窗口各自重试。任务会话增加 retry 记录，Agent 状态事件同时保存 `agentId`；详情页显示错误、下次重试和停止按钮。
- **Why（为什么这么做）**：用户提供的三种失败属于请求没有形成有效一轮结果的基础设施问题，适合有限、可取消的同会话恢复；正文中引用这些错误不能触发重试，用户主动中断、任务完成、归档或会话身份变化也不能触发。
- **How（怎么实现的）**：原始 Codex transcript → lifecycle `task_complete.error` → 精确分类 → 任务会话保存失败和下次时间 → 单例协调器等待 → 发送前校验 → 原终端提交“继续” → 监听新的 working 或失败边界。所有状态写入任务 profile，前端只显示主进程结果。
- **用户须知**：首轮默认只对本机 Codex、身份明确且能确认空闲的任务关联会话自动继续；历史启动时看到的失败只展示，不自动重放。自动重试可以在会话详情停止；达到三次后必须人工处理。远程执行主机、身份不完整、发送结果无法确认时不会盲发。
- **验证**：原始 lifecycle、任务生命周期、Agent 状态持久化及三类错误分类定向测试共 23 项通过；Node 全量类型检查仍受合并后的既有 preload/UI 类型错误影响，未将其归因于本轮。主进程后台协调器的真实 Electron 端到端重试尚未完成。
- **已知限制**：当前 `session-retry-monitor.ts` 的真实启动路径、应用退出清理、远程主机和 stream disconnected 的实际 transcript 形态仍需端到端覆盖；本轮没有让真实用户会话自动发送“继续”。

- **What（做了什么）**：新增 `docs/kanban-workflow-remediation-plan-2026-09-13.md`，把最近三轮讨论收敛为主动发现、停滞任务唤醒、决策卡、最小下一步、服务错误分流、受控收件箱、学习卡和每周反馈八个能力；明确四级主动权限，拆分五个实施阶段，并给出首版本范围、验收场景和指标。
- **Why（为什么这么做）**：实际阻塞不是 Agent 完全不能实现，而是用户需要在长报告、技术细节和不明确的下一步之间反复切换。先改善决策入口和任务重启，再增加主动派发和长期学习，能避免错误状态被自动化放大。
- **How（怎么实现的）**：任务/会话/工具事件 → 结构化事件索引 → 待处理原因与决策卡 → 用户确认或接受最小下一步 → 原会话继续或生成收件箱草稿；明确事实、推断和建议的边界。学习链路为明确用户反馈 → 短学习卡 → 相似任务复用 → 每周最多五条有证据反馈。
- **用户须知**：首版本只允许主动观察和建议，不自动启动写代码 Agent、不自动修改任务状态、不自动提交或发布；首版本目标是减少“继续”、重新读会话和服务失败后的重复操作。
- **已知限制**：方案尚未拆成代码Issue，身份字段完整性、任务事件索引和真实自动化触发仍需先做技术设计；本轮没有实现或运行测试。
- **关联假设**：沿用 2026-09-12 工作流复盘中的事实边界；学习状态不能从用户沉默推断，主动建议必须保留证据来源。


## 2026-09-13：补充静默积累、集中决策与针对性学习方案

- **What（做了什么）**：在 `docs/kanban-workflow-remediation-plan-2026-09-13.md` 增加远程工作时静默积累、打开决策中心集中处理、信息缺口引导问题、按需短教程、每周反馈、提醒分级与隐私范围；将首版本调整为“决策中心＋静默队列＋引导问题＋短教程＋每周反馈”。
- **Why（为什么这么做）**：用户的限制不是没有任务，而是有时间时找不到可直接决策的任务，没时间时又被任务打断；大而全教程无法在决策窗口内产生帮助。
- **How（怎么实现的）**：允许的任务/会话事件 → 本地静默索引 → 事实/缺口/建议分离 → 用户打开时最多呈现3张决策卡 → 选择写回任务并继续原会话；同一决策触发单张项目化教程 → 用户反馈调整难度 → 每周最多5条有证据反馈。
- **用户须知**：首版本默认只观察和建议，不自动启动写代码 Agent、提交、合并或发布；提醒默认为静默积累和每日汇总，只有安全风险或用户设置的截止时间才即时提醒。
- **已知限制**：本轮只修改方案和项目记录，没有实现数据索引、决策中心或学习卡；远程会话摘要的权限和脱敏边界需要在实现阶段继续核对。
- **关联假设**：继续采用“沉默不是同意”“事实必须有证据”“远程执行主机拥有代码和凭据”的既有约定。


## 2026-09-13：新增调度窗口作为统一任务入口

- **What（做了什么）**：在 `docs/kanban-workflow-remediation-plan-2026-09-13.md` 新增调度窗口设计。调度窗口接收自然语言后分流为执行、查询、任务管理、自动化、学习和复盘；先显示识别结果、准备动作和不会做的事情，再按权限确认。补充不完整信息的引导问题、与自动化 Tab 的关系、首版本边界和验收场景。
- **Why（为什么这么做）**：当前流程要求用户先建任务、再选会话；用户往往只有想法或一句目标。统一调度窗口可以把“说目标”作为起点，同时保留高影响动作的确认，减少用户记忆任务入口和参数的负担。
- **How（怎么实现的）**：用户输入 → 调度分类器判断请求类型 → 查询任务/会话/事件索引 → 生成调度预览 → 用户确认 → 继续原会话、创建收件箱草稿或创建自动化；学习和复盘只生成信息，不创建执行任务。自动化 Tab 与调度窗口共享事件索引，自动化发现的候选回到决策中心。
- **用户须知**：首版允许用户用一句话查询任务、准备候选、继续原会话或预览自动化；提交、合并、发布、删除和写代码派发必须明确确认。用户说“继续”只表示继续当前已明确动作，不能作为万能授权。
- **已知限制**：当前仅更新方案，没有实现自然语言分流、统一事件索引或调度预览；任务身份完整性和失败状态仍需在实现阶段先稳定。
- **关联假设**：沿用主动权限四级模型，默认观察/建议；远程代码、凭据和进程仍由执行主机负责。


## 2026-09-13：补充未知内容启动成本与渐进式学习

- **What（做了什么）**：在整改方案新增“逐步收敛任务启动”“三层结果报告”“安全试做”“四级学习台阶”“针对性提问”和“用户瓶颈自检”。调度窗口先自主调查，再一次只问一个会改变方向的问题；任务报告首屏只显示一句结果、三项重点和一个主要选择；教程默认只提供够做当前选择的一级内容。
- **Why（为什么这么做）**：用户已经有目标，但面对大而未知的方案或知识主题时，会把启动任务理解成先掌握整个领域。继续增加长报告会扩大启动成本。需要让 Agent 先承担整理和低风险试做，把用户介入压缩到真实产品取舍。
- **How（怎么实现的）**：自然语言想法 → 只读调查 → 事实/未知/可自动确认分离 → 一个引导问题 → 最小可撤回动作 → 证据结果 → 下一个问题或执行；学习链路为当前决策缺口 → 一级短卡 → 用户反馈 → 按需展开二/三/四级。等待过久时，Agent 先检查问题是否过大，能自动补齐的内容不再询问用户。
- **用户须知**：首版本不要求用户先写完整需求或读完整教程；用户可选择“先看方案、先做只读调查、按推荐执行”。涉及用户可见行为、对照组、发布、删除和外部费用仍必须确认。
- **已知限制**：本轮只是方案更新，没有实现调度窗口、事件索引或学习档案；四级内容和行为指标需要真实使用后调整，不能从少量会话推断用户能力。
- **关联假设**：用户的主要瓶颈是启动成本和信息负担，默认优先减少首个有效动作的认知量，而不是增加解释总量。


## 2026-09-13：修订为主动副手和角色化会话工作流

- **What（做了什么）**：根据用户反馈，在 `docs/kanban-workflow-remediation-plan-2026-09-13.md` 增加方向修订。明确完整信息保留在关联会话；用户可从收件箱或报告进入原会话追问。把首版重点从决策卡和调度窗口改为现有会话内的主动副手，以及方案审查员、复现与诊断员、验收解释员、学习辅导员四个辅助角色。角色通过新会话提示词或原会话追加提示词调用，结果统一回主会话。暂缓决策卡、复杂状态和独立调度窗口。
- **Why（为什么这么做）**：用户真正的启动压力来自未知和繁杂内容，增加按钮和任务对象会增加新的学习成本。Agent 已经负责方案和执行，缺少的是主动调查、拆解、补充、提问和把结果翻译成可决策内容。保留会话作为主工作面可以减少上下文切换。
- **How（怎么实现的）**：用户一句想法 → 主动副手读取代码/记录 → 只问会改变方向的问题 → 方案审查员检查边界 → 复现员验证失败样本 → 主 Agent 在确认范围内直接执行 → 验收解释员短报告 → 学习辅导员按当前卡点补一级知识。所有角色统一输出“结论/已确认/还缺/推荐/下一步/需要用户/证据”。
- **用户须知**：首版本不需要学习新任务 UI，也不要求每一步重新授权。用户确认目标和边界后，Agent 可在范围内自主继续；只有改变产品行为、删除、提交合并发布或产生外部成本时再询问。用户说“看不懂”时直接在原关联会话追问即可。
- **已知限制**：本轮只调整方案和项目文档，没有实现角色提示词、Skill 或自动化触发。角色调用和远程会话插入时机仍需在实现阶段验证。
- **关联假设**：用户更需要降低首次有效行动的认知负担，而不是更多摘要、按钮或教程总量；详细知识按需展开。


## 2026-09-13：明确自动调度角色与触发器的关系

- **What（做了什么）**：在整改方案新增“触发器决定何时、角色决定怎么做”的设计。确认现有自动化执行器可以保留，通过角色提示词、作用范围、动作策略、通知策略和去重键扩展。定义收件箱拆解、搁置任务方案、用户迷惑学习、执行前审查四个首批角色，以及定时、任务事件、停滞时间、会话行为和结果条件五类触发器。
- **Why（为什么这么做）**：用户指出当前自动化只有到时间执行一段提示词，缺少可复用角色和主动调度行为。完全新建调度系统会重复现有能力；把角色从提示词中抽出来即可复用、观测和持续改进。
- **How（怎么实现的）**：触发器命中 → 选择角色模板 → 注入任务/会话/项目范围 → 使用现有 Agent 启动器或追加原关联会话 → 角色输出事实、缺口、推荐、下一步和证据 → 结果回主会话。默认不二次启动调度 Agent，避免每次主动整理产生两个会话。
- **用户须知**：角色是提示词和 Skill 的可复用行为规范，不是新的任务对象；用户在自动化设置时确认范围后，运行过程中不需要逐次授权。首版仍保护提交、合并、发布、删除等不可逆动作。
- **已知限制**：本轮只更新方案，没有实现角色模板、事件触发器或去重控制；现有自动化的实际执行链路仍需编码阶段接通。
- **关联假设**：现有自动化执行器能够承载角色提示词和新增触发条件；若验证发现执行器无法表达事件触发，再单独设计最小扩展，不直接重建调度系统。


## 2026-09-13：确定性事件触发器优先于角色

- **What（做了什么）**：在整改方案新增当前自动化核对和事件触发器设计。确认现有自动化以 `prompt`、`agentId`、`rrule`、工作区、执行模式和前置检查为主，稳定触发只有定时 `scheduled` 与手动 `manual`。新增收件箱进入、待审阅状态变更、Agent 完成、任务重新打开和用户发送消息五类首版事件，要求边沿触发、去重、冷却、延期和远程来源明确；首版暂不增加角色字段。
- **Why（为什么这么做）**：用户希望主动整理，但不希望依赖“反复追问”这类无法直接确认的语义触发。事件状态已有任务 Store、会话生命周期和 Agent 状态事件作为来源，可靠性、可测试性和解释性更好。角色与触发器底层最终都调用现有 Agent 执行器，角色可以在未来从重复提示词中抽取。
- **How（怎么实现的）**：状态事件 → 自动化匹配 `eventType + conditions` → `eventId + automationId` 去重 → 检查冷却/暂停/远程所有权 → 使用现有提示词和 Agent 派发 → 结果写入原关联会话和自动化运行记录。没有事件字段的旧自动化继续按定时或手动运行。
- **用户须知**：首版本不需要配置角色，也不增加新调度入口；在自动化页面仍编辑普通提示词，只是可以选择确定性触发条件。用户发送消息首版只更新活动时间或提醒，不直接触发学习分析。
- **已知限制**：本轮只更新方案，没有实现事件订阅、边沿判断或自动化配置字段；当前工作区存在其他任务的源码修改，本轮未触碰。
- **关联假设**：任务 Store、会话生命周期和 Agent 状态事件可以提供稳定事件标识；如某事件无法提供可靠身份，首版应暂缓该事件，而不是用模型猜测替代。


## 2026-09-13：确定性自动化事件触发实现

- **What（做了什么）**：
  - `src/shared/automation-event-types.ts` 新增事件类型和事件触发条件：任务进入收件箱、任务状态变为指定 `Open/In progress/Needs review/Done`、Agent 会话完成、任务重新打开。`automations-types.ts` 将事件触发条件加入自动化和运行记录，并增加 `event` 运行来源。
  - `src/main/local-tasks/event-detection.ts` 新增 `detectLocalTaskEvents`，比较写入前后的任务，只有状态边沿、收件箱进入、重新打开和会话从未完成到完成才生成稳定事件 ID。
  - `src/main/local-tasks/store.ts` 增加事件监听；每次任务持久化成功后发布事件，不改变已有任务变更广播。`src/main/ipc/local-tasks.ts` 把事件转给自动化服务，保留任务项目、工作区、状态和任务 ID。
  - `src/main/automations/service.ts` 增加 `triggerEvent`，匹配启用自动化的事件类型、项目、工作区和目标状态，按事件 ID 去重，复用现有 `requestDispatch`；事件型自动化不会被定时扫描重复执行。提示词追加事件类型和任务 ID。
  - `src/main/persistence/scheduling-automations/automation-run-operations.ts`、`loading-store/automation-persistence.ts`、`automation-run-writer.ts` 透传事件来源和事件 ID，保证运行记录可追踪。
  - `AutomationsPage.tsx`、`AutomationEditorDialog.tsx`、`AutomationEditorSettingsSidebar.tsx`、`automation-edit-draft.ts` 增加事件选择和状态选择；不选择事件时仍按原定时/手动自动化工作。
  - 测试覆盖任务事件边沿、事件运行去重、状态筛选和原有自动化回归。
- **Why（为什么这么做）**：用户要求只采用系统能直接确认的触发器，不使用“用户反复追问”等模型猜测。任务 Store 和 Agent 生命周期已经拥有稳定状态来源，事件触发比定时扫描更及时、可解释且能做确定性回归。
- **How（怎么实现的）**：任务写入前后比较 → 生成 `eventType + eventId` → 自动化服务筛选 → 持久化 event 运行记录 → 复用现有目标解析和派发器 → 运行结果沿用原自动化观察器。事件型自动化与原 `scheduled/manual` 运行分开，旧自动化不改变。
- **用户须知**：自动化编辑器现在可以选择事件触发；状态变更事件必须再选择目标状态。事件自动化仍使用普通提示词，暂时没有角色概念。用户发送消息首版不触发自动化，只更新任务活动。
- **已知限制**：本轮没有新增复杂冷却字段；事件运行去重依赖持久化运行记录的 `eventId`，同一任务的不同状态会产生不同事件。运行时如果事件自动化目标主机不可用，会写入既有跳过/失败运行记录。
- **验证**：`src/main/local-tasks/session-lifecycle.test.ts` 与 `src/main/automations/service.test.ts` 共 19 项通过；`git diff --check` 通过。`pnpm tc:node` 仍被工作区已有未完成 Preload 改动阻塞（重复 `PreloadApi`、缺少 API 字段和未定义符号等），本轮新增自动化类型/主进程错误已排除。
- **关联假设**：沿用“确定性事件优先；事件身份缺失不猜测”的方案约定。


## 2026-09-13：确定性自动化触发器首版实现

- **What（做了什么）**：在现有自动化上增加事件触发。共享类型新增 `AutomationEventType`（事件名称）、`AutomationEventTrigger`（事件筛选条件）和 `event` 运行来源；自动化运行记录增加 `eventId`（事件唯一标识）。任务 Store 在持久化前后比较状态，发布收件箱进入、任务状态变更、任务重新打开和执行会话完成事件。自动化服务匹配启用记录的事件类型、项目、工作区和目标状态，按 `eventId` 去重后复用原有目标解析、前置检查和派发器。定时扫描跳过事件型自动化。自动化编辑器增加事件和目标任务状态选择，清空事件即恢复原定时/手动行为。
- **Why（为什么这么做）**：用户确认首版只要能直接从系统事实触发，不使用“反复追问”等模型猜测。事件由任务 Store 和会话生命周期产生，能做边沿判断、持久化去重和自动化回归。暂不抽取角色，避免把提示词复用问题与触发可靠性问题混在一起。
- **How（怎么实现的）**：任务写入 → `detectLocalTaskEvents` 比较前后状态 → IPC 转交 `AutomationService.triggerEvent` → 按条件筛选 → `eventId` 查重 → 创建 `event` 运行记录 → 复用现有派发器。原有 `scheduled`（定时）和 `manual`（手动）运行链路保持不变。
- **用户须知**：在自动化编辑器选择事件即可创建事件型自动化；任务状态事件需要再选择目标状态。事件提示词仍是普通提示词，运行结果通过现有关联会话和自动化运行记录查看。任务进入收件箱、状态变为待审阅或完成、执行会话结束和任务重新打开可以触发自动化。用户发消息暂不触发自动化。
- **已知限制**：事件筛选目前只支持项目、工作区和任务目标状态；事件运行仍保留原有定时字段用于通用存储，但不会被定时扫描。事件触发使用当前主进程内已持久化运行记录去重；远程任务事件仍需由拥有任务状态的主机产生。
- **验证**：`src/main/local-tasks/session-lifecycle.test.ts` 与 `src/main/automations/service.test.ts` 共 19 项通过；覆盖事件边沿、状态变更、会话完成、事件筛选和重复事件不重复派发；`git diff --check` 通过。`pnpm tc:node` 仍被工作区已有 Preload/UI 类型错误阻塞，错误不来自本轮事件代码。
- **关联假设**：事件型自动化暂不抽象角色；待真实使用中出现重复提示词后，再把角色作为独立复用层添加。


## 2026-09-13：修复自动化页面 `useAppStore` 渲染崩溃

- **What（做了什么）**：Crash Report 指向 `AutomationsPage.tsx` 首次渲染时调用未定义的 `useAppStore`。检查发现该文件顶部是 `AutomationsPageSurface`/`useAutomationsPageController` 的拆分入口，但主体仍残留旧页面实现，导致旧主体依赖的导入全部缺失。恢复 `main` 拆分后的最小入口：创建控制器并将其传给页面表面组件；事件触发字段接到拆分后的 `AutomationDraft`、本地状态、自动化保存和设置侧栏。
- **Why（为什么这么做）**：只补 `useAppStore` 导入会继续暴露几十个旧主体依赖，并让新旧两套自动化页面同时存在。恢复与当前 main 架构一致的入口能一次消除错误的混合状态，同时保留事件自动化功能。
- **How（怎么实现的）**：`AutomationsPage` → `useAutomationsPageController` → `AutomationsPageSurface`；事件配置由编辑器草稿 → `automation-orca-save` → IPC/持久化。
- **用户须知**：重新构建后点击自动化 Tab 不会再触发 `ReferenceError: useAppStore is not defined`；事件触发选择仍在自动化设置里。
- **已知限制**：当前工作区同时存在其他任务的 Preload/UI 改动，未对其做清理；本轮只修自动化页入口。
- **验证**：`AutomationsPage.test.tsx`、严格模式保存测试和自动化保存操作测试共 34 项通过；`git diff --check` 通过。


## 2026-09-13：修复打开自动化页面的渲染崩溃

- **What（做了什么）**：Crash Report 的 `page.automations` 报告 `ReferenceError: useAppStore is not defined`。根因是 `AutomationsPage.tsx` 顶部已经是 `AutomationsPageSurface` 和 `useAutomationsPageController` 的拆分入口，但主体仍残留旧页面代码。已恢复 `main` 拆分后的最小入口，并将此前事件触发草稿字段接到拆分后的 `AutomationEditorDialog`、本地状态、设置侧栏、编辑草稿和 `automation-orca-save`。
- **Why（为什么这么做）**：只补一个导入会继续暴露旧主体的多个缺失依赖，并保留两套自动化页面。恢复同一版本的拆分入口能消除整类混合状态。
- **How（怎么实现的）**：`AutomationsPage` 创建控制器 → `AutomationsPageSurface` 负责渲染；事件自动化字段由编辑器草稿 → 保存动作 → 共享自动化类型和主进程持久化。
- **用户须知**：重启或热更新到当前源码后，点击自动化 Tab 不再因该 `ReferenceError` 崩溃；事件触发设置仍可选择任务事件及目标状态。
- **验证**：自动化页面、严格模式保存、自动化保存操作测试共 34 项通过；`git diff --check` 通过。全量 `tc:node` 仍被工作区其他未完成 Preload/UI 改动阻塞，与本次入口修复无关。


## 2026-09-13：修复重启后工作区打开的终端初始化崩溃

- **What（做了什么）**：根据 Crash Report `15dbf66b-dc64-4eec-8b52-c47f3df5ab7c`，在 `useAutoAckViewedAgent.ts` 中将缺失的 `manuallyUnreadTurnsByPaneKey`（重启后可能尚未水合的手动未读映射）按空对象处理；在 `agent-status-pane-keyed-records.ts` 中让 `removePaneKeys` 和 `removePaneKeysByTabPrefix` 能处理空映射，避免终端初始化或清理路径再次调用 `Object.keys(undefined)`。新增缺失映射回归用例。
- **Why（为什么这么做）**：重启恢复先加载 UI 状态，Agent 状态和相关映射可能稍后到达。旧代码把可选持久化字段当作必有对象，工作区打开时首次终端布局写入触发 `Object.entries(undefined)`，渲染边界捕获异常并中断工作区创建收尾，界面因此长时间停留在 “Creating worktree”。空记录是当前时刻的正确语义，不应让渲染崩溃。
- **How（怎么实现的）**：持久化字段缺失 → 读取函数回退 `{}` → 无待清理条目时安全返回；清理函数也对缺失映射回退 `{}` → 终端布局持久化继续执行 → 工作区创建完成回调可以正常收尾。
- **用户须知**：重启后打开已有或新建工作区时，缺少旧手动未读记录不会再让终端工作台崩溃；“Creating worktree”卡住的这条异常路径已消除。用户仍需运行包含此修复的新开发构建。
- **已知限制**：本轮没有清理工作区中其他未提交的 Preload/UI 类型改动；未在用户真实项目上执行创建操作。
- **验证**：`useAutoAckViewedAgent.test.ts` 25 项通过，覆盖缺失映射、自动确认、保留行清理和页签窗格隔离；`git diff --check` 通过。


## 2026-09-14：修复重启后工作区打开崩溃与 Creating worktree 卡住

- **What（做了什么）**：
  - `src/renderer/src/hooks/useAutoAckViewedAgent.ts`：`computeLapsedManualUnreadProtections`（计算已失效的手动未读保护）和自动确认前的映射读取改为将未水合的 `manuallyUnreadTurnsByPaneKey` 当作空记录。
  - `src/renderer/src/store/slices/agent-status-pane-keyed-records.ts`：`removePaneKeys`/`removePaneKeysByTabPrefix`（按窗格或页签清理状态）支持空映射，避免恢复和关闭终端时再次调用 `Object.keys(undefined)`。
  - `src/renderer/src/lib/worktree-creation-flow-execute.ts`：初始化新工作区的终端和完成时激活过程增加异常收尾，错误会写回待创建状态、清理完成回调，避免渲染监听器异常后永久显示 `Creating worktree`。
  - `src/renderer/src/hooks/useAutoAckViewedAgent.test.ts`：新增重启期间映射未加载的回归用例。
- **Why（为什么这么做）**：Crash Report `15dbf66b-dc64-4eec-8b52-c47f3df5ab7c` 显示页面在终端布局首次持久化时因为缺失映射崩溃。该异常发生在新工作区首次创建终端的关键路径，后续创建完成回调无法执行，所以界面会一直保留 Creating worktree。
- **How（怎么实现的）**：持久化 UI 字段缺失 → 读取函数返回空记录 → 自动确认/清理继续执行；若终端初始化仍有其他异常 → 创建流程将状态置为 error 并清理 pending completion → 用户看到可重试的错误，而不是永久创建中。
- **用户须知**：重启或打开新项目时，旧 UI 状态缺少手动未读字段不会再导致终端工作台崩溃；若创建过程中确有其他错误，界面会结束 Creating worktree 并显示错误。需要重启或热更新到新源码。
- **已知限制**：当前工作区存在其他未提交 Preload/UI/任务重试改动；工作区创建流程既有测试有5项失败，失败涉及创建收尾和启动草稿夹具，需另行处理。本轮没有进行真实项目创建操作。
- **验证**：`useAutoAckViewedAgent.test.ts` 25 项通过，`git diff --check` 通过。

## 2026-09-14：Kanban 自动化模板主动化调整

- **What（做了什么）**：
  - `automation-templates.ts` 的 Open 执行模板仍由调度 Agent 扫描 `ready + Open` 任务并调用 `orca local-task dispatch`，但交给目标关联会话的请求改为主动阅读任务/代码/历史、拆解目标、补充细节、只问影响方向的问题，信息足够后直接实现、验证并回写结果；调度完成不再被描述为任务完成。
  - 收件箱澄清模板改为主动梳理描述、范围和验收方式，先读代码与历史；明确使用 `grilling` 技能的 frontier（当前已具备前置条件的问题）轮次规则，每轮给推荐答案和选项，不重复已回答问题，不修改代码、不把 inbox 改为 ready。该模板增加 `eventType: local_task.intake_changed`，新任务进入收件箱即可触发一次。
  - 长期待审阅模板改为读取完整会话、代码和验证记录，解释已完成、没有改变、剩余问题、前后行为差异、风险和最小下一步；继续由每日定时 Agent 筛选 `Needs review` 且活动超过 7 天的任务，没有改成“刚变待审阅就触发”。
  - `AutomationTemplate` 与现有模板套用逻辑透传 `eventType`/`eventStatus`；事件型模板保存为事件自动化，其他模板不选择事件时沿用定时/手动运行。
- **Why（为什么这么做）**：原模板把目标 Agent 限制成“只负责派发”，自动化即使运行也只是在任务中心转发命令，不能主动解决用户的拆解、澄清、解释和执行问题。收件箱进入是确定事件，适合即时触发；长期搁置需要时间条件，保留定时筛选更准确；Open 模板已有批量执行语义，暂不改成单状态边沿。
- **How（怎么实现的）**：定时或收件箱事件 → 调度 Agent 读取任务 → `local-task dispatch` 按标签选择原关联会话 → 目标 Agent 使用注入的任务描述和会话上下文主动处理 → 结果写回原会话。收件箱澄清在目标提示词中引入 grilling 的“轮次 frontier”概念：只问当前能回答且会改变方向的问题。
- **用户须知**：使用模板创建自动化后，收件箱任务会在进入收件箱时触发澄清；Open 执行和长期待审阅仍按模板原有定时方式扫描。模板仍使用普通提示词，没有新增角色字段；如需修改行为，直接编辑模板生成的提示词即可。
- **已知限制**：事件触发目前保存单一事件类型；长期“超过 7 天”仍由定时 Agent 自己筛选，尚未做时间条件事件。模板运行依赖 `orca local-task dispatch` 和目标会话的原生身份，身份缺失或会话忙碌时按现有规则跳过。
- **验证**：自动化模板、自动化页面、保存、自动化服务和任务生命周期测试共 53 项通过；定向 oxlint 与 `git diff --check` 通过。
- **关联假设**：沿用用户确认的确定性触发器优先；`grilling` 只用于收件箱澄清，不把用户自然语言困惑作为自动触发条件。


## 2026-09-14：修复关联会话启动后的快速启动菜单崩溃

- **What（做了什么）**：根据 Crash Report `8ebf6922-302e-4968-976f-c106f5117eae`，在 `src/renderer/src/components/tab-bar/QuickLaunchButton.tsx` 补充 `useStructuredAgentLaunchStatus` 导入。该函数读取结构化 Agent 启动状态，快速启动菜单使用它判断 Claude/Codex 条目是否处于等待启动。此前函数调用存在但变量未定义，打开任务页或点击关联会话启动任务时渲染边界直接崩溃。
- **Why（为什么这么做）**：函数实现已经位于 `src/renderer/src/lib/structured-agent-session-launch.ts`，错误是拆分/合并后导入缺失；复用现有实现比复制状态读取逻辑更安全。
- **How（怎么实现的）**：QuickLaunch 菜单渲染 → 读取 `useStructuredAgentLaunchStatus(worktreeId, agent)` → 显示启动中/可用状态；新增导入后恢复模块绑定。
- **用户须知**：重启或热更新后，任务页的快速启动菜单不应再因 `useStructuredAgentLaunchStatus is not defined` 崩溃；该函数只影响启动状态展示，不改变 Agent 启动命令。
- **已知限制**：快速启动文件的独立 oxlint 仍报告工作区既有的 `structuredLaunchAccepted` 未使用问题，位于同一创建流程改动中；本轮未扩大范围处理。
- **验证**：`TabBarCreateEntry.keyboard.test.tsx` 等快速启动相关测试共 12 项通过，`git diff --check` 通过。


## 2026-09-14：修复关联会话点击启动任务无响应

- **What（做了什么）**：`src/renderer/src/lib/launch-agent-in-new-tab.ts` 在解析 Agent 启动平台、远程标记和原生聊天转录可读性时使用了未定义的 `worktreeSshConnectionId`，已通过现有 `getConnectionIdFromState(store, worktreeId)` 从当前工作区解析执行主机连接。任务页启动的 `launchSource === task_page` 仍避开异步结构化原生会话路径，使用能立即返回终端页签 ID 的普通启动路径，确保任务会话关联能够写入。
- **Why（为什么这么做）**：错误发生在创建终端之前，所以用户点击 Agent 后看不到会话、任务也不会更新。直接补主机解析复用现有所有权解析；任务页需要立即得到页签 ID，不能等待只适用于普通快速启动的结构化会话快照。
- **How（怎么实现的）**：任务页选择 Agent → 解析 worktree 的 SSH/本机连接 → 构建启动命令 → 创建终端页签 → `LocalTaskAgentPicker` 持久化关联 → 关闭任务详情并聚焦终端。普通快速启动仍可使用结构化原生会话。
- **用户须知**：任务详情中的“启动任务 → 选择 Agent”现在会创建终端、写入关联会话并进入工作区；若 Agent 本身未安装或信任检查失败，沿用现有错误提示。
- **已知限制**：当前工作区仍有其他未提交的 Preload/UI/任务重试改动；未进行真实远程主机启动。
- **验证**：`launch-agent-structured-chat-guard.test.ts`、`launch-agent-in-new-tab.test.ts`、`LocalTaskAgentPicker.test.tsx` 共 45 项通过，`git diff --check` 通过。


## 2026-09-14：修复事件自动化选择后不触发

- **What（做了什么）**：根据用户截图和开发版profile核对，页面已选择“任务进入收件箱”，但持久化自动化的 `eventTrigger` 是 `null`，原因是运行时 RPC 的 `AutomationCreate`/`AutomationUpdate` Zod 参数校验（运行时检查输入结构的规则）没有声明该字段，未知字段被丢弃。`src/main/runtime/rpc/methods/automation-schemas.ts` 现在允许四种事件类型、项目/工作区过滤和任务目标状态；事件配置可以从页面保存到主进程。`AutomationEditorSettingsSidebar.tsx` 在选择事件时将日程标签显示为“日程（事件触发时不使用）”，避免用户以为时间仍决定运行。
- **Why（为什么这么做）**：事件服务和任务事件监听已经正确接通，实际profile证据表明故障发生在保存边界；只修改事件派发器不能解决配置丢失。时间字段仍保留是因为自动化记录和表单共用定时结构，但事件自动化不会进入定时扫描。
- **How（怎么实现的）**：页面草稿 `eventTrigger` → RPC schema 放行 → 运行时 Controller/Store 持久化 → 任务状态边沿生成事件 → AutomationService 匹配并去重 → 现有派发器启动Agent。事件模式下 `rrule` 只保留通用存储，不参与触发。
- **用户须知**：此前已保存的 `Inbox requirement clarification` 记录的 `eventTrigger` 仍为 `null`，因为旧保存已经丢失选择；修复后需重新打开并保存该自动化，或重新从模板创建。保存后新任务进入收件箱会触发一次；模板的 Agent、项目和 workspace 仍决定在哪个主机运行。
- **已知限制**：长期待审阅仍由每日提示词扫描“超过 7 天”，没有单独的时间边沿事件；事件自动化目前仍使用普通提示词，不支持角色字段。
- **验证**：RPC 自动化参数、模板、自动化服务和任务生命周期共 26 项测试通过；`git diff --check` 通过。

## 2026-09-14：Kanban 模板主动化与收件箱事件触发

## 2026-09-14：新增每日工作流、知识和进展自动化

补充：根据用户选择，同时新增 `kanban-automation-health-daily`（每日自动化健康检查），检查失败、跳过、失效项目/workspace、事件配置丢失和无目标会话等确定性问题，写入 `assistant/workflow-reviews/automation-health-YYYY-MM.md`。它与每日进展汇报分工不同：进展汇报回答“项目做了什么”，健康检查回答“自动化本身是否真的运行”。

补充：四个新增每日模板（工作流复盘、知识梳理、任务进展汇报、自动化健康检查）默认设置 `localTaskScope: all_local_projects`，由执行会话放在所选 workspace，但读取范围覆盖所有本地任务；这样报告不会只看到 `/Users/lmy/proj/OPC/temp` 的单个项目。

- **What（做了什么）**：`automation-templates.ts` 新增三个每日模板。`kanban-workflow-review-daily` 回顾最近24小时任务、会话和自动化运行，最多输出三条有事实来源的工作流改进建议，追加到 `assistant/workflow-reviews/YYYY-MM.md`；`kanban-knowledge-review-daily` 汇总用户问过/选择过的内容以及 Agent 实现和验证使用的新知识，生成一句定义、项目例子、误区和影响组成的短教程单元，追加到 `assistant/workflow-reviews/knowledge-YYYY-MM.md`；`kanban-daily-progress-report` 汇总昨日完成、进行中、风险、卡点、已验证/未验证和下一步，追加到 `assistant/workflow-reviews/daily-YYYY-MM.md`。三个文件都要求当天重复执行时更新同一日期章节，不创建任务、不改代码或任务状态。模板测试更新为检查五个 Kanban 助手模板和三个新模板的时间配置。
- **Why（为什么这么做）**：用户需要一个低打扰的整体复盘、知识积累和昨日进展入口；知识梳理不能只响应“我不懂”，还要覆盖真实问答、选择、实现和验证中出现的概念。把结果写成按月文档，保留完整内容又避免每天生成大量卡片和新界面。
- **How（怎么实现的）**：每日定时自动化 → Agent 读取限定时间范围的任务/会话/运行记录 → 按目标输出不同文档 → 日期章节去重更新。工作流复盘关注流程摩擦；知识梳理关注可复用理解；进展汇报关注项目状态，三者分开避免报告互相重复。
- **用户须知**：可以从自动化 Tab 套用三个模板后分别设置 Agent、项目和 workspace。推荐每日进展在早上、工作流复盘在傍晚、知识梳理紧随复盘或错开运行。文档默认写入自动化所选项目 workspace 的 `assistant/workflow-reviews/`，多项目汇总时应选择能访问目标任务的 workspace。当前模板只读分析和写文档，不自动修改任务或代码。
- **已知限制**：当前执行器仍按普通定时提示词运行，Agent 需要自行读取限定范围；没有独立的全局跨项目文档存储。若项目 workspace 无法访问其他任务，汇报范围会受选定 workspace 限制。文档去重依赖提示词约束，后续可增加结构化日期写入工具。
- **验证**：`automation-templates.test.ts` 3 项通过；模板定向 `oxlint` 和 `git diff --check` 通过。

- **What（做了什么）**：三个模板已更新。Open 执行模板要求目标关联会话主动拆解、补细节、提问、实现和验证；收件箱模板使用 grilling 的 frontier 轮次提问；长期待审阅模板解释前后行为差异、风险、验证缺口和最小下一步。收件箱模板配置了 `local_task.intake_changed`（任务进入收件箱）事件；Open 和长期待审阅保留每日定时批量筛选。模板套用与保存链路已透传事件配置。
- **Why（为什么这么做）**：原模板只要求调度 Agent 派发，目标会话没有被要求主动完成拆解、澄清、执行和解释。收件箱进入是确定性事件，适合即时触发；长期七天筛选仍由定时提示词完成。
- **How（怎么实现的）**：模板 → 草稿事件字段 → RPC 校验 → 自动化记录 → 任务事件 → 现有派发器 → 原关联会话。事件模式不依赖日程运行，但保留通用日程字段。
- **用户须知**：`/Users/lmy/proj/OPC/temp` 当前“每日执行未开始任务”是每日 09:30 的普通定时自动化，不负责收件箱澄清。旧的收件箱自动化记录此前保存成 `eventTrigger: null`，修复构建后需重新打开并保存，或从模板重新创建；已有任务不会追溯触发。
- **已知限制**：长期待审阅仍由每日提示词筛选超过七天；角色字段暂未增加。
- **验证**：模板、自动化页面、保存、自动化服务和任务生命周期共 53 项通过；定向 `oxlint` 和 `git diff --check` 通过。
## [2026-09-14] 修复本地任务 Agent 派发会话关联与失败重试

- **What（做了什么）**：
  - `src/main/runtime/rpc/methods/local-task-catalog.ts` 使用终端的 `parentTabId` 作为任务会话的标签页标识，与终端列表的编号口径统一；新会话先以 `idle` 保存，提示被接受后才更新为 `working`；等待超时、终端缺失或提示拒绝会写入失败原因并保留可重试状态。
  - `src/main/local-tasks/file-store-mutations.ts` 支持创建会话时指定初始状态。
  - `src/main/local-tasks/session-output-mutations.ts` 支持显式保存 `idle`，不会把失败会话误写成 `done`。
  - `src/shared/local-task-types.ts` 增加会话初始状态参数，并允许更新为 `idle`。
  - `src/main/runtime/rpc/methods/local-task-dispatch.test.ts` 增加父标签关联、就绪超时和提示拒绝回归测试。
- **Why（为什么这么做）**：原实现把子窗格编号当成标签页编号，导致已有终端无法匹配；同时在提示发送前就写入 `working`，失败时留下“看似运行中”的假会话。调整状态时序和失败记录后，重试可以复用同一任务并明确显示失败原因。
- **How（怎么实现的）**：创建终端 → 保存 `idle` 会话 → 等待终端就绪 → 发送提示 → 接受后更新 `working`；任一等待/发送错误 → 更新 `idle` 和失败说明 → 保留会话供下一次派发。
- **用户须知**：`idle` 表示会话已登记但当前没有成功提交本轮提示；失败说明写在会话备注中，重新派发会覆盖为新的尝试。
- **已知限制**：真实 Electron/Agent 运行时仍需重启开发运行时后验收；本轮未修改自动化触发器配置。
- **验证**：`node_modules/.bin/vitest run src/main/runtime/rpc/methods/local-task-dispatch.test.ts`，7 项通过；`git diff --check` 通过。`pnpm test` 因本机 Corepack 缺少 `pnpm.cjs` 未能启动；直接 `tsc` 受现有 TypeScript 5.9 配置移除 `baseUrl` 的错误拦截。

## [2026-09-14] 任务会话折叠、终端高度和直接标签页导航

- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskSessionDisclosure.tsx`：新增任务会话的折叠阅读组件；复用项目现有 Collapsible（自带键盘和展开状态语义的折叠控件），默认展开，收起时保留标题和一行预览，采用现有边框、背景、文本与焦点颜色。
  - `LocalTaskSessionHistory.tsx`：把“本会话执行摘要”接入折叠控件；会话备注、标签和保存方式沿用现有行为。
  - `LocalTaskSessionTurnHistory.tsx`：最近请求独立折叠，每轮用户问题与 Agent 小结作为一组折叠；仍按最新轮次在前显示，收起后保留轮次和问题预览；原回答滚动区域与无小结提示保留。
  - `LocalTaskSessionSplit.tsx`：新增历史区与终端区之间的水平分隔线。拖动分隔线上下调整两区高度，使用指针捕获保证指针移出分隔线仍能继续拖动；释放、取消或失去捕获后停止调整。分隔线可聚焦，支持方向键和边界快捷键。高度变化只作用于布局，复用原终端实例。
  - `LocalTaskDetailAside.tsx`：在有实时终端的会话预览中接入上下分区，替代原历史区固定最大高度；无实时终端时继续显示历史和恢复入口。保留本轮开始前已有的失败重试提示。
  - `LocalTaskLinkedSessionCard.tsx`：从详情页抽出关联会话卡片，保留状态、来源、时间、历史展开和失败重试提示；卡片主体继续打开侧边预览，增加独立右上箭头按钮，悬停或键盘聚焦显示“打开会话标签页”。
  - `LocalTaskDetailPanel.tsx`：改用上述会话卡片，将原导航回调传给新按钮；抽取后文件保持在项目 400 行上限内，未放宽检查规则。
  - `local-task-workspace-navigation.ts`：成功定位会话后明确切换到终端页面。原先调用“关闭任务中心”会恢复进入任务中心前的页面，导致从外部工单页进入时，虽然会话选中了，画面却回到工单页；本次真实界面验证复现并修复。
  - `local-task-workspace-navigation.test.ts`、`local-task-center-actions.test.ts`：更新已有导航断言，要求成功后切换到终端页，失败时不执行该收尾动作；保留原会话映射、拒绝无关终端和工作区路径解析覆盖。
  - `PRD.md`、`plan.md`、`ASSUMPTIONS.md`、`PROJECT_STATUS.md`：分别记录需求、进度、默认布局假设与实际验证状态。
- **Why（为什么这么做）**：
  - 折叠减少长摘要和历史问答占用，独立高度调整让阅读与终端操作按需要分配空间；直接跳转避免先打开预览再点击终端跳转。
  - 复用折叠基础组件、终端预览和导航身份校验，不另建会话恢复或远端执行流程。现有横向侧栏拖动和检查详情高度组件各有专用宽度/像素边界，无法直接表达本次上下比例，因此新增仅服务会话预览的布局组件；没有新增依赖。
- **How（怎么实现的）**：
  - 阅读：摘要/最近请求/轮次数据 → 独立折叠控件 → 展开正文或收起后的单行预览。
  - 导航：关联会话按钮 → 原有工作区激活 → 原标签页和会话身份校验 → 聚焦目标标签页 → 明确显示终端页面。工作区解析仍沿用普通文件夹、Git 工作树和远端主机的既有机制；没有新增远端协议或在本机推断远端进程状态。
  - 调高：历史区默认占容器 30%，可在 10%～75% 之间调整，终端使用剩余空间（扣除 6 像素分隔线）。上方向键扩大终端、下方向键缩小终端，每次移动 5 个百分点；Home 把历史区缩到 10%，End 扩到 75%。这些是界面内部边界，不是新增业务配置。
  - 常规数字示例：容器高 800 像素，历史区起始 30% 即 240 像素；分隔线向下移动 120 像素，增加 120/800×100=15 个百分点；历史区变为 45% 即 360 像素，终端剩余 800−360−6=434 像素。
  - 边界数字示例：同一容器历史区起始 70% 即 560 像素；向下移动 160 像素，计算值为 70+160/800×100=90%；按上限取 75% 即 600 像素，终端仍有 800−600−6=194 像素，不会被拖没。
- **用户须知**：
  - 点标题折叠/展开，点会话卡片主体仍看侧边预览，点独立右上箭头直接进入会话标签页。
  - 默认全部展开，折叠与高度仅在当前预览内保持，关闭重开恢复默认，不跨重启保存；无需新增配置。
  - 标签页已关闭时仍沿用原历史恢复提示和身份校验，不自动猜测另一个标签页。
- **验证**：
  - 4 个已有定向测试文件、13 项测试通过：详情描述编辑、导航与工作区解析、会话身份匹配。
  - 当前开发版 Electron 经 Playwright CDP（浏览器调试连接）实际验证：摘要展开→收起→展开；每轮问答展开→收起→展开；最近请求收起；拖动 120 像素后历史区比例由 30% 变为约 44%；Home/End/上方向键分别得到 10%/75%/70%。
  - 实际点击“打开会话标签页”后，DOM 中活动标签页为“明确单package热更新的资源下载与活动规则”，编号 `af423a60-5ad6-46fe-9cee-54eb5859b3f2`，任务侧边预览消失，终端页面可见。复现与修复覆盖从外部工单页进入任务中心的返回错误。
  - 本次 10 个源码/测试文件通过 oxlint 与 oxfmt 格式检查；界面组件通过项目原生代码质量规则检查。
  - 全量 `pnpm tc:web` 未通过：233 项错误，主要为已有界面状态声明缺字段；本次修改的 7 个组件没有类型错误。没有把未通过的全量检查记作通过。
  - 截图保存在 `/tmp/orca-session-ui-check/`：`expanded.png`、`collapsed.png`、`session-tab.png`。截图验证了当前浅色主题；没有更改任务正文、派发新 Agent 或向会话提交提示。
- **已知限制**：当前仅对本机 macOS 开发版做了真实界面验证，Linux、Windows、SSH 会话和暗色主题未做运行验收；项目指定的 Electron 技能文件本机未找到，使用仓库已有 Playwright CDP 方法完成实际验证。
- **关联假设**：`ASSUMPTIONS.md` 中“会话阅读布局默认值”。

## [2026-09-14] test1 收件箱自动化事件未触发修复

- **What（做了什么）**：
  - `src/main/runtime/runtime-automation-controller.ts`：`RuntimeAutomationController` 是自动化接口与持久化存储之间的转换层。其 `create`（新建自动化）现在把 `eventTrigger` 一并交给存储；`copyPatchValues`（筛选本次编辑实际提交的字段）现在保留该字段，使 `update`（更新自动化）能设置或清空触发条件。业务修复为两处字段透传。
  - `src/main/runtime/orca-runtime-automations.test.ts`：新建测试要求传递事件配置；增加编辑收件箱触发器、带项目/工作区/状态过滤的触发器、显式清空以及省略/undefined 保留原值的覆盖。修复前四项失败，显示存储收到空更新对象或缺少字段，修复后通过。
  - `src/main/local-tasks/session-lifecycle.test.ts`：补充“直接新建收件箱任务产生一次事件，随后普通描述修改不重复产生进入收件箱事件”的覆盖，保留原有事件边沿及会话生命周期测试。
  - 真实配置：通过应用运行时接口修正既有自动化 `263917a6-87bc-43d7-afa0-ea8719246e61`（Inbox requirement clarification），设置进入收件箱事件；名称、提示词、Codex Agent、temp 工作区、启用状态、原定时字符串、会话复用和执行主机信息经前后对比保持原值。
  - 真实验证：只将用户指定的 `lt_c65aac90-6f8a-45ea-9260-a2c87709a162`（test1）从收件箱暂时移出再移回，以产生新的进入事件；未创建其他测试任务，没有调用手动 Run now。事件自动化按已有提示词扫描全部收件箱，这一原有执行范围未改。
- **Why（为什么这么做）**：
  - 现场任务确实是 `intakeState=inbox`（收件箱），自动化也已启用，但 `eventTrigger=null`（没有事件触发条件）；唯一历史运行是手动触发。任务显示的 Open 是执行状态，不等同于是否进入收件箱，用户操作没有问题。
  - 重新提交事件配置仍被丢弃，排除“只需重保存旧配置”的初步解释。接口校验允许字段，持久化层也会保存字段，但中间运行时控制器使用字段白名单，漏了该字段；新建和编辑均受影响。
  - 复用现有事件检测与派发机制，不为已存在任务增加扫描补发或按自动化名称强行迁移，避免重复启动或误修改其他定时自动化。
- **How（怎么实现的）**：
  - 修复前：编辑器提交事件配置 → 接口校验接收 → 运行时转换丢弃 → 存储保留 null → 任务事件找不到匹配自动化。
  - 修复后：编辑器提交 → 接口校验 → 运行时保留字段 → 存储回读正确 → test1 进入收件箱 → 生成 event 运行 → 启动调度会话 → 为 test1 派发需求澄清关联会话。
  - `eventTrigger` 表示触发条件：对象表示设置条件，`null` 表示明确取消条件，省略或 `undefined` 表示本次不修改；沿用原有更新语义，没有新增协议字段或依赖。
  - 事件触发器可选进入收件箱、任务执行状态变化、任务重新打开、Agent 会话完成；本次实际设置的是进入收件箱，不新增项目或工作区过滤。已有接口字段的完整传递适用于本机及运行同一代码的远端主机，旧远端仍需更新才能获得修复。
- **实际证据**：
  - 4 个定向测试文件、39 项测试通过；本次 3 个源码/测试文件的 oxlint、oxfmt 及差异空白检查通过。
  - `/tmp/orca-inbox-event-check/probe.cjs` 通过运行中 Electron 的接口读取指定任务、指定自动化和最近运行；修复前稳定失败于“收件箱自动化必须保存进入收件箱事件触发器”。修复后同一读路径验证了触发配置、test1 事件运行和关联会话存在。
  - 真实事件运行编号：`1c81161a-e227-4918-b266-840dd3322e54`；事件编号：`lt_c65aac90-6f8a-45ea-9260-a2c87709a162:1789400221238:local_task.intake_changed:inbox`；触发类型为 `event`，不是 `manual`；派发时间为 2026-09-14 23:37:01（北京时间）。
  - 调度会话标签编号：`c659e4b6-0381-422d-bffb-5a9adda41995`；test1 自动关联的需求澄清会话编号：`c4451f9a-66fb-4ea3-8896-5223c610154c`，首次确认时状态为 `working`（运行中），任务仍在收件箱。
  - 构建成功，执行了应用自己的正常重启流程以加载新的主进程代码。原开发启动器在应用退出时同时停止了页面开发服务，已按项目同一 Vite 配置恢复 5173 端口服务并重新加载开发页面，确认任务中心可用。
- **用户须知**：本次已更新运行版本与该自动化实际配置，不需要用户再次保存；后续新建或移入收件箱会正常生成事件。旧事件不因配置修改自动回放，所以本次为测试任务重新产生一次进入事件。test1 的澄清业务是否完成，应以其关联会话为准，派发成功不等于任务验收完成。
- **已知限制**：全量 `pnpm tc:node` 仍有 41 项错误，位于现有 preload 接口及重复声明等，本次修改的运行时控制器和运行时测试没有类型错误；构建有既有包体大小及 package.json 重复键警告。真实 SSH/跨版本主机未验收。自动化启动快照曾过早显示 completed，但实际 Agent 随后仍在工作，因此本次以事件编号、终端派发和 test1 关联会话作为成功证据，不把该快照状态当作业务完成。
- **关联假设**：`ASSUMPTIONS.md` 的“test1 收件箱事件修复验证”。


## [2026-09-15] 收件箱澄清任务正文不包含会话操作限制

- **What（做了什么）**：
  - `src/renderer/src/components/automations/automation-templates.ts`：在收件箱自动化交给澄清 Agent 的提示词中增加三项规则：正文只包含确认的目标、范围、需求约束和验收标准；与用户确认稿一致，确认后不得自行追加章节；本轮操作限制、状态管理要求及执行承诺仅保留在会话。明确以“本次澄清边界”等附加章节为反例，保留澄清阶段不修改业务代码、不转为可执行的要求。
  - `PRD.md`：新增写回内容边界的需求变更历史。`plan.md`：记录定位、修改及验证三项任务。`PROJECT_STATUS.md`：记录实际完成范围、测试结果和已保存自动化未更新的限制。
- **Why（为什么这么做）**：用户确认的需求正文原本没有“本轮不改代码、不改收件箱状态”等附言，Agent 写回时却自行加入，后续执行会话可能据此拒绝实施。原模板只限制当前 Agent 行为，没有明确这些限制不能进入任务正文。选择补充源提示词，不在存储层按关键词删除内容，因为真实业务需求也可能合理包含“不修改代码”等限制。
- **How（怎么实现的）**：用户选择收件箱模板 → 调度提示词携带正文写回规则 → 派发接口把任务描述和提示词拼接给澄清 Agent → 用户确认最终稿后写回。规则放在传给澄清 Agent 的提示词内部，而不是仅告诉调度 Agent。派发接口、描述保存接口、任务状态规则和原有调度配置不变；无需新增依赖或协议字段。
- **用户须知**：修改的是模板源码。编辑器选择模板时将模板提示词复制到草稿，已保存的自动化保留独立提示词，不会因本次模板修改而自动更新；本轮没有修改真实自动化配置、已污染的任务正文或历史会话，也没有启动自动化。
- **验证**：现有 `automation-templates.test.ts` 的 3 项测试通过；修改的模板文件通过 oxlint（代码规则检查）和 oxfmt（格式检查），本轮文件通过差异空白检查。环境的 pnpm 启动器指向不存在的 12.0.0 缓存，因此直接调用项目已安装的测试和检查工具完成验证，没有修改包管理器配置。
- **已知限制**：测试覆盖模板现有结构和默认配置，不证明模型必定遵循新文字；未做真实 Agent 会话验收，未运行全量类型检查。本次没有增加存储层强制过滤。
- **关联假设**：无；按用户已提出并授权修改的提示词约束执行。


## [2026-09-16] 修复启动前 CLI 构建缺少返回值
- **What（做了什么）**：
  - `src/shared/agent-session-resume.ts`：在 `getAgentResumeArgv`（根据智能体类型和会话身份生成恢复命令参数的函数）补齐 Cursor 分支。编号类型为 `session_id`（原生会话编号）时返回 `cursor-agent --resume <编号>`；类型为 `conversation_id`（其他提供方使用的对话编号）时返回 `null`，表示无法生成合法恢复命令。
  - `src/shared/agent-session-resume.test.ts`：新增正常编号生成命令、不匹配编号类型返回空结果两项测试；修复前两项均失败，修复后通过。
  - `PRD.md`：顶部记录启动修复需求；`plan.md`：追加定位、修复与验证三步并标记完成；`ASSUMPTIONS.md`：说明保留已有 Cursor 可恢复声明的边界；`PROJECT_STATUS.md`：追加本轮结果和验证范围。
- **Why（为什么这么做）**：
  - 工作区先前把 Cursor 加入可恢复列表，却未在命令生成函数中处理它，导致执行路径落到函数末尾，违反声明的返回类型，编译因此中止。
  - 采用项目 AI 会话档案既有命令格式，保留当前 Cursor 声明；不删除原有改动，也不通过放宽返回类型或增加通用空返回掩盖遗漏。
- **How（怎么实现的）**：
  - 智能体类型和会话身份 → Cursor 专用分支 → 校验身份类型 → 返回命令参数或空结果。参数仍按数组传递，沿用调用方对命令转义、执行主机和工作目录的现有处理。
  - 先用 CLI 类型检查复现原 TS2366，再添加失败用例，最后补齐分支。完整 CLI 构建通过；会话参数、恢复启动命令、AI 会话档案恢复命令共 162 项测试通过；两份源码的代码与格式检查通过。
- **用户须知**：无新增依赖或配置，原先的 pnpm dev 命令不变。全局 orca-dev 安装提示为已有命令保护，不是本次失败原因。
- **已知限制**：未进行桌面界面验收；Cursor 事件的会话身份提取仍保留原行为，不表示本轮已实现完整自动捕获与恢复。
- **关联假设**：ASSUMPTIONS.md 的“保留既有 Cursor 可恢复声明”。


## [2026-09-16] Cursor 重启恢复链路补齐与上一轮结论纠正
- **What（做了什么）**：
  - `src/shared/agent-session-resume.ts`：`extractAgentProviderSession`（从智能体事件提取恢复身份）新增 Cursor 分支，读取 conversation_id；`getAgentResumeArgv`（生成恢复命令参数）改为只接受该身份，生成 cursor-agent --resume 对话编号。session_id 是运行实例编号，不作为 Cursor 历史对话恢复目标。
  - `src/shared/agent-session-resume.test.ts`：验证正确身份、两类编号并存、拒绝缺失/非法编号及不匹配类型。
  - `src/main/agent-hooks/server-cursor-normalization.test.ts`：验证开始提问、结束、返回答复三类真实事件规范化时不丢对话编号。
  - `src/renderer/src/components/terminal-pane/pty-connection-cold-restore-agent-resume.test.ts`：把既有 Codex 重连测试参数化，增加 Cursor，检查实际传给终端连接层的命令及身份。
  - `src/renderer/src/components/terminal-pane/pty-connection-cursor-resume-persistence.test.ts`：新增事件 → 完成会话恢复记录 → JSON 保存/重新读取 → 恢复启动计划的测试；同时覆盖本地和 SSH，工作区采用普通文件夹，不依赖 Git。
  - PRD、plan、ASSUMPTIONS、PROJECT_STATUS 同步记录本次需求、步骤、身份依据和验证边界。
- **Why（为什么这么做）**：
  - 用户报告仅 Cursor 在重启后回到普通命令行。通过 Playwright 调试连接读取运行中状态，两个 Cursor 条目均缺少 providerSession（原生恢复身份），其他 Codex 有该字段。共享提取函数此前直接忽略 Cursor，无法产生可保存恢复记录。
  - 已安装 Cursor CLI 事件构造代码使用 conversation_id 标识对话。上一轮采用 session_id 的修复仅解决类型检查，不能解决恢复，现予纠正。
  - 不新增并行恢复机制，沿用既有事件、保存和终端启动链路；不根据目录中最新对话猜测标签归属。
- **How（怎么实现的）**：
  - Cursor 事件 → 提取 conversation_id → 保存原生恢复身份 → 生成持久恢复记录 → 重启读取 → 原执行主机终端接收 cursor-agent --resume 命令。
  - 先验证五项失败用例，再修改业务分支。最终 190 项相关测试通过，CLI 构建及修改文件代码检查通过。未增加远程协议字段或操作码，复用既有可选身份字段；旧端仍可忽略不认识的 Cursor 恢复记录。
- **用户须知**：新事件可建立恢复身份。旧版已丢失身份的空白标签不会仅靠代码更新自动找回关联；arrow3d 本地两份 Cursor 对话文件仍在，可确认后重新恢复。没有向现有智能体发送提示或清空历史。
- **已知限制**：全量前端类型检查存在其他项目错误；没有执行真实退出/重启恢复验收。当前运行时读取检查不等同于新代码已完成真实恢复。
- **关联假设**：Cursor 恢复使用持久对话身份。
- **最终范围确认**：用户明确“老的不用兼容”，因此取消旧标签补绑，不修改历史数据。需要重新启动开发版主进程加载修复，新 Cursor 对话产生事件后会建立恢复记录。前端类型检查最终结果中本轮修改文件无报错，其他项目错误仍存在。


## [2026-09-16] 修复“在工作树中恢复”的展示参数错误
- **What（做了什么）**：
  - `src/renderer/src/components/work-items/local-task-session-resume.ts`：`resumeLocalTaskSession`（查找或恢复任务原生会话、绑定返回终端并提供导航目标的函数）把本地控制路径的 presentation 从非法 visible 改为 focused；远程运行时保留 background。请求对象使用 `RuntimeEnsureAgentSessionRequest`（主机恢复请求的共享类型）作编译期校验，今后非法字段值会导致类型检查失败。
  - `src/renderer/src/components/work-items/local-task-session-resume.test.ts`：模拟远程调用时先执行主进程真实参数校验器；新增 Cursor 的本地、SSH、远程运行时三个场景，并核对返回终端绑定。原测试错误地期待 visible 且完全跳过校验，现已纠正。
  - PRD、plan、ASSUMPTIONS、PROJECT_STATUS 更新需求、进度、展示约定及验证边界。
- **Why（为什么这么做）**：恢复请求在执行恢复前就被参数校验拒绝，根因是调用端和接口约定不一致，不是历史对话丢失。复用既有合法选项比扩展协议更小且兼容当前主机。
- **How（怎么实现的）**：点击恢复 → 按原执行主机发送合法请求 → 主机查找或恢复原会话 → 使用主机返回的标签编号重绑任务 → 导航至终端。focused 表示打开并聚焦；background 表示后台恢复，避免抢占远程主机界面。SSH 和普通文件夹仍沿用既有主机/工作区解析，无协议变更。
- **验证**：修复前真实校验器复现三项相同 Invalid option 错误；修复后任务恢复、工作区导航和主机接口共 36 项测试通过，代码、格式及差异空白检查通过。全量前端类型检查仍有其他项目错误，本轮两份文件无类型报错。
- **用户须知**：没有新增配置；开发界面加载更新后可重新点击“在工作树中恢复”。此前请求在校验阶段失败，不会因为本错误已经执行一次恢复。
- **已知限制**：尚未在真实会话上点击恢复验收；不兼容或补绑旧会话的用户约定保持不变。
- **关联假设**：任务手动恢复沿用接口既有展示方式。


## [2026-09-16] 任务详情增加独立待办与转为子任务

- **What（做了什么）**：
  - `src/shared/local-task-types.ts`：新增 `LocalTaskChecklistItem`（普通待办数据，含唯一编号 id、文本 title、是否完成 completed）和 `LocalTaskChecklistChange`（单条变更请求）。变更请求的 action 支持 add（添加文本）、update（按 itemId 修改文本或完成状态）、delete（按 itemId 删除）；未提供的内容保持原值。任务新增可选 checklist 清单；任务更新请求新增可选 checklistChange；会话创建请求新增可选 sourceChecklistItemId，表示要转换的原待办编号。全部新增字段均可省略，旧任务没有清单时按空清单显示。
  - `src/main/ipc/local-task-ipc-validation.ts`：在现有桌面进程间调用校验中接受上述变更和来源编号，拒绝空白文本、超过 500 字的内容和非布尔勾选状态；不另建平行接口。保留原先未提交的终端恢复校验改动。
  - `src/main/local-tasks/checklist-mutations.ts`：新增单条清单变更与转换前校验。新增待办生成唯一编号并限制最多 100 条；更新和删除读取最新任务后仅修改目标条目，避免整张清单覆盖其他窗口的改动。已删除条目报错；已完成待办需先取消勾选；澄清和任务报告会话不能承接执行子任务。
  - `src/main/local-tasks/file-store-mutations.ts`：任务更新函数 updateTask 在现有持久化写入中处理清单变更，普通勾选不改父任务状态、不创建会话或子任务。会话创建函数 createSession 在转换时新建一个以待办原文为标题的子任务，同时移除源待办，和会话放在同一次任务保存中；不占用原有未绑定子任务。同名待办不按提示词合并，同一会话请求重试仍复用已创建会话，换新会话再次转换同一已消费条目会被拒绝。
  - `src/renderer/src/components/work-items/mock-data.ts` 与 `local-task-view-model.ts`：任务展示模型增加可选清单，将持久化数据传给详情，旧任务缺少清单时提供空数组；保留原有终端绑定修改。
  - `src/renderer/src/components/work-items/LocalTaskChecklist.tsx`：新增独立“待办事项”区域，显示完成数/总数，支持新增、改名、勾选、删除和转换。复用现有按钮、输入框和勾选框组件及颜色样式变量。保存中禁用操作并防止重复提交，失败显示原位错误并保留输入；输入框支持 Enter 保存、Escape 取消，中文输入法确认时不误提交。转换对话框独立于待办行挂载，源条目因后台刷新消失时仍可保留回读错误和重试入口。
  - `src/renderer/src/components/work-items/LocalTaskDetailPanel.tsx`：在子任务区域上方插入独立待办清单，以任务编号隔离编辑状态，切换任务不会带入上一任务的草稿。
  - `src/renderer/src/components/work-items/LocalTaskSubtaskCreateDialog.tsx`：复用原有选择 Agent 的创建流程，转换时预填且锁定待办文本。创建会话时提交源待办编号，由后端一次保存完成转换，不再额外调用子任务创建接口。会话创建失败时沿用原有未绑定终端清理，回读失败时重试只读取结果、不再次启动 Agent。会话展示标题截到接口的 500 字上限，完整待办内容仍作为执行请求和子任务标题保留。主目录任务按自身项目和路径定位工作区，找不到时提示先打开目标工作区，不再借用其他项目的活动工作区；已明确的普通文件夹和远程工作区编号原样交给既有启动器解析执行主机。
  - `src/main/local-tasks/checklist.test.ts`：新增 8 项存储与接口测试，覆盖序列化往返、普通操作状态隔离、失败不消费、重复转换、同名转换、无项目收件箱、无效输入以及条数上限。
  - `src/renderer/src/components/work-items/LocalTaskChecklist.test.tsx`：新增 10 项交互测试，覆盖增改删勾选、输入失败重试、转换确认、回读重试、实时刷新、完成禁用、正确项目、普通文件夹与远程工作区编号传递、长文本边界和未加载项目保护。
  - `PRD.md`、`plan.md`、`ASSUMPTIONS.md`、`PROJECT_STATUS.md` 与本记录：补充用户确认范围、执行进度、默认行为及验收证据。
- **Why（为什么这么做）**：
  - 普通小事项不应为了获得一个勾选框而创建执行会话。独立清单可以随父任务保存，同时在真正需要执行时进入原有子任务流程。
  - 不以“先创建子任务、再删除待办”的两次前端写入实现转换，避免第二次保存失败造成重复数据；不整体回写清单，避免并发覆盖。
  - 沿用原有任务持久化和 Agent 启动器，不新增数据库、远程执行机制或命令行入口。
- **How（怎么实现的）**：
  - 普通操作：清单按钮 → 现有任务更新接口 → 基于最新任务应用单条变更 → 现有任务持久化 → 更新详情。
  - 转换：待办“转为子任务” → 确认内容并选择 Agent → 既有启动器在目标工作区创建终端 → 现有会话创建接口校验待办 → 一次保存会话、新子任务和剩余清单 → 回读并更新详情。
  - 如果持久化抛错，旧待办、会话和子任务数据不改变；已保存后只是回读失败则显示重试入口，不重复创建会话。旧版本桌面进程不认识新请求字段时会明确拒绝，原清单不被前端自行删除。
- **用户须知**：
  - 使用方法：任务详情 → 待办事项 → 新增待办 → 输入文本保存；勾选只改变该待办完成状态。需要执行时取消完成勾选，再点击转为子任务并选择 Agent，成功后在子任务列表查看。
  - 单条待办最多 500 字，每个任务最多 100 条；完成项可改名、删除或取消勾选。普通待办保存在应用任务元数据中，无项目的收件箱也能记录。
  - 本轮更新主进程接口，旧运行进程需加载新版代码后才能使用；未主动重启用户运行中的应用或真实启动 Agent 验收。
- **验证结果与已知限制**：
  - 7 个相关测试文件共 57 项通过；其中本轮新增 18 项，另外复用持久化、会话生命周期、接口校验、详情和展示模型回归。
  - 本轮 11 份源码及测试文件的 oxlint 代码检查、格式检查通过；主要新增/变更模块的额外代码质量规则通过；差异空白检查通过。
  - 全量 pnpm tc 未通过，包含应用状态字段、构建常量与工程文件列表等错误；其中前端工程会递归带入未纳入文件列表的主进程模块，也包含新清单模块。以关闭 composite 工程文件列表约束的补充前端检查确认，本轮修改文件未出现类型错误，整个工程仍有其他错误；这不等于全量类型检查通过。
  - 真实 Electron 渲染及实际 Agent 执行未验收：项目 AGENTS.md 要求 electron 技能和 Playwright 调试连接，当前技能目录及插件目录中未找到 electron/SKILL.md，未改用禁止的 computer-use。文件夹/远程工作区仅验证编号传递，未实测远程进程。
  - 未增加 CLI 管理待办、拖拽排序、独立到期日期或子任务反向转待办。
- **关联假设**：ASSUMPTIONS.md 的“待办转换复用子任务执行入口”。


## [2026-09-16] 去掉新增待办的确认按钮
- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskChecklist.tsx`：新增状态下仅展示输入框，移除保存与取消按钮；新增统一草稿提交函数，回车或输入框失去焦点时将非空文本通过已有任务更新接口添加。沿用正在保存的标记防止重复请求，失败保留输入和错误；Escape 收起时标记为主动退出，防止失焦误提交。编辑已有条目仍保留保存与取消按钮。
  - `src/renderer/src/components/work-items/LocalTaskChecklist.test.tsx`：原新增失败重试用例改为表单提交并断言两按钮不存在；补充失焦添加与重复事件防护、空白和 Escape 不添加的交互回归，保留既有改名/删除/转换测试。
  - 需求、计划、假设、项目现状文档同步本次小范围交互变更。
- **Why（为什么这么做）**：用户认为新增不需要额外确认，误加后可以删除。以回车或失焦作为提交边界，既减少一次点击，也避免输入过程中产生多条不完整待办。
- **How（怎么实现的）**：新增待办 → 输入文本 → 回车或失焦 → 复用现有单条新增请求 → 成功后关闭输入区；失败保留草稿供再次回车或失焦重试。
- **用户须知**：新增无需点击保存；空白内容不会添加，误加仍使用该行删除按钮。已有待办编辑方式保持原样。
- **验证**：清单和详情共 13 项交互回归通过，两个修改文件的代码与格式检查通过，差异空白检查通过。未重跑主进程测试或全量类型检查，本轮没有修改主进程或数据结构；未执行真实 Electron UI 验收。
- **已知限制**：自动提交以回车或失焦为触发点，不逐字持久化。
- **关联假设**：ASSUMPTIONS.md 的“新增待办直接添加的触发方式”。


## [2026-09-16] 子任务复用关联会话侧栏
- **What（做了什么）**：
  - `src/renderer/src/components/work-items/LocalTaskSubtaskBlock.tsx`：子任务块增加 onOpenSession 回调（按会话编号打开已有侧栏）。在当前任务会话列表中找到关联会话时，将子任务标题和右侧会话名称放入同一个原生按钮；提供鼠标悬停和键盘焦点样式。未绑定或关联会话不存在时保持普通文本。完成勾选与步骤编辑按钮位于预览按钮外，不会同时触发预览。
  - `src/renderer/src/components/work-items/LocalTaskDetailPanel.tsx`：向子任务块传递已有的 onOpenSession 回调，与关联会话卡片使用同一个函数；详情侧栏原有逻辑无需修改。
  - `src/renderer/src/components/work-items/LocalTaskDetailPanel.test.tsx`：使用真实子任务块和关联会话卡片验证两个入口向同一个回调传入相同会话编号；覆盖已完成子任务、无关联、失效关联、独立勾选和步骤编辑。测试挂载现有 TooltipProvider（提示气泡所需的上下文组件），避免缺少应用层上下文导致测试报错。
  - 更新 PRD.md、plan.md、PROJECT_STATUS.md 和本记录。
- **Why（为什么这么做）**：用户希望从子任务直接查看执行会话。复用既有侧栏入口可以保持预览、历史和终端展示行为一致，不维护第二套侧栏或导航状态。
- **How（怎么实现的）**：点击子任务标题/会话名称 → 详情已有的会话打开回调 → 设置当前侧栏会话编号 → 原侧栏显示相同的关联会话。不会切换到工作区或创建新会话；会话是否运行不影响打开入口。
- **用户须知**：已完成的子任务仍可查看关联会话；左侧勾选只切换完成状态，步骤编辑只编辑步骤。只有当前任务列表中存在关联会话时才显示可点击区域。
- **验证**：详情与清单共 14 项交互回归通过，3 个修改文件代码、格式及差异空白检查通过。未改持久化、主进程或远程协议，未重跑全量类型检查；真实 Electron 界面未验收。
- **已知限制**：关联会话不存在时不提供预览入口，沿用现有侧栏能力；本轮没有新增会话恢复机制。
- **关联假设**：无。


## 2026-09-17：侧边栏按工作区显示任务

- **What（做了什么）**：
  - `src/shared/sidebar-workspace-content.ts`：定义工作区下方内容偏好，`sessions` 表示显示 Agent 会话（默认），`tasks` 表示显示任务；未知值回到会话。`src/shared/persisted-ui-state-types.ts`：为软件配置增加可选偏好字段。
  - `src/renderer/src/store/slices/ui.ts`：接入偏好的初始值、切换保存和启动恢复。`src/main/persistence/applying-settings/ui-state-read.ts`、`ui-state-update.ts`：在读取和更新时统一校验，旧配置没有该字段时继续会话模式。
  - `src/shared/pairing-local-ui-fields.ts`：把该偏好列为各客户端自己保存的界面设置。`src/renderer/src/web/preload-api/web-preference-normalization.ts`：接收主机界面状态时保留浏览器自己的选择。`src/main/runtime/rpc/methods/client-ui-schemas.ts`：接受新客户端提交的可选字段，随后由已有边界逻辑去除，不修改远端主机偏好；旧主机由客户端发送前去除机制保护。
  - `src/renderer/src/components/sidebar/SidebarWorkspaceContentMenu.tsx`：在现有工作区设置中提供“会话／任务”单选项。`workspace-options-menu-items.tsx`：挂载菜单，窄侧栏和正常宽度共用。`SidebarHeader.tsx`：任务模式显示“· 任务”，活动视图不显示该标注。
  - `src/renderer/src/components/sidebar/worktree-card-secondary-rows.tsx`：在每个原工作区卡片下切换任务列表或会话列表。`use-worktree-card-secondary-details.ts`：任务模式停止准备隐藏的内嵌会话列表。项目、工作区、普通文件夹、可见性与排序继续由既有工作区列表负责。
  - `src/renderer/src/components/sidebar/WorktreeCardTasks.tsx`：按项目编号和工作区编号读取任务，显示标题、图标和中文状态；保留标题悬停提示；未完成任务按最近更新显示，超过 5 条可展开；已完成任务另行折叠。排除收件箱、已归档和未绑定工作区任务。空工作区仍保留并显示空状态。点击任务不向工作区父卡片冒泡，也不触发工作区拖动。
  - `src/renderer/src/components/work-items/local-task-status-presentation.tsx`：从 `work-item-pieces.tsx` 提取现有状态图标和颜色；原文件转为重导出，使事项中心保持原样，侧边栏可直接复用轻量模块。
  - `src/renderer/src/components/work-items/LocalTaskCatalogProvider.tsx`、`local-task-catalog-context.ts`：提供窗口内共享任务数据和项目／工作区索引；`src/renderer/src/App.tsx` 将工作区界面接入该共享入口。首次进入事项中心或开启任务模式后才读取列表，随后保持单组变更与删除监听，避免关闭页面期间错过删除通知。
  - `src/renderer/src/components/work-items/use-local-task-center-data.ts`：在本轮开始时已有的未提交加载逻辑上扩展共享入口，保留刷新期间事件优先、删除保护、旧请求作废和详情编辑保护；事项中心按所选项目派生列表，更新时保留其他项目数据。侧边栏行不各自调用任务列表。
  - `src/renderer/src/components/work-items/mock-data.ts`、`local-task-view-model.ts`：增加原始更新时间供排序；共享实时状态计算在远程证据缺失时保留任务原状态、标记会话无法核实，重新收到已确认会话事实时清除提示，避免把断线误显示成已完成或待审阅。
  - `src/renderer/src/components/work-items/local-task-navigation.ts`：暂存指定任务目标。`use-local-task-navigation.ts`：等待数据加载、切换目标项目、清空搜索与标签筛选、切换正确任务队列并展开详情；匹配项目、任务编号和路径，找不到则提示不可访问，不跳到别的任务。`WorkItemsPrototypePage.tsx`：消费共享状态与导航请求，保留本轮之前已存在的详情刷新保护改动。
  - 新增 `WorktreeCardTasks.test.tsx`、`SidebarWorkspaceContentMenu.test.tsx`、`use-local-task-navigation.test.tsx`，覆盖共享订阅、普通文件夹归属、同编号不同项目隔离、实时更新、折叠排序、点击隔离和精确导航。扩展 `local-task-view-model.test.ts`、`src/main/persistence-ui-state.test.ts`、`src/main/runtime/rpc/methods/client-ui-pairing-local-fields.test.ts`、`src/renderer/src/web/web-preload-api-ui.test.ts`，覆盖断线重连、持久化往返和配对客户端边界。
- **Why（为什么这么做）**：
  - 任务数据和工作区结构都已存在，因此只替换工作区下方的展示层，无需增加第二套任务存储或重做事项中心。
  - 共享一份加载结果与状态计算，避免每个工作区发请求、两处状态不同；状态展示单独提取，避免侧边栏为了图标加载整组任务操作组件。
  - 继续通过事项中心的原详情阅读会话，防止在窄侧边栏中重复构造子任务和会话树。
- **How（怎么实现的）**：
  - 当前软件配置的任务目录 → 单组列表请求与任务事件 → 统一实时状态 → 项目／工作区索引 → 侧边栏任务行。事项中心从同一数据派生所选项目列表。
  - 任务行点击 → 保存精确任务目标 → 打开事项中心 → 等待匹配数据 → 清除阻挡目标的筛选 → 展开原详情。
  - 远程无证据 → 保留已有任务状态并提示“状态待确认”；恢复后收到会话事实 → 重新计算并清除提示。没有向远程发送执行命令或自动恢复会话。
- **用户须知**：在侧边栏右上角工作区设置中选择“工作区下显示内容 → 任务”；选择会自动保存。再次选择“会话”可回到原展示。已归档、收件箱和失去工作区匹配的任务继续从事项中心访问。普通文件夹工作区使用同一归属规则。
- **验证**：11 个测试文件共 185 项通过；Vite 前端生产构建成功，输出在 `/tmp/orca-sidebar-renderer-build`。32 个本轮源码／测试文件的格式检查、原生代码规则及类型感知代码规则检查通过。普通 lint 仅剩 `src/renderer/src/store/slices/ui.ts` 超行问题，该文件原版已远超 300 行限制；没有禁用或提高限制。前端完整类型检查仍有 238 项分支既有错误，修改文件中仅 SidebarHeader 原有 sidebarBody/setSidebarBody 类型缺失；主进程类型检查 41 项既有错误，本轮修改文件无报错。
- **已知限制**：未做真实 Electron 点击、浅深色、窄宽度和远程机器联调；项目要求的 electron 技能在已配置及常用技能目录中未找到，因此没有用其他 UI 工具替代。生产构建不等同真实桌面验收。现有分支的全量类型与代码检查错误仍需原任务处理。
- **关联假设**：ASSUMPTIONS.md 的“侧边栏任务展示边界”和“任务列表折叠数量”。


## 2026-09-17：空项目默认折叠与工作区右键新建任务
- **What（做了什么）**：
  - `src/renderer/src/components/sidebar/WorktreeCardTasks.tsx`：空工作区返回空内容，移除“暂无可执行任务”及其占位区域；真实加载失败仍保留重试入口。
  - `src/renderer/src/components/sidebar/use-task-project-collapse.ts`：根据共享任务目录派生无未完成可执行任务的项目分组；沿用既有项目、项目组和多主机项目分组编号，支持普通文件夹所属项目组及父级。只有任务模式、按项目分组、首次加载成功后才自动折叠；手动展开优先，新任务进入后解除自动折叠。
  - `src/renderer/src/components/sidebar/WorktreeList.tsx`：将上述默认折叠接入既有分组、滚动定位和展开处理；Agent 定位展开仍在最终层生效。自动折叠不写入原会话模式的持久化折叠列表。
  - `src/renderer/src/components/work-items/open-local-task-composer.ts`：抽取共享新建任务入口；先进入事项中心，再打开原 `new-workspace-composer` 弹窗（现有创建工作区／本地任务共用的弹窗），启用本地任务和已有工作区模式，传入右键项目、工作区编号及主机编号；普通文件夹同时预选所属项目组。只打开弹窗，不直接创建任务或启动 Agent。
  - `src/renderer/src/components/work-items/use-local-task-center-interactions.ts`：事项中心原新建按钮使用同一入口，保持只预选项目的原使用方式。
  - `src/renderer/src/components/sidebar/WorktreeContextMenuView.tsx`：单个工作区右键菜单增加“新建任务”；删除中的工作区不可使用。菜单关闭时如果新建弹窗已打开，不再把焦点拉回工作区列表。
  - `src/renderer/src/components/NewWorkspaceComposerModal.tsx`：补充弹窗可选初始工作区和执行主机参数，不另建任务弹窗。
  - `src/renderer/src/hooks/use-local-task-workspace-selection.ts`：从原创建逻辑中提取工作区选项与预选逻辑，响应目录变化；按选中的项目提供 Git 工作区及普通文件夹工作区。显式右键目标优先于活动工作区、主工作区；目标暂缺时不静默替换成其他工作区。没有显式目标时保持原先的默认选择规则。
  - `src/renderer/src/hooks/useLocalTaskComposer.ts`：复用上述选择逻辑，创建时从当前项目候选中按工作区和目标主机核对路径；不再以活动主机查找右键工作区。目标不可用时提示重新选择，不会创建到其他目录。
  - 新增 `use-task-project-collapse.test.tsx`、`open-local-task-composer.test.ts`、`use-local-task-workspace-selection.test.tsx`，并扩展 `WorktreeCardTasks.test.tsx`：覆盖加载空窗、任务筛选、父子项目组和普通文件夹、手动展开、返回会话模式、精确预选、远程目标与活动主机不同、目标不可用拒绝创建、空工作区无占位。
- **Why（为什么这么做）**：消除空项目中的重复空提示，保留快速展开和右键创建能力；创建弹窗、项目分组和工作区目录均复用现有机制，避免另一套任务创建流程。
- **How（怎么实现的）**：共享任务目录 → 未归档且可执行、未完成的项目集合 → 现有分组编号 → 默认折叠＋手动展开覆盖。工作区右键 → 事项中心 → 原创建弹窗 → 预选项目和工作区 → 用户提交 → 核对目标主机及路径 → 原任务创建接口。
- **用户须知**：“未开始／进行中／待审阅”均计入未完成可执行任务；收件箱、已完成及归档不计入。手动展开空项目后仍可右键任意工作区新建任务，弹窗中可以继续修改选择。
- **验证**：6 文件 28 项测试通过；13 个本轮源码／测试文件格式、普通代码规则、原生代码规则及类型感知规则检查通过；前端生产构建通过。前端完整类型检查仍有分支既有 238 项错误，本轮修改文件没有类型报错。
- **已知限制**：项目要求的 electron 技能仍未找到，未做真实桌面点击、焦点及远程联调；上述测试为组件／逻辑验证。自动折叠的手动覆盖保持在当前列表生命周期内，不新增持久化设置。
- **关联假设**：ASSUMPTIONS.md 的“空项目默认折叠”。
## 2026-09-17：事项中心全部项目看板按项目分组
- **What（做了什么）**：
  - `src/renderer/src/components/work-items/WorkItemsPrototypePage.tsx`：全部项目筛选（`projectFilter === 'all'`）进入任务看板时传入按项目分组标记；单项目筛选保持原状态列布局。
  - `src/renderer/src/components/work-items/work-item-views.tsx`：`BoardView` 新增项目分组模式。项目组标题显示项目名和任务数，组内仍按 `Open`、`In progress`、`Waiting`、`Needs review`、`Done` 状态列展示；标题按钮支持键盘和鼠标折叠，折叠状态只在当前页面生命周期内保留。
  - `src/renderer/src/components/work-items/work-item-views.test.tsx`：覆盖多项目分组及单独折叠项目后其他项目仍可见。
- **Why（为什么这么做）**：全部项目时任务来自多个项目，直接混在状态列中难以确认归属；把项目作为第一层分组能保留状态看板语义，同时避免改变单项目用户已经熟悉的布局。
- **How（怎么实现的）**：筛选范围 → `BoardView(groupByProject)` → 项目分组 → 每组状态列 → 任务卡片；折叠只隐藏该项目组的状态列，不修改任务数据或筛选条件。
- **用户须知**：事项中心选择“全部项目”后，可点击项目标题收起或展开该项目；切换筛选或重新打开页面后按默认展开显示。
- **已知限制**：本轮未做真实 Electron 窗口点击验收；完整类型检查仍被仓库现有的大量类型错误阻塞。

## 2026-09-18：看板分组标题使用项目名
- **What**：WorkItemsPrototypePage.tsx 向看板传入现有项目选项；work-item-views.tsx 根据分组编号读取选项名称作为标题；work-item-views.test.tsx 验证标题为显示名称且仍能折叠。
- **Why**：任务的 project 字段存储项目编号，直接渲染会显示一串内部编号；复用筛选菜单名称可与用户已有项目命名一致。
- **How**：项目目录 → 已有筛选选项的编号与名称 → 标题显示名称；分组和折叠身份保持编号，避免同名项目合并。
- **用户须知**：本次只修正项目分组标题；项目目录找不到对应记录时保留编号作为兜底。
- **验证**：定向组件测试；未做真实 Electron 界面验收。
- **组件整理**：新增 ProjectBoardSection.tsx 承载项目标题、任务数量与折叠状态，复用现有按钮控件提供键盘焦点样式；原看板文件恢复到行数限制内。4 个涉及文件代码检查通过，3 项定向测试通过。

## 2026-09-18：项目 Open 列快捷新建
- **What**：ProjectBoardSection.tsx 新增加号按钮，提供项目名悬停提示及无障碍名称；work-item-views.tsx 仅在项目分组的 Open 列底部渲染按钮，回调传项目编号；WorkItemsPrototypePage.tsx 直接接入现有 openLocalTaskComposer（预选项目并打开新建任务弹窗的入口）。work-item-views.test.tsx 验证两个项目各有一个入口且传递正确编号。
- **Why / How**：项目 Open 列加号 → 原创建入口 → 原弹窗预选项目 → 用户填写提交；复用原有工作区选择及主机归属逻辑，避免创建另一套流程。
- **用户须知**：点击加号只打开弹窗，不直接创建或派发任务；当前入口在全部项目的任务看板中。
- **验证**：相关组件和原创建入口测试通过；代码检查通过，未进行真实 Electron 界面验收。

## 2026-09-18：看板恢复状态竖列并在列内折叠项目
- **What（做了什么）**：
  - `work-item-views.tsx` 的 BoardView（任务看板）统一使用原四状态列骨架，在“全部项目”时于每列滚动区内渲染项目分组；列头显示状态总数，组头显示当前列内任务数，Open 的项目新建回调继续传原项目编号。单项目仍直接展示卡片。
  - `ProjectBoardSection.tsx` 的 ProjectBoardSection（项目折叠容器）改为适合列宽的紧凑标题，长名称省略、数量不压缩、分组不压缩高度；复用已有完成/空组默认折叠判断及手动覆盖。修正项目列表初始化的条件语句大括号以符合代码规则。
  - `work-item-views.test.tsx` 更新原分组交互回归，确认仅四个状态区域、正确放置任务、空组与完成组默认折叠、跨列和跨项目折叠隔离、空项目创建绑定及卡片选择。
  - `plan.md`、`PRD.md`、`ASSUMPTIONS.md`、`PROJECT_STATUS.md` 同步任务、需求、判定范围和验证状态。
- **Why（为什么这么做）**：项目作为最外层会重复切断状态列，无法纵向浏览所有同状态任务。复用原状态列并移动已有项目折叠组件，消除重复列骨架，保留原操作方式。
- **How（怎么实现的）**：现有任务集合 → 四状态列 → 各项目在该状态下的任务 → 项目折叠区 → 原任务卡片；项目加号 → 原新建弹窗 → 预选项目。每个项目折叠组件属于自己的状态列，互不联动。列头固定、各列内容独立纵向滚动。
- **用户须知**：无新配置；Done（已完成）及当前列无任务的组默认收起，可手动展开。Open（待处理）空项目需要展开后点击加号。In progress（进行中）与 Needs review（待审阅）的非空组默认展开。
- **验证**：2 文件 5 项相关测试通过；本轮 3 个源码/测试文件代码和格式检查通过。
- **已知限制**：本地技能目录及插件缓存未找到项目要求的 electron 技能，未执行真实 Electron 点击、滚动和跨平台视觉验收；组件测试不能替代桌面验收。仅修改前端展示，无远程协议、执行主机或文件夹工作区数据逻辑变更。
- **关联假设**：ASSUMPTIONS.md「列内项目默认折叠范围」。
- **类型检查补充**：完整前端类型检查失败，报错涉及其他模块及项目文件包含配置；本轮修改的看板和折叠组件未出现在错误输出中。

## 2026-09-18：隐藏状态列中的零任务项目
- **What**：`work-item-views.tsx` 在项目分组渲染前检查该项目在当前状态列的任务数量，数量为零直接跳过；删除不再可达的组内空提示。列级空提示统一按当前状态任务总数判断。`work-item-views.test.tsx` 更新已有回归，验证空项目完全隐藏、有其他状态任务的项目不会出现在空状态列、整列为空时显示提示，保留非空组折叠和新建绑定验证。
- **Why**：大量零任务标题占用纵向空间；直接跳过空组可突出当前需要浏览的任务。
- **How**：状态列 → 项目在该状态下的任务 → 数量大于零才显示项目折叠区；状态列总任务数为零时显示一条统一提示。
- **用户须知**：空项目没有列内加号，可通过页面原有新建入口创建任务；非空 Open（待处理）项目的加号不变，非空 Done（已完成）项目默认折叠不变。
- **已知限制**：未执行真实桌面验收，沿用前次缺少 electron 技能的验证限制。
- **关联假设**：已按用户决定更新 ASSUMPTIONS.md 的空组展示假设；PRD.md、plan.md 和 PROJECT_STATUS.md 已同步。
- **验证**：既有组件回归 3 项通过；两个修改文件代码检查、格式化及差异空白检查通过。


## [2026-09-19] 子任务自动发现相关上下文并按需读取参考

- **What（做了什么）**：
  - `src/shared/local-task-types.ts`：子任务新增可选 `description`，保存创建时的执行目标；当前任务响应可提供父描述、同级概览和选中的参考快照，保留当前会话负责的子任务列表。
  - `src/shared/local-task-reference-types.ts`：定义只读概览和详细参考响应，明确描述来源、是否截短、历史来源与完整性。
  - `src/shared/local-task-reference-context.ts`：统一生成两层上下文；概览只包含其他子任务的编号、标题、描述、状态和关联会话编号，不携带回答或执行步骤。每项描述预览最多 2,000 字符，选中后返回完整保存描述及该会话已有记录。
  - `src/main/local-tasks/store.ts`：默认子任务保存父任务的初始目标；同时消除相同类型的重复导入，不改变存储行为。
  - `src/main/local-tasks/file-store-mutations.ts`：首次关联、后续新会话及显式创建子任务时保存执行要求，后续追问不覆盖子任务初始描述。
  - `src/main/runtime/rpc/methods/local-tasks.ts`：当前任务接口返回父目标和其他子任务概览；可选参数只接受当前父任务内的子任务编号，返回只读参考。原有工作区、会话和编辑权限检查保留。
  - `src/cli/specs/local-tasks.ts`、`src/cli/handlers/local-tasks.ts`：在现有 `local-task current` 命令上增加可选 `--reference <子任务ID>`；未选择参考时不发送新请求字段，选择后运行时不支持则明确失败，不静默忽略。
  - `src/renderer/src/components/work-items/local-task-agent-prompt.ts`：启动后先读取父目标和同级标题/描述，自行判断相关性，无关则跳过；相关时按编号读取。长历史复用 handoff 的按目标整理和引用证据规则，由当前会话完成，不要求用户手动关联、不恢复来源会话，也不因缺少 skill 阻塞。
  - `src/main/local-tasks/reference-context.test.ts`：覆盖初始描述在追问和 Store 重建后仍保留、长描述按需展开、旧记录来源标注、未启动子任务不唤醒会话。
  - `src/main/runtime/rpc/methods/local-tasks.test.ts`：更新旧的仅返回当前子任务断言，验证概览与编辑责任分离、参考读取不改变来源、跨父任务读取和修改他人子任务被拒绝；调用使用实际参数校验器。
  - `src/cli/handlers/local-task-current.test.ts`：验证无参考请求保持原参数、参考编号与当前会话编号分开、旧运行时错误明确透传。
  - `src/renderer/src/components/work-items/local-task-agent-prompt.test.ts`：验证自动选择、按需读取、handoff 与不唤醒来源会话的启动约束。
- **Why（为什么这么做）**：
  - 用户明确希望由当前会话判断其他子任务是否有帮助，不增加手动关联操作。仅共享父任务编号不足以发现已有实现；直接注入所有会话历史又会带入无关内容。
  - 复用当前任务命令、软件持久化和启动提示词，不增加关系选择器、依赖图、独立摘要数据库或自动运行来源 Agent 的流程。
- **How（怎么实现的）**：
  - 新子任务启动 → 读取父目标及同级概览 → 当前会话判断相关性 → 只读选中参考 → 核对原始证据/当前代码 → 完成自己的子任务。
  - `referenceSubtasks` 是只读候选列表；`assignedSubtasks` 仍是当前会话负责的子任务。能看到其他目标不等于有权修改其状态或认领其工作。
  - `descriptionSource` 的四种取值：`subtask` 表示已保存的子任务初始目标；`retained-prompt` 表示旧记录里最早仍保留的一条请求，不能认作原始第一轮；`recent-prompt` 表示仅有最近请求；`unavailable` 表示没有可用描述。
  - `descriptionTruncated` 为 true 表示概览描述被截短，按编号读取可获得保存的完整文本。例如 1,000 字符要求原样返回；3,000 字符要求先返回前 2,000 字符，选中后返回全部 3,000 字符。
  - 详细参考的 `historySource=task-session-snapshot` 表示任务保存的会话快照；`historyIsComplete=false` 明确它不是完整原始会话。原生记录定位信息存在时一并返回，提示 Agent 在对应执行主机读取，不能把远程路径当本机路径。
- **验证**：8 个测试文件共 43 项通过，覆盖 RPC、存储重建、生命周期、自动派发、CLI、提示词和待办转子任务。CLI 类型检查、CLI 完整构建、13 个本轮文件格式检查、原生规则及类型感知规则检查通过。
  - 普通代码检查仍报 `store.ts` 357 个非空行超过 300 行限制；HEAD 同文件也是 357 个非空行，本轮没有增加该计数、没有禁用规则。
  - 主进程全量类型检查有 41 项其他模块诊断，本轮文件无诊断。前端全量类型检查有 3,267 项诊断，包含现有主进程依赖被前端配置带入后的文件包含错误；本轮修改的主进程文件也受到这一配置问题影响，未声称全量通过。
  - 没有启动真实业务 Agent、修改真实任务或重启应用；因此 Agent 是否正确选择参考、真实远程原始记录读取仍待实际验收。本轮没有界面布局改动。
- **用户须知**：
  - 用户照常创建子任务，不需要选择参考关系。更新并重启当前工作区的 Orca 运行时后，新建会话获得新的启动说明和读取结果。
  - Agent 使用 `orca local-task current --json` 看概览；用 `orca local-task current --reference <子任务ID> --json` 看选中的记录。这里的编号来自概览，不是需要用户手填的新操作。
  - 已运行的旧会话不会自动收到新启动提示词；已有旧任务不会被批量回填描述。对旧运行时使用新参考参数会明确报错，应升级对应运行时。
- **已知限制**：是否相关由 Agent 判断，没有新增确定性关联算法；会话快照可能含旧工具输出或缺失的历史，必须核对原文和代码。当前不新增完整原始会话读取器、不修改个人 handoff 技能；复用的是其整理规则，不运行来源会话的技能。
- **关联假设**：`ASSUMPTIONS.md` 中“子任务描述与按需参考来源”。


## [2026-09-20] 移除会话摘要和最近预览，历史默认折叠
- **What（做了什么）**：
  - `LocalTaskSessionHistory.tsx` 删除“本会话执行摘要”，不再传最近请求供显示；会话备注、标签保留。
  - `LocalTaskSessionTurnHistory.tsx` 删除“最近请求”；历史区复用已有折叠组件，侧栏初始收起，各轮问答也初始收起。关联卡片仍先通过原按钮展开历史，展开后可见轮次列表。
  - `LocalTaskSessionDisclosure.tsx` 增加 `defaultOpen`（初次是否展开）参数，默认 false；true 仅用于用户已经主动打开关联卡片历史后的内部历史区域。后续普通数据刷新不强制改变用户的展开状态。
  - `LocalTaskLinkedSessionCard.tsx` 移除“当前”请求预览，保留会话标题、状态、历史按钮和原终端入口。
  - 整改正文及技术附录记录用户最新决定：同轮重复、重复子任务和旧事件回退暂缓；不再列为立即必做。
- **Why（为什么这么做）**：用户已有会话历史，不需要在旁边重复显示最近内容和摘要；低频记录问题暂不投入改造。
- **How（怎么实现的）**：移除两类重复展示 → 复用现有折叠控件 → 保留原问答与终端入口。未新增状态系统，也未修改后端写入、创建或历史数据。
- **用户须知**：侧栏先看到“会话历史”标题，点击后显示各轮标题，再展开需要阅读的轮次；关闭重开恢复默认收起。关联卡片历史入口原本默认关闭，继续保持。
- **验证**：现有详情、待办和任务页面三个组件测试文件共 22 项通过；四个修改文件普通及原生代码规则检查通过。没有为此次小范围显示调整新建测试；现有测试不等于真实桌面验收。
- **已知限制**：没有执行真实 Electron 检查。项目 AGENTS 要求使用 electron 技能配合 Playwright CDP，当前已检查的个人技能与插件目录未找到该技能；未使用其他桌面工具代替，未重启用户应用。底层旧结果内容仍保留，本次只是移除重复显示。
- **关联假设**：ASSUMPTIONS.md“最近消息显示范围”。


## [2026-09-20] 子任务参考问答、模板来源对照和描述版本写回
- **What（做了什么）**：
  - 当前任务概览默认只给父任务标题/描述和其他子任务标题、描述、状态。`--reference` 只返回已保存问答轮次 `savedTurns`，不含工具输出或完整原始会话。
  - 启动子任务和澄清提示要求：自行判断相关性；相关且问答较多时用 handoff 整理；不唤醒来源会话。
  - 从模板创建或套用模板时保存 `sourceTemplate`（编号、版本、当时提示词）。自动化详情对照当前模板，区分未绑定、已匹配、提示词已改、模板已更新。不自动覆盖已保存提示词。
  - `update-description` 增加 `--expected-revision`。描述版本是独立字段，会话更新不会改它。版本不匹配时拒绝写回。
- **Why（为什么这么做）**：用户要求只落实 1、2、7、8。默认读问答会浪费上下文；模板改源码不等于已保存自动化已更新；确认后的范围必须能安全写回。
- **How（怎么实现的）**：概览 → 自行判断 → 按需读 savedTurns → 必要时 handoff。模板来源随创建/套用写入，详情只对照。描述写回带期望版本。
- **验证**：相关测试 52 项通过，CLI 类型检查通过。`store.ts` / `automations-types.ts` 仍超过既有 max-lines，本轮没有禁用该规则。未重启应用，未用真实 Agent 验收。
- **用户须知**：更新运行时后新会话才会使用新提示。旧自动化没有来源字段时显示未绑定，不会按名称猜测。写回描述时带上 current 返回的 descriptionRevision。
- **已知限制**：是否相关仍由 Agent 判断。保存问答最多保留最近轮次，不保证完整。不自动把已有自动化升级到新模板。
- **关联假设**：ASSUMPTIONS.md“子任务参考、模板来源与描述版本”。
