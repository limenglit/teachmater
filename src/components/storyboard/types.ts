export interface StoryboardParams {
  theme: string;
  audience: 'middle-school' | 'high-school' | 'college' | 'teacher' | 'general';
  tone: 'educational' | 'serious' | 'encouraging' | 'critical';
  panelCount: 3 | 4 | 5 | 6;
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9';
  language: 'zh' | 'en';
  colorScheme: 'soft' | 'high-contrast';
  textDensity: 'low' | 'medium' | 'high';
}

export interface StoryboardResult {
  id: string;
  params: StoryboardParams;
  imageUrl: string;
  prompt: string;
  createdAt: string;
}

export const DEFAULT_PARAMS: StoryboardParams = {
  theme: '',
  audience: 'college',
  tone: 'educational',
  panelCount: 4,
  aspectRatio: '4:3',
  language: 'zh',
  colorScheme: 'soft',
  textDensity: 'medium',
};

export const TEMPLATES: { name: string; nameKey: string; params: Partial<StoryboardParams> }[] = [
  // 教学流程类
  {
    name: '五问反思',
    nameKey: 'storyboard.template.fiveWhys',
    params: {
      theme: '五问反思法：为什么学习AI？为什么需要批判思维？为什么要验证信息？为什么要负责任地使用？为什么要持续学习？',
      audience: 'college',
      tone: 'critical',
      panelCount: 5,
      textDensity: 'medium',
    },
  },
  {
    name: '课堂流程图',
    nameKey: 'storyboard.template.classFlow',
    params: {
      theme: '一节AI素养课的流程：导入→概念讲解→案例分析→小组讨论→实践练习→总结反思',
      audience: 'teacher',
      tone: 'educational',
      panelCount: 6,
      textDensity: 'high',
    },
  },
  {
    name: '角色对比图',
    nameKey: 'storyboard.template.roleCompare',
    params: {
      theme: 'AI时代的学生角色转变：被动接收者vs主动探索者，死记硬背vs批判思考，单独学习vs协作创新',
      audience: 'college',
      tone: 'encouraging',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '案例分析板',
    nameKey: 'storyboard.template.caseAnalysis',
    params: {
      theme: 'AI辅助学习的正确打开方式：场景展示→问题分析→解决方案→注意事项',
      audience: 'high-school',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  // 思维工具类
  {
    name: '思维导图',
    nameKey: 'storyboard.template.mindMap',
    params: {
      theme: '中心主题放射状展开：核心概念在中央，四周分支展示关键要点、子主题和细节，用线条连接表示关系',
      audience: 'general',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '时间线',
    nameKey: 'storyboard.template.timeline',
    params: {
      theme: '横向时间轴展示事件发展：起点→关键节点1→关键节点2→关键节点3→当前状态→未来展望',
      audience: 'general',
      tone: 'educational',
      panelCount: 6,
      textDensity: 'medium',
    },
  },
  {
    name: 'SWOT分析',
    nameKey: 'storyboard.template.swot',
    params: {
      theme: 'SWOT战略分析框架：优势(Strengths)、劣势(Weaknesses)、机会(Opportunities)、威胁(Threats)四象限分析',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'high',
    },
  },
  {
    name: '鱼骨图',
    nameKey: 'storyboard.template.fishbone',
    params: {
      theme: '因果分析鱼骨图：主干表示问题结果，鱼骨分支展示人员、方法、材料、设备、环境等原因类别',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'high',
    },
  },
  {
    name: '流程图',
    nameKey: 'storyboard.template.flowchart',
    params: {
      theme: '标准流程图：开始→输入→处理步骤→判断分支→输出→结束，包含循环和条件判断',
      audience: 'general',
      tone: 'educational',
      panelCount: 6,
      textDensity: 'medium',
    },
  },
  {
    name: '金字塔结构',
    nameKey: 'storyboard.template.pyramid',
    params: {
      theme: '金字塔层级结构：顶层核心观点，中层支撑论据，底层具体事实和数据',
      audience: 'college',
      tone: 'serious',
      panelCount: 3,
      textDensity: 'medium',
    },
  },
  // 学习方法类
  {
    name: 'KWL学习法',
    nameKey: 'storyboard.template.kwl',
    params: {
      theme: 'KWL学习策略：K-我已知道什么(Know)，W-我想学什么(Want)，L-我学到了什么(Learned)',
      audience: 'middle-school',
      tone: 'encouraging',
      panelCount: 3,
      textDensity: 'medium',
    },
  },
  {
    name: '费曼学习法',
    nameKey: 'storyboard.template.feynman',
    params: {
      theme: '费曼学习法四步骤：选择概念→教给小白→发现盲点→简化重述',
      audience: 'college',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: 'PBL项目学习',
    nameKey: 'storyboard.template.pbl',
    params: {
      theme: '项目式学习流程：提出驱动问题→调研探究→设计方案→制作原型→展示成果→反思改进',
      audience: 'high-school',
      tone: 'encouraging',
      panelCount: 6,
      textDensity: 'medium',
    },
  },
  {
    name: '康奈尔笔记法',
    nameKey: 'storyboard.template.cornell',
    params: {
      theme: '康奈尔笔记系统：左栏关键词/问题，右栏详细笔记，底部总结要点',
      audience: 'college',
      tone: 'educational',
      panelCount: 3,
      textDensity: 'high',
    },
  },
  {
    name: '番茄工作法',
    nameKey: 'storyboard.template.pomodoro',
    params: {
      theme: '番茄工作法：25分钟专注→5分钟休息→循环4次→长休息15-30分钟',
      audience: 'general',
      tone: 'encouraging',
      panelCount: 4,
      textDensity: 'low',
    },
  },
  // 分析框架类
  {
    name: 'PEST分析',
    nameKey: 'storyboard.template.pest',
    params: {
      theme: 'PEST宏观环境分析：政治(Political)、经济(Economic)、社会(Social)、技术(Technological)四维度',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'high',
    },
  },
  {
    name: '5W1H分析',
    nameKey: 'storyboard.template.5w1h',
    params: {
      theme: '5W1H问题分析法：What什么、Why为什么、Who谁、When何时、Where何地、How如何',
      audience: 'general',
      tone: 'educational',
      panelCount: 6,
      textDensity: 'medium',
    },
  },
  {
    name: 'PDCA循环',
    nameKey: 'storyboard.template.pdca',
    params: {
      theme: 'PDCA持续改进循环：计划(Plan)→执行(Do)→检查(Check)→行动(Act)→再计划',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '优缺点对比',
    nameKey: 'storyboard.template.proscons',
    params: {
      theme: '优缺点对比分析：左侧列出优点/好处，右侧列出缺点/风险，底部综合评估',
      audience: 'general',
      tone: 'critical',
      panelCount: 3,
      textDensity: 'medium',
    },
  },
  {
    name: '四象限矩阵',
    nameKey: 'storyboard.template.quadrant',
    params: {
      theme: '四象限决策矩阵：紧急重要、紧急不重要、不紧急重要、不紧急不重要四个区域',
      audience: 'general',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  // 创意设计类
  {
    name: '六顶思考帽',
    nameKey: 'storyboard.template.sixHats',
    params: {
      theme: '六顶思考帽：白帽事实、红帽情感、黑帽批判、黄帽乐观、绿帽创意、蓝帽控制',
      audience: 'college',
      tone: 'critical',
      panelCount: 6,
      textDensity: 'medium',
    },
  },
  {
    name: '设计思维',
    nameKey: 'storyboard.template.designThinking',
    params: {
      theme: '设计思维五阶段：共情(Empathize)→定义(Define)→构思(Ideate)→原型(Prototype)→测试(Test)',
      audience: 'college',
      tone: 'encouraging',
      panelCount: 5,
      textDensity: 'medium',
    },
  },
  {
    name: 'SCAMPER创新',
    nameKey: 'storyboard.template.scamper',
    params: {
      theme: 'SCAMPER创新法：替代、合并、改造、修改、另用、消除、重组七种创新策略',
      audience: 'college',
      tone: 'encouraging',
      panelCount: 4,
      textDensity: 'high',
    },
  },
  {
    name: '故事板叙事',
    nameKey: 'storyboard.template.narrative',
    params: {
      theme: '故事叙事结构：开场设置→冲突引入→情节发展→高潮转折→结局收尾',
      audience: 'general',
      tone: 'encouraging',
      panelCount: 5,
      textDensity: 'medium',
    },
  },
  // 目标管理类
  {
    name: 'SMART目标',
    nameKey: 'storyboard.template.smart',
    params: {
      theme: 'SMART目标设定：具体(Specific)、可衡量(Measurable)、可达成(Achievable)、相关性(Relevant)、时限(Time-bound)',
      audience: 'college',
      tone: 'serious',
      panelCount: 5,
      textDensity: 'medium',
    },
  },
  {
    name: 'OKR目标',
    nameKey: 'storyboard.template.okr',
    params: {
      theme: 'OKR目标管理：设定目标(Objective)→定义关键结果(Key Results)→执行追踪→复盘评估',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '行动计划表',
    nameKey: 'storyboard.template.actionPlan',
    params: {
      theme: '行动计划模板：目标描述→具体任务→负责人→截止日期→资源需求→进度状态',
      audience: 'teacher',
      tone: 'serious',
      panelCount: 6,
      textDensity: 'high',
    },
  },
  // 对比展示类
  {
    name: '前后对比',
    nameKey: 'storyboard.template.beforeAfter',
    params: {
      theme: '前后对比展示：改变前的状态/问题→转变过程→改变后的效果/成果',
      audience: 'general',
      tone: 'encouraging',
      panelCount: 3,
      textDensity: 'low',
    },
  },
  {
    name: '正误对比',
    nameKey: 'storyboard.template.rightWrong',
    params: {
      theme: '正确与错误做法对比：错误示范(打叉)vs正确示范(打勾)，配合说明原因',
      audience: 'middle-school',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '步骤指南',
    nameKey: 'storyboard.template.stepGuide',
    params: {
      theme: '分步操作指南：第一步→第二步→第三步→第四步，每步配图说明',
      audience: 'general',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  // 特殊用途类
  {
    name: '用户旅程图',
    nameKey: 'storyboard.template.userJourney',
    params: {
      theme: '用户体验旅程：意识阶段→考虑阶段→决策阶段→使用阶段→推荐阶段，标注触点和情绪',
      audience: 'college',
      tone: 'serious',
      panelCount: 5,
      textDensity: 'medium',
    },
  },
  {
    name: '商业画布',
    nameKey: 'storyboard.template.businessCanvas',
    params: {
      theme: '商业模式画布九要素：价值主张、客户细分、渠道、客户关系、收入来源、核心资源、关键活动、合作伙伴、成本结构',
      audience: 'college',
      tone: 'serious',
      panelCount: 4,
      textDensity: 'high',
    },
  },
  {
    name: '复盘总结',
    nameKey: 'storyboard.template.retrospective',
    params: {
      theme: '项目复盘四步法：回顾目标→评估结果→分析原因→总结经验',
      audience: 'teacher',
      tone: 'critical',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
  {
    name: '知识卡片',
    nameKey: 'storyboard.template.knowledgeCard',
    params: {
      theme: '知识点卡片：核心概念定义→关键特征→实际例子→常见误区',
      audience: 'middle-school',
      tone: 'educational',
      panelCount: 4,
      textDensity: 'medium',
    },
  },
];
