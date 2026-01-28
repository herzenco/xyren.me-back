import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Zap, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { AreaChartCard } from './AreaChartCard';
import { LeadFilters } from './leads/LeadFilters';
import { LeadsTable } from './leads/LeadsTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Lead, SortField, SortDirection } from './leads/types';

export function LeadsTab() {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => queryClient.invalidateQueries({ queryKey: ['leads'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const stats = useMemo(() => {
    if (!leads) return { total: 0, thisWeek: 0, heroModal: 0, projectPlan: 0 };

    const weekAgo = subDays(new Date(), 7);
    return {
      total: leads.length,
      thisWeek: leads.filter((l) => isAfter(new Date(l.created_at), weekAgo)).length,
      heroModal: leads.filter((l) => l.source === 'hero_modal').length,
      projectPlan: leads.filter((l) => l.source === 'project_plan_modal').length,
    };
  }, [leads]);

  const filteredAndSortedLeads = useMemo(() => {
    if (!leads) return [];

    let result = leads;

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter((l) => l.source === sourceFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.full_name.toLowerCase().includes(query) ||
          l.email.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortField === 'lead_score') {
        aVal = a.lead_score ?? 0;
        bVal = b.lead_score ?? 0;
      } else {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      }

      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [leads, sourceFilter, searchQuery, sortField, sortDirection]);

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleExportCSV = () => {
    if (!leads || leads.length === 0) return;

    const headers = ['Name', 'Email', 'Phone', 'Website', 'Industry', 'Source', 'Score', 'Status', 'Date'];
    const rows = leads.map((l) => [
      l.full_name,
      l.email,
      l.phone || '',
      l.website || '',
      l.industry || '',
      l.source || '',
      l.lead_score?.toString() || '0',
      l.qualification_status || '',
      format(new Date(l.created_at), 'yyyy-MM-dd'),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Leads" value={stats.total} icon={Users} />
        <StatsCard title="This Week" value={stats.thisWeek} icon={TrendingUp} />
        <StatsCard title="Hero Modal" value={stats.heroModal} icon={Zap} />
        <StatsCard title="Project Plan" value={stats.projectPlan} icon={FileText} />
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="stats-card rounded-xl p-5"
      >
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Leads Over Time</h3>
        <AreaChartCard data={leads || []} title="leads" />
      </motion.div>

      {/* Filters and Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="stats-card overflow-hidden rounded-xl"
      >
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <LeadFilters
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <LeadsTable leads={filteredAndSortedLeads} isLoading={isLoading} />
      </motion.div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
