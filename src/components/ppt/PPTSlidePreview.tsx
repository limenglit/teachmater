import { PPTSlide, PPT_COLOR_SCHEMES } from './pptTypes';

interface Props {
  slide: PPTSlide;
  index: number;
  colorSchemeId: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function PPTSlidePreview({ slide, index, colorSchemeId, isSelected, onClick }: Props) {
  const colors = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];

  const renderSlideContent = () => {
    switch (slide.type) {
      case 'title':
        return (
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
        );

      case 'section':
        return (
          <>
            <rect x="0" y="35" width="160" height="20" fill={colors.primary} />
            <text x="80" y="48" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">
              {slide.title.slice(0, 18)}
            </text>
          </>
        );

      case 'two-column':
        return (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            <rect x="8" y="15" width="20" height="1.5" fill={colors.accent} />
            {/* Left column */}
            <rect x="8" y="20" width="68" height="60" fill={colors.accent} fillOpacity="0.1" rx="2" />
            {slide.leftTitle && (
              <text x="12" y="28" fontSize="4" fontWeight="bold" fill={colors.secondary}>
                {slide.leftTitle.slice(0, 15)}
              </text>
            )}
            {slide.leftBullets?.slice(0, 3).map((b, i) => (
              <text key={i} x="12" y={35 + i * 8} fontSize="3" fill={colors.text}>
                • {b.slice(0, 18)}
              </text>
            ))}
            {/* Right column */}
            <rect x="84" y="20" width="68" height="60" fill={colors.accent} fillOpacity="0.1" rx="2" />
            {slide.rightTitle && (
              <text x="88" y="28" fontSize="4" fontWeight="bold" fill={colors.secondary}>
                {slide.rightTitle.slice(0, 15)}
              </text>
            )}
            {slide.rightBullets?.slice(0, 3).map((b, i) => (
              <text key={i} x="88" y={35 + i * 8} fontSize="3" fill={colors.text}>
                • {b.slice(0, 18)}
              </text>
            ))}
          </>
        );

      case 'image-text':
        return (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            {/* Image placeholder */}
            <rect x="8" y="20" width="60" height="55" fill={colors.accent} rx="2" />
            <text x="38" y="50" textAnchor="middle" fontSize="16" fill="white">🖼️</text>
            {/* Text content */}
            {slide.bullets?.slice(0, 4).map((b, i) => (
              <text key={i} x="76" y={28 + i * 10} fontSize="4" fill={colors.text}>
                • {b.slice(0, 22)}
              </text>
            ))}
          </>
        );

      case 'comparison':
        return (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            {/* Left box */}
            <rect x="8" y="20" width="60" height="55" fill={colors.primary} rx="3" />
            {slide.leftTitle && (
              <text x="38" y="32" textAnchor="middle" fontSize="4" fontWeight="bold" fill="white">
                {slide.leftTitle.slice(0, 12)}
              </text>
            )}
            {/* VS */}
            <text x="80" y="48" textAnchor="middle" fontSize="6" fontWeight="bold" fill={colors.accent}>VS</text>
            {/* Right box */}
            <rect x="92" y="20" width="60" height="55" fill={colors.secondary} rx="3" />
            {slide.rightTitle && (
              <text x="122" y="32" textAnchor="middle" fontSize="4" fontWeight="bold" fill="white">
                {slide.rightTitle.slice(0, 12)}
              </text>
            )}
          </>
        );

      case 'quote':
        return (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            <text x="8" y="35" fontSize="20" fill={colors.accent}>"</text>
            {slide.quoteText && (
              <text x="25" y="45" fontSize="5" fontStyle="italic" fill={colors.text}>
                {slide.quoteText.slice(0, 40)}{slide.quoteText.length > 40 ? '...' : ''}
              </text>
            )}
            {slide.quoteAuthor && (
              <text x="120" y="65" fontSize="4" fill={colors.secondary} textAnchor="end">
                — {slide.quoteAuthor}
              </text>
            )}
          </>
        );

      case 'timeline':
        return (
          <>
            <text x="8" y="12" fontSize="6" fontWeight="bold" fill={colors.primary}>
              {slide.title.slice(0, 22)}{slide.title.length > 22 ? '...' : ''}
            </text>
            {/* Timeline line */}
            <line x1="15" y1="45" x2="145" y2="45" stroke={colors.accent} strokeWidth="1.5" />
            {/* Timeline dots */}
            {[0, 1, 2, 3].map(i => (
              <circle key={i} cx={30 + i * 35} cy="45" r="3" fill={colors.primary} />
            ))}
            {slide.timelineItems?.slice(0, 4).map((item, i) => (
              <g key={i}>
                <text x={30 + i * 35} y="38" textAnchor="middle" fontSize="3" fontWeight="bold" fill={colors.primary}>
                  {item.year}
                </text>
                <text x={30 + i * 35} y="55" textAnchor="middle" fontSize="2.5" fill={colors.text}>
                  {item.text.slice(0, 10)}
                </text>
              </g>
            ))}
          </>
        );

      default:
        // Standard content slide
        return (
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
        );
    }
  };

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
        {renderSlideContent()}
      </svg>
      <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
        {index + 1}
      </div>
    </div>
  );
}
