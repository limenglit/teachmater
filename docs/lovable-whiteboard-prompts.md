# TeachMater 协助白板（Padlet 业务模式参考）Lovable 提示词包

说明：
- 目标是借鉴公开业务模式（协作白板/看板/时间线/画布），不是复制 Padlet 的品牌、文案、视觉细节或专有交互。
- 下面每段提示词可直接粘贴到 Lovable。建议按顺序执行。

## 0. 总控提示词（先发）

```text
你是资深产品+全栈工程师，请在当前 TeachMater 项目中新增「协助白板」模块。

约束：
1) 仅借鉴“协作白板业务模式”，不得复刻 Padlet 的品牌元素、图标、布局细节、文案。
2) 技术栈保持现有项目：Vite + React + TypeScript + Tailwind + shadcn + Supabase。
3) 先输出实现计划，再按计划分步提交代码。
4) 代码需可运行、可测试，保持与现有风格一致。

目标功能：
- 新增白板空间（Board Space），支持课堂协作发布卡片。
- 支持 4 种视图：墙模式（Wall）、看板模式（Kanban）、时间线（Timeline）、自由画布（Canvas）。
- 卡片支持：文本、图片URL、链接、标签、颜色、置顶、点赞、评论、作者昵称、创建时间。
- 支持学生匿名/昵称发布，教师拥有管理权限（审核、删除、置顶、锁板、导出）。
- 支持二维码加入板子（学生手机进入提交页）。
- 支持基础审核词过滤（违禁词命中先进入待审）。
- 支持导出（CSV + PNG截图）。

交付方式：
- 第一步只做数据库与类型。
- 第二步做页面与组件骨架。
- 第三步接入实时协作与权限。
- 第四步补齐测试与文档。
```

## 1. PRD 提示词（让 Lovable 先产文档）

```text
请先输出「协助白板模块」PRD（中文），结构必须包含：
1) 背景与目标
2) 用户角色（教师/学生/游客）
3) 用户故事（至少12条）
4) 功能范围（MVP / v1.1）
5) 信息架构与页面清单
6) 数据模型草案
7) 权限矩阵（角色 x 操作）
8) 非功能需求（性能/安全/可用性）
9) 验收标准（Gherkin）
10) 风险与回滚策略

要求结合 TeachMater 课堂场景，不要写成通用社区产品。
```

## 2. 数据库与 RLS 提示词（Supabase）

```text
基于当前项目 Supabase 风格，设计并生成协助白板模块 SQL migration：

表结构：
- board_spaces
  - id uuid pk
  - owner_user_id uuid
  - title text
  - description text
  - view_type text check in ('wall','kanban','timeline','canvas')
  - is_locked boolean default false
  - allow_anonymous boolean default true
  - moderation_mode text check in ('off','pre','post') default 'post'
  - join_code text unique
  - created_at timestamptz default now()

- board_columns（用于kanban）
  - id uuid pk
  - board_id uuid fk
  - title text
  - sort_order int

- board_posts
  - id uuid pk
  - board_id uuid fk
  - column_id uuid nullable fk
  - author_user_id uuid nullable
  - author_nickname text
  - content text
  - media_url text nullable
  - link_url text nullable
  - tags text[] default '{}'
  - color text
  - position_x numeric nullable
  - position_y numeric nullable
  - timeline_at timestamptz nullable
  - is_pinned boolean default false
  - status text check in ('published','pending','rejected') default 'published'
  - like_count int default 0
  - comment_count int default 0
  - created_at timestamptz default now()
  - updated_at timestamptz default now()

- board_comments
  - id uuid pk
  - post_id uuid fk
  - author_user_id uuid nullable
  - author_nickname text
  - content text
  - created_at timestamptz default now()

- board_likes
  - id uuid pk
  - post_id uuid fk
  - actor_key text
  - created_at timestamptz default now()
  - unique(post_id, actor_key)

- board_blacklist_terms
  - id uuid pk
  - owner_user_id uuid
  - term text unique
  - created_at timestamptz default now()

同时生成：
1) 必要索引
2) updated_at trigger
3) RLS 策略（教师可全控；学生可按规则读写；游客仅通过 join_code 访问最小能力）
4) 2个RPC：
   - create_board_space(...)
   - submit_board_post_with_moderation(...)

输出：完整 migration SQL，可直接放入 supabase/migrations。
```

## 3. 前端页面与路由提示词

