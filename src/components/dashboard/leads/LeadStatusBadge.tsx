import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, SCORE_COLORS } from './types';

interface LeadStatusBadgeProps {
  status: string | null;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const normalizedStatus = (status || 'cool').toLowerCase();
  const colorClass = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.cool;

  return (
    <Badge
      variant="outline"
      className={cn('capitalize font-medium', colorClass, className)}
    >
      {normalizedStatus}
    </Badge>
  );
}

interface LeadScoreBadgeProps {
  score: number | null;
  className?: string;
}

export function LeadScoreBadge({ score, className }: LeadScoreBadgeProps) {
  const numScore = score ?? 0;
  let colorClass = SCORE_COLORS.low;
  
  if (numScore >= 70) {
    colorClass = SCORE_COLORS.high;
  } else if (numScore >= 40) {
    colorClass = SCORE_COLORS.medium;
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-medium tabular-nums', colorClass, className)}
    >
      {numScore}
    </Badge>
  );
}
