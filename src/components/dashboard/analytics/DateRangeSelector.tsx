import { useState } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function DateRangeSelector({ dateRange, onDateRangeChange }: DateRangeSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomOpen(true);
      return;
    }

    const days = parseInt(value);
    const end = endOfDay(new Date());
    const start = days === 0 ? startOfDay(new Date()) : startOfDay(subDays(new Date(), days));
    onDateRangeChange({ start, end });
  };

  const getCurrentPreset = () => {
    const today = startOfDay(new Date());
    const start = startOfDay(dateRange.start);
    const diffDays = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const preset = PRESETS.find(p => p.days === diffDays);
    return preset ? String(preset.days) : 'custom';
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={getCurrentPreset()} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map(preset => (
            <SelectItem key={preset.days} value={String(preset.days)}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom...</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{
              from: dateRange.start,
              to: dateRange.end,
            }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onDateRangeChange({
                  start: startOfDay(range.from),
                  end: endOfDay(range.to),
                });
                setIsCustomOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
