import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-[80px]">Score</TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="text-right">Date</TableHead>
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
                <motion.tbody
                  key={lead.id}
                  initial={false}
                  animate={{ backgroundColor: isExpanded ? 'hsl(var(--muted) / 0.3)' : 'transparent' }}
                >
                  <TableRow 
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => toggleRow(lead.id)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {formatSource(lead.source || '')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <LeadScoreBadge score={lead.lead_score} />
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.qualification_status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={8} className="p-0">
                          <LeadExpandedRow lead={lead} />
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </motion.tbody>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
