# 项目现状（最后更新：2026-09-06）

## 当前实施状态

- 当前在 kanban1 原位重构，保留原看板、列表和详情交互。kanban2 已放弃，其实现不作为验收成果。
- 当前目标：软件持久化任务及步骤状态、子任务与会话一对一、运行优先的任务状态；三份项目 Markdown 仅保存可供 AI 续接的上下文；不兼容旧任务数据。
- 正在实施状态规则收敛；软件存储和一对一关系尚未完成。见 `plan.md` 顶部实际进度。
- 状态规则第一阶段已完成；任务元数据已接入 `PersistedState.localTasks`，但文件 Store 兼容路径仍待移除，不能视为最终存储边界。
- 一对一子任务/会话已完成；旧的子任务移交 CLI、RPC、preload 和详情选择器已删除。收件箱脱离 workspace 文件、旧文件 Store 清理和真实 Electron 验收仍在进行。
- PR 合并成功后不再自动迁移任务 workspace；任务验收与代码合入保持两个明确步骤。
- `transferWorkspace` 生产接口及旧迁移辅助文件已删除，任务 workspace 归属不会因 PR 合并自动变化。
- 空路径收件箱任务现在会在项目筛选下继续显示，直到用户将其整理到具体 workspace。
- 生产任务 Store 未注入 Orca profile 时会直接报初始化错误，不再静默回退到项目 `task.json`；旧文件 Store 仅剩测试/过渡路径。
- 收件箱整理现在使用显式 workspace 选择器，确认后才写入项目/workspace 归属；任务卡读取稳定索引，避免 selector 造成无限更新。
- 下方诊断是历史背景，与当前目标冲突处以 `TASK_REDESIGN_IMPLEMENTATION.md` 顶部基线为准。

## 最新诊断：2026-09-05

- 后续用户澄清：无需兼容旧任务逻辑或数据；必须保留同任务多会话和延后待办；完整会话是决策依据。最新建议改为从 main 新建干净分支重建任务层，优先解决完整会话阅读与稳定关联，详见诊断文档第 11 节。尚未切换分支或实施；以下旧数据迁移和优先交付卡建议已被本次澄清修正。

- 最新模型进一步收缩：任务只保存基础信息、项目/workspace 指向、状态和可跳转会话索引；不保存验收要求、执行请求、待处理事项、阅读位置、产物关联或 AI 摘要副本。项目任务继续使用 `orca/<task-id>/prd.md`、`plan.md`、`records.md` 作为长期上下文；`plan.md` 记录准备做什么，`records.md` 记录已经做了什么，完整会话仍由原 Orca 记录提供。详见诊断文档第 12 节。
- 待办与步骤的最新边界：待办状态由软件任务记录保存，使用 `todo`（未开始）、`doing`（有人处理）、`done`（明确完成）、`cancelled`（取消）；步骤不再属于任务层，只作为会话内部临时计划保留。`plan.md` 是可读计划，不参与状态推断；长期需要追踪的步骤由用户显式提升为待办。
- 存储边界的最新修正：任务状态、待办状态、项目/workspace 指向和会话关系由 Orca 软件持久化，不放在 Git 分支的 `task.json`。`prd.md`、`plan.md`、`records.md` 仅作为项目上下文文件；收件箱任务先放软件记录或软件管理的临时目录，转为可执行并选择项目/workspace 后才写入对应项目的 `orca/<task-id>/`。
- 收件箱规则已进一步确认：收件箱任务的项目/workspace 可以为空，主记录始终由软件管理；点击“转为可执行”并选择项目/workspace 后，才创建或移动 `prd.md`、`plan.md`、`records.md` 到对应项目。切换分支或 worktree 不会删除任务，当前分支缺文件只表示上下文暂不可读。
- 已完成实现前设计文档：`TASK_REDESIGN_IMPLEMENTATION.md`。后续开发在 `kanban2` 从同步后的 `main` 开始，参考 `kanban1` 的功能和 UI；当前仍未切换或修改业务代码。
- 已补充 `kanban1` 能力盘点：任务列表/看板、项目筛选、标签、workspace 选择、会话启动/恢复、终端跳转、文件监听、删除保护和 CLI/RPC 进入第一版重做范围；批量执行、定时自动化、Kanban Advisor 记录流、worktree 影子任务和旧兼容逻辑暂不带入。

