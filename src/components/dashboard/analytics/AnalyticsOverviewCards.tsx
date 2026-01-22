import { Users, Eye, Clock, TrendingDown, Target } from 'lucide-react';
import { StatsCard } from '../StatsCard';

interface OverviewStats {
  uniqueVisitors: number;
  pageViews: number;
  avgDuration: number;
  bounceRate: number;
  conversionRate: number;
}

interface AnalyticsOverviewCardsProps {
  stats: OverviewStats;
  isLoading?: boolean;
}

export function AnalyticsOverviewCards({ stats, isLoading }: AnalyticsOverviewCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatsCard
        title="Unique Visitors"
        value={stats.uniqueVisitors.toLocaleString()}
        icon={Users}
      />
      <StatsCard
        title="Page Views"
        value={stats.pageViews.toLocaleString()}
        icon={Eye}
      />
      <StatsCard
        title="Avg. Duration"
        value={`${Math.round(stats.avgDuration)}s`}
        icon={Clock}
      />
      <StatsCard
        title="Bounce Rate"
        value={`${stats.bounceRate.toFixed(1)}%`}
        icon={TrendingDown}
      />
      <StatsCard
        title="Conversion Rate"
        value={`${stats.conversionRate.toFixed(1)}%`}
        icon={Target}
      />
    </div>
  );
}
