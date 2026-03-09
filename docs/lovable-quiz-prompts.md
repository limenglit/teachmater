# TeachMater 答题器 / 随堂测验 Lovable 提示词包

说明：
- 目标是实现课堂答题器与随堂测验，不复制任何第三方产品的品牌与视觉细节。
- 所有提示词按当前项目技术栈设计：Vite + React + TypeScript + Tailwind + shadcn + Supabase。
- 可直接复制到 Lovable 分阶段执行。

## 0. 总控提示词（先发）

```text
你是资深产品经理+全栈工程师，请在当前 TeachMater 项目新增「答题器 / 随堂测验」模块。

硬性约束：
1) 保持现有技术栈与代码风格，不要引入重型新框架。
2) 面向课堂场景优化移动端答题体验。
3) 学生端免登录：扫码进入后仅输入姓名即可答题。
4) 姓名输入必须支持自动补全（来自教师发布时选择的班级名单或最近提交记录）。
5) 实时展示统计图：提交人数、正确率、选项分布。
6) 支持题库与组卷、单题快问、抢答模式。
7) 给出分步计划并按步骤提交代码。

MVP 范围：
- 教师创建题目（单选、多选、判断、简答）
- 题库管理与按规则组卷
- 发起一次答题会话并生成二维码
- 学生扫码答题（无需登录）
- 实时统计看板（正确率/提交人数/选项分布）
- 自动判分（客观题）+ 简答待批阅
- 会话结束后导出结果 CSV
```

## 1. PRD 提示词

```text
请输出「答题器 / 随堂测验」PRD（中文），结构必须包含：
1) 背景与目标
2) 用户角色（教师、学生、游客）
3) 课堂使用流程（课前/课中/课后）
4) 用户故事（至少15条）
5) 功能范围（MVP / v1.1）
6) 页面清单与关键交互
7) 数据模型草案
8) 权限矩阵
9) 统计口径定义（正确率、完成率、平均耗时）
10) 验收标准（Gherkin）

注意：必须突出教学价值：
- 诊断共性薄弱点
- 提高匿名参与
- 抢答提升课堂趣味性
```

## 2. 数据库与 RLS 提示词（Supabase）

```text
请为答题器模块生成 Supabase migration SQL，包含：

1) question_bank
- id uuid pk
- owner_user_id uuid
- title text
- subject text
- grade text
- tags text[] default '{}'
- created_at timestamptz default now()

2) questions
- id uuid pk
- bank_id uuid fk
- type text check in ('single','multiple','judge','short')
- stem text
- options jsonb nullable
- correct_answer jsonb nullable
- explanation text nullable
- difficulty int default 2
- score numeric default 1
- created_at timestamptz default now()
- updated_at timestamptz default now()

3) quiz_papers
- id uuid pk
- owner_user_id uuid
- title text
- description text
- question_ids uuid[]
- total_score numeric
- created_at timestamptz default now()

4) quiz_sessions
- id uuid pk
- owner_user_id uuid
- mode text check in ('single_question','paper','rush')
- paper_id uuid nullable fk
- question_id uuid nullable fk
- title text
- join_code text unique
- status text check in ('draft','active','ended') default 'draft'
- allow_anonymous boolean default true
- show_correct_immediately boolean default false
- started_at timestamptz nullable
- ended_at timestamptz nullable
- created_at timestamptz default now()

5) quiz_session_students
- id uuid pk
- session_id uuid fk
- student_name text
- actor_key text
- joined_at timestamptz default now()
- unique(session_id, actor_key)

6) quiz_answers
- id uuid pk
- session_id uuid fk
- question_id uuid fk
- actor_key text
- student_name text
- answer jsonb
- is_correct boolean nullable
- score numeric default 0
- duration_ms int nullable
- submitted_at timestamptz default now()
- unique(session_id, question_id, actor_key)

7) quiz_short_grades
- id uuid pk
- answer_id uuid fk unique
- grader_user_id uuid
- score numeric
- comment text
- graded_at timestamptz default now()

8) quiz_name_suggestions
- id uuid pk
- session_id uuid fk
- student_name text
- usage_count int default 1
- last_used_at timestamptz default now()
- unique(session_id, student_name)

同时输出：
- 索引
- updated_at 触发器
- RLS（教师全控；学生匿名最小写权限；会话结束后不可再提交）
- RPC:
  - create_quiz_session(...)
  - submit_quiz_answer(...)
  - get_quiz_live_stats(...)
  - upsert_name_suggestion(...)
```

## 3. 路由与页面提示词

