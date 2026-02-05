import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Zap, FileText, Download, Archive, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { AreaChartCard } from './AreaChartCard';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

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
  archived: boolean;
};

const sourceFilters = [
  { value: 'all', label: 'All' },
  { value: 'hero_modal', label: 'Hero' },
  { value: 'project_plan_modal', label: 'Project Plan' },
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'home_services_page', label: 'Home Services' },
  { value: 'professional_services_page', label: 'Professional Services' },
  { value: 'archived', label: 'Archived' },
];

function formatSource(source: string): string {
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function LeadsTab() {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  const archiveMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('leads')
        .update({ archived: true })
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeads(new Set());
      toast.success('Leads archived successfully');
    },
    onError: (error) => {
      toast.error('Failed to archive leads: ' + error.message);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('leads')
        .update({ archived: false })
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeads(new Set());
      toast.success('Leads restored successfully');
    },
    onError: (error) => {
      toast.error('Failed to restore leads: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeads(new Set());
      setDeleteDialogOpen(false);
      toast.success('Leads deleted permanently');
    },
    onError: (error) => {
      toast.error('Failed to delete leads: ' + error.message);
    },
  });

  const stats = useMemo(() => {
    if (!leads) return { total: 0, thisWeek: 0, heroModal: 0, projectPlan: 0 };

    const activeLeads = leads.filter((l) => !l.archived);
    const weekAgo = subDays(new Date(), 7);
    return {
      total: activeLeads.length,
      thisWeek: activeLeads.filter((l) => isAfter(new Date(l.created_at), weekAgo)).length,
      heroModal: activeLeads.filter((l) => l.source === 'hero_modal').length,
      projectPlan: activeLeads.filter((l) => l.source === 'project_plan_modal').length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];

    if (sourceFilter === 'archived') {
      return leads.filter((l) => l.archived);
    }

    // For non-archived filters, exclude archived leads
    const activeLeads = leads.filter((l) => !l.archived);

    if (sourceFilter === 'all') return activeLeads;
    return activeLeads.filter((l) => l.source === sourceFilter);
  }, [leads, sourceFilter]);

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    // Handle "indeterminate" state - treat as false (deselect all)
    const shouldSelect = checked === true;
    if (shouldSelect) {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean | "indeterminate") => {
    // Handle "indeterminate" state - treat as false (deselect)
    const shouldSelect = checked === true;
    const newSelected = new Set(selectedLeads);
    if (shouldSelect) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleArchive = () => {
    archiveMutation.mutate(Array.from(selectedLeads));
  };

  const handleUnarchive = () => {
    unarchiveMutation.mutate(Array.from(selectedLeads));
  };

  const handleDelete = () => {
    deleteMutation.mutate(Array.from(selectedLeads));
  };

  // Properly escape CSV fields: wrap in quotes if contains comma, quote, or newline
  const escapeCSVField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      // Escape double quotes by doubling them
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const handleExportCSV = () => {
    if (!leads || leads.length === 0) return;

    const headers = ['Name', 'Email', 'Phone', 'Website', 'Industry', 'Source', 'Score', 'Status', 'Date', 'Archived'];
    const rows = leads.map((l) => [
      escapeCSVField(l.full_name),
      escapeCSVField(l.email),
      escapeCSVField(l.phone || ''),
      escapeCSVField(l.website || ''),
      escapeCSVField(l.industry || ''),
      escapeCSVField(l.source || ''),
      l.lead_score?.toString() || '0',
      escapeCSVField(l.qualification_status || ''),
      format(new Date(l.created_at), 'yyyy-MM-dd'),
      l.archived ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isViewingArchived = sourceFilter === 'archived';
  const allSelected = filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length;
  const someSelected = selectedLeads.size > 0;

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
        <AreaChartCard data={leads?.filter((l) => !l.archived) || []} title="leads" />
      </motion.div>

      {/* Filters and Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="stats-card overflow-hidden rounded-xl"
      >
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setSelectedLeads(new Set()); }}>
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
          <div className="flex items-center gap-2">
            {someSelected && (
              <>
                {isViewingArchived ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnarchive}
                    disabled={unarchiveMutation.isPending}
                    className="gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Restore ({selectedLeads.size})
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending}
                    className="gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archive ({selectedLeads.size})
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedLeads.size})
                </Button>
              </>
            )}
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
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
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
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    {isViewingArchived ? 'No archived leads' : 'No leads found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="table-row-hover">
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        aria-label={`Select ${lead.full_name}`}
                      />
                    </TableCell>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. These leads will be permanently deleted from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
