// AI 生图（火山引擎豆包 / Seedream）配置：
// 三层结构 —— 逻辑结构分类（一级筛选） → 图表类型（二级） → 具体形式 + 三级提示词模板

/** 逻辑结构分类：让用户可以按「要表达什么」而不是「叫什么图」来找 */
export interface StructureDef {
  key: string;
  name: string;
  icon: string;
  desc: string;
}

export const STRUCTURE_CATEGORIES: StructureDef[] = [
  { key: 'all', name: '全部', icon: '✳️', desc: '显示全部图表类型' },
  { key: 'data', name: '数据类', icon: '📈', desc: '展示数值、比例与趋势' },
  { key: 'process', name: '流程类', icon: '🔀', desc: '展示步骤、流转与变化' },
  { key: 'structure', name: '结构类', icon: '🏗️', desc: '展示层级、组成与架构' },
  { key: 'compare', name: '比较类', icon: '⚖️', desc: '对比多个对象的异同' },
  { key: 'time', name: '时序类', icon: '⏳', desc: '按时间排列阶段与里程碑' },
  { key: 'relation', name: '关系类', icon: '🔗', desc: '展示实体之间的关联与流动' },
  { key: 'concept', name: '框架类', icon: '🧩', desc: '解释抽象概念与分析模型' },
  { key: 'list', name: '列表类', icon: '📝', desc: '把纯文字清单变得可视化' },
  { key: 'geo', name: '地理类', icon: '🗺️', desc: '展示地区分布与路径' },
  { key: 'brand', name: '营销/个人', icon: '📣', desc: '简历、海报、社交媒体图' },
];

export interface ChartTypeDef {
  key: string;
  name: string;
  icon: string;
  desc: string;
  structure: string;
  subs: string[];
}

