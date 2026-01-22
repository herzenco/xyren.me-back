import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  session_id: string;
}

interface ScrollDepthChartProps {
  events: AnalyticsEvent[];
}

const SCROLL_THRESHOLDS = ['25%', '50%', '75%', '100%'];
const COLORS = [
  'hsl(var(--primary))',
  'hsl(190 90% 45%)',
  'hsl(190 80% 40%)',
  '#51C481',
];

export function ScrollDepthChart({ events }: ScrollDepthChartProps) {
  const scrollData = useMemo(() => {
    const scrollEvents = events.filter(e => e.event_type === 'scroll');
    const thresholdMap = new Map<string, Set<string>>();

    SCROLL_THRESHOLDS.forEach(threshold => {
      thresholdMap.set(threshold, new Set());
    });

    scrollEvents.forEach(event => {
      // Match events like "scroll_25", "scroll_50", etc.
      const match = event.event_name.match(/scroll_(\d+)/);
      if (match) {
        const depth = parseInt(match[1]);
        const threshold = `${depth}%`;
        if (thresholdMap.has(threshold)) {
          thresholdMap.get(threshold)!.add(event.session_id);
        }
      }
    });

    const totalSessions = new Set(scrollEvents.map(e => e.session_id)).size;

    return SCROLL_THRESHOLDS.map((threshold, index) => ({
      threshold,
      users: thresholdMap.get(threshold)?.size || 0,
      percentage: totalSessions > 0
        ? Math.round((thresholdMap.get(threshold)?.size || 0) / totalSessions * 100)
        : 0,
      color: COLORS[index],
    }));
  }, [events]);

  const hasData = scrollData.some(d => d.users > 0);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Scroll Depth Distribution</h3>
      
      {hasData ? (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scrollData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="threshold" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'users' ? `${value} users` : `${value}%`,
                    name === 'users' ? 'Users' : 'Percentage'
                  ]}
                />
                <Bar dataKey="users" radius={[4, 4, 0, 0]}>
                  {scrollData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {scrollData.map((data, index) => (
              <div key={data.threshold} className="text-center">
                <div
                  className="text-2xl font-bold"
                  style={{ color: COLORS[index] }}
                >
                  {data.percentage}%
                </div>
                <div className="text-xs text-muted-foreground">
                  reached {data.threshold}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-8">No scroll data available</p>
      )}
    </div>
  );
}
