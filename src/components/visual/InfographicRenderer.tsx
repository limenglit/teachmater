import { useState, useCallback } from 'react';
import { type AnalysisResult, type TemplateStyle, type StructureNode, type VisualSettings, COLOR_SCHEMES, FONT_FAMILIES } from './visualTypes';

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

export default function InfographicRenderer({ analysis, colorSchemeId, template, onUpdate, visualSettings }: Props) {
  const scheme = COLOR_SCHEMES.find(s => s.id === colorSchemeId) || COLOR_SCHEMES[0];
  const nodes = analysis.structure_nodes;
  const isDark = template === 'dark' || template === 'tech';
  const bgColor = isDark ? '#1e1e2e' : template === 'magazine' ? '#fafaf9' : template === 'elegant' ? '#f8f5f0' : template === 'bold' ? scheme.bg : scheme.bg;
  const textColor = isDark ? '#cdd6f4' : template === 'elegant' ? '#3c3836' : scheme.text;
  const isPlayful = template === 'playful';

  const borderRadius = isPlayful ? '16px' : template === 'modern' ? '12px' : template === 'bold' ? '2px' : template === 'elegant' ? '8px' : '4px';
  const fontDef = FONT_FAMILIES.find(f => f.id === (visualSettings?.fontFamily || 'sans'));
  const fontFamily = fontDef?.css || 'inherit';
  const baseFontSize = visualSettings?.fontSize || 14;
  const density = visualSettings?.layoutDensity || 'normal';
  const gap = density === 'compact' ? '0.25rem' : density === 'spacious' ? '1rem' : '0.5rem';
  const padding = density === 'compact' ? '0.5rem' : density === 'spacious' ? '1.5rem' : '0.75rem';

  const updateNode = useCallback((index: number, patch: Partial<StructureNode>) => {
    if (!onUpdate) return;
    const newNodes = [...analysis.structure_nodes];
    newNodes[index] = { ...newNodes[index], ...patch };
    onUpdate({ ...analysis, structure_nodes: newNodes });
  }, [analysis, onUpdate]);

  const updateTitle = useCallback((title: string) => {
    onUpdate?.({ ...analysis, title });
  }, [analysis, onUpdate]);

  const updateSummary = useCallback((summary: string) => {
    onUpdate?.({ ...analysis, summary });
  }, [analysis, onUpdate]);

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
    node.description ? <EditableText value={node.description} onChange={v => updateNode(i, { description: v })} style={style} className={className} /> : null
  );

  const renderFlow = () => (
    <div className="flex flex-wrap items-center justify-center gap-2" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="px-4 py-3 text-center shadow-sm"
            style={{
              backgroundColor: scheme.colors[i % scheme.colors.length],
              color: '#fff',
              borderRadius,
              minWidth: '100px',
              fontSize: isPlayful ? '15px' : '13px',
              fontWeight: 600,
            }}
          >
            <div>{renderNodeLabel(node, i)}</div>
            {node.description && <div className="text-xs mt-1 opacity-80">{renderNodeDesc(node, i)}</div>}
          </div>
          {i < nodes.length - 1 && <span className="text-xl" style={{ color: scheme.colors[0] }}>→</span>}
        </div>
      ))}
    </div>
  );

  const renderPyramid = () => (
    <div className="flex flex-col items-center gap-1" style={{ fontFamily }}>
      {nodes.map((node, i) => {
        const width = 40 + (i / Math.max(nodes.length - 1, 1)) * 60;
        return (
          <div
            key={i}
            className="py-2 px-4 text-center shadow-sm"
            style={{
              backgroundColor: scheme.colors[i % scheme.colors.length],
              color: '#fff',
              borderRadius,
              width: `${width}%`,
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {renderNodeLabel(node, i)}
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
          <div
            key={i}
            className="py-2 px-4 text-center shadow-sm"
            style={{
              backgroundColor: scheme.colors[i % scheme.colors.length],
              color: '#fff',
              borderRadius,
              width: `${width}%`,
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {renderNodeLabel(node, i)}
            {node.value != null && <span className="ml-2 text-xs opacity-80">({node.value})</span>}
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
            className="absolute left-[-14px] top-2 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: scheme.colors[i % scheme.colors.length], borderColor: bgColor }}
          />
          <div
            className="px-3 py-2 shadow-sm"
            style={{ backgroundColor: isDark ? '#313244' : '#fff', borderRadius, border: `1px solid ${scheme.colors[i % scheme.colors.length]}30` }}
          >
            <div className="font-semibold text-sm" style={{ color: scheme.colors[i % scheme.colors.length] }}>{renderNodeLabel(node, i)}</div>
            {node.description && <div className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.7 }}>{renderNodeDesc(node, i)}</div>}
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
                <div
                  key={i}
                  className="px-3 py-2 shadow-sm"
                  style={{
                    backgroundColor: scheme.colors[gi * 2 + (i % 2)],
                    color: '#fff',
                    borderRadius,
                    fontSize: '13px',
                  }}
                >
                  <div className="font-semibold">{renderNodeLabel(node, realIndex)}</div>
                  {node.description && <div className="text-xs mt-0.5 opacity-80">{renderNodeDesc(node, realIndex)}</div>}
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
                className="absolute px-2 py-1 text-center shadow-sm"
                style={{
                  left: x - 40, top: y - 16,
                  backgroundColor: scheme.colors[i % scheme.colors.length],
                  color: '#fff',
                  borderRadius: '50%',
                  width: 80, height: 80,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 600,
                }}
              >
                {renderNodeLabel(node, i)}
              </div>
            );
          })}
          <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: scheme.colors[0], opacity: 0.3 }}>🔄</div>
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="space-y-2" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2 shadow-sm" style={{ backgroundColor: isDark ? '#313244' : '#fff', borderRadius, borderLeft: `4px solid ${scheme.colors[i % scheme.colors.length]}` }}>
          <span className="text-lg font-bold" style={{ color: scheme.colors[i % scheme.colors.length] }}>{i + 1}</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: textColor }}>{renderNodeLabel(node, i)}</div>
            {node.description && <div className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.6 }}>{renderNodeDesc(node, i)}</div>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderHierarchy = () => (
    <div className="space-y-1" style={{ fontFamily }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${Math.min(i, 3) * 20}px` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scheme.colors[i % scheme.colors.length] }} />
          <span className="text-sm font-medium" style={{ color: textColor }}>{renderNodeLabel(node, i)}</span>
          {node.description && <span className="text-xs" style={{ color: textColor, opacity: 0.5 }}>— {renderNodeDesc(node, i)}</span>}
        </div>
      ))}
    </div>
  );

  const structureMap: Record<string, () => JSX.Element> = {
    flow: renderFlow,
    pyramid: renderPyramid,
    funnel: renderFunnel,
    timeline: renderTimeline,
    comparison: renderComparison,
    cycle: renderCycle,
    list: renderList,
    hierarchy: renderHierarchy,
    quadrant: renderComparison,
  };

  const renderer = structureMap[analysis.structure_type] || renderList;

  return (
    <div className="p-6 rounded-lg" style={{ backgroundColor: bgColor, color: textColor, fontFamily }}>
      {/* Title & Summary */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: scheme.colors[0] }}>
          <EditableText value={analysis.title} onChange={updateTitle} />
        </h2>
        <p className="text-sm opacity-70">
          <EditableText value={analysis.summary} onChange={updateSummary} />
        </p>
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
        {analysis.keywords.map((kw, i) => (
          <span
            key={i}
            className="px-2 py-0.5 text-xs rounded-full"
            style={{
              backgroundColor: `${scheme.colors[i % scheme.colors.length]}20`,
              color: scheme.colors[i % scheme.colors.length],
              border: `1px solid ${scheme.colors[i % scheme.colors.length]}40`,
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