- 已完成任务系统产品与架构诊断，详见 [任务中心整体诊断与整改建议](docs/task-center-redesign-review.md)。本轮仅新增诊断和进度记录，没有实施功能修改或数据迁移。
- 当前核心风险：任务状态由多个来源推断；工作中事件会把活动批次标为待审阅；恢复后的终端标签与稳定会话标识映射不完整；用户问题未进入任务详情数据；历史结束会话覆盖新一轮进行中展示。
- 以当前代码为准的执行事实：批次启动器同时启动全部候选，没有实现同工作区串行；定时 Open 任务执行依赖桌面界面进程可用，不支持已有的无窗口派发器，但不要求任务中心页面一直打开。
- 以当前代码为准的展示事实：任务中心默认打开“可执行”，任务视角直接使用任务展示状态，不再按最新子任务推断。以下旧记录中关于工作区串行、最新子任务状态和页面存活依赖的描述仅代表历史记录。
- 验证结果：5 个相关测试文件共 59 项通过；临时目录真实模块调用确认上述五个异常。当前终端为 Node 22.21.1，低于项目声明的 Node 24；没有运行真实 Electron 或远程主机验收。
- 建议顺序：先稳定状态、身份与同目录执行，再建立交付与用户决定闭环，然后确认任务独立于工作树存储和子任务简化，最后补齐无人值守执行。以上为待讨论方向，尚未修改 PRD。

## 项目概述

Orca 是 Electron 多 agent 研发工作台。当前已完成任务中心核心功能和全局提示词库：用户可以管理并行 AI 工作，也可以在不离开当前页面的情况下查找、分类和复制常用提示词。

## 技术架构

- Electron + React + TypeScript + Zustand；渲染层使用现有 shadcn 组件、Tailwind token 和 Lucide 图标。
- `work-items` 是独立顶层视图；现有 Tasks 页继续浏览 GitHub、GitLab、Linear、Jira 外部工单。
- 本地任务持久化链路：
  `WorkItemsPrototypePage` → `window.api.localTasks` → preload IPC → 主进程 IPC 校验 → 项目目录 `orca/<task-id>/task.json`。
- 任务文件所有权：`task.json.projectPath` 必须与文件实际所在 workspace 根目录一致；Git 在其他 worktree 检出的同 ID 文件是影子副本，Store 不索引、不监听也不写入。
- 已归档任务：`localTasks.list({ includeArchived: true })` 显式返回；任务中心的“已归档”Tab 提供搜索、恢复和永久删除。
- 领域类型位于 `src/shared/local-task-types.ts`；文件格式和 Store 位于 `src/main/local-tasks/`；IPC 校验位于 `src/main/ipc/local-task-ipc-validation.ts`。
- 提示词库持久化链路：
  `PromptLibraryPanel` → Zustand `updateSettingsOrThrow` → 现有 `settings:set` IPC → 主进程 `normalizePromptLibrary` → 当前 Orca 用户资料的 `GlobalSettings.promptLibrary`。该数据不进入项目文件，也不投影到 SSH 或配对 runtime。

## 已完成功能

