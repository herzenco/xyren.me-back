import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PageSession {
  device_type: string | null;
  browser: string | null;
  os: string | null;
}

interface DeviceBreakdownChartsProps {
  sessions: PageSession[];
}

const DEVICE_COLORS = ['hsl(var(--primary))', 'hsl(190 80% 45%)', '#51C481'];
const BROWSER_COLORS = ['hsl(var(--primary))', 'hsl(190 80% 45%)', '#51C481', '#8064CA', '#F59E0B'];
const OS_COLORS = ['hsl(var(--primary))', 'hsl(190 80% 45%)', '#51C481', '#8064CA'];

export function DeviceBreakdownCharts({ sessions }: DeviceBreakdownChartsProps) {
  const { deviceData, browserData, osData } = useMemo(() => {
    const deviceCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();

    sessions.forEach(session => {
      const device = session.device_type || 'Unknown';
      const browser = session.browser || 'Unknown';
      const os = session.os || 'Unknown';

      deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
      browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);
      osCounts.set(os, (osCounts.get(os) || 0) + 1);
    });

    const toChartData = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    return {
      deviceData: toChartData(deviceCounts),
      browserData: toChartData(browserCounts),
      osData: toChartData(osCounts),
    };
  }, [sessions]);

  const renderPieChart = (
    data: Array<{ name: string; value: number }>,
    colors: string[],
    title: string
  ) => (
    <div className="flex flex-col items-center">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
      <div className="h-48 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No data
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Device & Browser Breakdown</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderPieChart(deviceData, DEVICE_COLORS, 'Device Type')}
        {renderPieChart(browserData, BROWSER_COLORS, 'Browser')}
        {renderPieChart(osData, OS_COLORS, 'Operating System')}
      </div>
    </div>
  );
}
