import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Download, History, RotateCcw, ImageIcon } from 'lucide-react';
import TextInputArea from './visual/TextInputArea';
import StyleControls from './visual/StyleControls';
import InfographicRenderer from './visual/InfographicRenderer';
import DataChartRenderer from './visual/DataChartRenderer';
import ExportButtons from './ExportButtons';
import { type AnalysisResult, type TemplateStyle, type ChartType, type StructureType, type VisualHistoryItem } from './visual/visualTypes';
import { getGuestAIRemaining, recordGuestAIUsage } from '@/lib/guest-ai-limit';

const HISTORY_KEY = 'visual_history';

function loadHistory(): VisualHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(items: VisualHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

export default function VisualizationPanel() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [colorScheme, setColorScheme] = useState('ocean');
  const [template, setTemplate] = useState<TemplateStyle>('modern');
  const [structureType, setStructureType] = useState<StructureType>('list');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VisualHistoryItem[]>(loadHistory);
  const [inputText, setInputText] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = useCallback(async (text: string) => {
    if (!user) {
      const remaining = getGuestAIRemaining(false);
      if (remaining <= 0) {
        toast({ title: t('ai.guestLimitReached'), variant: 'destructive' });
        return;
      }
    }
    setLoading(true);
    setInputText(text);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: { text, lang },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'Rate limited') {
          toast({ title: t('visual.rateLimited'), variant: 'destructive' });
        } else {
          toast({ title: data.error, variant: 'destructive' });
        }
        return;
      }
      const result = data as AnalysisResult;
      setAnalysis(result);
      setStructureType(result.structure_type);
      setChartType(result.suggested_chart === 'none' ? 'bar' : result.suggested_chart);

      if (!user) recordGuestAIUsage(false);

      // Save to history
      const item: VisualHistoryItem = {
        id: crypto.randomUUID(),
        title: result.title,
        timestamp: Date.now(),
        analysis: result,
        inputText: text.slice(0, 200),
        colorScheme,
        template,
      };
      const newHistory = [item, ...history].slice(0, 20);
      setHistory(newHistory);
      saveHistory(newHistory);

      toast({ title: t('visual.analyzeSuccess') });
    } catch (err: any) {
      console.error(err);
      toast({ title: t('visual.analyzeError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, lang, t, colorScheme, template, history]);

  const restoreHistory = (item: VisualHistoryItem) => {
    setAnalysis(item.analysis);
    setColorScheme(item.colorScheme);
    setTemplate(item.template);
    setStructureType(item.analysis.structure_type);
    setChartType(item.analysis.suggested_chart === 'none' ? 'bar' : item.analysis.suggested_chart);
    setShowHistory(false);
  };

  const handleUpdateAnalysis = useCallback((updated: AnalysisResult) => {
    setAnalysis(updated);
  }, []);

  // Override structure_type for rendering
  const renderAnalysis = analysis ? { ...analysis, structure_type: structureType } : null;

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            {t('visual.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('visual.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1.5">
          <History className="w-4 h-4" />
          {t('visual.history')}
        </Button>
      </div>

      {showHistory && (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2">
          <h3 className="text-sm font-medium">{t('visual.history')}</h3>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('visual.noHistory')}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-auto">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => restoreHistory(item)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-xs"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground ml-2">{new Date(item.timestamp).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <TextInputArea onAnalyze={handleAnalyze} loading={loading} />

      {/* Results */}
      {renderAnalysis && (
        <>
          {/* Style Controls */}
          <div className="bg-card border border-border rounded-lg p-3">
            <StyleControls
              colorScheme={colorScheme}
              onColorChange={setColorScheme}
              template={template}
              onTemplateChange={setTemplate}
              structureType={structureType}
              onStructureChange={setStructureType}
              chartType={chartType}
              onChartChange={setChartType}
              hasData={renderAnalysis.data_points.length > 0}
            />
          </div>

          {/* Preview area */}
          <div className="bg-card border border-border rounded-lg p-2">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-medium text-muted-foreground">{t('visual.preview')}</span>
              <ExportButtons targetRef={exportRef as React.RefObject<HTMLElement>} filename={renderAnalysis.title || 'infographic'} />
            </div>
            <div ref={exportRef}>
              {/* Infographic */}
              <InfographicRenderer analysis={renderAnalysis} colorSchemeId={colorScheme} template={template} onUpdate={handleUpdateAnalysis} />

              {/* Data Chart */}
              {renderAnalysis.data_points.length > 0 && (
                <div className="mt-4 p-4 bg-background rounded-lg">
                  <DataChartRenderer data={renderAnalysis.data_points} chartType={chartType} colorSchemeId={colorScheme} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
