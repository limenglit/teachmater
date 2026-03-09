import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type DataPoint, type ChartType, type ColorScheme, COLOR_SCHEMES } from './visualTypes';

interface Props {
  data: DataPoint[];
  chartType: ChartType;
  colorSchemeId: string;
}

export default function DataChartRenderer({ data, chartType, colorSchemeId }: Props) {
  const scheme = COLOR_SCHEMES.find(s => s.id === colorSchemeId) || COLOR_SCHEMES[0];
  if (!data.length) return null;

  const chartData = data.map(d => ({ name: d.label, value: d.value, unit: d.unit }));

  const commonProps = { width: '100%' as any, height: 300 };

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
    default:
      return null;
  }
}
