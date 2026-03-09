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
];
