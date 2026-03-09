# 教创搭子（TeachMater）开发设计说明书（软著申报版）

文档版本：V1.0  
编写日期：2026-03-09  
适用系统：课堂工具一体化互动平台（Web）

## 1. 编写目的

本文档用于软件著作权申报，完整说明本软件的：

- 软件总体设计
- 软件结构图
- 功能流程图
- 逻辑框图
- 接口设计
- 模块与函数设计
- 算法设计
- 运行设计
- 异常处理与安全设计

## 2. 软件概述

### 2.1 软件名称

教创搭子（TeachMater）课堂工具一体化互动平台。

### 2.2 建设目标

为教师和课堂组织者提供统一的课堂互动中枢，实现：

- 名单管理与班级库维护
- 随机点名
- 分组/建队
- 多场景排座
- 白板互动、投票、测验
- 签到（含座位签到）
- 工具箱（计时、二维码、指令卡等）
- AI 辅助内容生产（手绘故事板、PPT、文本可视化）
- 导出与留档

### 2.3 技术栈

- 前端：Vite + React 18 + TypeScript + Tailwind + shadcn-ui
- 数据与认证：Supabase（Auth、Postgres、RPC、Edge Functions）
- 图表与可视化：Recharts、Framer Motion
- 导出：html2canvas、jsPDF、xlsx
- 测试：Vitest + Testing Library

## 3. 总体设计

### 3.1 总体架构

```text
+------------------------------ Browser Client ------------------------------+
|                                                                            |
|  React Router + 页面容器 (App/Index)                                      |
|    |                                                                       |
|    +-- 业务模块层 (随机点名/分组建队/排座/白板/测验/工具箱/AI模块)          |
|    |                                                                       |
|    +-- 状态上下文层 (AuthContext/StudentContext/LanguageContext/Theme)    |
|    |                                                                       |
|    +-- 工具层 (seat-utils/export/command-cards/guest-ai-limit/...)        |
|                                                                            |
+-------------------------------|--------------------------------------------+
                                | HTTPS / WebSocket
+-------------------------------v--------------------------------------------+
|                              Supabase Cloud                                |
|  Auth  | Postgres Tables | RPC | Realtime | Edge Functions                |
|  analyze-text / generate-ppt-outline / generate-storyboard / analyze-*     |
+----------------------------------------------------------------------------+
```

### 3.2 分层说明

- 表现层：`src/pages/*`、`src/components/*`
- 状态层：`src/contexts/*`、`src/hooks/useStudentStore.ts`
- 领域算法层：`src/lib/*`（排座、导出、限流等）
- 数据访问层：`src/integrations/supabase/client.ts`
- 云函数层：`supabase/functions/*`

### 3.3 启动链路

```text
main.tsx -> App.tsx
  -> LanguageProvider
  -> QueryClientProvider
  -> AuthProvider
  -> FeatureConfigProvider
  -> TooltipProvider
  -> BrowserRouter
  -> Routes (Index + 子路由)
```

## 4. 软件结构图

### 4.1 目录级结构图（核心）

```text
src/
  main.tsx
  App.tsx
  pages/
    Index.tsx
    AdminPage.tsx
    AuthPage.tsx
    CheckInPage.tsx
    DiscussPage.tsx
    SeatCheckinPage.tsx
    BoardPage.tsx
    BoardSubmitPage.tsx
    QuizSubmitPage.tsx
    PollVotePage.tsx
  components/
    StudentSidebar.tsx
    ClassLibrary.tsx
    RandomPicker.tsx
    TeamworkPanel.tsx
    GroupManager.tsx
    TeamBuilder.tsx
    SeatChart.tsx
    BoardPanel.tsx
    QuizPanel.tsx
    ToolkitPanel.tsx
    StoryboardPanel.tsx
    PPTPanel.tsx
    VisualizationPanel.tsx
  contexts/
    AuthContext.tsx
    StudentContext.tsx
    LanguageContext.tsx
    ThemeContext.tsx
    FeatureConfigContext.tsx
  hooks/
    useStudentStore.ts
  lib/
    seat-utils.ts
    export.ts
    command-cards.ts
    guest-ai-limit.ts
    scalable-realtime.ts
  integrations/supabase/
    client.ts
    types.ts
supabase/functions/
  analyze-text/
  analyze-barrage/
  analyze-board/
  generate-ppt-outline/
  generate-ppt-image/
  generate-storyboard/
```

