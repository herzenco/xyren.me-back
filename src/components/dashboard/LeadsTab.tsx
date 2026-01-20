import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Zap, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { AreaChartCard } from './AreaChartCard';
import { LeadScoreBadge } from './LeadScoreBadge';
import { formatSource } from '@/lib/leadScoring';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  source: string | null;
  lead_score: number | null;
  qualification_status: string | null;
  notes: string | null;
  intent_signals: Record<string, boolean> | null;
  engagement_depth: number | null;
};

const sourceFilters = [
  { value: 'all', label: 'All' },
  { value: 'hero_modal', label: 'Hero' },
  { value: 'project_plan_modal', label: 'Project Plan' },
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'professional_services', label: 'Professional' },
  { value: 'home_services', label: 'Home Services' },
  { value: 'education', label: 'Education' },
];

export function LeadsTab() {
  const [sourceFilter, setSourceFilter] = useState('all');

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

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (sourceFilter === 'all') return leads;
    return leads.filter((l) => l.source === sourceFilter);
  }, [leads, sourceFilter]);

  const handleExportCSV = () => {
    if (!leads || leads.length === 0) return;

    const headers = ['Name', 'Email', 'Phone', 'Website', 'Industry', 'Source', 'Score', 'Date'];
    const rows = leads.map((l) => [
      l.full_name,
      l.email,
      l.phone || '',
      l.website || '',
      l.industry || '',
      l.source || '',
      l.lead_score?.toString() || '0',
      format(new Date(l.created_at), 'yyyy-MM-dd'),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xyren-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
          <Tabs value={sourceFilter} onValueChange={setSourceFilter}>
            <TabsList className="h-9 bg-muted/50">
              {sourceFilters.map((filter) => (
                <TabsTrigger
                  key={filter.value}
                  value={filter.value}
                  className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">Score</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="table-row-hover">
                    <TableCell>
                      <LeadScoreBadge score={lead.lead_score || 0} />
                    </TableCell>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell>
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {lead.website.replace(/^https?:\/\//, '').slice(0, 25)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.industry || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {formatSource(lead.source || '')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