export const CHART_TYPES: ChartTypeDef[] = [
  // —— 数据类 ——
  { key: 'datachart', name: '数据图表', icon: '📈', structure: 'data', desc: '用图形准确表达数值与趋势', subs: ['柱状图', '条形图', '折线图', '面积图', '饼图', '环形图', '散点图', '雷达图', '热力图'] },
  { key: 'dashboard', name: '数据看板', icon: '🖥️', structure: 'data', desc: '多图并置的指标总览仪表盘', subs: ['KPI 卡片墙', '综合看板', '月度报表', '年度总结', '市场分析'] },
  { key: 'infographic', name: '信息图', icon: '📊', structure: 'data', desc: '把要点、数据整合成一张可讲解的图文海报', subs: ['统计卡片', '数据总览', '要点列表', '图文混排', '时间轴信息图', '对比信息图'] },

  // —— 流程类 ——
  { key: 'flowchart', name: '流程图', icon: '🔀', structure: 'process', desc: '按步骤/分支表达执行过程', subs: ['线性流程', '基本流程', '泳道图', '跨职能流程', '决策树', '工作流', '数据流'] },
  { key: 'cycle', name: '循环流程图', icon: '🔁', structure: 'process', desc: '首尾相接的闭环流程（PDCA 等）', subs: ['PDCA 循环', '闭环流程', '双循环', '螺旋上升', '生命周期'] },
  { key: 'funnel', name: '漏斗图', icon: '🫙', structure: 'process', desc: '展示逐层转化与流失', subs: ['销售转化漏斗', '用户增长漏斗', '招聘漏斗', '倒金字塔'] },
  { key: 'mechanism', name: '机制图', icon: '⚙️', structure: 'process', desc: '解释「怎么运作」，强调输入→过程→输出', subs: ['流程机制', '因果链', '反馈回路', '循环机制', '层次结构', '网络机制'] },

  // —— 结构类 ——
  { key: 'orgchart', name: '组织架构图', icon: '🏢', structure: 'structure', desc: '展示团队/部门的层级隶属', subs: ['公司架构', '团队架构', '项目组织', '矩阵式组织'] },
  { key: 'pyramid', name: '金字塔图', icon: '🔺', structure: 'structure', desc: '自下而上的层级递进结构', subs: ['需求层次', '能力金字塔', '目标分解', '倒金字塔'] },
  { key: 'mindmap', name: '思维导图', icon: '🧠', structure: 'structure', desc: '中心主题向外发散的知识结构', subs: ['辐射状', '树状图', '逻辑图', '概念图', '气泡图', '组织结构'] },
  { key: 'architecture', name: '架构图', icon: '🏗️', structure: 'structure', desc: '系统分层、模块与依赖关系', subs: ['系统架构', '云架构', '微服务', '数据架构', '网络拓扑', '分层架构'] },

  // —— 比较类 ——
  { key: 'comparison', name: '对比图', icon: '⚖️', structure: 'compare', desc: '并列比较多个对象的异同', subs: ['左右双栏对比', '多条目对比表', '并排对比', '矩阵对比', '雷达对比', '条形对比'] },
  { key: 'venn', name: '维恩图', icon: '🔵', structure: 'compare', desc: '展示集合之间的交集与差异', subs: ['两圆交叉', '三圆交叉', '包含关系', '核心交集'] },

  // —— 时序类 ——
  { key: 'timeline', name: '时间线', icon: '⏳', structure: 'time', desc: '按时间顺序展示阶段与里程碑', subs: ['水平时间线', '垂直时间线', '蛇形时间线', '环形时间轴', '里程碑'] },
  { key: 'gantt', name: '甘特图', icon: '📅', structure: 'time', desc: '项目排期与任务进度管理', subs: ['项目排期', '任务分解', '资源计划', '进度追踪'] },
  { key: 'roadmap', name: '路线图', icon: '🛣️', structure: 'time', desc: '规划未来阶段目标与节奏', subs: ['产品路线图', '季度规划', '学习路径', '战略路线'] },

  // —— 关系类 ——
  { key: 'relationship', name: '关系图', icon: '🔗', structure: 'relation', desc: '表达实体之间的连接与流向', subs: ['网络图', '力导向图', '拓扑关系', '实体关系'] },
  { key: 'sankey', name: '桑基图', icon: '🌊', structure: 'relation', desc: '展示数据/资源的流动与分配', subs: ['能量流动', '预算流向', '用户去向', '供应链流'] },
  { key: 'fishbone', name: '鱼骨图', icon: '🐟', structure: 'relation', desc: '特性要因分析，定位问题根因', subs: ['问题归因', '质量分析', '5M1E 分析', '服务改进'] },

  // —— 框架类 ——
  { key: 'swot', name: 'SWOT 分析', icon: '🧭', structure: 'concept', desc: '优势/劣势/机会/威胁四象限', subs: ['经典 SWOT', '个人 SWOT', '产品 SWOT', 'TOWS 策略'] },
  { key: 'pest', name: 'PEST 分析', icon: '🌐', structure: 'concept', desc: '政治/经济/社会/技术宏观环境', subs: ['经典 PEST', 'PESTEL', '行业环境', '出海分析'] },
  { key: 'matrix', name: '四象限矩阵', icon: '🔲', structure: 'concept', desc: '两个维度切分的 2×2 战略矩阵', subs: ['波士顿矩阵', '重要-紧急矩阵', '优先级矩阵', '风险矩阵'] },
  { key: 'canvas', name: '商业模型画布', icon: '🧱', structure: 'concept', desc: '九宫格商业模式画布', subs: ['商业模式画布', '精益画布', '价值主张画布'] },
  { key: 'research', name: '科研申报图', icon: '🔬', structure: 'concept', desc: '课题申报、技术路线与研究框架', subs: ['技术路线', '研究框架', '实验设计', '概念框架', '学术海报'] },

  // —— 列表类 ——
  { key: 'iconlist', name: '图标列表', icon: '📝', structure: 'list', desc: '要点清单配图标的卡片排布', subs: ['图标列表', '编号步骤', '卡片网格', '技巧清单'] },
  { key: 'checklist', name: '检查清单', icon: '☑️', structure: 'list', desc: '带勾选框的待办/自检清单', subs: ['上线自检', '待办清单', '备考清单', '流程核对'] },

  // —— 地理类 ——
  { key: 'map', name: '地图分布', icon: '🗺️', structure: 'geo', desc: '按地域展示数据分布', subs: ['中国地图热力', '世界地图', '区域点阵', '气泡分布'] },
  { key: 'route', name: '路线路径图', icon: '📍', structure: 'geo', desc: '展示地点之间的路径与流向', subs: ['物流配送', '出行路线', '门店辐射', '供应网络'] },

  // —— 营销 / 个人 ——
  { key: 'resume', name: '个人简历图', icon: '🧑‍💼', structure: 'brand', desc: '可视化简历与个人能力展示', subs: ['简历信息图', '作品集封面', '能力雷达', '职业时间线'] },
  { key: 'team', name: '团队介绍页', icon: '👥', structure: 'brand', desc: '团队成员风采与分工展示', subs: ['成员卡片墙', '核心团队', '导师阵容'] },
  { key: 'poster', name: '宣传海报', icon: '📣', structure: 'brand', desc: '产品/活动推广的图文海报', subs: ['产品亮点长图', '活动海报', '课程招生', '餐饮菜单', '信息型海报'] },
  { key: 'social', name: '社交媒体卡片', icon: '💬', structure: 'brand', desc: '适合分享传播的知识卡片', subs: ['书单干货清单', '引用证言卡片', '知识卡片', '金句海报'] },
];

