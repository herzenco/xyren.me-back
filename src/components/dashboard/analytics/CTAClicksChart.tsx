import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  element_id: string | null;
  element_text: string | null;
  session_id: string;
}

interface CTAClicksChartProps {
  events: AnalyticsEvent[];
}

interface ClickStats {
  element: string;
  eventName: string;
  clicks: number;
  uniqueClickers: number;
}

export function CTAClicksChart({ events }: CTAClicksChartProps) {
  const clickStats = useMemo(() => {
    const clickEvents = events.filter(e => e.event_type === 'click');
    const statsMap = new Map<string, { clicks: number; sessionIds: Set<string>; eventName: string }>();

    clickEvents.forEach(event => {
      const element = event.element_text || event.element_id || 'Unknown';
      const key = `${element}__${event.event_name}`;
      
      if (!statsMap.has(key)) {
        statsMap.set(key, { clicks: 0, sessionIds: new Set(), eventName: event.event_name });
      }
      
      const stats = statsMap.get(key)!;
      stats.clicks += 1;
      stats.sessionIds.add(event.session_id);
    });

    const result: ClickStats[] = [];
    statsMap.forEach((stats, key) => {
      const element = key.split('__')[0];
      result.push({
        element,
        eventName: stats.eventName,
        clicks: stats.clicks,
        uniqueClickers: stats.sessionIds.size,
      });
    });

    return result.sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  }, [events]);

  const chartData = clickStats.slice(0, 5).map(stat => ({
    name: stat.element.length > 20 ? stat.element.substring(0, 20) + '...' : stat.element,
    clicks: stat.clicks,
    unique: stat.uniqueClickers,
  }));

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Button & CTA Clicks</h3>
      
      {chartData.length > 0 ? (
        <>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Element</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Unique</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clickStats.map((stat, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-[200px] truncate">{stat.element}</TableCell>
                  <TableCell className="font-mono text-xs">{stat.eventName}</TableCell>
                  <TableCell className="text-right">{stat.clicks}</TableCell>
                  <TableCell className="text-right">{stat.uniqueClickers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-8">No click data available</p>
      )}
    </div>
  );
}
