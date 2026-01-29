import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';

interface TrafficDataPoint {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  leads: number;
}

interface TrafficOverTimeChartProps {
  sessions: Array<{ started_at: string | null; session_id: string }>;
  leads: Array<{ created_at: string }>;
  dateRange: { start: Date; end: Date };
}

export function TrafficOverTimeChart({ sessions, leads, dateRange }: TrafficOverTimeChartProps) {
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    const dataMap = new Map<string, TrafficDataPoint>();
    
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      dataMap.set(dateKey, {
        date: dateKey,
        pageViews: 0,
        uniqueVisitors: 0,
        leads: 0,
      });
    });

    // Count page views and unique visitors per day
    const dailySessionIds = new Map<string, Set<string>>();
    
    sessions.forEach(session => {
      if (!session.started_at) return;
      const dateKey = format(startOfDay(parseISO(session.started_at)), 'yyyy-MM-dd');
      const existing = dataMap.get(dateKey);
      if (existing) {
        existing.pageViews += 1;
        if (!dailySessionIds.has(dateKey)) {
          dailySessionIds.set(dateKey, new Set());
        }
        dailySessionIds.get(dateKey)!.add(session.session_id);
      }
    });

    dailySessionIds.forEach((sessionIds, dateKey) => {
      const existing = dataMap.get(dateKey);
      if (existing) {
        existing.uniqueVisitors = sessionIds.size;
      }
    });

    // Count leads per day
    leads.forEach(lead => {
      const dateKey = format(startOfDay(parseISO(lead.created_at)), 'yyyy-MM-dd');
      const existing = dataMap.get(dateKey);
      if (existing) {
        existing.leads += 1;
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, leads, dateRange]);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Traffic Over Time</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#51C481" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#51C481" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="pageViews"
              name="Page Views"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorPageViews)"
            />
            <Area
              type="monotone"
              dataKey="uniqueVisitors"
              name="Unique Visitors"
              stroke="hsl(var(--accent))"
              fillOpacity={1}
              fill="url(#colorVisitors)"
            />
            <Area
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="#51C481"
              fillOpacity={1}
              fill="url(#colorLeads)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