// 每种图表类型的构图指令（写进提示词，显著提升结构正确率）
export const CHART_TYPE_GUIDES: Record<string, string> = {
  infographic: '顶部一条主标题带副标题，主体分 3–6 个模块化卡片区块，每个区块配一个简洁矢量图标 + 一句要点，重要数字放大加粗；整体像一张可直接投屏讲解的教学海报。',
  dashboard: '看板式栅格布局：顶部一排 3–4 个 KPI 数字卡片，下方并置 2–4 个不同类型的小图表（柱状/折线/环形），每个图表配标题与单位，整体对齐同一网格。',
  mechanism: '用「输入 → 处理 → 输出」的主干贯穿画面，关键环节用方框/圆角块表示，箭头标明方向与作用，必要时画出反馈回路；每个环节下方一行小字解释作用。',
  research: '自上而下呈现研究层级：研究目标 → 关键科学问题 → 技术路线/研究内容 → 预期成果，层与层之间用箭头串联，模块化分区、留白充足，符合基金申报书插图规范。',
  flowchart: '标准流程图符号：椭圆表示开始/结束，矩形表示处理，菱形表示判断（分支标注「是/否」），箭头单一方向不交叉，主流程走直线、分支向侧边展开。',
  cycle: '环形闭环构图：4–6 个环节沿圆周等距排列，弧形箭头顺时针连接首尾相接，每个环节配单色图标与短标题，圆心可放置循环主题名称。',
  funnel: '上宽下窄的漏斗分层，层数 3–6 层，每层标注阶段名、数量与转化率，颜色由浅到深渐变，右侧可标注层间流失率。',
  architecture: '严格分层绘制（如展示层/服务层/数据层），同层模块等高对齐，层间用箭头或连接线表达调用关系，外部系统放在画面边缘并用虚线框区分。',
  orgchart: '自上而下的树状层级：顶层单一节点居中，下级节点等宽等高并水平对齐，使用直角折线连接，同级同色，层级之间留出清晰间距。',
  pyramid: '金字塔分层从底到顶逐层收窄，层数 3–6 层，每层内写层级名称，层外侧可加一行说明文字，色彩自底部深到顶部亮渐变。',
  datachart: '坐标轴、刻度、图例、数据标签齐全且数值与文本一致；配色区分各系列，网格线淡化，标题说明数据含义，不要编造未给出的数据。',
  mindmap: '中心主题放在画面正中并最醒目，一级分支向四周均匀发散并用不同颜色区分，二级分支用细线延伸，分支线条为平滑曲线，文字沿分支水平排列。',
  timeline: '一条清晰主轴贯穿画面，节点等间距分布并标注时间与事件名，节点上下（或左右）交替放置说明卡片，起点与终点有明确标识。',
  gantt: '左侧为任务名称列，右侧为时间刻度轴（周/月/季度），每个任务对应一条水平色条，条上标注起止时间，里程碑用菱形标记，行间隔行浅色底。',
  roadmap: '按阶段（季度/版本）横向分段，每段一个色块标题，段内纵向列出 2–4 个要点，整体呈道路或箭头推进的形态，方向从左到右。',
  comparison: '左右（或多列）对称构图，每列顶部为对象名称，下方逐行对齐比较维度，同一维度横向对齐，差异处用强调色标出，可加一行结论。',
  venn: '2–3 个半透明圆形相交，圆内标注集合名称与代表要点，交集区域用叠色显示并写出共同点，圆外留出图例。',
  relationship: '节点大小体现重要度，连线粗细体现关系强度并标注关系名称，避免连线交叉与重叠，重要节点集中于画面中心区域。',
  sankey: '左侧为来源、右侧为去向，中间用宽度代表数量的平滑带状流条连接，流条半透明并按来源着色，两端标注名称与数值。',
  fishbone: '水平主骨指向右侧的问题结果框，主骨上下对称伸出 4–6 根大骨（分类维度），每根大骨再延伸小骨写具体原因，鱼头处写问题描述。',
  swot: '标准四象限矩阵：左上 S 优势、右上 W 劣势、左下 O 机会、右下 T 威胁，每象限 3 条要点并配图标，四象限用不同底色区分且面积相等。',
  pest: '四宫格分别为政治(P)、经济(E)、社会(S)、技术(T)，每格顶部为图标与标题，下方列 2–4 条要点，四格等大、配色统一有区分。',
  matrix: '2×2 象限图，横轴与纵轴均标注维度名称与高低方向，四个象限各有名称与代表元素，坐标轴清晰，象限内可用气泡表示对象。',
  canvas: '九宫格画布布局：左侧合作伙伴/关键活动/关键资源，中间价值主张，右侧客户关系/渠道/客户细分，底部成本结构与收入来源，格子边框统一。',
  iconlist: '卡片式网格排列（如 3×2 或 2×3），每张卡片左侧或顶部一个单色矢量图标，右侧标题加粗、描述文字为浅灰，卡片间距一致。',
  checklist: '清单式竖向排列，每项左侧一个方形勾选框，已完成项打勾并文字变灰加删除线，整体像便签或记事本，行距舒适。',
  map: '地图轮廓准确简洁，按数值深浅填色（热力）或用气泡大小表示数量，配图例说明色阶/尺寸含义，标注排名靠前的地区名与数值。',
  route: '地图或简化底图上标出起点与多个终点，用带箭头的虚线/曲线连接表示路径，地点用图标+名称标注，路径不交叉重叠。',
  resume: '纵向分区：顶部姓名职位与头像占位，下方依次为个人优势、经历时间线、技能条（百分比）、教育背景，左右栏对齐，现代极简排版。',
  team: '成员卡片水平或网格排列，每张卡片含头像占位、姓名、职位、一句话简介，卡片等高等宽，底部可加一行团队使命。',
  poster: '海报式竖向构图：顶部大标题与主视觉，中部 3–6 个卖点/栏目图文块，底部行动号召区（二维码占位/联系方式），层次分明、视觉冲击力强。',
  social: '正方形或竖版社媒卡片，主标题醒目居上，内容以 3–5 条卡片或引用块呈现，留出品牌色块与署名位置，适合手机阅读的大字号。',
};