### 4.2 路由结构图

```text
/
/auth
/reset-password
/admin
/discuss/:topicId
/checkin/:sessionId
/seat-checkin/:sessionId
/board/:boardId
/board/:boardId/submit
/quiz/:sessionId
/poll/:pollId
```

## 5. 功能模块设计

### 5.1 模块划分与职责

| 模块 | 主要文件 | 职责说明 |
|---|---|---|
| 应用壳层 | `src/App.tsx`, `src/pages/Index.tsx` | Provider 组装、路由分发、主界面布局与侧栏状态机 |
| 名单与班级库 | `src/components/StudentSidebar.tsx`, `src/components/ClassLibrary.tsx` | 名单维护、班级树管理、导入导出、名单与班级库联动 |
| 随机点名 | `src/components/RandomPicker.tsx`, `src/components/SpinWheel.tsx` | 滚动抽取、转盘抽取、去重池、语音播报、弹窗反馈 |
| 分组建队 | `src/components/GroupManager.tsx`, `src/components/TeamBuilder.tsx` | 自动分组/建队、组长队长标记、拖拽重排、历史保存 |
| 排座 | `src/components/SeatChart.tsx`, `src/lib/seat-utils.ts` | 多策略自动排座、禁用座位、走道拖拽、导出 |
| 白板互动 | `src/components/BoardPanel.tsx` + `src/components/board/*` | 创建白板、卡片互动、视图切换、二维码分享、报告 |
| 测验 | `src/components/QuizPanel.tsx` + `src/components/quiz/*` | 题库、试卷、会话发布、作答统计、CSV 导出 |
| 工具箱 | `src/components/ToolkitPanel.tsx` + `src/components/toolkit/*` | 倒计时、二维码、指令卡、投票等课堂微工具 |
| AI 生产力 | `src/components/StoryboardPanel.tsx`, `src/components/PPTPanel.tsx`, `src/components/VisualizationPanel.tsx` | AI 生成故事板/PPT/文本可视化 |
| 认证与权限 | `src/contexts/AuthContext.tsx` | 登录态、审批状态、管理员角色查询 |
| 多语种 | `src/contexts/LanguageContext.tsx` | 文案翻译、语言切换、格式化输出 |
| 导出服务 | `src/lib/export.ts` | PNG/PDF/SVG 导出与页眉页脚版权注入 |

### 5.2 功能流程图（按核心模块）

#### 5.2.1 名单与班级库流程

```text
用户进入首页
  -> StudentSidebar 显示当前名单
  -> (可选) 打开 ClassLibrary
      -> 读取 colleges/classes/class_students
      -> 选择班级 -> loadToWorkspace
      -> importFromText 写入当前名单
  -> 名单可增删改/导入/下载
```

#### 5.2.2 随机点名流程

```text
点击“开始抽取”
  -> 校验可选学生池 (noRepeat ? 未抽中过滤 : 全量)
  -> 启动 step 循环 (setTimeout 逐步减速)
  -> 实时更新 selectedStudent
  -> 到达终点或用户提前触发停止
  -> finishRoll
      -> 写入已抽取历史
      -> noRepeat 时写入 usedIds
      -> 播放音效/语音播报/弹窗
```

#### 5.2.3 分组/建队流程

```text
点击自动分组(或自动建队)
  -> 打乱 students
  -> 根据 groupCount 或 membersPerTeam 切分
  -> 生成 groups/teams
  -> 支持拖拽成员交换位置
  -> 支持组长/队长唯一标记
  -> 可保存 teamwork_history 或导出
```

#### 5.2.4 排座流程

```text
设置 rows/cols/mode/走道/禁用位
  -> autoSeat()
      -> 按模式生成 grid
      -> 跳过禁用位与考试模式空隔
  -> 可手动拖拽互换座位
  -> 可导出图像/PDF
```

#### 5.2.5 测验流程

```text
题库选题 -> startSession
  -> quiz_sessions 写入 (含题目快照和可答名单)
  -> 生成作答链接 /quiz/:sessionId + 二维码
  -> 学生提交 quiz_answers
  -> 教师端统计 QuizStatsView
  -> 可结束会话、导出 CSV
```