- 本地任务实体：标题、描述、Open/In progress/Needs review/Done、单一 workspace、归档和标题来源。
- workspace 关系：一个任务最多一个 workspace，一个 workspace 可关联多个任务；创建时使用当前 workspace，没有可选 workspace 时使用 `local + 当前 HEAD`。
- workspace 生命周期：未合入 workspace 删除时不额外保留任务；本机 Orca PR/MR 合入成功后，任务目录复制到目标 workspace 并重写所有权，任务业务状态保持不变。
- 会话关系：一个任务多个会话；指定 session ID 只能关联一个任务；详情可创建关联会话。会话的稳定 `id` 与当前 Orca Terminal Tab 的 `tabId` 分开保存，恢复时 Tab 因 ID 冲突重新生成也能回写映射。
- 子任务/步骤：默认子任务视角和可切换的任务视角；列表可展开子任务及 AI 执行步骤；用户完成子任务，AI 更新步骤。
- 新建子任务会话：先把子任务写入项目文件，再启动 Agent、创建会话记录并绑定；成功后自动刷新详情和关闭弹窗，绑定失败可幂等重试。
- 生命周期：通过 Agent 菜单或批量入口启动真实会话后进入 In progress；任意会话结束进入 Needs review；用户验收后进入 Done；运行中任务禁止归档。
- 标题规则：创建时无自定义标题取描述第一行；首次 AI 完成可生成一次标题；用户编辑后 AI 只更新描述。
- 详情交互：标题编辑、会话最后输出、workspace/session 跳转入口、详情抽屉收起和空状态创建。
- 收件箱整理：任务详情底部提供“移至收件箱”按钮；写入时只更新 `intakeState`，原项目、workspace、状态、会话、子任务和执行记录保持不变；收件箱任务继续使用同一位置的“整理为可执行”按钮返回 `ready`。
- 任务队列筛选：原“全部”Tab 已改为“可执行”，只显示 `intakeState = ready` 且未归档的任务；收件箱任务不再混入该列表。“可执行”代表需求已经整理，不等同于当前批量执行候选，因此 In progress、Needs review 和 Done 等已整理任务仍可显示。
- 持久化与验证：任务目录初始化、原子 JSON 写入、文件监听、zod IPC 参数校验、任务变更广播。
- Agent 任务桥接：从任务中心启动的 Agent shell 带有任务 ID；内置 `orca local-task` CLI 通过 runtime RPC 读取和更新当前任务、子任务、AI 执行步骤，并报告本轮最后输出。
- 后台 Agent 上下文：澄清启动、批次启动与普通任务启动共用后台启动器；前两者会注入 `ORCA_LOCAL_TASK_ID` 和 `ORCA_LOCAL_TASK_ROOT`，因此 CLI 能定位项目内 `orca/<task-id>/task.json`。
- 新建任务默认：任务中心每次打开新建任务弹窗都会显式使用 `ready`（可执行任务）；只有用户选择 `inbox` 才会进入收件箱。
- 会话实时性：任务会话的 tab 若仍有活动 PTY，即使智能体仪表盘暂时没有对应卡片，也视为实时会话；详情恢复动作不会对其调用 AI Vault resume。
- 关联会话：已有任务会话时，用户先输入本轮独立请求，再选择 Agent；该请求作为新会话内容和会话标题，不再重复发送原任务提示。
- 文件格式：任务读取只接受完整的 `schemaVersion=1` 当前格式；旧状态别名、字符串输出、plan-only 子任务和缺字段文件会明确报错，不再迁移。
- UI 行为：任务视角按最新子任务显示状态；归档事件立即移除卡片；任务中心默认关闭详情；执行步骤使用较大字号并保留勾选图标、不划线。
- 输出记录：Agent 状态进入 `done` 时自动把 `lastAssistantMessage` 写入任务会话和 `latestOutput`，不再完全依赖 Agent 主动调用 `report-completed`。
- 标签与会话状态：任务支持创建/编辑标签和看板/列表共用筛选；详情页使用可见 Dialog 编辑标题和标签；Agent done 事件会结束关联 session，即使没有文本输出。
- 关联会话预览：点击任务详情中的已有会话会扩展详情抽屉，在右侧显示智能体仪表盘复用的实时终端；多个入口可同时预览同一 PTY，关闭一个入口不会中断其他入口的实时更新。
- 提示词库：左侧“提示词库”入口打开非模态覆盖抽屉，不改变当前页面、workspace 或 tab；支持标题、正文和单一分类的新增、编辑、删除，支持全部/未分类/自定义分类筛选、标题/正文/分类全文搜索和一键复制正文。
- 提示词库数据安全：共享归一化层限制最多 100 个分类、500 条提示词、标题 120 字和正文 20,000 字；重复分类、重复 ID、非法时间、空内容和失效分类引用有确定性处理，损坏配置不会阻止应用启动。
- 提示词库抽屉协调：与 Workspace 看板和智能体仪表盘抽屉互斥；支持入口切换、关闭按钮、外部点击和 `Esc`；内层菜单与对话框优先处理 `Esc`；桌面显示双栏，窄窗口显示紧凑上下布局。

## 当前进度

