# TeachMater AI PPT 生成工具 Lovable 提示词包

说明：
- 目标是构建“从文稿到可下载 PPT”的一体化工具。
- 参考主流 PPT 生成工具的通用作业流程：输入内容 -> 结构化提纲 -> 风格模板 -> 自动成稿 -> 微调 -> 导出。
- 不复制任何第三方产品的品牌元素、具体模板文件或受版权保护的素材。

## 0. 产品作业流程（给 Lovable 的产品基线）

```text
请先输出本产品的端到端作业流程图（Mermaid）+ 流程说明，流程必须包含：

A. 内容输入层：
- 粘贴文稿 / 上传 txt, md, docx / 输入主题关键词

B. 语义处理层：
- 核心词提取（关键词 + 主题词 + 术语）
- 章节切分（按语义段落）
- 幻灯片大纲生成（每页标题 + 3~5 要点）
- 受众适配（汇报型 / 教学型 / 营销型）

C. 设计生成层：
- 选择模板（商务、教育、学术、创意）
- 选择风格（简洁、专业、故事化、信息图）
- 选择配色（冷静蓝、活力橙、科技灰、品牌自定义）
- 自动图文排版（标题页、目录页、内容页、图表页、结论页）

D. 交互编辑层：
- 一键重写单页
- 长文压缩/扩展
- 图标、配图建议
- 字体与间距微调

E. 导出发布层：
- 生成 .pptx 可直接下载
- 同步导出 PDF
- 保存项目历史版本

并输出每一步的输入、输出、失败兜底策略。
```

## 1. 总控提示词（先发）

```text
你是资深产品经理 + 全栈工程师，请在当前 TeachMater 项目中新增「AI PPT 生成工具」。

硬性约束：
1) 保持现有技术栈：Vite + React + TypeScript + Tailwind + shadcn + Supabase。
2) 先做可落地的 MVP，再扩展高级功能。
3) 核心能力必须包括：
   - 文稿自动核心词提取
   - 自动分页提纲生成
   - 模板/风格/配色选择
   - 生成可下载 .pptx
4) 输出前必须有预览页（至少缩略图预览 + 大纲预览）。
5) 分步提交，提供每一步变更文件清单与运行命令。

MVP 功能：
- 输入：粘贴文本 + 上传 markdown/docx（二选一先做也可）
- AI 分析：关键词、章节、每页标题与要点
- 模板：至少4种
- 风格：至少3种
- 配色：至少6组预设 + 1组自定义主色
- 导出：PPTX 下载（必须）
- 历史：最近20次生成记录

请先给出开发计划，再开始实现。
```

## 2. 数据模型与存储提示词（Supabase）

```text
请为 AI PPT 生成工具设计 Supabase 表结构与 migration SQL：

1) ppt_projects
- id uuid pk
- owner_user_id uuid
- title text
- source_type text check in ('paste','file','topic')
- source_content text
- language text default 'zh-CN'
- audience text
- scenario text
- created_at timestamptz default now()
- updated_at timestamptz default now()

2) ppt_outlines
- id uuid pk
- project_id uuid fk
- keywords text[]
- sections jsonb
- slides_outline jsonb
- quality_score numeric
- created_at timestamptz default now()

3) ppt_styles
- id uuid pk
- project_id uuid fk
- template_key text
- tone text
- palette jsonb
- typography jsonb
- layout_density text
- created_at timestamptz default now()

4) ppt_exports
- id uuid pk
- project_id uuid fk
- file_url text
- file_type text check in ('pptx','pdf')
- file_size_kb int
- created_at timestamptz default now()

5) ppt_versions
- id uuid pk
- project_id uuid fk
- version_no int
- prompt_snapshot text
- slides_json jsonb
- created_at timestamptz default now()

同时输出：
- 索引（project_id, owner_user_id, created_at）
- updated_at trigger
- RLS（仅创建者可读写）
- RPC（可选）：create_ppt_project, save_ppt_version
```

## 3. 前端页面与路由提示词

```text
请新增 AI PPT 工具页面与组件：

路由：
- /ppt（工作台）
- /ppt/:projectId（编辑与预览）

组件拆分建议：
- components/ppt/PptInputPanel.tsx
- components/ppt/KeywordExtractionPanel.tsx
- components/ppt/OutlinePanel.tsx
- components/ppt/TemplateSelector.tsx
- components/ppt/StyleSelector.tsx
- components/ppt/PaletteSelector.tsx
- components/ppt/SlidePreviewGrid.tsx
- components/ppt/SlideEditorPanel.tsx
- components/ppt/ExportPanel.tsx
- components/ppt/HistoryPanel.tsx

交互要求：
1) 左侧输入与配置，右侧实时预览。
2) 生成步骤进度条：解析中 -> 提纲中 -> 排版中 -> 可导出。
3) 单页支持“重写该页”“精简”“展开”“换风格”。
4) 移动端下简化为分步向导。
```

## 4. NLP 与提纲生成提示词（核心）

