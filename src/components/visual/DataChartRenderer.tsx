import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Treemap } from 'recharts';
import { type DataPoint, type ChartType, COLOR_SCHEMES } from './visualTypes';
import { Pencil } from 'lucide-react';

interface Props {
  data: DataPoint[];
  chartType: ChartType;
  colorSchemeId: string;
  onDataChange?: (data: DataPoint[]) => void;
}

function DataEditor({ data, scheme, onDataChange }: { data: DataPoint[]; scheme: { colors: string[] }; onDataChange: (d: DataPoint[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ label: string; value: string }>({ label: '', value: '' });

  const startEdit = (i: number) => {
    setEditIdx(i);
    setDraft({ label: data[i].label, value: String(data[i].value) });
  };

  const save = () => {
    if (editIdx === null) return;
    const newData = [...data];
    newData[editIdx] = { ...newData[editIdx], label: draft.label, value: parseFloat(draft.value) || 0 };
    onDataChange(newData);
    setEditIdx(null);
  };

  return (
    <div className="mb-3 space-y-1">
      <div className="flex items-center gap-1.5 mb-1">
        <Pencil className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Click a row to edit data</span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 gap-y-0.5 text-xs items-center">
        {data.map((d, i) => (
          editIdx === i ? (
            <div key={i} className="contents">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scheme.colors[i % scheme.colors.length] }} />
              <input autoFocus value={draft.label} onChange={e => setDraft(p => ({ ...p, label: e.target.value }))} onKeyDown={e => e.key === 'Enter' && save()} className="border border-primary rounded px-1 py-0.5 text-xs bg-background" />
              <input value={draft.value} onChange={e => setDraft(p => ({ ...p, value: e.target.value }))} onKeyDown={e => e.key === 'Enter' && save()} type="number" className="border border-primary rounded px-1 py-0.5 text-xs w-20 bg-background" />
              <button onClick={save} className="text-primary text-[10px] font-medium hover:underline">✓</button>
            </div>
          ) : (
            <div key={i} className="contents cursor-pointer hover:bg-muted/50 rounded" onClick={() => startEdit(i)}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scheme.colors[i % scheme.colors.length] }} />
              <span className="truncate">{d.label}</span>
              <span className="text-muted-foreground text-right">{d.value}{d.unit ? ` ${d.unit}` : ''}</span>
              <span className="text-muted-foreground text-[10px]">✎</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default function DataChartRenderer({ data, chartType, colorSchemeId, onDataChange }: Props) {
  const scheme = COLOR_SCHEMES.find(s => s.id === colorSchemeId) || COLOR_SCHEMES[0];
  if (!data.length) return null;

  const chartData = data.map(d => ({ name: d.label, value: d.value, unit: d.unit }));

  const commonProps = { width: '100%' as any, height: 300 };

  const renderChart = () => {
  switch (chartType) {
    case 'bar':
      return (
        <ResponsiveContainer {...commonProps}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={scheme.colors[i % scheme.colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    case 'line':
      return (
        <ResponsiveContainer {...commonProps}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={scheme.colors[0]} strokeWidth={2} dot={{ fill: scheme.colors[0] }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'area':
      return (
        <ResponsiveContainer {...commonProps}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={scheme.colors[0]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={scheme.colors[0]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={scheme.colors[0]} fill="url(#areaGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      );
    case 'pie':
      return (
        <ResponsiveContainer {...commonProps}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={scheme.colors[i % scheme.colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'donut':
      return (
        <ResponsiveContainer {...commonProps}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={scheme.colors[i % scheme.colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'radar':
      return (
        <ResponsiveContainer {...commonProps}>
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Radar dataKey="value" stroke={scheme.colors[0]} fill={scheme.colors[0]} fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      );
    case 'scatter':
      return (
        <ResponsiveContainer {...commonProps}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis dataKey="value" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Scatter data={chartData} fill={scheme.colors[0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={scheme.colors[i % scheme.colors.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );
    case 'treemap': {
      const treemapData = chartData.map((d, i) => ({
        ...d,
        fill: scheme.colors[i % scheme.colors.length],
      }));
      return (
        <ResponsiveContainer {...commonProps}>
          <Treemap
            data={treemapData}
            dataKey="value"
            nameKey="name"
            stroke="#fff"
            fill={scheme.colors[0]}
          >
            {treemapData.map((entry, i) => (
              <Cell key={i} fill={scheme.colors[i % scheme.colors.length]} />
            ))}
            <Tooltip />
          </Treemap>
        </ResponsiveContainer>
      );
    }
    default:
      return null;
  }
  };

  return (
    <div>
      {onDataChange && <DataEditor data={data} scheme={scheme} onDataChange={onDataChange} />}
      {renderChart()}
    </div>
  );
}
