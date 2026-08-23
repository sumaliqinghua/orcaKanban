# 本地任务中心施工计划

本计划以 `PRD.md` v0.7 为准。当前产品名是“任务中心”，核心实体是 `LocalTask`（本地任务）、会话、子任务和 AI 执行步骤。每项都写明执行步骤和验收标准；`[x]` 已完成，`[~]` 进行中，`[ ]` 未开始。

## 依赖关系

```text
领域类型 → SQLite Store/迁移 → IPC/preload → 真实任务页面
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

## 阶段 2：SQLite 持久化

- [x] 2.1 创建用户数据目录数据库
  - **执行步骤**：在 Orca 用户数据目录使用 `local-tasks.db`，开启 WAL、busy timeout、外键和正常同步级别。
  - **验收标准**：数据库与 workspace 路径无关，重启后任务仍可读取。
- [x] 2.2 建立任务、会话、子任务、步骤表和索引
  - **执行步骤**：创建四张表、外键级联关系和项目/状态/更新时间索引。
  - **验收标准**：删除任务不会留下孤立会话、子任务或步骤；一个 workspace 可关联多个任务。
- [x] 2.3 实现 schema version 和旧库迁移
  - **执行步骤**：创建 schema version 表；检测旧表缺失的 `title_suggestion`、`association_source` 字段并执行 `ALTER TABLE`。
  - **验收标准**：空库初始化和旧库升级都成功，迁移后新字段可正常读写。
- [x] 2.4 实现 `LocalTaskStore`
  - **执行步骤**：实现 create/list/get/update/archive/restore/accept、createSession、createSubtask、updateSubtask、AI updateStep/reportCompleted。
  - **验收标准**：状态和归属边界在 Store 层拒绝；Waiting 必须有原因；Done 只能通过 accept。

## 阶段 3：主进程 IPC 与 preload

- [x] 3.1 建立 renderer 可用 API
  - **执行步骤**：暴露 list/get/create/update/createSession/createSubtask/updateSubtask/accept/archive/restore；AI 专用步骤和完成报告不放进 preload API。
  - **验收标准**：renderer 只能通过 `window.api.localTasks` 访问任务，不接触数据库文件。
- [x] 3.2 增加运行时参数校验
  - **执行步骤**：用 zod 检查 ID、文本长度、枚举值、数组长度和未知字段；再调用 Store 做实体归属校验。
  - **验收标准**：非法 payload 返回可读错误，不因异常参数让主进程崩溃。
- [x] 3.3 发布任务变更通知
  - **执行步骤**：写操作后向所有未销毁窗口发送完整任务快照；页面按 task ID upsert。
  - **验收标准**：多窗口不会重复插入，刷新后从数据库恢复。

## 阶段 4：任务中心真实 UI

- [x] 4.1 从 Store 查询替换 mock 数据
  - **执行步骤**：页面接入 loading/error/empty 状态、真实查询和变更订阅；创建表单写入真实数据库。
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

## 后置，不阻塞本期交付

- [ ] 文件级写入锁和租约；
- [ ] 从 workspace/Agent Dashboard 反向打开本地任务；
- [ ] 将会话创建真正接入各 agent provider 的启动器；
- [ ] AI context 注入和 provider hook 自动汇报；
- [ ] `.orca/tasks/` 镜像、远程同步、外部工单双向状态和正式依赖图。

## 当前进度

核心本地任务中心已完成：真实 SQLite 数据、双视角任务面板、会话/子任务/步骤生命周期、验收归档、当前 workspace 和可用 session 跳转入口、运行时校验及测试均已实现。后置列表是明确不纳入本期的能力，不影响本地任务面板可用。
