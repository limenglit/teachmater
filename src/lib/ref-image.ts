/** 参考图工具：压缩为 data URL，并生成风格一致性提示词。 */

export interface RefImage {
  id: string;
  name: string;
  dataUrl: string;
}

export const MAX_REF_IMAGES = 3;

/** 将参考图压缩到最长边 1024px 的 JPEG data URL，避免请求体过大。 */
export function compressImageFile(file: File, maxSide = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface RefAspects {
  style: boolean;
  layout: boolean;
  palette: boolean;
}

export const DEFAULT_REF_ASPECTS: RefAspects = { style: true, layout: true, palette: true };

export const REF_STRENGTHS = [
  { key: 'light', name: '轻度参考', hint: '仅借鉴整体气质，构图自由发挥' },
  { key: 'medium', name: '中度参考', hint: '明显沿用参考图的视觉语言' },
  { key: 'strong', name: '严格一致', hint: '严格复用风格/布局/配色，保持系列统一' },
] as const;

/** 依据勾选的维度生成中文参考约束提示词。 */
export function buildRefPrompt(count: number, aspects: RefAspects, strength: string): string {
  if (count <= 0) return '';
  const dims: string[] = [];
  if (aspects.style) dims.push('绘画风格与线条质感（笔触、描边粗细、图标造型、材质与阴影处理）');
  if (aspects.layout) dims.push('版面布局与构图节奏（模块划分、留白比例、标题与说明文字的位置关系）');
  if (aspects.palette) dims.push('配色方案（主色、辅助色、强调色与背景色的搭配及明度关系）');
  if (dims.length === 0) dims.push('整体视觉风格');

  const level =
    strength === 'strong'
      ? '必须严格保持一致，视为同一套系列图的延续，不得引入参考图之外的风格元素'
      : strength === 'light'
        ? '作为风格倾向参考即可，允许适度自由发挥'
        : '在保证内容表达清晰的前提下尽量贴合';

  return (
    `\n\n【参考图约束】随附 ${count} 张参考图，请以其为视觉基准：` +
    `严格参考以下维度——${dims.join('；')}。${level}。` +
    `注意：参考图仅用于风格/布局/配色的迁移，不要照搬其中的文字内容与具体图形语义，画面内容必须以上文描述为准，确保系列出图风格统一。`
  );
}