#### 5.2.6 白板流程

```text
createBoard -> openBoard
  -> board_cards 实时增删改
  -> 视图模式: wall/kanban/timeline/canvas/ppt
  -> 点赞、评论、审核、锁定等控制
  -> 可导出 CSV / 二维码分享
```

#### 5.2.7 AI 文本可视化流程

```text
输入文本 -> handleAnalyze
  -> supabase.functions.invoke('analyze-text')
  -> 返回 AnalysisResult
  -> 结构图 + 数据图联动渲染
  -> 历史记录写入 localStorage (最多20)
  -> 导出按钮输出成果图
```

#### 5.2.8 AI PPT 流程

```text
输入文本/上传文件 -> handleGenerate
  -> invoke('generate-ppt-outline')
  -> 生成大纲 + 幻灯片结构
  -> 用户调整模板/配色/字号
  -> handleExport('pptx'|'pdf'|'both')
```

#### 5.2.9 AI 手绘故事板流程

```text
配置主题和模板 -> handleGenerate
  -> invoke('generate-storyboard')
  -> 返回图像/元数据
  -> 保存本地历史
  -> 可选择历史、清空、再次生成
```

## 6. 逻辑框图

### 6.1 前端业务逻辑框图

```text
[UI事件]
   -> [组件处理函数 handle*]
      -> [Context/Hook 状态更新]
         -> [可选: Supabase 查询/写入]
            -> [返回结果/错误]
               -> [toast + UI刷新 + 本地持久化]
```

### 6.2 数据逻辑框图（本地+云）

```text
        +--------------------+
        |  localStorage      |
        |  - 学生名单         |
        |  - AI历史           |
        |  - token缓存        |
        +---------+----------+
                  |
                  v
+---------+   +---+----------------------+   +-------------------------+
|  UI层   |-->| 状态层 Context/Hook      |-->| Supabase (Auth/DB/RPC) |
+---------+   +---+----------------------+   +------------+------------+
                  |                                      |
                  +--------------------------------------+
                                 Edge Functions
```

### 6.3 侧栏交互逻辑框图（当前已实现）

```text
sidebarCollapsed (名单折叠态)
   + sidebarMode ('list'|'library')
   + sidebarModeTransitioning
   + sidebarTransitionDirection

规则：
- 菜单切换时保持 sidebarCollapsed 不变
- 名单<->班级库切换使用 150ms 滑入+淡入动画
- 折叠态图标支持 tooltip + aria-label + Enter/Space
```

## 7. 接口设计

### 7.1 前端内部接口（示例）

1. `StudentContextType`（`src/contexts/StudentContext.tsx`）

- `students: Student[]`
- `addStudent(name)`
- `removeStudent(id)`
- `updateStudent(id, name)`
- `clearAll()`
- `importFromText(text)`

2. `AuthContextType`（`src/contexts/AuthContext.tsx`）

- `user`, `session`, `loading`
- `approvalStatus`, `isAdmin`
- `signOut()`
- `refreshStatus()`

3. `ClassLibraryProps`（`src/components/ClassLibrary.tsx`）

- `onBackToList?: () => void`

4. `StudentSidebar Props`（`src/components/StudentSidebar.tsx`）

- `onClose?`, `collapsed?`, `onToggleCollapse?`, `onOpenLibrary?`

### 7.2 数据库与 RPC 接口（核心）

常用数据表（前端直接访问）：

- 名单班级：`colleges`, `classes`, `class_students`
- 协作白板：`boards`, `board_cards`, `board_likes`, `board_comments`
- 测验：`quiz_questions`, `quiz_papers`, `quiz_sessions`, `quiz_answers`, `quiz_categories`
- 投票：`polls`, `poll_votes`
- 签到：`seat_checkin_sessions`, `seat_checkin_records`
- 历史：`teamwork_history`
- 用户：`profiles`、角色/审批相关函数

常用 RPC：

- 认证授权：`get_my_status`, `has_role`, `get_pending_users`, `approve_user`, `reject_user`
- 白板：`delete_board`, `update_board`, `manage_board_card`
- 测验：`update_quiz_session`, `delete_quiz_session`
- 投票：`update_poll`, `delete_poll`
- 成就：`delete_badge`

