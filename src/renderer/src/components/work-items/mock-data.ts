export type WorkItemStatus = 'Open' | 'In progress' | 'Waiting' | 'Needs review' | 'Done'
export type StepStatus = 'todo' | 'doing' | 'done' | 'canceled'
export type FollowUpStatus = 'open' | 'active' | 'resolved'

export type Subtask = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  session: string
  steps: { id: string; title: string; status: StepStatus }[]
}

export type WorkItem = {
  id: string
  title: string
  description: string
  status: WorkItemStatus
  workspace: string
  workspaceId?: string
  projectPath?: string
  project: string
  updated: string
  sessions: number
  activeSessions: number
  waitingReason?: string
  subtasks: Subtask[]
  latestOutput: { session: string; text: string }
  sessionsList: { id?: string; title: string; status: 'working' | 'idle' | 'done'; time: string }[]
  titleSource?: 'first-line' | 'ai-suggestion' | 'user'
  titleSuggestion?: string | null
  labels?: string[]
  archivedAt?: number | null
  intakeState?: 'inbox' | 'ready'
  executionState?: 'idle' | 'queued' | 'running' | 'needs_review' | 'failed'
  executionBatchId?: string | null
  executionRunId?: string | null
  reviewKind?: 'delivery' | 'needs_input' | 'execution_failed' | null
}

export const STATUS_ORDER: WorkItemStatus[] = [
  'Open',
  'In progress',
  'Waiting',
  'Needs review',
  'Done'
]

export function getTaskPerspectiveStatus(item: WorkItem): WorkItemStatus {
  if (item.status === 'Done') {
    return 'Done'
  }
  if (item.status === 'Waiting') {
    return 'Waiting'
  }
  const latest = item.subtasks[0]
  if (!latest) {
    return item.status
  }
  return latest.status === 'doing'
    ? 'In progress'
    : latest.status === 'done'
      ? 'Needs review'
      : 'Open'
}

export const MOCK_ITEMS: WorkItem[] = [
  {
    id: 'LT-104',
    title: '修复登录刷新失效',
    description: '处理 refresh token 过期后的重试边界，补齐跨窗口登录状态同步。',
    status: 'In progress',
    workspace: 'local · HEAD a82f1c4 · feature/token-refresh',
    project: 'Orca',
    updated: '2 分钟前',
    sessions: 3,
    activeSessions: 2,
    subtasks: [
      {
        id: 'st1',
        title: '定位并修复 token 刷新逻辑',
        status: 'doing',
        session: '主实现会话',
        steps: [
          { id: 's1', title: '定位 token 过期原因', status: 'done' },
          { id: 's2', title: '修改刷新逻辑', status: 'doing' },
          { id: 's3', title: '补充刷新失败测试', status: 'todo' }
        ]
      },
      {
        id: 'st2',
        title: '生成实现说明文档',
        status: 'done',
        session: '文档会话',
        steps: [{ id: 's4', title: '整理 refresh 流程说明', status: 'done' }]
      },
      {
        id: 'st3',
        title: '修正并发刷新边界',
        status: 'todo',
        session: '风险讨论会话',
        steps: [{ id: 's5', title: '确认旧 token 覆盖场景', status: 'todo' }]
      }
    ],
    latestOutput: {
      session: '主实现会话',
      text: '已确认问题来自并发刷新时的旧 token 覆盖，正在接入请求去重。'
    },
    sessionsList: [
      { title: '主实现会话', status: 'working', time: '2 分钟前' },
      { title: '文档会话', status: 'done', time: '18 分钟前' },
      { title: '风险讨论会话', status: 'idle', time: '1 小时前' }
    ]
  },
  {
    id: 'LT-101',
    title: '重做本地任务数据模型',
    description: '定义本地任务、会话、子任务和 workspace 归属。',
    status: 'Needs review',
    workspace: 'local · HEAD d91ce02 · feature/local-tasks',
    project: 'Orca',
    updated: '24 分钟前',
    sessions: 2,
    activeSessions: 0,
    subtasks: [
      {
        id: 'st1',
        title: '定义实体边界',
        status: 'done',
        session: '架构会话',
        steps: [{ id: 's1', title: '确认任务与 workspace 关系', status: 'done' }]
      },
      {
        id: 'st2',
        title: '补充持久化字段',
        status: 'done',
        session: '实现会话',
        steps: [{ id: 's2', title: '写数据库迁移测试', status: 'done' }]
      }
    ],
    latestOutput: {
      session: '实现会话',
      text: '数据模型和迁移测试已经完成，等待你检查本地任务的入口和上下文展示。'
    },
    sessionsList: [
      { title: '架构会话', status: 'done', time: '24 分钟前' },
      { title: '实现会话', status: 'done', time: '31 分钟前' }
    ]
  },
  {
    id: 'LT-098',
    title: '补充 Windows 路径兼容测试',
    description: '覆盖 WSL UNC 路径、远端 workspace 和路径重命名场景。',
    status: 'Waiting',
    workspace: 'local · HEAD 92ce77b · feature/path-tests',
    project: 'Orca',
    updated: '1 小时前',
    sessions: 1,
    activeSessions: 0,
    waitingReason: '等待确认测试样例是否纳入 Linux CI',
    subtasks: [
      {
        id: 'st1',
        title: '整理路径失败样例',
        status: 'doing',
        session: '路径兼容会话',
        steps: [
          { id: 's1', title: '整理现有失败样例', status: 'done' },
          { id: 's2', title: '确认 CI 运行矩阵', status: 'doing' }
        ]
      }
    ],
    latestOutput: {
      session: '路径兼容会话',
      text: '已整理出 4 组样例，需要你确认是否扩大 Linux CI 运行时间。'
    },
    sessionsList: [{ title: '路径兼容会话', status: 'idle', time: '1 小时前' }]
  },
  {
    id: 'LT-095',
    title: '更新 Agent Dashboard 说明',
    description: '整理 Needs You、Working、Done、Idle 四种运行态的使用说明。',
    status: 'Open',
    workspace: 'local · 当前 HEAD',
    project: 'Orca',
    updated: '昨天',
    sessions: 0,
    activeSessions: 0,
    subtasks: [],
    latestOutput: { session: '暂无会话', text: '尚未开始。' },
    sessionsList: []
  },
  {
    id: 'LT-087',
    title: '增加 GitLab 工单链接',
    description: '在 workspace 卡片上展示 GitLab issue 与 MR 关联。',
    status: 'Done',
    workspace: 'local · HEAD 6a12b8e · feature/gitlab-links',
    project: 'Orca',
    updated: '3 天前',
    sessions: 2,
    activeSessions: 0,
    subtasks: [
      {
        id: 'st1',
        title: '增加链接字段并补充展示',
        status: 'done',
        session: '实现会话',
        steps: [
          { id: 's1', title: '增加链接字段', status: 'done' },
          { id: 's2', title: '补充卡片展示', status: 'done' }
        ]
      }
    ],
    latestOutput: {
      session: '验收会话',
      text: '已验收，关联链接已在 workspace 卡片和新建 workspace 流程中可见。'
    },
    sessionsList: [
      { title: '实现会话', status: 'done', time: '3 天前' },
      { title: '验收会话', status: 'done', time: '3 天前' }
    ]
  }
]
