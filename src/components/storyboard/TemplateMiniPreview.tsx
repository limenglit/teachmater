import { TextOverlay } from './types';

interface Props {
  keywords: TextOverlay[];
  theme: string;
}

export default function TemplateMiniPreview({ keywords, theme }: Props) {
  if (!keywords || keywords.length === 0) {
    return (
      <div className="w-[120px] h-[80px] bg-muted rounded flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">{theme}</span>
      </div>
    );
  }

  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      className="rounded border border-border bg-background"
    >
      {/* Background */}
      <rect width="120" height="80" fill="hsl(var(--muted))" opacity="0.3" />
      
      {/* Render keyword positions as visual indicators */}
      {keywords.map((kw, i) => {
        const cx = (kw.x / 100) * 120;
        const cy = (kw.y / 100) * 80;
        
        // Use different shapes based on font size to indicate hierarchy
        if (kw.fontSize >= 28) {
          // Title - large rectangle
          return (
            <g key={i}>
              <rect
                x={cx - 18}
                y={cy - 5}
                width={36}
                height={10}
                rx={2}
                fill={kw.color}
                opacity={0.9}
              />
            </g>
          );
        } else if (kw.fontSize >= 20) {
          // Subtitle - medium rectangle
          return (
            <rect
              key={i}
              x={cx - 12}
              y={cy - 3}
              width={24}
              height={6}
              rx={1}
              fill={kw.color}
              opacity={0.8}
            />
          );
        } else if (kw.fontSize >= 14) {
          // Label - small rectangle
          return (
            <rect
              key={i}
              x={cx - 8}
              y={cy - 2}
              width={16}
              height={4}
              rx={1}
              fill={kw.color}
              opacity={0.7}
            />
          );
        } else {
          // Small text - dot
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={2}
              fill={kw.color}
              opacity={0.6}
            />
          );
        }
      })}
    </svg>
  );
}
