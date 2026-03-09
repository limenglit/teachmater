import { PPTSlide, PPTColorScheme, PPT_COLOR_SCHEMES } from './pptTypes';

interface Props {
  slide: PPTSlide;
  index: number;
  colorSchemeId: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function PPTSlidePreview({ slide, index, colorSchemeId, isSelected, onClick }: Props) {
  const colors = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full aspect-video rounded-lg border-2 cursor-pointer transition-all overflow-hidden
        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}
      `}
      style={{ backgroundColor: colors.background }}
    >
      <svg width="100%" height="100%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet">
        {slide.type === 'title' ? (
          <>
            <text x="80" y="40" textAnchor="middle" fontSize="8" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 20)}{slide.title.length > 20 ? '...' : ''}
            </text>
            {slide.subtitle && (
              <text x="80" y="52" textAnchor="middle" fontSize="5" fill={colors.text}>
                {slide.subtitle.slice(0, 30)}
              </text>
            )}
          </>
        ) : slide.type === 'section' ? (
          <>
            <rect x="0" y="35" width="160" height="20" fill={colors.primary} />
            <text x="80" y="48" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">
              {slide.title.slice(0, 18)}
            </text>
          </>
        ) : (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            <rect x="8" y="15" width="20" height="1.5" fill={colors.accent} />
            {slide.bullets?.slice(0, 4).map((b, i) => (
              <text key={i} x="10" y={24 + i * 10} fontSize="4" fill={colors.text}>
                • {b.slice(0, 35)}{b.length > 35 ? '...' : ''}
              </text>
            ))}
          </>
        )}
      </svg>
      <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
        {index + 1}
      </div>
    </div>
  );
}
