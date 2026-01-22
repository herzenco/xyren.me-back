import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface PageSession {
  page_path: string;
  session_id: string;
  duration_seconds: number | null;
  max_scroll_depth: number | null;
  started_at: string | null;
}

interface TopPagesTableProps {
  sessions: PageSession[];
}

interface PageStats {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgDuration: number;
  avgScrollDepth: number;
  trend: number[];
}

export function TopPagesTable({ sessions }: TopPagesTableProps) {
  const pageStats = useMemo(() => {
    const statsMap = new Map<string, {
      views: number;
      sessionIds: Set<string>;
      durations: number[];
      scrollDepths: number[];
      dailyCounts: Map<string, number>;
    }>();

    sessions.forEach(session => {
      const path = session.page_path;
      if (!statsMap.has(path)) {
        statsMap.set(path, {
          views: 0,
          sessionIds: new Set(),
          durations: [],
          scrollDepths: [],
          dailyCounts: new Map(),
        });
      }

      const stats = statsMap.get(path)!;
      stats.views += 1;
      stats.sessionIds.add(session.session_id);
      
      if (session.duration_seconds) {
        stats.durations.push(session.duration_seconds);
      }
      if (session.max_scroll_depth) {
        stats.scrollDepths.push(session.max_scroll_depth);
      }

      if (session.started_at) {
        const dateKey = session.started_at.split('T')[0];
        stats.dailyCounts.set(dateKey, (stats.dailyCounts.get(dateKey) || 0) + 1);
      }
    });

    const result: PageStats[] = [];
    
    statsMap.forEach((stats, path) => {
      const avgDuration = stats.durations.length > 0
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : 0;
      
      const avgScrollDepth = stats.scrollDepths.length > 0
        ? stats.scrollDepths.reduce((a, b) => a + b, 0) / stats.scrollDepths.length
        : 0;

      // Get last 7 days trend
      const sortedDates = Array.from(stats.dailyCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7);
      
      const trend = sortedDates.map(([, count]) => count);

      result.push({
        path,
        views: stats.views,
        uniqueVisitors: stats.sessionIds.size,
        avgDuration: Math.round(avgDuration),
        avgScrollDepth: Math.round(avgScrollDepth),
        trend,
      });
    });

    return result.sort((a, b) => b.views - a.views).slice(0, 20);
  }, [sessions]);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Top Pages</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Unique</TableHead>
              <TableHead className="text-right">Avg Time</TableHead>
              <TableHead className="text-right">Scroll %</TableHead>
              <TableHead className="w-24">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageStats.map((page) => (
              <TableRow key={page.path}>
                <TableCell className="font-mono text-sm">{page.path}</TableCell>
                <TableCell className="text-right">{page.views}</TableCell>
                <TableCell className="text-right">{page.uniqueVisitors}</TableCell>
                <TableCell className="text-right">{page.avgDuration}s</TableCell>
                <TableCell className="text-right">{page.avgScrollDepth}%</TableCell>
                <TableCell>
                  <div className="h-8 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={page.trend.map((v, i) => ({ i, v }))}>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                          strokeWidth={1.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {pageStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No page data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