### 7.3 Edge Functions 接口（核心）

1. `analyze-text`

- 输入：`{ text, lang }`
- 输出：结构化可视化数据（标题、摘要、关键词、结构类型、图表建议等）
- 错误码：`400/429/402/500`

2. `generate-ppt-outline`

- 输入：`{ content, audience }`
- 输出：PPT 大纲 JSON（关键词、slides）
- 错误码：`400/429/402/500`

3. `generate-storyboard`

- 输入：故事板参数（主题、受众、风格等）
- 输出：图片与结构化元数据

4. `analyze-barrage` / `analyze-board`

- 输入：课堂互动文本集合
- 输出：聚类、关键词、统计结论

## 8. 函数设计（关键函数清单）

### 8.1 核心框架函数

- `App()`：应用总入口与路由挂载（`src/App.tsx`）
- `renderContent()`：主内容区按 tab 动态渲染（`src/pages/Index.tsx`）
- `switchSidebarMode(nextMode)`：名单/班级库切换动画状态机（`src/pages/Index.tsx`）
- `handleTabChange(tab)`：跨模块切换并保持侧栏折叠一致性（`src/pages/Index.tsx`）

### 8.2 名单与班级库函数

- `addStudent/removeStudent/updateStudent/clearAll/importFromText`（`src/hooks/useStudentStore.ts`）
- `loadAll/addCollege/addClass/addStudent`（`src/components/ClassLibrary.tsx`）
- `handleFileSelect/confirmImport/confirmTextImport`（`src/components/ClassLibrary.tsx`）
- `loadToWorkspace`（班级名单回填当前名单）

### 8.3 随机点名函数

- `startRoll`：滚动模式随机抽取入口
- `finishRoll`：抽取完成写回状态
- `handleWheelRollStart/handleWheelRollEnd`：转盘模式回调
- `resetPool`：去重池清空

### 8.4 分组建队函数

- `autoGroup`（`GroupManager.tsx`）
- `autoTeam`（`TeamBuilder.tsx`）
- `toggleLeader/toggleCaptain`（唯一角色标记）
- `handleDrop`（拖拽重排）
- `handleSave/handleRestore`（历史存取）

### 8.5 排座函数

- `autoSeat`（`SeatChart.tsx` 与 `lib/seat-utils.ts`）
- `splitIntoGroups`、`getColOrder`、`findNextFree`、`getVisualRow`
- `toggleDisabledSeat`、`swapSeats`
- `moveAisle`（走道重定位）

### 8.6 AI 模块函数

- 文本可视化：`handleAnalyze`, `restoreHistory`, `handleUpdateAnalysis`（`VisualizationPanel.tsx`）
- PPT：`handleFileUpload`, `handleGenerate`, `handleExport`, `handleRegenerateSlide`（`PPTPanel.tsx`）
- 手绘：`handleGenerate`, `handleSelectHistory`, `handleClearHistory`（`StoryboardPanel.tsx`）

### 8.7 白板与测验函数

- 白板：`loadCloudBoards`, `createBoard`, `openBoard`, `deleteBoard`, `updateBoardSetting`, `exportCSV`
- 测验：`loadQuestions/loadCategories/loadPapers/loadSessions`, `startSession`, `endSession`, `deleteSession`, `exportCSV`

### 8.8 导出函数

- `exportToPNG/exportToPDF/exportToSVG`（`src/lib/export.ts`）
- 内部复用 `captureWithHeaderFooter` 注入标题和版权信息

## 9. 算法设计

### 9.1 随机点名减速抽取算法

实现位置：`src/components/RandomPicker.tsx`

核心思想：

- 以 `progress = elapsed / duration` 表示抽取进度
- 每一步随机展示候选人并播放 tick
- 延迟使用 `delay = minInterval + progress^2 * 400` 实现非线性减速
- 终点二次随机确定最终结果

复杂度：`O(k)`，`k` 为滚动帧数。

### 9.2 分组与建队算法

实现位置：`GroupManager.tsx`, `TeamBuilder.tsx`

- 随机打散：`shuffled = students.sort(() => Math.random() - 0.5)`
- 分组策略：
  - 分组（group）：`i % groupCount` 轮询分配
  - 建队（team）：按 `membersPerTeam` 连续切片

