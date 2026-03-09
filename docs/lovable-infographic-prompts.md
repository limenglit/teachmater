# TeachMater 文本可视化信息图生成工具 Lovable 提示词包

说明：
- 目标是实现“输入文本 -> 提炼核心 -> 自动生成信息图/数据图 -> 高清导出”的一体化工具。
- 业务模式可参考通用文本可视化平台（如 Napkin 类产品）与主流数据可视化平台的通用流程。
- 不复制任何第三方品牌元素、模板文件、受版权保护素材与专有文案。

## 0. 作业流程基线提示词（先发）

```text
请先输出本产品的端到端作业流程图（Mermaid）+ 流程说明，流程必须包括：

A. 内容输入层
- 粘贴文本 / 上传 txt, md, docx / 输入主题关键词

B. 语义提炼层
- 核心词提取（关键词、主题词、实体）
- 逻辑结构识别（并列、因果、流程、对比、时间线）
- 数据点识别（百分比、数量、趋势、分组）
- 自动摘要（用于标题与图注）

C. 视觉映射层
- 自动推荐图形类型（流程图、对比图、金字塔、漏斗、象限、时间线、关系图）
- 自动推荐数据图（柱状、折线、饼图、雷达、散点、热力）
- 模板、风格、配色映射

D. 编辑层
- 一键重写文案
- 一键换图形类型
- 一键换配色与风格
- 手动编辑节点/数值/标签

E. 导出层
- 下载 PNG / JPG（高清，支持 2x/3x）
- 可选 SVG/PDF 导出
- 保存历史版本

并输出每一步的输入、输出、失败兜底策略。
```

## 1. 总控提示词（先发）

```text
你是资深产品经理 + 全栈工程师，请在当前 TeachMater 项目新增「文本可视化信息图生成工具」。

硬性约束：
1) 保持现有技术栈：Vite + React + TypeScript + Tailwind + shadcn + Supabase。
2) 先实现可落地 MVP，再扩展高级能力。
3) 核心能力必须包括：
   - 文本核心提炼（关键词 + 结构 + 数据点）
   - 自动生成信息图（非数据图）
   - 自动生成数据图（可切换图表类型）
   - 模板/风格/配色选择
   - 高清 PNG/JPG 下载
4) 必须提供预览编辑区，支持修改后再导出。
5) 分步提交，每步输出变更文件与运行命令。

MVP 范围：
- 输入：粘贴文本 + 文件上传（二选一可先实现）
- 语义分析：核心词、摘要、结构类型
- 图形生成：至少 6 类信息图模板
- 数据图生成：至少 5 类图表
- 样式系统：至少 4 种模板、4 种风格、8 套配色
- 导出：PNG/JPG 高清下载
- 历史：最近 20 次生成记录

请先给开发计划，再开始实现。
```

## 2. 数据模型与存储提示词（Supabase）

```text
请为文本可视化工具设计 Supabase migration SQL：

1) viz_projects
- id uuid pk
- owner_user_id uuid
- title text
- source_type text check in ('paste','file','topic')
- source_content text
- language text default 'zh-CN'
- created_at timestamptz default now()
- updated_at timestamptz default now()

2) viz_extractions
- id uuid pk
- project_id uuid fk
- keywords text[]
- summary text
- structure_type text
- entities jsonb
- data_points jsonb
- confidence numeric
- created_at timestamptz default now()

3) viz_artifacts
- id uuid pk
- project_id uuid fk
- artifact_type text check in ('infographic','chart')
- chart_type text nullable
- template_key text
- style_key text
- palette_key text
- canvas_json jsonb
- created_at timestamptz default now()

4) viz_exports
- id uuid pk
- project_id uuid fk
- artifact_id uuid fk
- format text check in ('png','jpg','svg','pdf')
- file_url text
- width int
- height int
- scale numeric
- created_at timestamptz default now()

5) viz_versions
- id uuid pk
- project_id uuid fk
- version_no int
- prompt_snapshot text
- artifact_snapshot jsonb
- created_at timestamptz default now()

同时输出：
- 索引（owner_user_id, project_id, created_at）
- updated_at trigger
- RLS（仅创建者可读写）
- RPC（可选）：create_viz_project, save_viz_version
```

## 3. 路由与页面提示词

```text
请新增页面与组件：

路由：
- /viz（可视化工作台）
- /viz/:projectId（编辑与导出页）

组件：
- components/viz/VizInputPanel.tsx
- components/viz/CoreExtractionPanel.tsx
- components/viz/StructureDetectorPanel.tsx
- components/viz/InfographicTemplateSelector.tsx
- components/viz/ChartTypeSelector.tsx
- components/viz/StyleSelector.tsx
- components/viz/PaletteSelector.tsx
- components/viz/CanvasEditor.tsx
- components/viz/ChartEditor.tsx
- components/viz/ExportPanel.tsx
- components/viz/HistoryPanel.tsx

交互要求：
1) 左侧配置，右侧实时预览。
2) 支持“信息图模式 / 数据图模式”切换。
3) 支持节点拖拽、文案微调、颜色替换。
4) 移动端为分步向导模式。
```

## 4. 文本提炼与图形映射提示词（核心）

