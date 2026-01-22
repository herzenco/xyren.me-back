import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Activity, Eye, MousePointer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface RecentEvent {
  id: string;
  type: 'page_view' | 'event';
  name: string;
  path?: string;
  timestamp: Date;
}

export function RealTimeActivity() {
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [liveVisitors, setLiveVisitors] = useState(0);

  useEffect(() => {
    // Fetch recent page sessions for live visitor count (last 5 minutes)
    const fetchLiveCount = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('page_sessions')
        .select('session_id', { count: 'exact', head: true })
        .gte('started_at', fiveMinutesAgo);
      setLiveVisitors(count || 0);
    };

    fetchLiveCount();
    const interval = setInterval(fetchLiveCount, 30000);

    // Subscribe to realtime page sessions
    const sessionChannel = supabase
      .channel('realtime-sessions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_sessions' },
        (payload) => {
          const newEvent: RecentEvent = {
            id: payload.new.id,
            type: 'page_view',
            name: 'Page View',
            path: payload.new.page_path,
            timestamp: new Date(payload.new.created_at),
          };
          setRecentEvents(prev => [newEvent, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    // Subscribe to realtime analytics events
    const eventChannel = supabase
      .channel('realtime-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events' },
        (payload) => {
          const newEvent: RecentEvent = {
            id: payload.new.id,
            type: 'event',
            name: payload.new.event_name,
            path: payload.new.page_path,
            timestamp: new Date(payload.new.created_at),
          };
          setRecentEvents(prev => [newEvent, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(eventChannel);
    };
  }, []);

  return (
    <div className="stats-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Real-Time Activity</h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium">{liveVisitors} live visitors</span>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {recentEvents.length > 0 ? (
          recentEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 animate-in slide-in-from-top-2"
            >
              {event.type === 'page_view' ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <MousePointer className="h-4 w-4 text-accent" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{event.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {event.type === 'page_view' ? 'View' : 'Event'}
                  </Badge>
                </div>
                {event.path && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {event.path}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(event.timestamp, 'HH:mm:ss')}
              </span>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Waiting for activity...</p>
          </div>
        )}
      </div>
    </div>
  );
}