/** 三级提示词模板：`${chartType}:${subStyle}` → 具体绘制指令 */
export const SUB_STYLE_GUIDES: Record<string, string> = {
  // 数据类
  'datachart:柱状图': '柱状图对比各类别数值，纵轴标注单位，柱顶显示具体数值标签，柱体等宽等距、使用同色系渐变。',
  'datachart:条形图': '横向条形图，类别名称在左侧对齐，条形按数值从大到小排序，条尾标注数值。',
  'datachart:折线图': '折线随时间变化，曲线平滑，标注最高点与最低点，横轴为时间刻度，纵轴标注单位。',
  'datachart:面积图': '折线下方填充浅色半透明面积，多系列时叠加区分，标注关键拐点。',
  'datachart:饼图': '饼图展示各部分占比，扇区按比例准确，外侧引线标注名称与百分比，配色柔和。',
  'datachart:环形图': '环形图展示占比，圆心放置总量或核心数字，扁平风格，各扇区标注百分比。',
  'datachart:散点图': '散点表示两个变量关系，坐标轴标注维度名称，可加一条趋势线，异常点突出标记。',
  'datachart:雷达图': '多维度雷达图，各轴标注维度名与满分刻度，多对象用半透明填充叠加，图例置于右下角。',
  'datachart:热力图': '网格热力图，颜色深浅代表数值大小，行列均有标签，右侧附色阶图例。',
  'dashboard:KPI 卡片墙': '顶部 3–4 张 KPI 卡片，每张一个大数字 + 指标名 + 同比箭头，下方补充小图。',
  'dashboard:年度总结': '年度总结看板：核心成绩数字、月度趋势折线、结构占比环形图、重点事件时间线四区并置。',
  'dashboard:市场分析': '市场分析看板：市场规模趋势、份额占比、竞品对比、增长驱动因素四个区块。',

  // 流程类
  'flowchart:线性流程': '水平线性流程，步骤依次编号并用箭头连接，每步一张卡片含步骤名与一句说明。',
  'flowchart:泳道图': '按角色划分横向泳道，每条泳道内放置该角色负责的步骤，跨泳道用箭头表示交接。',
  'flowchart:决策树': '从根节点出发按判断条件分叉，菱形判断节点标注「是/否」，末端为结论节点。',
  'cycle:PDCA 循环': '计划-执行-检查-改进四环节形成顺时针闭环，每环节配单色图标与短说明。',
  'cycle:生命周期': '按阶段顺时针排列生命周期环节，箭头首尾相接，圆心写主题名。',
  'funnel:销售转化漏斗': '自上而下的转化漏斗，每层标注阶段名、数量与转化率，暖色渐变，层间标出流失比例。',
  'funnel:用户增长漏斗': '曝光→点击→注册→活跃→付费分层漏斗，逐层收窄并标注人数与转化率。',

  // 结构类
  'orgchart:公司架构': '顶层为最高负责人，下设职能负责人，再往下展开各职能小组，竖直树状、直角连接线、标题栏统一色。',
  'pyramid:需求层次': '五层金字塔自下而上递进，每层写层级名与典型表现，暖色渐变，底宽顶窄。',
  'mindmap:辐射状': '中心主题居中，四周均匀发散一级分支（不同颜色），每个一级分支再延伸 2–3 个子节点，线条为有机曲线。',
  'architecture:分层架构': '自上而下展示层次（如应用层/服务层/数据层），每层内并排模块等高，层间箭头表示调用。',

  // 比较类
  'comparison:左右双栏对比': '左右两栏对比两个对象，按 3–5 个维度逐行对齐，优劣用绿√红×图标标出，表格化排版。',
  'comparison:多条目对比表': '多列方案对比表，表头加粗、隔行换色，每列一个方案并用不同主色，关键差异高亮。',
  'venn:两圆交叉': '两个半透明圆相交，各写集合名与要点，交集区域标注核心共同点。',
  'venn:三圆交叉': '三个半透明圆两两相交，标注各自特征、两两交集与中心公共交集。',

  // 时序类
  'timeline:水平时间线': '水平主轴贯穿，等距分布 4–8 个节点，每节点含年份/时间、标题与一句描述，上下交替放置。',
  'timeline:垂直时间线': '中间竖轴串联各阶段，左侧写时间、右侧写内容卡片，节点用圆形图标。',
  'timeline:蛇形时间线': 'S 形蛇形排布节点，节省横向空间，节点按顺序编号并配图标。',
  'gantt:项目排期': '左列任务名，右侧按周/月刻度绘制彩色进度条，里程碑用菱形，条上标注起止时间。',
  'roadmap:产品路线图': '按四个季度横向分段，每段列出 2–3 个功能点，彩色分段推进条，方向从左到右。',

  // 关系与框架
  'sankey:预算流向': '左侧为资金来源、右侧为使用去向，流条宽度代表金额，两端标注名称与数值。',
  'fishbone:问题归因': '鱼头写问题结果，主骨上下伸出人员/流程/产品/环境/价格/系统等大骨，每根大骨延伸具体小原因。',
  'swot:经典 SWOT': '四象限分别为 S 优势、W 劣势、O 机会、T 威胁，每象限 3 条要点，左上绿、右上黄、左下蓝、右下红。',
  'pest:经典 PEST': '政治、经济、社会、技术四宫格，每格图标 + 3 条要点，四格等大配色统一。',
  'matrix:波士顿矩阵': '横轴市场占有率、纵轴市场增长率，四象限为明星、问题、金牛、瘦狗，象限内用气泡标注对象。',
  'matrix:重要-紧急矩阵': '横轴紧急程度、纵轴重要程度，四象限标注处理策略并各列 2–3 个事项。',
  'canvas:商业模式画布': '标准九宫格画布，每格标题加粗，格内 2–3 条要点，中间价值主张格用强调色。',

  // 列表类
  'iconlist:图标列表': '3×2 卡片网格，每条要点左侧一个单色矢量图标，标题加粗、描述为灰色小字。',
  'iconlist:编号步骤': '竖向排列步骤，每步有彩色圆形数字编号与简洁插画，上下留出舒适间距。',
  'checklist:上线自检': '便签纸风格清单，每项前带方框勾选标记，已完成项打勾并划线变灰。',

  // 地理类
  'map:中国地图热力': '中国地图按数值深浅填色，标注前五名地区名称与数值，右下角含南海诸岛小图与色阶图例。',
  'map:区域点阵': '地图上用气泡标出各城市数值，气泡大小代表数量，旁边标注城市名与数字。',
  'route:物流配送': '从中心仓出发向多个区域仓的带箭头虚线路径，地点配图标，底图为浅色地形纹理。',

  // 营销与个人
  'resume:简历信息图': '含头像占位、个人优势、工作经历时间线、技能百分比条、教育背景，现代极简，双主色搭配。',
  'resume:能力雷达': '五维能力雷达图（如设计、沟通、逻辑、领导力、技术），标注各项评分，右侧附简短总结。',
  'team:成员卡片墙': '4 名成员卡片水平排列，含头像占位、姓名、职位、一句话简介，底部一行团队使命。',
  'poster:产品亮点长图': '竖向长图：主标题+产品图占位、6 个核心卖点图文、参数对比表、底部二维码区，配色高级有质感。',
  'poster:餐饮菜单': '菜单式排版，按品类分区，每道菜含名称、简短描述与价格，配食物插画占位，边框与分隔线精致。',
  'social:书单干货清单': '5 本书纵向排列，每本含封面缩略占位、书名、作者与一行推荐理由，温暖纸质感背景。',
  'social:引用证言卡片': '三段用户证言错落排布，每段带双引号、头像占位、姓名与身份，并加星级评分。',
};