```text
请在现有路由中新增协助白板页面：
- /board（教师工作台：我的白板列表）
- /board/:boardId（实时协作主页面）
- /board/join/:joinCode（学生加入页，移动端优先）

页面组件拆分：
- pages/BoardHomePage.tsx
- pages/BoardPage.tsx
- pages/BoardJoinPage.tsx
- components/board/BoardToolbar.tsx
- components/board/BoardViewSwitcher.tsx
- components/board/PostComposer.tsx
- components/board/PostCard.tsx
- components/board/views/WallView.tsx
- components/board/views/KanbanView.tsx
- components/board/views/TimelineView.tsx
- components/board/views/CanvasView.tsx
- components/board/ModerationPanel.tsx

要求：
1) UI 风格延续 TeachMater，不照搬 Padlet 视觉。
2) 移动端可用（尤其 join + 提交）。
3) 组件职责清晰，避免单文件过大。
4) 关键操作都有 toast 反馈与空状态。
```

## 4. 实时协作与交互提示词

```text
请为 BoardPage 接入 Supabase Realtime：

实时事件：
- board_posts insert/update/delete
- board_comments insert
- board_likes insert/delete

交互细节：
1) 新卡片默认插入顶部（或按当前视图排序规则）。
2) Kanban 支持拖拽列内排序和跨列移动（更新 column_id + sort_order）。
3) Timeline 按 timeline_at 升序；无时间的归入“未安排”。
4) Canvas 支持卡片拖拽定位（position_x/position_y），并做边界保护。
5) 点赞幂等：同一 actor_key 只能点赞一次。
6) 审核模式：命中黑名单词则 status=pending，教师审核后发布。
7) 板子锁定后，学生不可新增/修改，只可浏览。

请同时处理网络失败回滚和乐观更新冲突。
```

## 5. 教学增强提示词（课堂专用）

```text
请在协助白板中加入课堂特化能力：
1) 快速模板：头脑风暴、Exit Ticket、问题停车场、小组任务墙。
2) 课堂计时联动：可选择接入现有 CountdownTimer，倒计时结束自动锁板（可选）。
3) 随机点名联动：从白板发言用户中抽取1人（复用现有随机模块逻辑）。
4) 导出课堂纪要：按板子生成 Markdown 摘要（主题、高赞观点、待解问题）。

要求：
- 仅做轻耦合，不破坏现有模块。
- 通过明确的 adapter 层调用已有能力。
```

## 6. 安全与审核提示词

```text
请为协助白板补齐安全策略：
1) 输入清洗：防 XSS（渲染前转义），链接白名单协议校验。
2) 频率限制：同 actor_key 30 秒最多发 3 条。
3) 内容长度限制：标题/正文/评论上限。
4) 敏感词审核：命中后进入 pending，并记录命中词（审计日志）。
5) 管理操作审计：删除、驳回、锁板写入审计表。

输出：
- 前端校验 + 后端约束 + RLS 补充策略。
```

## 7. 测试提示词（Vitest + Testing Library）

```text
请为新增白板模块编写测试，遵循当前项目测试风格。

覆盖清单：
1) BoardHomePage：创建板子成功/失败、空列表。
2) PostComposer：输入校验、锁板禁用、匿名昵称逻辑。
3) Wall/Kanban/Timeline/Canvas：各自排序与渲染规则。
4) Kanban 拖拽：跨列移动后数据正确。
5) 点赞幂等：重复点击不重复计数。
6) 审核流：pending -> published/rejected。
7) Join 页：join_code 无效处理。
8) Realtime 订阅：事件到达后 UI 更新。

要求：
- mock Supabase 与 Realtime。
- 不修改业务逻辑。
- 输出可直接运行的测试代码与执行命令。
```

## 8. 上线验收提示词（给 Lovable 做最终巡检）

```text
请作为发布工程师，对协助白板模块做上线前检查并输出报告：

检查维度：
1) 类型检查与构建
2) 核心链路手测清单
3) 权限与RLS验证
4) 性能（首屏、100条卡片渲染、实时事件压力）
5) 异常处理（断网、重复提交、并发冲突）
6) 回滚方案（数据库与前端）

输出格式：
- 阻断问题（必须修）
- 高优先问题
- 可延期问题
- 最终发布建议（Go/No-Go）
```

## 9. 一键版（最短可用）

```text
请在当前 TeachMater 项目中新增“协助白板”MVP：
- 路由：/board, /board/:boardId, /board/join/:joinCode
- 视图：Wall + Kanban（先不做 Timeline/Canvas）
- 能力：发帖、评论、点赞、置顶、锁板、二维码加入、CSV导出
- 权限：教师全控，学生可发帖与评论，锁板后仅浏览
- 实时：帖子与评论实时同步
- 安全：基础敏感词过滤 + XSS防护
- 测试：覆盖创建板子、发帖、锁板、审核、无权限访问

请分4次提交，每次提交后给出变更文件列表与运行命令。
```

## 10. 你可以直接复制的建议执行顺序

1. 先发「0.总控提示词」
2. 再发「1.PRD 提示词」确认范围
3. 接着发「2.数据库与RLS 提示词」
4. 然后发「3+4 前端与实时提示词」
5. 最后发「7 测试」和「8 上线验收」

这样可以避免 Lovable 一次输出过大导致代码质量下降。