```text
请实现从文本到可视化结构的映射服务：

输入：
- rawText
- language
- targetMode ('infographic'|'chart'|'auto')

输出：
- keywords: string[]
- structureType: 'flow'|'compare'|'timeline'|'hierarchy'|'matrix'|'funnel'|'network'
- infographicBlocks: [{title, points, iconHint, priority}]
- chartDataCandidates: [{chartType, labels, series, insight}]
- titleSuggestion
- subtitleSuggestion

规则：
1) 自动提取 10~25 核心词，去停用词。
2) 根据语义结构推荐信息图类型。
3) 文本含数据时优先生成图表候选。
4) 文本无明确数据时生成“估算/待补充数据”占位并提示用户确认。
5) 输出结构需可直接渲染到前端画布。

请输出：
- TypeScript 接口定义
- 服务函数签名
- 异常处理策略
- 单元测试样例
```

## 5. 模板 / 风格 / 配色系统提示词

```text
请实现可配置视觉系统：

模板（template）：
- clean_card
- edu_poster
- executive_brief
- vibrant_story

风格（style）：
- minimal
- professional
- playful
- data_focus

配色（palette）：
- calm_blue
- orange_energy
- purple_gradient
- green_fresh
- neutral_gray
- red_alert
- dark_modern
- custom

要求：
1) 每个模板定义布局 schema（标题区、内容区、注释区）。
2) 每个风格定义字重、圆角、阴影、线条粗细。
3) 每个配色定义主色、辅色、强调色、背景色。
4) 输出 style tokens JSON，供画布与导出共用。
```

## 6. 数据图能力提示词

```text
请实现数据图生成能力：

支持图表：
- bar
- line
- pie
- radar
- scatter
- area
- heatmap（可选）

功能要求：
1) 自动推荐图表类型，并允许一键切换。
2) 支持多序列数据。
3) 自动生成图表标题、图例、数据标签。
4) 支持单位、百分比、千分位格式化。
5) 提供“数据洞察一句话”自动生成。

实现要求：
- 优先复用项目已有图表组件能力。
- 图表配置与导出一致，避免预览与导出不一致。
```

## 7. 导出提示词（高清 PNG/JPG）

```text
请实现可下载导出能力：

1) 支持导出格式：PNG、JPG（MVP 必做）。
2) 分辨率支持：1x、2x、3x；默认 2x。
3) 支持自定义宽高（如 1080x1350, 1920x1080, A4 比例）。
4) 导出前可选“透明背景/纯色背景”。
5) 文件名自动包含项目名+时间戳。

技术建议：
- 使用前端画布导出方案（如 html-to-image / canvas）
- 导出失败有重试按钮与错误提示
- 大图导出显示进度与耗时
```

## 8. 参考平台通用能力扩展（v1.1）

```text
请在 MVP 基础上规划并实现 v1.1 功能（借鉴行业通用能力，不复制具体产品）：

A. 智能可视化增强
- 一键“换结构”（流程 -> 时间线 -> 对比）
- 一键“文案精简/扩展”
- 一键“多版本图稿对比”

B. 数据增强
- 表格粘贴自动识别数据源
- CSV 导入自动映射图表
- 指标异常点自动标注

C. 协作能力
- 分享链接
- 评论批注
- 历史版本回滚

D. 质量检查
- 文案可读性评分
- 颜色对比度无障碍检查
- 图表误导风险提示（截断轴、样本量不足）

请输出 v1.1 里程碑计划（功能、工期、风险、验收标准）。
```

## 9. 测试提示词（Vitest + Testing Library）

```text
请为文本可视化工具补充测试：

1) 输入解析
- 空文本
- 超长文本
- 中英混合

2) 核心提炼
- 关键词数量范围
- 去重与相关性
- 结构识别正确率（示例集）

3) 图形映射
- 不同结构对应模板正确
- 图表类型推荐逻辑正确

4) 编辑与样式
- 模板/风格/配色切换后预览更新
- 节点编辑持久化

5) 导出
- PNG/JPG 导出成功
- 分辨率参数生效
- 失败重试流程

6) 历史记录
- 保存、读取、回滚

要求：
- mock 外部 AI 服务
- 不修改业务逻辑
- 输出运行命令与预期结果
```

## 10. 上线验收提示词

```text
请做发布前验收并输出报告：

检查项：
1) 类型检查与构建
2) 全链路：文本输入 -> 提炼 -> 生成 -> 编辑 -> 导出
3) 导出性能：高清图 10 秒内完成
4) 图片质量：文字清晰、配色对比可读
5) 多端兼容：桌面/移动
6) 权限与数据隔离（RLS）
7) 异常恢复：网络失败、导出失败、AI接口失败

输出：
- 阻断问题
- 高优问题
- 可延期问题
- 发布建议（Go/No-Go）
```

## 11. 最短一键版（快速开工）

```text
请在 TeachMater 中新增“文本可视化信息图生成”MVP：
- 输入文本 -> 提炼核心词与结构 -> 生成信息图/数据图
- 可切换模板、风格、配色
- 可编辑图稿节点与文案
- 可下载高清 PNG/JPG

请拆成4次提交：
1) 数据模型与页面骨架
2) 文本提炼与结构映射
3) 模板风格配色系统
4) 导出与测试
每次提交后输出变更文件清单与运行命令。
```

## 12. 可直接复制的输入示例

```text
主题：AI素养 vs 批判性AI素养
目标：生成一张课堂信息图 + 一张数据图
受众：高校一年级学生
语言：中文
文本：
AI素养强调工具使用能力，批判性AI素养强调对偏见、风险和后果的识别。教学中需要从“会用”走向“会判断”，通过五个关键问题帮助学生反思：不自己做会失去什么？谁的视角缺失？错误未被发现的后果是什么？谁从中获利？如果不标注AI我还会信吗？

请输出：
1) 核心词清单
2) 信息图结构（分区标题+要点）
3) 数据图候选（图表类型+示例数据+洞察）
4) 最终可导出高清PNG/JPG。
```