```text
请实现文稿解析与提纲生成服务，要求：

输入：
- 原始文稿文本（中文优先）
- 目标页数（可选）
- 场景（课堂讲授/工作汇报/项目路演）

输出：
- keywords: string[]（核心词）
- outline: [{slideNo, title, bullets, speakerNotes?}]
- structure: titleSlide, agenda, contentSlides, summary, qa

规则：
1) 自动提取 10~20 个核心词（去重、去停用词）。
2) 每页 bullet 控制在 3~5 条，每条 <= 28 中文字。
3) 优先保证逻辑：背景 -> 问题 -> 方案 -> 结果 -> 行动。
4) 文稿过长时自动摘要；文稿过短时自动扩展上下文。
5) 输出可直接映射到 PPTX 生成器的数据结构。

请提供：
- 解析函数接口定义
- 错误处理（空文本、乱码、超长文本）
- 单元测试样例
```

## 5. 模板 / 风格 / 配色系统提示词

```text
请实现可配置设计系统：

模板（template）：
- business_clean
- edu_board
- academic_report
- startup_pitch

风格（style）：
- concise
- professional
- storytelling
- data_focus

配色（palette）：
- calm_blue
- energetic_orange
- tech_gray
- green_growth
- dark_navy
- warm_beige
- custom_primary

排版规则：
1) 自动选择标题字号、正文字号、行高。
2) 标题页与内容页有不同版式。
3) 图表页优先大图 + 少文本。
4) 中文字体默认选择易读字体，避免过花。

输出：
- style token JSON
- 每个模板的页面布局 schema
- 与导出引擎一致的字段映射
```

## 6. PPTX 导出提示词（可下载）

```text
请实现可下载 PPTX 导出能力，要求：

1) 优先使用可控方案（例如 PptxGenJS）构建 .pptx。
2) 输入为 slides_json，输出为可下载文件 URL。
3) 支持：
   - 标题页
   - 目录页
   - 多内容页
   - 图表占位页
   - 结论页
4) 支持页脚：页码、日期、项目名（可开关）。
5) 支持导出 PDF（可选，若实现复杂可延后到 v1.1）。

注意：
- 导出失败要有明确错误提示。
- 大文件导出显示进度。
- 不泄露任何服务端密钥。
```

## 7. 参考主流工具“通用能力”扩展提示词（v1.1）

```text
请在 MVP 基础上规划并实现 v1.1 扩展功能（借鉴行业通用能力，不复制具体产品）：

A. 智能增强
- 一键“补数据页”（自动建议图表页）
- 一键“演讲稿模式”（每页生成讲稿备注）
- 一键“多版本风格对比”

B. 素材增强
- 图标建议（按关键词）
- 配图建议（版权安全来源链接占位）
- 自动生成图示关系（流程/对比/时间线）

C. 协作能力
- 项目分享链接
- 版本对比与回滚
- 评论与批注

D. 质量检查
- 文案过长预警
- 术语一致性检查
- 颜色对比度可读性检查

请输出 v1.1 里程碑计划（功能、工作量、风险、验收标准）。
```

## 8. 测试提示词（Vitest + Testing Library）

```text
请为 AI PPT 生成工具补充测试，覆盖：

1) 输入解析
- 空文本
- 超长文本
- 中英文混合文本

2) 核心词提取
- 去重
- 关键词数量范围
- 主题相关性

3) 分页提纲
- 页数控制
- 每页 bullet 条数与长度
- 结构完整性（标题/目录/结论）

4) 模板风格映射
- template/style/palette 组合正确落地

5) 导出
- 生成 PPTX 成功
- 失败重试与错误提示

6) 历史记录
- 保存、读取、删除

要求：
- mock 外部 AI 服务与文件导出服务。
- 不改业务逻辑。
- 输出可执行命令与预期结果。
```

## 9. 上线验收提示词

```text
请做发布前验收并输出报告：

检查项：
1) 类型检查与构建
2) 端到端链路：文稿输入 -> 提纲 -> 风格 -> 导出
3) 10页PPT生成性能（目标 30s 内可导出）
4) 导出文件可在 PowerPoint/WPS 打开
5) 多终端兼容（桌面/移动）
6) 权限与数据隔离（RLS）
7) 异常恢复（网络失败/导出失败）

输出：
- 阻断问题
- 高优问题
- 可延期问题
- 发布建议（Go/No-Go）
```

## 10. 最短一键版（快速开工）

```text
请在 TeachMater 中新增「AI PPT 生成」MVP：
- 粘贴文稿 -> 自动提取核心词 -> 自动分页提纲
- 可选模板/风格/配色
- 预览每页标题与要点
- 导出可下载 PPTX

请拆成4次提交：
1) 数据模型与页面骨架
2) NLP提纲生成
3) 风格模板系统
4) PPTX导出与测试
每次提交后给出变更文件清单和运行命令。
```

## 11. 可直接复制的“产品文稿输入示例”

```text
主题：AI素养与批判性AI素养
受众：高校一年级学生
目标：10页课堂讲解PPT
风格：教学+信息图
语言：中文
文稿：
AI素养强调会使用工具，但批判性AI素养强调会判断工具。课堂中学生容易把流畅答案当作正确答案，忽略偏见来源与数据局限。建议在使用AI前先问五个问题：不自己做会失去什么？谁的视角缺失？错误未被发现后果是什么？谁从中获利？如果不标注AI我还会信吗？
请据此生成：
1) 核心词
2) 10页提纲
3) 每页3-5个要点
4) 可导出PPTX。
```
