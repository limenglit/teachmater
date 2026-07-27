import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAIQuota } from '@/hooks/useAIQuota';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Download, RefreshCw, Upload, ImageIcon } from 'lucide-react';
import {
  AIImageParams,
  AI_FONTS,
  AI_PALETTES,
  AI_SIZES,
  AI_STYLES,
  CHART_TYPES,
  DEFAULT_AI_IMAGE_PARAMS,
  buildPrompt,
} from './aiImageTypes';
import { readTextFile } from '@/lib/text-file';

export default function AIImageStudio() {
  const { user } = useAuth();
  const aiQuota = useAIQuota();
  const [params, setParams] = useState<AIImageParams>(DEFAULT_AI_IMAGE_PARAMS);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeType = CHART_TYPES.find(t => t.key === params.chartType) ?? CHART_TYPES[0];

  const update = (patch: Partial<AIImageParams>) => setParams(prev => ({ ...prev, ...patch }));

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setFileName(file.name);
      update({ docText: text.slice(0, 2000) });
    } catch {
      toast({ title: '文件读取失败', variant: 'destructive' });
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!params.docText.trim()) {
      toast({ title: '请先粘贴文档内容或上传文件', variant: 'destructive' });
      return;
    }
    if (!user) {
      toast({ title: '请先登录后使用 AI 生图', variant: 'destructive' });
      return;
    }
    if (aiQuota.remaining === 0 && aiQuota.purchasedRemaining <= 0) {
      toast({ title: '今日 AI 次数已用完', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-visual-image', {
        body: { prompt: buildPrompt(params), size: params.size },
      });
      if (error || data?.error) {
        toast({ title: data?.error || '生成失败，请稍后重试', variant: 'destructive' });
        return;
      }
      setImageUrl(data.imageUrl);
      aiQuota.consume();
      toast({ title: '生成成功' });
    } catch {
      toast({ title: '生成失败，请稍后重试', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [params, user, aiQuota]);

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${activeType.name}_${params.subStyle}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      {/* 左侧配置 */}
      <div className="w-full xl:w-[380px] shrink-0 space-y-3">
        {/* 文档内容 */}
        <section className="bg-card border border-border rounded-xl p-3">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide mb-2">📄 文档内容</h3>
          <Textarea
            value={params.docText}
            onChange={e => update({ docText: e.target.value })}
            placeholder="粘贴教学要点、研究摘要、实验数据或项目描述..."
            className="h-24 text-sm"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {fileName ? `已选择：${fileName}` : '上传文档 (.txt / .md / .csv)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv"
            hidden
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </section>

        {/* 图表类型 */}
        <section className="bg-card border border-border rounded-xl p-3">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide mb-2">📊 图表类型</h3>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {CHART_TYPES.map(type => (
              <button
                key={type.key}
                onClick={() => update({ chartType: type.key, subStyle: type.subs[0] })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  params.chartType === type.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:border-primary/50'
                }`}
              >
                {type.icon} {type.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
            {activeType.subs.map(sub => (
              <button
                key={sub}
                onClick={() => update({ subStyle: sub })}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  params.subStyle === sub
                    ? 'bg-primary/10 text-primary border-primary font-semibold'
                    : 'bg-background border-border hover:border-primary/40'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </section>

        {/* 配色 */}
        <section className="bg-card border border-border rounded-xl p-3">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide mb-2">🎨 配色方案</h3>
          <div className="flex flex-wrap gap-2">
            {AI_PALETTES.map(p => (
              <button
                key={p.key}
                title={p.name}
                onClick={() => update({ palette: p.key })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  params.palette === p.key ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }}
              />
            ))}
          </div>
        </section>

        {/* 字体与风格 */}
        <section className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide">✍️ 字体 · 风格 · 尺寸</h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={params.font}
              onChange={e => update({ font: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_FONTS.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
            </select>
            <select
              value={params.style}
              onChange={e => update({ style: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_STYLES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            <select
              value={params.size}
              onChange={e => update({ size: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2 col-span-2"
            >
              {AI_SIZES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
        </section>

        <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? '火山引擎生成中…' : '生成信息图'}
        </Button>
      </div>

      {/* 右侧预览 */}
      <div className="flex-1 min-w-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm font-medium">🖼️ 实时预览</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!imageUrl} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> 下载
            </Button>
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> 重新生成
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-[320px] flex items-center justify-center p-4 bg-muted/30">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-xs">正在调用火山引擎生成图像，约需 10-30 秒…</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={`${activeType.name} ${params.subStyle}`} className="max-w-full max-h-[70vh] rounded-lg shadow-lg" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="w-8 h-8" />
              <p className="text-xs">填写内容并选择图表类型后点击「生成信息图」</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
