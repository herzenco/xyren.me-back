import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PageSession {
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  session_id: string;
}

interface TrafficSourcesChartProps {
  sessions: PageSession[];
}

const SOURCE_COLORS = ['hsl(var(--primary))', 'hsl(190 80% 45%)', '#51C481', '#8064CA', '#F59E0B'];

function categorizeReferrer(referrer: string | null): string {
  if (!referrer || referrer === '') return 'Direct';
  const r = referrer.toLowerCase();
  if (r.includes('google') || r.includes('bing') || r.includes('duckduckgo') || r.includes('yahoo')) {
    return 'Organic Search';
  }
  if (r.includes('facebook') || r.includes('twitter') || r.includes('linkedin') || r.includes('instagram')) {
    return 'Social';
  }
  return 'Referral';
}

export function TrafficSourcesChart({ sessions }: TrafficSourcesChartProps) {
  const { sourceData, utmData } = useMemo(() => {
    const sourceCounts = new Map<string, number>();
    const utmMap = new Map<string, { sessions: number; uniqueVisitors: Set<string> }>();

    sessions.forEach(session => {
      const source = categorizeReferrer(session.referrer);
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);

      if (session.utm_source) {
        const utmKey = `${session.utm_source}|${session.utm_medium || '-'}|${session.utm_campaign || '-'}`;
        if (!utmMap.has(utmKey)) {
          utmMap.set(utmKey, { sessions: 0, uniqueVisitors: new Set() });
        }
        const utm = utmMap.get(utmKey)!;
        utm.sessions += 1;
        utm.uniqueVisitors.add(session.session_id);
      }
    });

    const sourceData = Array.from(sourceCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const utmData = Array.from(utmMap.entries())
      .map(([key, data]) => {
        const [source, medium, campaign] = key.split('|');
        return {
          source,
          medium,
          campaign,
          sessions: data.sessions,
          uniqueVisitors: data.uniqueVisitors.size,
        };
      })
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    return { sourceData, utmData };
  }, [sessions]);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Traffic Sources</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-4">Source Breakdown</h4>
          <div className="h-64">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No traffic data
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-4">UTM Campaigns</h4>
          {utmData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Medium</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utmData.map((utm, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{utm.source}</TableCell>
                      <TableCell className="font-mono text-xs">{utm.medium}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[100px] truncate">
                        {utm.campaign}
                      </TableCell>
                      <TableCell className="text-right">{utm.sessions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No UTM campaigns tracked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
