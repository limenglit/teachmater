import { useMemo } from 'react';
import type { DimensionKey } from './analyticsTypes';

interface RadarChartProps {
  labels: string[];
  values: number[]; // 0-100 normalized
  size?: number;
  color?: string;
}

export default function RadarChart({ labels, values, size = 200, color = 'hsl(var(--primary))' }: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const levels = 4;

  const points = useMemo(() => {
    const n = labels.length;
    return labels.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    });
  }, [labels.length]);

  const gridLines = useMemo(() => {
    const lines: string[] = [];
    for (let lv = 1; lv <= levels; lv++) {
      const r = (radius * lv) / levels;
      const pts = points.map(p => `${center + p.x * r},${center + p.y * r}`).join(' ');
      lines.push(pts);
    }
    return lines;
  }, [points, radius, center]);

  const dataPath = useMemo(() => {
    return points
      .map((p, i) => {
        const v = Math.min(100, Math.max(0, values[i] || 0)) / 100;
        const r = radius * v;
        return `${center + p.x * r},${center + p.y * r}`;
      })
      .join(' ');
  }, [points, values, radius, center]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid */}
      {gridLines.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1"
          opacity={0.5}
        />
      ))}
      {/* Axis lines */}
      {points.map((p, i) => (
        <line
          key={`axis-${i}`}
          x1={center} y1={center}
          x2={center + p.x * radius} y2={center + p.y * radius}
          stroke="hsl(var(--border))"
          strokeWidth="1"
          opacity={0.3}
        />
      ))}
      {/* Data polygon */}
      <polygon
        points={dataPath}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth="2"
      />
      {/* Data points */}
      {points.map((p, i) => {
        const v = Math.min(100, Math.max(0, values[i] || 0)) / 100;
        const r = radius * v;
        return (
          <circle
            key={`dot-${i}`}
            cx={center + p.x * r}
            cy={center + p.y * r}
            r={3}
            fill={color}
          />
        );
      })}
      {/* Labels */}
      {points.map((p, i) => {
        const labelR = radius + 18;
        const x = center + p.x * labelR;
        const y = center + p.y * labelR;
        return (
          <text
            key={`label-${i}`}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            fontSize="10"
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}
