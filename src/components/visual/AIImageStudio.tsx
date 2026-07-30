import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAIQuota } from '@/hooks/useAIQuota';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Download, RefreshCw, Upload, ImageIcon, History, FlaskConical, CheckCircle2, AlertTriangle, XCircle, Circle, Wand2, Copy, ChevronDown } from 'lucide-react';
import {
  AIImageParams,
  AI_BACKGROUNDS,
  AI_FONTS,
  AI_LANGUAGES,
  AI_MODELS,
  AI_PALETTES,
  AI_PRESETS,
  AI_RATIOS,
  AI_RESOLUTIONS,
  AI_STYLES,
  AI_TEXT_DENSITY,
  CHART_TYPES,
  CHART_TYPE_GUIDES,
  DEFAULT_AI_IMAGE_PARAMS,
  buildPrompt,
  resolveSize,
} from './aiImageTypes';
import AIImageHistoryPanel from './AIImageHistoryPanel';
import { saveAIImageToHistory } from '@/lib/ai-image-history';

import { decodeTextBytes } from '@/lib/text-file';


interface RegStep {
  label: string;
  status: 'pending' | 'running' | 'pass' | 'warn' | 'fail';
  detail?: string;
}

export default function AIImageStudio() {
  const { user } = useAuth();
  const aiQuota = useAIQuota();
  const [params, setParams] = useState<AIImageParams>(DEFAULT_AI_IMAGE_PARAMS);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [regSteps, setRegSteps] = useState<RegStep[]>([]);
  const [regRunning, setRegRunning] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  const activeType = CHART_TYPES.find(t => t.key === params.chartType) ?? CHART_TYPES[0];
  const autoPrompt = buildPrompt(params);
  const finalPrompt = promptOverride ?? autoPrompt;

  const update = (patch: Partial<AIImageParams>) => setParams(prev => ({ ...prev, ...patch }));

  const applyPreset = (key: string) => {
    const preset = AI_PRESETS.find(p => p.key === key);
    if (!preset) return;
    setActivePreset(key);
    setPromptOverride(null);
    update(preset.patch);
  };



  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = decodeTextBytes(await file.arrayBuffer());
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
        body: {
          prompt: finalPrompt,
          size: resolveSize(params.ratio, params.resolution),
          model: params.model,
          watermark: params.watermark,
          seed: params.seed,
        },
      });

      if (error || data?.error) {
        toast({ title: data?.error || '生成失败，请稍后重试', variant: 'destructive' });
        return;
      }
      setImageUrl(data.imageUrl);
      aiQuota.consume();
      toast({ title: '生成成功' });

      // 保存到系统历史记录（存储桶 + 数据库）
      try {
        await saveAIImageToHistory({
          imageUrl: data.imageUrl,
          title: `${activeType.name} · ${params.subStyle}`,
          prompt: buildPrompt(params),
          docText: params.docText,
          chartType: params.chartType,
          subStyle: params.subStyle,
          params: params as unknown as Record<string, unknown>,
          model: data.model || params.model,
          provider: data.provider || '',
          size: data.size || resolveSize(params.ratio, params.resolution),
        });
        setHistoryKey(k => k + 1);
      } catch (e) {
        console.error('save ai image history failed', e);
        toast({ title: '图片已生成，但历史记录保存失败', variant: 'destructive' });
      }

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

  // ===== 一键端到端回归测试 =====
  const REG_PROMPT =
    '绘制一幅图用于讲解人工智能的一个研究方向： 智能机器人的原理。白色背景，细节准确，科研风格，文字简练，中文标注图片内容。';

  const setStep = (index: number, patch: Partial<RegStep>) =>
    setRegSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const runRegression = useCallback(async () => {
    const steps: RegStep[] = [
      { label: '检查登录状态与 AI 额度', status: 'pending' },
      { label: '调用生图接口（火山引擎 Visual）', status: 'pending' },
      { label: '校验返回图片可用', status: 'pending' },
      { label: '确认服务商链路', status: 'pending' },
      { label: '写入历史记录', status: 'pending' },
    ];
    setRegSteps(steps);
    setRegRunning(true);
    try {
      // 1
      setStep(0, { status: 'running' });
      if (!user) {
        setStep(0, { status: 'fail', detail: '未登录，请先登录后再测试' });
        return;
      }
      if (aiQuota.remaining === 0 && aiQuota.purchasedRemaining <= 0) {
        setStep(0, { status: 'fail', detail: '今日 AI 次数已用完' });
        return;
      }
      setStep(0, { status: 'pass', detail: `剩余 ${aiQuota.remaining + aiQuota.purchasedRemaining} 次` });

      // 2
      setStep(1, { status: 'running' });
      const size = resolveSize(params.ratio, params.resolution);
      const started = Date.now();
      const { data, error } = await supabase.functions.invoke('generate-visual-image', {
        body: { prompt: REG_PROMPT, size, model: params.model, watermark: false, seed: null },
      });
      if (error || data?.error) {
        setStep(1, { status: 'fail', detail: data?.error || error?.message || '接口调用失败' });
        return;
      }
      setStep(1, { status: 'pass', detail: `耗时 ${((Date.now() - started) / 1000).toFixed(1)}s` });

      // 3
      setStep(2, { status: 'running' });
      if (!data?.imageUrl) {
        setStep(2, { status: 'fail', detail: '未返回图片' });
        return;
      }
      setImageUrl(data.imageUrl);
      setShowHistory(false);
      aiQuota.consume();
      setStep(2, { status: 'pass', detail: `尺寸 ${data.size || size}` });

      // 4
      setStep(3, { status: 'running' });
      const provider = data.provider || 'unknown';
      setStep(3, {
        status: provider === 'volc-visual' ? 'pass' : 'warn',
        detail:
          provider === 'volc-visual'
            ? '火山引擎 Visual（cn-north-1 / cv）'
            : `已降级：${provider}（${data.model || ''}）${data.volcError ? ` · 火山引擎失败原因：${data.volcError}` : ''}`,
      });

      // 5
      setStep(4, { status: 'running' });
      try {
        await saveAIImageToHistory({
          imageUrl: data.imageUrl,
          title: '回归测试 · 智能机器人的原理',
          prompt: REG_PROMPT,
          docText: REG_PROMPT,
          chartType: params.chartType,
          subStyle: params.subStyle,
          params: params as unknown as Record<string, unknown>,
          model: data.model || params.model,
          provider,
          size: data.size || size,
        });
        setHistoryKey(k => k + 1);
        setStep(4, { status: 'pass', detail: '已保存到历史记录' });
      } catch {
        setStep(4, { status: 'fail', detail: '历史记录保存失败' });
      }
    } catch (e) {
      toast({ title: '回归测试执行异常', variant: 'destructive' });
      console.error(e);
    } finally {
      setRegRunning(false);
    }
  }, [params, user, aiQuota]);



  const regDone = regSteps.length > 0 && !regRunning;
  const regPassed = regDone && regSteps.every(s => s.status === 'pass' || s.status === 'warn');
  const regProgress = regSteps.length
    ? Math.round((regSteps.filter(s => s.status !== 'pending' && s.status !== 'running').length / regSteps.length) * 100)
    : 0;

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      {/* 左侧配置 */}
      <div className="w-full xl:w-[380px] shrink-0 space-y-3">
        {/* 一键端到端回归测试 */}
        <section className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-muted-foreground tracking-wide">🧪 端到端回归测试</h3>
            <Button size="sm" variant="outline" onClick={runRegression} disabled={regRunning}>
              {regRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
              <span className="ml-1 text-xs">{regRunning ? '测试中…' : '一键测试'}</span>
            </Button>
          </div>

          {regSteps.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${regProgress}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {regSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="mt-0.5 w-3.5 shrink-0 text-center">
                      {s.status === 'running' ? (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      ) : s.status === 'pass' ? (
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                      ) : s.status === 'warn' ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      ) : s.status === 'fail' ? (
                        <XCircle className="w-3 h-3 text-destructive" />
                      ) : (
                        <Circle className="w-3 h-3 text-muted-foreground/50" />
                      )}
                    </span>
                    <span className={s.status === 'pending' ? 'text-muted-foreground/60' : 'text-foreground'}>
                      {s.label}
                      {s.detail && <span className="ml-1 text-muted-foreground">— {s.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {regDone && (
                <p className={`text-[11px] font-semibold ${regPassed ? 'text-primary' : 'text-destructive'}`}>
                  {regPassed ? '回归测试通过 ✅' : '回归测试未通过 ❌'}
                </p>
              )}
            </div>
          )}
        </section>

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
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide">✍️ 字体 · 风格 · 标注</h3>
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
              value={params.background}
              onChange={e => update({ background: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_BACKGROUNDS.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            </select>
            <select
              value={params.language}
              onChange={e => update({ language: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_LANGUAGES.map(l => <option key={l.key} value={l.key}>{l.name}</option>)}
            </select>
            <select
              value={params.textDensity}
              onChange={e => update({ textDensity: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2 col-span-2"
            >
              {AI_TEXT_DENSITY.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </div>
        </section>

        {/* 比例与画质 */}
        <section className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide">📐 画面比例 · 画质</h3>
          <div className="flex flex-wrap gap-1.5">
            {AI_RATIOS.map(r => (
              <button
                key={r.key}
                onClick={() => update({ ratio: r.key })}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  params.ratio === r.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:border-primary/50'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <select
              value={params.resolution}
              onChange={e => update({ resolution: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_RESOLUTIONS.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
            <select
              value={params.model}
              onChange={e => update({ model: e.target.value })}
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            >
              {AI_MODELS.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">输出尺寸：{resolveSize(params.ratio, params.resolution)} px</p>
        </section>

        {/* 高级选项 */}
        <section className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground tracking-wide">⚙️ 高级选项</h3>
          <Textarea
            value={params.negativePrompt}
            onChange={e => update({ negativePrompt: e.target.value })}
            placeholder="不希望出现的元素，如：乱码、英文水印、人物照片…"
            className="h-14 text-xs"
          />
          <div className="grid grid-cols-2 gap-2 items-center">
            <input
              type="number"
              value={params.seed ?? ''}
              onChange={e => update({ seed: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="随机种子（可选）"
              className="text-xs bg-background border border-border rounded-lg px-2 py-2"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={params.watermark}
                onChange={e => update({ watermark: e.target.checked })}
              />
              添加水印
            </label>
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
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={showHistory ? 'default' : 'outline'} onClick={() => setShowHistory(v => !v)} className="gap-1.5">
              <History className="w-3.5 h-3.5" /> 历史记录
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!imageUrl} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> 下载
            </Button>
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> 重新生成
            </Button>
          </div>
        </div>
        {showHistory ? (
          <div className="p-3">
            <AIImageHistoryPanel
              refreshKey={historyKey}
              onClose={() => setShowHistory(false)}
              onReuse={(_r, url) => { setImageUrl(url); setShowHistory(false); }}
            />
          </div>
        ) : (
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
        )}
      </div>

    </div>
  );
}
