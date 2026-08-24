# 项目现状（最后更新：2026-08-23）

## 项目概述

Orca 是 Electron 多 agent 研发工作台。当前已完成任务中心核心功能：以本地任务管理并行 AI 工作，以会话子任务汇报进度，并通过用户验收结束任务。

## 技术架构

- Electron + React + TypeScript + Zustand；渲染层使用现有 shadcn 组件、Tailwind token 和 Lucide 图标。
- `work-items` 是独立顶层视图；现有 Tasks 页继续浏览 GitHub、GitLab、Linear、Jira 外部工单。
- 本地任务持久化链路：
  `WorkItemsPrototypePage` → `window.api.localTasks` → preload IPC → 主进程 IPC 校验 → 项目目录 `orca/<task-id>/task.json`。
- 领域类型位于 `src/shared/local-task-types.ts`；文件格式和 Store 位于 `src/main/local-tasks/`；IPC 校验位于 `src/main/ipc/local-task-ipc-validation.ts`。

## 已完成功能

- 本地任务实体：标题、描述、Open/In progress/Waiting/Needs review/Done、单一 workspace、归档和标题来源。
- workspace 关系：一个任务最多一个 workspace，一个 workspace 可关联多个任务；创建时使用当前 workspace，没有可选 workspace 时使用 `local + 当前 HEAD`。
- 会话关系：一个任务多个会话；指定 session ID 只能关联一个任务；详情可创建关联会话。
- 子任务/步骤：默认子任务视角和可切换的任务视角；列表可展开子任务及 AI 执行步骤；用户完成子任务，AI 更新步骤。
- 生命周期：任务进入 In progress 后，在会话数为 0 时通过现有 Agent 菜单启动真实会话；Waiting 必须有原因；AI 完成且步骤完成/取消后进入 Needs review；用户验收后进入 Done；任务可归档和恢复。
- 标题规则：创建时无自定义标题取描述第一行；首次 AI 完成可生成一次标题；用户编辑后 AI 只更新描述。
- 详情交互：标题编辑、会话最后输出、workspace/session 跳转入口、详情抽屉收起和空状态创建。
- 持久化与验证：任务目录初始化、原子 JSON 写入、文件监听、zod IPC 参数校验、任务变更广播。
- Agent 任务桥接：从任务中心启动的 Agent shell 带有任务 ID；内置 `orca local-task` CLI 通过 runtime RPC 读取和更新当前任务、子任务、AI 执行步骤，并报告本轮最后输出。
- 关联会话：已有任务会话时，用户先输入本轮独立请求，再选择 Agent；该请求作为新会话内容和会话标题，不再重复发送原任务提示。
- 文件兼容：任务读取兼容 AI 写入的 `Completed` 状态、`completed` 会话状态、字符串总结，以及只在 `plan.json` 中保存的子任务计划，并统一映射到任务面板模型。
- UI 行为：任务视角按最新子任务显示状态；归档事件立即移除卡片；任务中心默认关闭详情；执行步骤使用较大字号并保留勾选图标、不划线。

## 当前进度

- 已完成：plan.md 阶段 1-6 的本地任务核心链路、session-bound CLI/RPC task bridge 和定向测试。
- 后置：provider hook 自动汇报、workspace/Agent Dashboard 反向打开任务、文件锁、远程同步、跨项目索引和外部工单双向同步。任务创建先从项目 workspace 下拉选择已有 workspace；选择新建时才进入第二步工作树创建。

## 已知问题与技术债

- Agent CLI 依赖从任务中心启动的终端环境变量；直接从 workspace 启动的会话不会自动归属本地任务，需从任务中心显式关联。
- provider hook 尚未自动解析每条模型输出并更新步骤；Agent 需要按启动提示主动执行 `orca local-task` 命令。
- 旧的已运行生产 Orca 进程可能仍使用不含 `local-task` 的 CLI；重启新的 `pnpm dev` 后会先构建 CLI。Agent 提示保留直接读取 `orca/<task-id>/task.json` 的兜底路径。
- workspace/Agent Dashboard 尚未增加反向“打开本地任务”入口。
- 文件锁和同 workspace 并行写入租约按用户决定后置。
- 全仓库 Node TypeScript 检查仍有既有 `ui-state-schema-parity-checks.ts` 类型错误；本地任务相关定向检查通过。

## 关键配置与环境信息

- 任务文件：项目目录下的 `orca/<task-id>/task.json`、`plan.json`、`prd.md`、`records.md`。
- 开发命令：`pnpm run dev`。
- Electron 构建：`pnpm run build:electron-vite`。
- 定向测试：`pnpm exec vitest run --config config/vitest.config.ts src/main/local-tasks/store.test.ts src/main/ipc/local-task-ipc-validation.test.ts src/main/runtime/rpc/methods/local-tasks.test.ts`。