export interface PaletteDef {
  key: string;
  name: string;
  colors: string[];
}

export const AI_PALETTES: PaletteDef[] = [
  { key: 'blue', name: '科技蓝', colors: ['#4f6ef6', '#8aa2ff', '#e8edff', '#1e293b'] },
  { key: 'teal', name: '青绿', colors: ['#0ea5a4', '#5eead4', '#e6fffb', '#134e4a'] },
  { key: 'violet', name: '紫罗兰', colors: ['#7c3aed', '#c4b5fd', '#f3eaff', '#3b0764'] },
  { key: 'amber', name: '暖橙', colors: ['#f59e0b', '#fcd34d', '#fff7e6', '#78350f'] },
  { key: 'rose', name: '玫瑰红', colors: ['#e11d48', '#fda4af', '#fff1f3', '#4c0519'] },
  { key: 'slate', name: '商务灰', colors: ['#475569', '#94a3b8', '#f1f5f9', '#0f172a'] },
  { key: 'forest', name: '森林绿', colors: ['#15803d', '#86efac', '#ecfdf3', '#052e16'] },
  { key: 'ink', name: '水墨', colors: ['#1f2937', '#6b7280', '#f8fafc', '#020617'] },
  { key: 'gold', name: '科技黑金', colors: ['#d4af37', '#f4e2a1', '#1c1c1e', '#f8fafc'] },
  { key: 'coral', name: '深蓝珊瑚', colors: ['#1e3a8a', '#fb7185', '#eef2ff', '#0f172a'] },
];

export const AI_FONTS = [
  { key: 'sans', name: '思源黑体' },
  { key: 'serif', name: '思源宋体' },
  { key: 'yahei', name: '微软雅黑' },
  { key: 'kai', name: '楷体' },
];

export const AI_STYLES = [
  { key: 'professional', name: '专业商务' },
  { key: 'minimal', name: '简约现代' },
  { key: 'academic', name: '学术严谨' },
  { key: 'creative', name: '创意活泼' },
  { key: 'tech', name: '科技质感' },
  { key: 'warm', name: '温暖手绘' },
];

export const AI_STYLE_GUIDES: Record<string, string> = {
  professional: '干净的商务风格，规整网格排版，圆角卡片，轻微投影，克制的图标语言。',
  minimal: '极简现代风格，大量留白，细线条，弱化装饰，只保留信息本身。',
  academic: '学术严谨风格，结构对称、线条精确、标注规范，接近论文与教材插图。',
  creative: '活泼的教学风格，柔和圆润的形状与生动图标，颜色明快但不喧宾夺主。',
  tech: '科技感风格，深色或冷色底、发光描边与细网格质感，几何化图形。',
  warm: '温暖手绘风格，柔和笔触与纸质纹理，圆润插画感，亲和力强。',
};

