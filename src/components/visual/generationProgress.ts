export type GenPhase = 'queued' | 'generating' | 'composing' | 'encoding' | 'saving' | 'done';

export interface PhaseStep {
  key: GenPhase;
  name: string;
  /** 进入该阶段的经过秒数（用于按耗时推进阶段） */
  at: number;
}

export const IMAGE_PHASES: PhaseStep[] = [
  { key: 'queued', name: '排队中', at: 0 },
  { key: 'generating', name: '模型生成', at: 3 },
  { key: 'composing', name: '画面合成', at: 14 },
  { key: 'saving', name: '写入历史', at: 26 },
];

export const VIDEO_PHASES: PhaseStep[] = [
  { key: 'queued', name: '排队中', at: 0 },
  { key: 'generating', name: '模型生成', at: 6 },
  { key: 'composing', name: '画面合成', at: 60 },
  { key: 'encoding', name: '视频转码', at: 150 },
];

/** 预估总耗时（秒），用于进度条封顶在 95% */
export const IMAGE_ETA = 35;
export const VIDEO_ETA = 210;

export function phaseAt(steps: PhaseStep[], elapsed: number): PhaseStep {
  let cur = steps[0];
  for (const s of steps) if (elapsed >= s.at) cur = s;
  return cur;
}

export function percentAt(elapsed: number, eta: number): number {
  return Math.min(95, Math.round((elapsed / eta) * 95));
}

export interface GenError {
  message: string;
  hint: string;
  retryable: boolean;
}

/** 把后端/网络错误翻译成可操作的提示 */
export function explainGenError(raw: unknown, mode: 'image' | 'video'): GenError {
  const text = (typeof raw === 'string' ? raw : (raw as { message?: string })?.message || '') || '';
  const t = text.toLowerCase();
  const label = mode === 'video' ? '视频' : '图像';

  if (t.includes('上限') || t.includes('429') || t.includes('rate') || t.includes('频繁')) {
    return { message: text || '请求过于频繁或已达今日上限', hint: '请稍等 1 分钟后重试，或前往「充值」补充 AI 算力次数。', retryable: true };
  }
  if (t.includes('402') || t.includes('额度不足') || t.includes('credit')) {
    return { message: text || 'AI 算力额度不足', hint: '请在「我的充值订单」中补充算力后再试。', retryable: false };
  }
  if (t.includes('unauthorized') || t.includes('401') || t.includes('登录')) {
    return { message: '登录状态已失效', hint: '请重新登录后再发起生成。', retryable: false };
  }
  if (t.includes('超时') || t.includes('timeout') || t.includes('504')) {
    return { message: `${label}生成超时`, hint: mode === 'video' ? '视频任务较慢，可缩短为 5 秒或改用 720P 模型后重试。' : '可降低分辨率（如 2K）或简化文档内容后重试。', retryable: true };
  }
  if (t.includes('prompt') || t.includes('提示词') || t.includes('400')) {
    return { message: text || '提示词不符合要求', hint: '请补充或调整文档内容（建议 20 字以上），避免敏感或空泛描述。', retryable: true };
  }
  if (t.includes('密钥') || t.includes('未配置') || t.includes('502')) {
    return { message: text || '生成服务暂不可用', hint: '服务商接口异常，请稍后重试；若持续失败请联系管理员检查模型开通状态。', retryable: true };
  }
  if (t.includes('failed to fetch') || t.includes('network')) {
    return { message: '网络连接中断', hint: '请检查网络后点击「重试」，本次不会消耗 AI 次数。', retryable: true };
  }
  return { message: text || `${label}生成失败`, hint: '请稍后重试；如反复失败可更换模型或简化内容。', retryable: true };
}