- 已完成：plan.md 阶段 1-6 的本地任务核心链路、session-bound CLI/RPC task bridge 和定向测试；阶段 7 的任务字段、Inbox、批次快照、运行记录、workspace 串行/并行队列和 Agent request-review 桥接。
- 进行中：阶段 7 的 AI 批次排序、完整批次进度 UI、重启恢复、集中待审阅细节和端到端验证。
- 已完成：阶段 8 AI 记录流。结果写入项目内 `assistant/results/YYYY-MM-DD/`，通过严格 schema、`seriesKey` 历史分组、`inputFingerprint` 无变化门禁和 `readAt` 已读状态复用现有任务中心；任务中心新增 AI 记录队列、Markdown 预览和 `projectId + taskId` 任务详情跳转。分析规则与写入脚本位于普通文档目录 `assistant/kanban-advisor/`，不会被普通任务会话作为 Skill 自动加载。
- 已完成：阶段 9 Kanban Advisor 自动化模板。自动化页面“从模板开始”新增收件箱需求澄清、每周候选任务规划、每日滞留任务简化、每日任务状态汇报四个分析模板，以及每日执行 Open 本地任务模板；后者复用现有 `open_local_tasks` 批次执行模式，默认当前 workspace、每日 09:30，不新增调度器或默认自动化。
- 已完成：阶段 10 提示词库。领域归一化、当前用户资料持久化、搜索与分类、非模态抽屉、增删改复制、中英文文案、定向测试和真实 Electron Playwright 验收均已完成。
- 已完成：阶段 11.2 本地任务 workspace 所有权。Store 忽略非所有者 worktree 中的 Git 影子副本；验收、归档、恢复和编辑显式传递项目路径；本机 PR/MR 合入可把任务转移到目标 workspace。
- 已完成：阶段 11.3 已归档任务与永久删除。删除只修改权威 workspace 的任务目录，不删除业务代码或自动操作 Git。
- 已完成：阶段 11.8 将任务中心“全部”队列收窄为“可执行”，隔离收件箱与已归档任务，同时保留已整理任务的全部业务状态。
- 后置：provider hook 自动汇报、workspace/Agent Dashboard 反向打开任务、文件锁、远程同步、跨项目任务索引和外部工单双向同步。任务创建先从项目 workspace 下拉选择已有 workspace；选择新建时才进入第二步工作树创建。

## 已知问题与技术债

- Agent CLI 依赖从任务中心启动的终端环境变量；任务详情启动器现在会在 tab 创建后、页面关闭前先持久化关联会话。直接从 workspace 启动的会话不会自动归属本地任务，仍需从任务中心显式关联。后台澄清和批次启动已由启动器统一注入任务 ID 与项目根目录。
- 任务恢复保护：活动 PTY 是避免重复恢复的最终事实；对仍有活动写入者的 Codex 会话不能再次执行 `codex resume`，否则会触发 `thread already has an active writer`。恢复新建 Tab 后通过任务会话的 `tabId` 映射更新详情预览，不改变 Codex provider session。
- 事项中心详情抽屉左边缘可拖拽调整宽度；顶部“执行当前任务”是批量执行入口，会对可执行 Open 任务按 workspace 串行启动所选 Agent；自动/定时执行尚未完成。
- 状态规则：任务只使用 Open/In progress/Needs review/Done；任意 session 已结束就显示 Needs review，没有结束会话但存在 working 或 queued/running 批次才显示 In progress，用户验收后进入 Done。
- 启动规则：详情不再提供只改状态的“开始执行”；Agent 必须通过启动任务/关联会话或顶部批量入口创建真实会话；同一首条提示的重复 working 会话会复用。
- 工作流审查：详见 `docs/local-task-workflow-review.md`。当前已知矛盾包括已归档运行任务、无会话的 In progress 任务、重复会话、历史 plan.json 空数组和 renderer 批次生命周期。
- provider hook 尚未自动解析每条模型输出并更新步骤；Agent 需要按启动提示主动执行 `orca local-task` 命令。
- 旧的已运行生产 Orca 进程可能仍使用不含 `local-task` 的 CLI；重启新的 `pnpm dev` 后会先构建 CLI。Agent 提示保留直接读取 `orca/<task-id>/task.json` 的兜底路径。
- workspace/Agent Dashboard 尚未增加反向“打开本地任务”入口。
- 文件锁和同 workspace 并行写入租约按用户决定后置。
- v1.6 尚未实现 AI 批次排序、跨重启批次恢复和完整批次进度/待审阅 UI；批次启动仍要求任务中心窗口保持可用。
- 当前应用代码的完整 `pnpm tc` 通过；测试目录使用独立的 `typecheck:e2e`，仍存在多处既有测试夹具类型错误。
- AI 记录首版只扫描本地项目根目录；SSH/配对 runtime 聚合、结果保留/清理策略和手动切换已读状态尚未实现。
- 全套 `typecheck:e2e` 当前包含仓库既有的多处类型错误；本次新增的 `kanban-ai-records.spec.ts` 和 `prompt-library-drawer.spec.ts` 均已通过实际 Playwright 运行。
- 提示词库首版仅属于当前 Orca 用户资料，不支持项目级隔离、远程主机独立库、云同步、导入导出、变量参数或直接发送给 Agent；多窗口同时编辑沿用全局设置的最后一次完整写入生效语义。
- 任务所有权转移目前只在同一本机执行主机的 Orca 直接 PR/MR 合入后执行；GitHub 合并队列在真正合入前不转移，手动 Git 合入、SSH 和配对 runtime 不会回退为本机文件写入。
- 永久删除是不可恢复操作，只在已归档 Tab 的任务详情中显示；已跟踪任务文件被删除后会作为 Git 删除 diff 出现。
- 任务中心默认使用任务视角；会话可展开查看首次提示/最近输出；实时终端关闭后可扫描 Agent Session History 并在工作树中恢复；任务 Store 会同步 `plan.json` 的子任务和步骤。
- 任务中心启动 Agent 在公共启动器中先激活目标 workspace、repo 和终端视图，再创建新 Tab；Codex 首次启动出现 `Hooks need review` 属于终端安全确认，需要用户选择继续。
- 任务详情右侧实时终端预览在用户输入后会做 200ms 防抖快照刷新，避免实时增量流排队或 ACK 延迟时输入已经写入但画面暂不更新。
- 右侧会话预览标题栏提供“跳转到终端 Tab”按钮，使用卡片的 workspace、执行主机、Tab ID 和 pane ID 精确定位主界面的终端分屏。
- 任务详情预览使用 `session.tabId` 查找实时 Dashboard card；没有该字段的旧任务继续使用 `session.id`。主进程/preload 变更需重启 `pnpm dev` 后生效。
- 2026-09-03 已清空 `/Users/lmy/proj/Tile/BallsOutProj/orca/` 下全部 4 个 `lt_*` 任务目录；该项目任务中心当前应显示空状态，需要重新创建任务。

