import { useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  cards: BoardCard[];
  city: string;
  onCityChange: (city: string) => void;
  onPickPoint: (point: { x: number; y: number }) => void;
}

const CITY_OPTIONS = [
  { value: 'beijing', labelKey: 'board.cityBeijing' },
  { value: 'shanghai', labelKey: 'board.cityShanghai' },
  { value: 'guangzhou', labelKey: 'board.cityGuangzhou' },
  { value: 'shenzhen', labelKey: 'board.cityShenzhen' },
  { value: 'hangzhou', labelKey: 'board.cityHangzhou' },
];

const CITY_BACKGROUNDS: Record<string, string> = {
  beijing: 'linear-gradient(160deg, #fef3c7 0%, #f5d0fe 40%, #bfdbfe 100%)',
  shanghai: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 35%, #c7d2fe 100%)',
  guangzhou: 'linear-gradient(160deg, #bbf7d0 0%, #a7f3d0 35%, #99f6e4 100%)',
  shenzhen: 'linear-gradient(160deg, #e9d5ff 0%, #c4b5fd 35%, #bae6fd 100%)',
  hangzhou: 'linear-gradient(160deg, #fde68a 0%, #fbcfe8 35%, #ddd6fe 100%)',
};

export default function BoardMapView({ cards, city, onCityChange, onPickPoint }: Props) {
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const markerX = e.clientX - rect.left;
    const markerY = e.clientY - rect.top;
    onPickPoint({
      x: Math.max(0, Math.min(rect.width - 220, markerX - 30)),
      y: Math.max(0, Math.min(rect.height - 160, markerY - 24)),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('board.mapCity')}</span>
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          {CITY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{t(option.labelKey as any)}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{t('board.mapClickHint')}</span>
      </div>

      <div
        ref={mapRef}
        className="relative min-h-[620px] rounded-2xl border border-border overflow-hidden"
        style={{ background: CITY_BACKGROUNDS[city] || CITY_BACKGROUNDS.beijing }}
        onClick={handleMapClick}
      >
        <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 1200 700" fill="none">
          <path d="M80 620 Q 260 480 420 560 T 760 540 T 1120 600" stroke="currentColor" strokeWidth="14" className="text-foreground" />
          <path d="M60 220 Q 300 120 520 220 T 1000 200" stroke="currentColor" strokeWidth="10" className="text-foreground" />
          <path d="M220 80 L 980 640" stroke="currentColor" strokeWidth="8" className="text-foreground" />
          <path d="M1000 90 L 320 650" stroke="currentColor" strokeWidth="8" className="text-foreground" />
        </svg>

        <div className="absolute top-3 left-3 bg-background/85 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-foreground border border-border">
          {t('board.mapMode')} · {t(CITY_OPTIONS.find(c => c.value === city)?.labelKey as any)}
        </div>

        {cards.map(card => (
          <div
            key={card.id}
            className="absolute group"
            style={{ left: card.position_x || 0, top: card.position_y || 0 }}
          >
            <div className="w-4 h-4 rounded-full bg-destructive border-2 border-background shadow" />
            <div className="absolute left-5 top-0 hidden group-hover:block bg-card border border-border rounded-lg p-2 w-44 shadow-lg z-20">
              <p className="text-xs text-foreground line-clamp-2">{card.content || t('board.mapEmptyLabel')}</p>
              {card.media_url && <img src={card.media_url} alt="" className="mt-1 rounded w-full h-20 object-cover" />}
              <p className="text-[10px] text-muted-foreground mt-1">{card.author_nickname}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