```text
请新增页面与路由：
- /quiz（教师端：题库/试卷/历史会话）
- /quiz/session/:sessionId（教师端实时看板）
- /quiz/join/:joinCode（学生端输入姓名）
- /quiz/answer/:sessionId（学生答题页）

新增组件建议：
- components/quiz/QuestionEditor.tsx
- components/quiz/QuestionTypeTabs.tsx
- components/quiz/PaperBuilder.tsx
- components/quiz/SessionLauncher.tsx
- components/quiz/NameAutoComplete.tsx
- components/quiz/StudentAnswerPanel.tsx
- components/quiz/LiveStatsBoard.tsx
- components/quiz/charts/OptionDistributionChart.tsx
- components/quiz/charts/AccuracyGauge.tsx
- components/quiz/charts/SubmissionTrendChart.tsx
- components/quiz/RushModeBoard.tsx

要求：
1) 学生端移动端优先，3步内完成答题。
2) 与现有二维码能力联动（直接复用当前二维码组件/逻辑）。
3) 视图状态清晰：未开始、进行中、已结束。
4) 结果图表实时刷新，不必手动刷新页面。
```

## 4. 业务规则与判分提示词

```text
请实现以下核心业务规则：

1) 题目类型
- 单选：唯一选项
- 多选：多选数组
- 判断：true/false
- 简答：文本提交

2) 自动判分
- 单选/多选/判断自动判分
- 简答默认待批阅（score=null）
- 会话总分 = 各题得分求和

3) 正确率口径
- 正确率 = 客观题中答对人数 / 客观题有效提交人数
- 简答不计入实时正确率，另设“待批阅数”

4) 姓名自动补全
- join页输入姓名时，联想展示当前会话常用姓名
- 支持前缀匹配，最多显示8条

5) 抢答模式
- 教师点击“开始抢答”后，首个正确提交者记为本轮获胜
- 若首个提交错误，则继续等待下一位
- 每轮产生 winner_name、winner_time_ms

6) 防重复提交
- 同一 actor_key 对同一题仅保留最后一次或首次（可配置，默认最后一次）
```

## 5. 实时统计提示词

```text
请为教师实时看板实现统计与可视化：

统计项：
1) 当前提交人数 / 应答人数
2) 客观题正确率
3) 选项分布（A/B/C/D）
4) 每题提交热度排行
5) 简答待批阅数量
6) 抢答榜（前10名）

图表建议：
- 选项分布：柱状图
- 正确率：环形图或仪表图
- 提交人数变化：折线图

技术要求：
- 使用现有 chart 组件能力（优先复用项目中 chart.tsx）
- 通过 Supabase Realtime + RPC 拉平延迟
- 处理断线重连与幂等更新
```

## 6. 安全与风控提示词

```text
请补齐安全策略：
1) 输入校验：题干、选项、简答文本长度限制
2) XSS防护：所有富文本/文本渲染前转义
3) 匿名 actor_key：基于设备+会话生成，避免明文设备标识
4) 频率限制：同 actor_key 每10秒最多提交2次
5) 会话状态校验：ended 状态拒绝提交
6) 审计日志：教师端关键操作（开始/结束会话、改分、删除题目）

输出前后端共同约束，不能只做前端校验。
```

## 7. 测试提示词（Vitest + Testing Library）

```text
请为答题器模块新增测试，覆盖：

1) 题目编辑
- 不同题型字段渲染正确
- 保存校验（空题干、无选项等）

2) 组卷逻辑
- 题库筛选、加入/移除试卷、总分计算

3) 学生加入与姓名补全
- join_code校验
- 姓名自动补全候选展示与选择

4) 提交与判分
- 单选/多选/判断自动判分
- 简答进入待批阅
- 重复提交策略正确

5) 实时统计
- mock realtime 事件后图表数据刷新
- 正确率和分布口径正确

6) 抢答模式
- 首个正确提交者获胜逻辑
- 错误首提不算胜者

要求：
- mock Supabase 和 Realtime
- 不改业务逻辑
- 给出可执行命令和预期结果
```

## 8. 上线验收提示词

```text
请对答题器模块进行发布前验收，输出报告：

检查项：
1) 类型检查与构建
2) 教师端全链路手测
3) 学生端扫码答题链路（移动端）
4) 并发 80 人提交下实时统计稳定性
5) 权限与RLS正确性
6) 导出CSV准确性
7) 异常恢复（断网、重复提交、会话结束）

输出：
- 阻断问题
- 高优问题
- 可延期问题
- 发布建议（Go/No-Go）
```

## 9. 最短一键版（快速MVP）

```text
请在 TeachMater 中新增答题器 MVP：
- 题型：单选 + 判断 + 简答
- 发布方式：教师发起会话并生成二维码
- 学生端：扫码 -> 输入姓名（自动补全）-> 答题
- 教师端：实时看板显示提交人数、正确率、选项分布
- 判分：客观题自动判分，简答待批阅
- 模式：普通答题 + 抢答
- 导出：CSV

请拆成 4 次提交：
1) 数据库与类型
2) 页面和组件
3) 实时统计与抢答
4) 测试与文档
每次提交后输出变更文件清单和运行命令。
```

## 10. 推荐执行顺序

1. 先发「0 总控」
2. 再发「1 PRD」确认口径
3. 发「2 数据库与RLS」
4. 发「3 页面」+「4 业务规则」
5. 发「5 实时统计」+「6 安全」
6. 最后发「7 测试」+「8 验收」

这样能最大化降低一次性大改导致的代码质量波动。