## 关键配置与环境信息

- 会话上下文：每个会话显示当前正在解决的问题，并保存最近 30 轮用户问题与 Agent 小结；任务详情和右侧预览共用轮次历史，不再只显示首次提示/最近输出。
- 子任务归属：子任务保持勾选/步骤模型；用户可新增并绑定已有或新建会话，AI 创建子任务自动绑定当前会话；AI 只能更新自己负责或未绑定子任务，跨会话修改需确认后移交。
- 会话运行状态：任务中心以智能体仪表盘的实时 tab 为运行事实；task.json 中残留的 working 会话会投影为已结束并允许归档，新会话有 15 秒启动宽限。

- 任务文件：项目目录下的 `orca/<task-id>/task.json`、`plan.json`、`prd.md`、`records.md`；AI 分析记录位于 `assistant/results/<YYYY-MM-DD>/air_<id>.json`；只有四个 Kanban Advisor 自动化模板会显式读取 `assistant/kanban-advisor/` 下的规则和写入脚本。
- 子任务绑定：`transferSubtask` 传递当前任务 `projectPath`，索引遍历会跳过并清理已被 workspace 删除的失效 `task.json` 路径，避免绑定已有/新建会话时因旧路径触发 ENOENT。
- 任务启动关联：任务页创建 Agent Tab 后，先等待 `createSession` 将 Tab ID 写入任务文件，再关闭任务面板和触发刷新；写入失败会清理新 Tab 并显示错误。
- 任务启动路径：AgentPicker 是唯一会话持久化屏障；父层回调只刷新任务和关闭任务中心。所有新建 workspace 分支都显式传递 `task.projectPath`，Store 会清理删除 workspace 后的失效索引。
- 开发命令：`pnpm run dev`。
- Electron 构建：`pnpm run build:electron-vite`。
- 提示词库定向测试：`pnpm test src/shared/prompt-library.test.ts src/renderer/src/lib/prompt-library-filter.test.ts src/renderer/src/components/prompt-library`；真实窗口验收：`npx playwright test tests/e2e/prompt-library-drawer.spec.ts --config tests/playwright.config.ts --project=electron-headless --workers=1`。
- 定向测试：`pnpm exec vitest run --config config/vitest.config.ts src/main/local-tasks/store.test.ts src/main/ipc/local-task-ipc-validation.test.ts src/main/runtime/rpc/methods/local-tasks.test.ts`。
- workspace 所有权定向测试：`pnpm test src/main/local-tasks/store.test.ts src/main/ipc/local-task-ipc-validation.test.ts src/renderer/src/components/work-items/local-task-workspace-transfer.test.ts src/renderer/src/components/right-sidebar/use-hosted-review-actions.test.tsx src/renderer/src/components/work-items/local-task-center-actions.test.ts`。
