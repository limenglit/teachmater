import { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { X, Plus, Download, Trash2, Move } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { TextOverlay } from './types';

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
}

interface Props {
  imageUrl: string;
  onClose: () => void;
  initialKeywords?: TextOverlay[];
}

const FONTS = [
  { value: 'Noto Sans SC', label: '思源黑体' },
  { value: 'Noto Serif SC', label: '思源宋体' },
  { value: 'ZCOOL KuaiLe', label: '站酷快乐体' },
  { value: 'Ma Shan Zheng', label: '马善政楷书' },
  { value: 'ZCOOL XiaoWei', label: '站酷小薇' },
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
];

const FONT_WEIGHTS = [
  { value: '400', label: '常规' },
  { value: '500', label: '中等' },
  { value: '700', label: '粗体' },
  { value: '900', label: '特粗' },
];

export default function TextOverlayEditor({ imageUrl, onClose }: Props) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const selectedLayer = layers.find(l => l.id === selectedId);

  const addLayer = () => {
    const newLayer: TextLayer = {
      id: crypto.randomUUID(),
      text: t('storyboard.newText'),
      x: 50,
      y: 50,
      fontSize: 24,
      fontFamily: 'Noto Sans SC',
      fontWeight: '700',
      color: '#333333',
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  };

  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - layer.x,
      y: e.clientY - rect.top - layer.y,
    });
    setSelectedId(layerId);
    setIsDragging(true);
  }, [layers]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 50, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - 20, e.clientY - rect.top - dragOffset.y));

    updateLayer(selectedId, { x, y });
  }, [isDragging, selectedId, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleExport = async () => {
    if (!canvasRef.current) return;

    try {
      // Deselect to hide selection border
      const prevSelected = selectedId;
      setSelectedId(null);

      // Wait for re-render
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(canvasRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      const link = document.createElement('a');
      link.download = `storyboard-edited-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setSelectedId(prevSelected);
      toast.success(t('storyboard.downloaded'));
    } catch (err) {
      console.error('Export error:', err);
      toast.error(t('storyboard.exportError'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">{t('storyboard.editText')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addLayer}>
            <Plus className="w-4 h-4 mr-1" />
            {t('storyboard.addText')}
          </Button>
          <Button variant="default" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            {t('storyboard.exportImage')}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 p-4 overflow-auto bg-muted/30">
          <div
            ref={canvasRef}
            className="relative mx-auto bg-white shadow-lg"
            style={{ maxWidth: '100%', width: 'fit-content' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            <img
              src={imageUrl}
              alt="Storyboard base"
              className="block max-w-full"
              crossOrigin="anonymous"
              draggable={false}
            />
            {layers.map(layer => (
              <div
                key={layer.id}
                className={`absolute cursor-move select-none ${
                  selectedId === layer.id ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                style={{
                  left: layer.x,
                  top: layer.y,
                  fontSize: layer.fontSize,
                  fontFamily: layer.fontFamily,
                  fontWeight: layer.fontWeight,
                  color: layer.color,
                  textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                }}
                onMouseDown={(e) => handleMouseDown(e, layer.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(layer.id);
                }}
              >
                {layer.text}
              </div>
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-72 border-l border-border p-4 overflow-y-auto bg-card">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Move className="w-4 h-4" />
            {t('storyboard.textProperties')}
          </h3>

          {selectedLayer ? (
            <div className="space-y-4">
              <div>
                <Label>{t('storyboard.textContent')}</Label>
                <Input
                  value={selectedLayer.text}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>{t('storyboard.fontFamily')}</Label>
                <Select
                  value={selectedLayer.fontFamily}
                  onValueChange={(v) => updateLayer(selectedLayer.id, { fontFamily: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(f => (
                      <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('storyboard.fontWeight')}</Label>
                <Select
                  value={selectedLayer.fontWeight}
                  onValueChange={(v) => updateLayer(selectedLayer.id, { fontWeight: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_WEIGHTS.map(w => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('storyboard.fontSize')}: {selectedLayer.fontSize}px</Label>
                <Slider
                  value={[selectedLayer.fontSize]}
                  onValueChange={([v]) => updateLayer(selectedLayer.id, { fontSize: v })}
                  min={12}
                  max={120}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>{t('storyboard.textColor')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={selectedLayer.color}
                    onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                    className="w-10 h-10 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={selectedLayer.color}
                    onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-4"
                onClick={() => deleteLayer(selectedLayer.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('storyboard.deleteText')}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {layers.length === 0
                ? t('storyboard.noTextLayers')
                : t('storyboard.selectTextLayer')}
            </p>
          )}

          {/* Layer List */}
          {layers.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <Label className="mb-2 block">{t('storyboard.textLayers')}</Label>
              <div className="space-y-1">
                {layers.map((layer, idx) => (
                  <div
                    key={layer.id}
                    className={`px-2 py-1.5 rounded text-sm cursor-pointer truncate ${
                      selectedId === layer.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedId(layer.id)}
                  >
                    {idx + 1}. {layer.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
