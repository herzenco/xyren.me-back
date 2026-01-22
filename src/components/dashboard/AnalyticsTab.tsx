import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsOverviewCards } from './analytics/AnalyticsOverviewCards';
import { TrafficOverTimeChart } from './analytics/TrafficOverTimeChart';
import { TopPagesTable } from './analytics/TopPagesTable';
import { CTAClicksChart } from './analytics/CTAClicksChart';
import { ScrollDepthChart } from './analytics/ScrollDepthChart';
import { DeviceBreakdownCharts } from './analytics/DeviceBreakdownCharts';
import { TrafficSourcesChart } from './analytics/TrafficSourcesChart';
import { FormModalAnalytics } from './analytics/FormModalAnalytics';
import { ChatEngagementStats } from './analytics/ChatEngagementStats';
import { RealTimeActivity } from './analytics/RealTimeActivity';
import { DateRangeSelector } from './analytics/DateRangeSelector';
import { ExportButtons } from './analytics/ExportButtons';

interface DateRange {
  start: Date;
  end: Date;
}

export function AnalyticsTab() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  });

  // Fetch page sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['page_sessions', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_sessions')
        .select('*')
        .gte('started_at', dateRange.start.toISOString())
        .lte('started_at', dateRange.end.toISOString())
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch analytics events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['analytics_events', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads for conversion tracking
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads_analytics', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch chat interactions
  const { data: chatInteractions, isLoading: chatLoading } = useQuery({
    queryKey: ['chat_analytics', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_interactions')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    if (!sessions) {
      return { uniqueVisitors: 0, pageViews: 0, avgDuration: 0, bounceRate: 0, conversionRate: 0 };
    }

    const uniqueVisitors = new Set(sessions.map(s => s.session_id)).size;
    const pageViews = sessions.length;
    
    const durations = sessions.filter(s => s.duration_seconds != null).map(s => s.duration_seconds!);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const bounces = sessions.filter(s => (s.duration_seconds || 0) < 10).length;
    const bounceRate = sessions.length > 0 ? (bounces / sessions.length) * 100 : 0;
    
    const leadCount = leads?.length || 0;
    const conversionRate = uniqueVisitors > 0 ? (leadCount / uniqueVisitors) * 100 : 0;

    return { uniqueVisitors, pageViews, avgDuration, bounceRate, conversionRate };
  }, [sessions, leads]);

  const isLoading = sessionsLoading || eventsLoading || leadsLoading || chatLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
        <ExportButtons 
          sessions={sessions || []} 
          events={events || []} 
          dateRange={dateRange} 
        />
      </div>

      {/* Overview Cards */}
      <AnalyticsOverviewCards stats={overviewStats} />

      {/* Real-time Activity */}
      <RealTimeActivity />

      {/* Traffic Over Time */}
      <TrafficOverTimeChart
        sessions={sessions || []}
        leads={leads || []}
        dateRange={dateRange}
      />

      {/* Two column layout for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <TopPagesTable sessions={sessions || []} />

        {/* CTA Clicks */}
        <CTAClicksChart events={events || []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scroll Depth */}
        <ScrollDepthChart events={events || []} />

        {/* Form/Modal Funnel */}
        <FormModalAnalytics events={events || []} />
      </div>

      {/* Device Breakdown */}
      <DeviceBreakdownCharts sessions={sessions || []} />

      {/* Traffic Sources */}
      <TrafficSourcesChart sessions={sessions || []} />

      {/* Chat Engagement */}
      <ChatEngagementStats interactions={chatInteractions || []} />
    </div>
  );
}
