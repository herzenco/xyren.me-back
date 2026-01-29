import { Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SOURCE_FILTERS, type SortField, type SortDirection } from './types';

interface LeadFiltersProps {
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
}

export function LeadFilters({
  sourceFilter,
  onSourceFilterChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
}: LeadFiltersProps) {
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      onSortChange(field, sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange(field, 'desc');
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Source Filter Tabs */}
      <Tabs value={sourceFilter} onValueChange={onSourceFilterChange}>
        <TabsList className="h-9 bg-muted/50">
          {SOURCE_FILTERS.map((filter) => (
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
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-[200px] sm:w-[250px]"
          />
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSortClick('lead_score')}>
              Score {sortField === 'lead_score' && (sortDirection === 'desc' ? '↓' : '↑')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSortClick('created_at')}>
              Date {sortField === 'created_at' && (sortDirection === 'desc' ? '↓' : '↑')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