复杂度：`O(n)`（不计打散排序）。

### 9.3 自动排座算法族

实现位置：`src/lib/seat-utils.ts`

支持策略：

- `verticalS`：按列蛇形
- `horizontalS`：按行蛇形
- `exam`：隔行/隔列留空
- `groupCol/groupRow`：按组列优先/行优先
- `smartCluster`：块状聚类布局
- `random`：全局随机填充

关键约束：

- 跳过禁用座位集合 `disabledSeats`
- 根据门窗方向生成 `colOrder`
- 走道通过视觉索引映射 `getVisualRow`

### 9.4 班级库导入去重算法

实现位置：`ClassLibrary.tsx`

- 读取 Excel 后过滤空行与缺失行
- 使用 `Set` 按 `college|class|name` 组合键去重
- `append` 模式与库内已有学生再次去重
- 输出导入预览和警告信息

### 9.5 访客 AI 限流算法

实现位置：`src/lib/guest-ai-limit.ts`

- 以 `YYYY-MM-DD` 为天维度记录次数
- `getGuestAIRemaining` 计算剩余额度
- `recordGuestAIUsage` 原子递增并持久化
- 登录用户默认不限额，支持动态限额配置

## 10. 运行设计

### 10.1 运行环境

- 浏览器：Chrome/Edge（建议最新版）
- Node.js + npm（开发环境）
- Supabase 项目（生产数据与鉴权）

### 10.2 进程与线程模型

- 单页应用（SPA）前端单主线程
- 异步任务通过 Promise + React State 管理
- AI/数据库访问采用 HTTP 请求和 Supabase SDK

### 10.3 状态同步策略

- UI 短期状态：组件本地 `useState`
- 全局状态：Context（Auth/Student/Language）
- 持久化：`localStorage`（名单、历史、token、访客额度）
- 云状态：Supabase 表 + RPC + Realtime

### 10.4 异常与降级设计

- 网络异常：toast 提示 + 保留原状态
- AI 失败：区分 `Rate limited`、`Payment required`、`Unknown`
- 解析失败：导入前置校验与跳过策略
- 本地存储异常：`try/catch` 返回安全默认值
- 游客模式：部分功能本地可用，发布类功能需登录

### 10.5 性能设计

- 路由级懒加载：`React.lazy + Suspense`
- 高频操作防抖/节流：工具库支持（如 realtime-throttle）
- 列表与图形分区渲染，减少整页重绘
- 导出时离屏渲染，避免干扰当前视图

## 11. 安全设计

- 鉴权：Supabase Auth 会话管理，Token 自动刷新
- 权限：RPC + RLS（数据库侧）限制越权
- CORS：Edge Functions 按允许域名返回跨域头
- 输入安全：长度检查、空值检查、类型约束
- 数据隔离：按 `user_id` 或 `creator_token` 查询

## 12. 测试与验证设计

### 12.1 测试策略

- 单元测试：算法与工具函数（`seat-utils`, `quiz-utils`, `word-cloud` 等）
- 组件测试：关键 UI 组件行为（`RandomPicker`, `StudentSidebar`, `ToolkitPanel`）
- 集成测试：核心流程（选人、分组、测验发布、导出）

### 12.2 建议验收清单

- 类型检查：`npx tsc --noEmit`
- 单测：`npm run test`
- 关键路径：
  - 名单导入 -> 点名 -> 分组 -> 排座 -> 导出
  - 白板/测验发布与学生端访问
  - AI 模块调用与失败兜底

## 13. 运行与部署说明

### 13.1 本地运行

```bash
npm i
npm run dev
```

### 13.2 打包与发布

```bash
npm run build
npm run preview
```

说明：在部分 Windows 环境若出现 SWC 绑定问题，可先使用 `npx tsc --noEmit` 验证 TypeScript 正确性。

## 14. 结论

本系统采用“前端模块化 + Supabase 云能力 + AI 辅助服务”的架构，形成了课堂组织、互动、评价与成果沉淀的一体化闭环。文档中已给出可复核的软件结构图、功能流程图、逻辑框图、接口、函数、算法与运行设计，满足软著申报的技术说明要求。