// 火山方舟 Seedream 支持的生图模型
export const AI_MODELS = [
  { key: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0（推荐）', maxTier: '4K' },
  { key: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0 文生图', maxTier: '2K' },
];

// 分辨率档位
export const AI_RESOLUTIONS = [
  { key: '1K', name: '1K 标准（快）' },
  { key: '2K', name: '2K 高清' },
  { key: '4K', name: '4K 超清（慢）' },
];

// 画面比例 → 各档位实际像素（符合方舟 Seedream 尺寸范围）
export interface RatioDef {
  key: string;
  name: string;
  dims: Record<string, string>;
}

export const AI_RATIOS: RatioDef[] = [
  { key: '1:1', name: '正方形 1:1', dims: { '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' } },
  { key: '4:3', name: '横版 4:3', dims: { '1K': '1152x864', '2K': '2304x1728', '4K': '4096x3072' } },
  { key: '3:4', name: '竖版 3:4', dims: { '1K': '864x1152', '2K': '1728x2304', '4K': '3072x4096' } },
  { key: '16:9', name: '宽屏 16:9', dims: { '1K': '1280x720', '2K': '2560x1440', '4K': '4096x2304' } },
  { key: '9:16', name: '竖屏 9:16', dims: { '1K': '720x1280', '2K': '1440x2560', '4K': '2304x4096' } },
  { key: '3:2', name: '横版 3:2', dims: { '1K': '1248x832', '2K': '2496x1664', '4K': '3936x2624' } },
  { key: '2:3', name: '竖版 2:3', dims: { '1K': '832x1248', '2K': '1664x2496', '4K': '2624x3936' } },
  { key: '21:9', name: '超宽 21:9', dims: { '1K': '1512x648', '2K': '3024x1296', '4K': '4096x1760' } },
];

export const AI_BACKGROUNDS = [
  { key: 'white', name: '纯白背景' },
  { key: 'light', name: '浅灰底' },
  { key: 'gradient', name: '淡渐变' },
  { key: 'dark', name: '深色底' },
  { key: 'transparent', name: '近似透明（白底）' },
];

export const AI_TEXT_DENSITY = [
  { key: 'low', name: '文字精简' },
  { key: 'medium', name: '文字适中' },
  { key: 'high', name: '文字详尽' },
];

export const AI_TEXT_DENSITY_GUIDES: Record<string, string> = {
  low: '每个模块只保留标题 + 不超过 8 个字的关键词，全图文字总量控制在 60 字以内。',
  medium: '每个模块标题 + 一句不超过 20 字的说明，全图文字总量控制在 150 字以内。',
  high: '每个模块可含标题与 2–3 条要点，但仍需保证字号可读、不拥挤。',
};

export const AI_LANGUAGES = [
  { key: 'zh', name: '中文标注' },
  { key: 'en', name: '英文标注' },
  { key: 'bilingual', name: '中英双语' },
];

// 一键场景预设：按应用场景分组，降低新用户的配置成本
export interface PresetDef {
  key: string;
  name: string;
  icon: string;
  group: string;
  patch: Partial<AIImageParams>;
}

export const PRESET_GROUPS = ['教育与学术', '商务与职场', '数据与报告', '个人与创意'];

export const AI_PRESETS: PresetDef[] = [
  // 教育与学术
  { key: 'lesson', name: '教学课件图', icon: '🧑‍🏫', group: '教育与学术', patch: { chartType: 'infographic', subStyle: '图文混排', style: 'creative', palette: 'blue', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'principle', name: '原理机制图', icon: '⚙️', group: '教育与学术', patch: { chartType: 'mechanism', subStyle: '流程机制', style: 'academic', palette: 'teal', ratio: '4:3', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'research', name: '课题技术路线', icon: '🔬', group: '教育与学术', patch: { chartType: 'research', subStyle: '技术路线', style: 'academic', palette: 'slate', ratio: '4:3', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'paperfig', name: '论文配图', icon: '📄', group: '教育与学术', patch: { chartType: 'research', subStyle: '研究框架', style: 'academic', palette: 'ink', ratio: '4:3', background: 'white', textDensity: 'low', language: 'bilingual' } },
  { key: 'experiment', name: '实验报告图', icon: '🧪', group: '教育与学术', patch: { chartType: 'research', subStyle: '实验设计', style: 'academic', palette: 'teal', ratio: '4:3', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'syllabus', name: '课程大纲', icon: '📚', group: '教育与学术', patch: { chartType: 'mindmap', subStyle: '树状图', style: 'minimal', palette: 'violet', ratio: '16:9', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'acadposter', name: '学术海报', icon: '🖼️', group: '教育与学术', patch: { chartType: 'research', subStyle: '学术海报', style: 'academic', palette: 'slate', ratio: '3:4', background: 'light', textDensity: 'high', language: 'bilingual' } },
  { key: 'summary', name: '知识总结导图', icon: '🧠', group: '教育与学术', patch: { chartType: 'mindmap', subStyle: '辐射状', style: 'minimal', palette: 'violet', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },

  // 商务与职场
  { key: 'bizreport', name: '商务报告', icon: '💼', group: '商务与职场', patch: { chartType: 'dashboard', subStyle: '综合看板', style: 'professional', palette: 'slate', ratio: '16:9', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'proposal', name: '项目提案', icon: '📌', group: '商务与职场', patch: { chartType: 'roadmap', subStyle: '战略路线', style: 'professional', palette: 'blue', ratio: '16:9', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'swot', name: 'SWOT 分析', icon: '🧭', group: '商务与职场', patch: { chartType: 'swot', subStyle: '经典 SWOT', style: 'professional', palette: 'amber', ratio: '4:3', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'pest', name: 'PEST 分析', icon: '🌐', group: '商务与职场', patch: { chartType: 'pest', subStyle: '经典 PEST', style: 'professional', palette: 'teal', ratio: '4:3', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'org', name: '组织架构图', icon: '🏢', group: '商务与职场', patch: { chartType: 'orgchart', subStyle: '公司架构', style: 'professional', palette: 'blue', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'canvas', name: '商业模型画布', icon: '🧱', group: '商务与职场', patch: { chartType: 'canvas', subStyle: '商业模式画布', style: 'professional', palette: 'slate', ratio: '16:9', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'gantt', name: '项目甘特图', icon: '📅', group: '商务与职场', patch: { chartType: 'gantt', subStyle: '项目排期', style: 'professional', palette: 'blue', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },

  // 数据与报告
  { key: 'dashboard', name: '数据看板', icon: '🖥️', group: '数据与报告', patch: { chartType: 'dashboard', subStyle: 'KPI 卡片墙', style: 'tech', palette: 'blue', ratio: '16:9', background: 'dark', textDensity: 'low', language: 'zh' } },
  { key: 'annual', name: '年度总结报告', icon: '🏆', group: '数据与报告', patch: { chartType: 'dashboard', subStyle: '年度总结', style: 'professional', palette: 'gold', ratio: '3:4', background: 'dark', textDensity: 'medium', language: 'zh' } },
  { key: 'market', name: '市场分析报告', icon: '📈', group: '数据与报告', patch: { chartType: 'dashboard', subStyle: '市场分析', style: 'professional', palette: 'forest', ratio: '16:9', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'funnel', name: '转化漏斗', icon: '🫙', group: '数据与报告', patch: { chartType: 'funnel', subStyle: '销售转化漏斗', style: 'professional', palette: 'amber', ratio: '4:3', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'compare', name: '对比分析图', icon: '⚖️', group: '数据与报告', patch: { chartType: 'comparison', subStyle: '左右双栏对比', style: 'professional', palette: 'amber', ratio: '4:3', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'geo', name: '区域分布地图', icon: '🗺️', group: '数据与报告', patch: { chartType: 'map', subStyle: '中国地图热力', style: 'professional', palette: 'blue', ratio: '4:3', background: 'white', textDensity: 'low', language: 'zh' } },

  // 个人与创意
  { key: 'resume', name: '个人简历/作品集', icon: '🧑‍💼', group: '个人与创意', patch: { chartType: 'resume', subStyle: '简历信息图', style: 'minimal', palette: 'coral', ratio: '3:4', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'adposter', name: '广告宣传海报', icon: '📣', group: '个人与创意', patch: { chartType: 'poster', subStyle: '产品亮点长图', style: 'tech', palette: 'gold', ratio: '9:16', background: 'dark', textDensity: 'medium', language: 'zh' } },
  { key: 'menu', name: '餐饮菜单', icon: '🍜', group: '个人与创意', patch: { chartType: 'poster', subStyle: '餐饮菜单', style: 'warm', palette: 'amber', ratio: '3:4', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'infoposter', name: '信息型海报', icon: '📌', group: '个人与创意', patch: { chartType: 'infographic', subStyle: '数据总览', style: 'professional', palette: 'forest', ratio: '3:4', background: 'gradient', textDensity: 'medium', language: 'zh' } },
  { key: 'socialcard', name: '社交媒体卡片', icon: '💬', group: '个人与创意', patch: { chartType: 'social', subStyle: '知识卡片', style: 'creative', palette: 'rose', ratio: '1:1', background: 'light', textDensity: 'low', language: 'zh' } },
  { key: 'booklist', name: '书单干货清单', icon: '📖', group: '个人与创意', patch: { chartType: 'social', subStyle: '书单干货清单', style: 'warm', palette: 'amber', ratio: '9:16', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'team', name: '团队介绍页', icon: '👥', group: '个人与创意', patch: { chartType: 'team', subStyle: '成员卡片墙', style: 'creative', palette: 'blue', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },
];

export function resolveSize(ratio: string, resolution: string): string {
  const r = AI_RATIOS.find(x => x.key === ratio) ?? AI_RATIOS[0];
  return r.dims[resolution] ?? r.dims['2K'];
}

export interface AIImageParams {
  chartType: string;
  subStyle: string;
  palette: string;
  font: string;
  style: string;
  model: string;
  ratio: string;
  resolution: string;
  background: string;
  textDensity: string;
  language: string;
  watermark: boolean;
  seed: number | null;
  negativePrompt: string;
  docText: string;
  title: string;
}

export const DEFAULT_AI_IMAGE_PARAMS: AIImageParams = {
  chartType: 'infographic',
  subStyle: '统计卡片',
  palette: 'blue',
  font: 'sans',
  style: 'professional',
  model: 'doubao-seedream-4-0-250828',
  ratio: '4:3',
  resolution: '2K',
  background: 'white',
  textDensity: 'low',
  language: 'zh',
  watermark: false,
  seed: null,
  negativePrompt: '',
  docText: '',
  title: '',
};

const BACKGROUND_GUIDES: Record<string, string> = {
  white: '纯白背景（#FFFFFF），无杂色与噪点',
  light: '浅灰底（#F5F7FA），元素与背景保持足够对比',
  gradient: '淡雅渐变背景，渐变幅度轻微、不干扰文字阅读',
  dark: '深色底，文字与图形使用高亮色确保对比度',
  transparent: '接近透明的纯白底，便于抠图与二次排版',
};

const LANGUAGE_GUIDES: Record<string, string> = {
  zh: '所有标注使用规范简体中文',
  en: '所有标注使用简洁英文',
  bilingual: '关键标注使用「中文（英文）」双语形式，中文为主、英文为辅',
};

// 默认负向词：Seedream 类模型最常见的翻车点
const BASE_NEGATIVE = '错别字、乱码文字、重复文字、无意义英文字符、文字被裁切、文字压图、水印、二维码、logo、真人照片、过度装饰、杂乱线条、模糊低清';

/** 取三级提示词模板 */
export function getSubStyleGuide(chartType: string, subStyle: string): string {
  return SUB_STYLE_GUIDES[`${chartType}:${subStyle}`] ?? '';
}

/** 从文档中提炼标题与要点，让模型更容易生成结构正确的图 */
export function extractOutline(docText: string): { title: string; points: string[] } {
  const lines = docText
    .split(/[\n\r]+/)
    .map(l => l.replace(/^[\s•\-*·\d.、）)]+/, '').trim())
    .filter(Boolean);
  const title = lines[0]?.slice(0, 40) ?? '';
  const rest = lines.slice(1);
  const source = rest.length >= 2
    ? rest
    : docText.split(/[。；;！!？?\n]/).map(s => s.trim()).filter(s => s.length > 3);
  return { title, points: source.slice(0, 8).map(p => p.slice(0, 60)) };
}

export function buildPrompt(p: AIImageParams): string {
  const type = CHART_TYPES.find(t => t.key === p.chartType);
  const palette = AI_PALETTES.find(c => c.key === p.palette);
  const font = AI_FONTS.find(f => f.key === p.font)?.name ?? '思源黑体';
  const style = AI_STYLES.find(s => s.key === p.style)?.name ?? '专业商务';
  const bg = BACKGROUND_GUIDES[p.background] ?? BACKGROUND_GUIDES.white;
  const density = AI_TEXT_DENSITY_GUIDES[p.textDensity] ?? AI_TEXT_DENSITY_GUIDES.low;
  const lang = LANGUAGE_GUIDES[p.language] ?? LANGUAGE_GUIDES.zh;
  const ratio = AI_RATIOS.find(r => r.key === p.ratio)?.key ?? '4:3';
  const typeGuide = CHART_TYPE_GUIDES[p.chartType] ?? '';
  const subGuide = getSubStyleGuide(p.chartType, p.subStyle);
  const styleGuide = AI_STYLE_GUIDES[p.style] ?? '';

  const outline = extractOutline(p.docText);
  const title = (p.title || outline.title || type?.name || '信息图').slice(0, 40);

  const lines = [
    `任务：绘制一张${type?.name ?? '信息图'}（二级形式：${p.subStyle}），画面比例 ${ratio}，一次成图、内容完整。`,
    `主标题：「${title}」，标题位于画面显著位置。`,
    `构图要求：${typeGuide}`,
  ];
  if (subGuide) lines.push(`该形式的具体画法：${subGuide}`);
  lines.push(
    `视觉风格：${style}，${styleGuide}背景为${bg}。`,
    `配色：主色 ${palette?.colors[0]}，辅助色 ${palette?.colors[1]}，浅底色 ${palette?.colors[2]}，深色文字 ${palette?.colors[3]}；同类元素配色一致，强调色只用于重点。`,
    `文字：字形接近${font}，${lang}；${density}字号层级分明（标题 > 模块名 > 说明），文字完整不截断、不重叠、不出现错别字与乱码。`,
    '质量：矢量扁平化插画，线条干净，元素对齐到统一网格，四周留出安全边距，图形与标注一一对应，数据与文字必须与给定内容一致，不得编造数据。',
  );

  if (outline.points.length) {
    lines.push('需要呈现的要点（逐条对应一个图形模块，不要遗漏、不要新增）：');
    outline.points.forEach((pt, i) => lines.push(`${i + 1}. ${pt}`));
  }

  const negative = [BASE_NEGATIVE, p.negativePrompt.trim().slice(0, 200)].filter(Boolean).join('、');
  lines.push(`画面中避免出现：${negative}。`);

  lines.push('原始内容参考：', p.docText.slice(0, 1200));
  return lines.join('\n');
}
