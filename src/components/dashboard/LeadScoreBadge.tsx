import { Badge } from '@/components/ui/badge';
import { getQualificationStatus, getScoreBadgeConfig } from '@/lib/leadScoring';
import { cn } from '@/lib/utils';

interface LeadScoreBadgeProps {
  score: number;
  className?: string;
}

export function LeadScoreBadge({ score, className }: LeadScoreBadgeProps) {
  const status = getQualificationStatus(score);
  const config = getScoreBadgeConfig(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        config.className,
        className
      )}
    >
      {config.label} ({score})
    </Badge>
  );
}
