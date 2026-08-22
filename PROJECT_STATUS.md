# 项目现状（最后更新：2026-08-22）

## 项目概述

Orca 是一个 Electron 多 agent 研发工作台；当前已增加独立的“任务中心”低保真 mock 原型，用于验证以本地任务管理并行 AI 工作、以会话子任务汇报进度的界面和信息结构。

## 技术架构

- Electron + React + TypeScript + Zustand。
- 渲染层使用现有 shadcn 风格组件、Tailwind token 和 Lucide 图标。
- 顶层页面由 `AppWorkspaceShell` 根据 `TopLevelView` 挂载。
- 现有 Tasks 页继续负责 GitHub、GitLab、Linear、Jira 外部工单。
- 新增 `work-items` 顶层视图暂时只使用页面内 mock 状态。

## 已完成功能

- PRD v0.5：明确本地任务、单一 workspace 绑定、多会话、会话子任务、AI 只读执行步骤、Waiting、Needs review、Done、归档和 MVP 边界。
- 任务中心 mock 原型：看板、列表、子任务展开、会话跳转、任务详情、workspace 上下文和最近会话输出。
- 任务中心导航入口：与现有外部 Tasks 入口并列。

## 当前进度

- 已完成：低保真界面验证原型。
- 进行中：等待用户确认本地任务、会话子任务和 AI 执行步骤的信息层级是否符合最终预期。
- 待开始：真实 WorkItem 数据模型、用户数据目录数据库、`workItem.*` RPC、会话上下文注入和真实 workspace 关联。

## 已知问题与技术债

- mock 页面固定显示详情抽屉，尚未做窄屏响应式收敛。
- 新建事项和归档按钮目前不持久化。
- 顶层视图新增后的全套导航历史测试尚未补齐。
- 仓库现有 web/node TypeScript 项目检查存在与本次改动无关的 TS6307 和 schema parity 错误。

## 关键配置与环境信息

- 开发命令：`pnpm run dev`。
- Electron renderer 开发服务本轮使用 `http://localhost:5174/`。
- Electron 构建命令：`pnpm run build:electron-vite`，本轮通过。
- 原型数据不使用数据库、环境变量或外部 API。
