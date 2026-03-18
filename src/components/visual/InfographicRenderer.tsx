import { useState, useCallback } from 'react';
import {
  type AnalysisResult, type TemplateStyle, type StructureNode, type VisualSettings,
  COLOR_SCHEMES, FONT_FAMILIES, DEFAULT_VISUAL_SETTINGS,
  getNodeIcon, getNodeShapeStyle, getShadowCSS, getGradientBg, getBorderCSS,
  getConnectorSymbol, getPatternSVG, getAspectRatioStyle,
} from './visualTypes';

interface Props {
  analysis: AnalysisResult;
  colorSchemeId: string;
  template: TemplateStyle;
  onUpdate?: (analysis: AnalysisResult) => void;
  visualSettings?: VisualSettings;
}

function EditableText({ value, onChange, style, className }: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className={className}
        style={{ ...style, background: 'rgba(255,255,255,0.15)', border: '1px dashed currentColor', outline: 'none', borderRadius: 4, padding: '0 4px', width: '100%', boxSizing: 'border-box' }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={className}
      style={{ ...style, cursor: 'pointer', borderBottom: '1px dashed transparent' }}
      onMouseEnter={e => (e.currentTarget.style.borderBottomColor = 'currentColor')}
      onMouseLeave={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

export default function InfographicRenderer({ analysis, colorSchemeId, template, onUpdate, visualSettings: vs }: Props) {
  const scheme = COLOR_SCHEMES.find(s => s.id === colorSchemeId) || COLOR_SCHEMES[0];
  const settings = vs || DEFAULT_VISUAL_SETTINGS;
  const nodes = analysis.structure_nodes;
  const isDark = template === 'dark' || template === 'tech';
  const bgColor = isDark ? '#1e1e2e' : template === 'magazine' ? '#fafaf9' : template === 'elegant' ? '#f8f5f0' : scheme.bg;
  const textColor = isDark ? '#cdd6f4' : template === 'elegant' ? '#3c3836' : scheme.text;
  const isPlayful = template === 'playful';

  const fontDef = FONT_FAMILIES.find(f => f.id === settings.fontFamily);
  const fontFamily = fontDef?.css || 'inherit';
  const baseFontSize = settings.fontSize;
  const density = settings.layoutDensity;
  const gap = density === 'compact' ? '0.25rem' : density === 'spacious' ? '1rem' : '0.5rem';
  const padding = density === 'compact' ? '0.5rem' : density === 'spacious' ? '1.5rem' : '0.75rem';

  const shadow = getShadowCSS(settings.shadowStyle);
  const patternBg = getPatternSVG(settings.backgroundPattern, scheme.colors[0]);

  // Node style helper
  const nodeStyle = (i: number, extraStyle?: React.CSSProperties): React.CSSProperties => {
    const color = scheme.colors[i % scheme.colors.length];
    const nextColor = scheme.colors[(i + 1) % scheme.colors.length];
    const bg = settings.gradientMode !== 'none' ? getGradientBg(settings.gradientMode, color, nextColor) : color;
    const shapeStyle = settings.nodeShape === 'diamond' ? {} : getNodeShapeStyle(settings.nodeShape);
    const border = getBorderCSS(settings.borderStyle, isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)');

    return {
      background: bg,
      color: '#fff',
      boxShadow: shadow,
      border,
      fontWeight: 600,
      fontSize: `${baseFontSize - 1}px`,
      ...shapeStyle,
      ...extraStyle,
    };
  };

  // Icon prefix
  const icon = (i: number) => {
    const ic = getNodeIcon(settings.iconStyle, i);
    return ic ? <span className="mr-1 opacity-80">{ic}</span> : null;
  };

  const updateNode = useCallback((index: number, patch: Partial<StructureNode>) => {
    if (!onUpdate) return;
    const newNodes = [...analysis.structure_nodes];
    newNodes[index] = { ...newNodes[index], ...patch };
    onUpdate({ ...analysis, structure_nodes: newNodes });
  }, [analysis, onUpdate]);

  const updateTitle = useCallback((title: string) => onUpdate?.({ ...analysis, title }), [analysis, onUpdate]);
  const updateSummary = useCallback((summary: string) => onUpdate?.({ ...analysis, summary }), [analysis, onUpdate]);
  const updateKeyword = useCallback((index: number, value: string) => {
    if (!onUpdate) return;
    const newKw = [...analysis.keywords];
    newKw[index] = value;
    onUpdate({ ...analysis, keywords: newKw });
  }, [analysis, onUpdate]);

  const renderNodeLabel = (node: StructureNode, i: number, style?: React.CSSProperties, className?: string) => (
    <EditableText value={node.label} onChange={v => updateNode(i, { label: v })} style={style} className={className} />
  );

  const renderNodeDesc = (node: StructureNode, i: number, style?: React.CSSProperties, className?: string) => (
    node.description && settings.showDescription ? <EditableText value={node.description} onChange={v => updateNode(i, { description: v })} style={style} className={className} /> : null
  );

  const connector = getConnectorSymbol(settings.connectorStyle);

  const renderFlow = () => (
    <div className="flex flex-wrap items-center justify-center gap-2" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="px-4 py-3 text-center" style={nodeStyle(i, { minWidth: '100px' })}>
            <div className="flex items-center justify-center">{icon(i)}{renderNodeLabel(node, i)}</div>
            {renderNodeDesc(node, i, { fontSize: '11px', opacity: 0.8, marginTop: '4px', display: 'block' })}
          </div>
          {i < nodes.length - 1 && connector && <span className="text-xl" style={{ color: scheme.colors[0] }}>{connector}</span>}
        </div>
      ))}
    </div>
  );

  const renderPyramid = () => (
    <div className="flex flex-col items-center gap-1" style={{ fontFamily }}>
      {nodes.map((node, i) => {
        const width = 40 + (i / Math.max(nodes.length - 1, 1)) * 60;
        return (
          <div key={i} className="py-2 px-4 text-center flex items-center justify-center" style={nodeStyle(i, { width: `${width}%` })}>
            {icon(i)}{renderNodeLabel(node, i)}
          </div>
        );
      })}
    </div>
  );

  const renderFunnel = () => (
    <div className="flex flex-col items-center gap-1" style={{ fontFamily }}>
      {nodes.map((node, i) => {
        const width = 100 - (i / Math.max(nodes.length - 1, 1)) * 60;
        return (
          <div key={i} className="py-2 px-4 text-center flex items-center justify-center" style={nodeStyle(i, { width: `${width}%` })}>
            {icon(i)}{renderNodeLabel(node, i)}
            {settings.showValues && node.value != null && <span className="ml-2 text-xs opacity-80">({node.value})</span>}
          </div>
        );
      })}
    </div>
  );

  const renderTimeline = () => (
    <div className="relative pl-6" style={{ fontFamily }}>
      <div className="absolute left-2 top-0 bottom-0 w-0.5" style={{ backgroundColor: scheme.colors[0] }} />
      {nodes.map((node, i) => (
        <div key={i} className="relative mb-4 pl-4">
          <div
            className="absolute left-[-14px] top-2 w-3.5 h-3.5 rounded-full border-2"
            style={{ backgroundColor: scheme.colors[i % scheme.colors.length], borderColor: bgColor, boxShadow: shadow }}
          />
          <div className="px-3 py-2" style={{ backgroundColor: isDark ? '#313244' : '#fff', ...getNodeShapeStyle(settings.nodeShape), border: `1px solid ${scheme.colors[i % scheme.colors.length]}30`, boxShadow: shadow }}>
            <div className="font-semibold text-sm flex items-center" style={{ color: scheme.colors[i % scheme.colors.length] }}>
              {icon(i)}{renderNodeLabel(node, i)}
            </div>
            {renderNodeDesc(node, i, { fontSize: '11px', color: textColor, opacity: 0.7, marginTop: '2px', display: 'block' })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderComparison = () => {
    const half = Math.ceil(nodes.length / 2);
    const left = nodes.slice(0, half);
    const right = nodes.slice(half);
    return (
      <div className="grid grid-cols-2 gap-3" style={{ fontFamily }}>
        {[left, right].map((group, gi) => (
          <div key={gi} className="space-y-2">
            {group.map((node, i) => {
              const realIndex = gi === 0 ? i : half + i;
              return (
                <div key={i} className="px-3 py-2" style={nodeStyle(gi * 2 + (i % 2))}>
                  <div className="font-semibold flex items-center">{icon(realIndex)}{renderNodeLabel(node, realIndex)}</div>
                  {renderNodeDesc(node, realIndex, { fontSize: '11px', opacity: 0.8, marginTop: '2px', display: 'block' })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderCycle = () => {
    const count = nodes.length;
    const radius = 100;
    return (
      <div className="flex justify-center" style={{ fontFamily }}>
        <div className="relative" style={{ width: radius * 2 + 100, height: radius * 2 + 100 }}>
          {nodes.map((node, i) => {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const x = radius * Math.cos(angle) + radius + 25;
            const y = radius * Math.sin(angle) + radius + 25;
            return (
              <div
                key={i}
                className="absolute px-2 py-1 text-center flex items-center justify-center"
                style={nodeStyle(i, {
                  left: x - 40, top: y - 40,
                  width: 80, height: 80,
                  borderRadius: '50%',
                  fontSize: '11px',
                  position: 'absolute',
                })}
              >
                <div>
                  {icon(i)}
                  <div>{renderNodeLabel(node, i)}</div>
                </div>
              </div>
            );
          })}
          {/* Center connector indicators */}
          {settings.connectorStyle !== 'none' && (
            <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: scheme.colors[0], opacity: 0.3 }}>🔄</div>
          )}
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="space-y-2" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2" style={{
          backgroundColor: isDark ? '#313244' : '#fff',
          ...getNodeShapeStyle(settings.nodeShape),
          borderLeft: `4px solid ${scheme.colors[i % scheme.colors.length]}`,
          boxShadow: shadow,
        }}>
          <span className="text-lg font-bold flex-shrink-0" style={{ color: scheme.colors[i % scheme.colors.length] }}>
            {getNodeIcon(settings.iconStyle, i) || String(i + 1)}
          </span>
          <div>
            <div className="font-semibold text-sm" style={{ color: textColor }}>{renderNodeLabel(node, i)}</div>
            {renderNodeDesc(node, i, { fontSize: '11px', color: textColor, opacity: 0.6, marginTop: '2px', display: 'block' })}
          </div>
          {settings.showValues && node.value != null && (
            <span className="ml-auto text-sm font-bold" style={{ color: scheme.colors[i % scheme.colors.length] }}>{node.value}</span>
          )}
        </div>
      ))}
    </div>
  );

  const renderHierarchy = () => (
    <div className="space-y-1" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${Math.min(i, 3) * 20}px` }}>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: scheme.colors[i % scheme.colors.length], boxShadow: shadow }} />
          <span className="text-sm font-medium" style={{ color: textColor }}>{icon(i)}{renderNodeLabel(node, i)}</span>
          {settings.showDescription && node.description && <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>— {renderNodeDesc(node, i)}</span>}
        </div>
      ))}
    </div>
  );

  const renderMindmap = () => (
    <div className="flex flex-col items-center" style={{ fontFamily, gap }}>
      <div className="px-6 py-3 shadow-md text-center" style={nodeStyle(0, {
        fontSize: `${baseFontSize + 2}px`,
        fontWeight: 700,
        borderRadius: settings.nodeShape === 'square' ? '4px' : '9999px',
      })}>
        {nodes[0] ? renderNodeLabel(nodes[0], 0) : analysis.title}
      </div>
      <div className="flex flex-wrap justify-center" style={{ gap }}>
        {nodes.slice(1).map((node, i) => (
          <div key={i + 1} className="flex flex-col items-center" style={{ gap: '4px' }}>
            <div className="w-0.5 h-4" style={{ backgroundColor: scheme.colors[(i + 1) % scheme.colors.length] }} />
            <div className="px-3 py-2 text-center" style={nodeStyle(i + 1, { maxWidth: '140px' })}>
              {icon(i + 1)}
              {renderNodeLabel(node, i + 1)}
              {renderNodeDesc(node, i + 1, { fontSize: '10px', opacity: 0.8, marginTop: '2px', display: 'block' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMatrix = () => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return (
      <div className="grid gap-2" style={{ fontFamily, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
        {nodes.map((node, i) => (
          <div key={i} className="px-3 py-3 text-center" style={nodeStyle(i)}>
            {icon(i)}
            {renderNodeLabel(node, i)}
            {renderNodeDesc(node, i, { fontSize: '10px', opacity: 0.8, marginTop: '4px', display: 'block' })}
            {settings.showValues && node.value != null && <div className="text-lg font-bold mt-1">{node.value}</div>}
          </div>
        ))}
      </div>
    );
  };

  const renderRadial = () => {
    const count = nodes.length;
    const radius = 120;
    return (
      <div className="flex justify-center" style={{ fontFamily }}>
        <div className="relative" style={{ width: radius * 2 + 140, height: radius * 2 + 140 }}>
          <div className="absolute rounded-full flex items-center justify-center text-center" style={nodeStyle(0, {
            left: radius + 70 - 45, top: radius + 70 - 45, width: 90, height: 90,
            borderRadius: '50%',
            fontSize: `${baseFontSize - 2}px`, fontWeight: 700, position: 'absolute',
          })}>
            {analysis.title.slice(0, 8)}
          </div>
          {nodes.map((node, i) => {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const x = radius * Math.cos(angle) + radius + 70;
            const y = radius * Math.sin(angle) + radius + 70;
            return (
              <div key={i} className="absolute px-2 py-1.5 text-center" style={nodeStyle(i, {
                left: x - 45, top: y - 20,
                width: 90,
                fontSize: `${baseFontSize - 3}px`,
                position: 'absolute',
              })}>
                {icon(i)}{renderNodeLabel(node, i)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSwot = () => {
    const labels = ['S', 'W', 'O', 'T'];
    const quadrants = [0, 1, 2, 3].map(qi => nodes.filter((_, i) => i % 4 === qi));
    return (
      <div className="grid grid-cols-2 gap-1" style={{ fontFamily }}>
        {quadrants.map((group, qi) => (
          <div key={qi} className="p-3" style={nodeStyle(qi)}>
            <div className="text-lg font-bold mb-2 opacity-90">{labels[qi]}</div>
            {group.map((node, i) => (
              <div key={i} className="text-xs mb-1 opacity-90">• {renderNodeLabel(node, qi + i * 4)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const structureMap: Record<string, () => JSX.Element> = {
    flow: renderFlow, pyramid: renderPyramid, funnel: renderFunnel,
    timeline: renderTimeline, comparison: renderComparison, cycle: renderCycle,
    list: renderList, hierarchy: renderHierarchy, quadrant: renderComparison,
    mindmap: renderMindmap, matrix: renderMatrix, radial: renderRadial, swot: renderSwot,
  };

  const renderer = structureMap[analysis.structure_type] || renderList;

  const containerStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    fontFamily,
    fontSize: `${baseFontSize}px`,
    padding,
    borderRadius: '8px',
    backgroundImage: patternBg !== 'none' ? patternBg : undefined,
    backgroundRepeat: 'repeat',
    overflow: 'hidden',
    ...getAspectRatioStyle(settings.aspectRatio),
  };

  return (
    <div style={containerStyle}>
      {/* Title & Summary */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: scheme.colors[0] }}>
          <EditableText value={analysis.title} onChange={updateTitle} />
        </h2>
        {settings.showDescription && (
          <p className="text-sm opacity-70">
            <EditableText value={analysis.summary} onChange={updateSummary} />
          </p>
        )}
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
        {analysis.keywords.map((kw, i) => (
          <span
            key={i}
            className="px-2 py-0.5 text-xs"
            style={{
              backgroundColor: `${scheme.colors[i % scheme.colors.length]}20`,
              color: scheme.colors[i % scheme.colors.length],
              border: `1px solid ${scheme.colors[i % scheme.colors.length]}40`,
              ...getNodeShapeStyle(settings.nodeShape === 'diamond' ? 'pill' : settings.nodeShape),
            }}
          >
            <EditableText value={kw} onChange={v => updateKeyword(i, v)} />
          </span>
        ))}
      </div>

      {/* Main structure */}
      {renderer()}

      {/* Edit hint */}
      {onUpdate && (
        <p className="text-center text-xs mt-4 opacity-40">💡 Click any text to edit</p>
      )}
    </div>
  );
}
