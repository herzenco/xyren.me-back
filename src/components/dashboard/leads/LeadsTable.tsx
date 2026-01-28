import { useState, Fragment } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LeadStatusBadge, LeadScoreBadge } from './LeadStatusBadge';
import { LeadExpandedRow } from './LeadExpandedRow';
import { formatSource } from '@/lib/leadScoring';
import type { Lead } from './types';

interface LeadsTableProps {
  leads: Lead[];
  isLoading?: boolean;
}

export function LeadsTable({ leads, isLoading }: LeadsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10"></TableHead>
            <TableHead className="min-w-[140px]">Name</TableHead>
            <TableHead className="min-w-[200px]">Email</TableHead>
            <TableHead className="min-w-[130px]">Phone</TableHead>
            <TableHead className="min-w-[100px]">Source</TableHead>
            <TableHead className="w-20 text-center">Score</TableHead>
            <TableHead className="w-20 text-center">Status</TableHead>
            <TableHead className="w-28 text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                No leads found
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => {
              const isExpanded = expandedRows.has(lead.id);
              return (
                <Fragment key={lead.id}>
                  <TableRow 
                    key={lead.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => toggleRow(lead.id)}
                  >
                    <TableCell className="p-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{lead.full_name}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{lead.email}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs whitespace-nowrap">
                        {formatSource(lead.source || '')}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <LeadScoreBadge score={lead.lead_score} />
                    </TableCell>
                    <TableCell className="text-center">
                      <LeadStatusBadge status={lead.qualification_status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      {format(new Date(lead.created_at), 'MMM d')}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${lead.id}-expanded`}>
                      <TableCell colSpan={8} className="p-0 bg-muted/30">
                        <LeadExpandedRow lead={lead} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
