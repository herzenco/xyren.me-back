import { ExternalLink, Globe, FileText, Building2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Lead } from './types';

interface LeadExpandedRowProps {
  lead: Lead;
}

export function LeadExpandedRow({ lead }: LeadExpandedRowProps) {
  const questionnaire = lead.questionnaire_answers;
  const intentSignals = lead.intent_signals;

  return (
    <div className="bg-muted/30 p-4 space-y-4 border-t border-border/50">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Website */}
        {lead.website && (
          <div className="flex items-start gap-2">
            <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Website</p>
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {lead.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Industry */}
        {lead.industry && (
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Industry</p>
              <p className="text-sm">{lead.industry}</p>
            </div>
          </div>
        )}

        {/* Engagement Depth */}
        {lead.engagement_depth !== null && lead.engagement_depth > 0 && (
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Engagement Depth</p>
              <p className="text-sm">{lead.engagement_depth}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
          </div>
        </div>
      )}

      {/* Intent Signals */}
      {intentSignals && Object.keys(intentSignals).length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Intent Signals</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(intentSignals).map(([key, value]) => (
              <Badge
                key={key}
                variant="outline"
                className={value ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground'}
              >
                {formatSignalLabel(key)}: {value ? 'Yes' : 'No'}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Questionnaire Answers (only for project_plan_modal) */}
      {lead.source === 'project_plan_modal' && questionnaire && (
        <div className="border-t border-border/50 pt-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Project Plan Questionnaire</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {questionnaire.businessType && (
              <QuestionnaireField label="Business Type" value={questionnaire.businessType} />
            )}
            {questionnaire.primaryGoal && (
              <QuestionnaireField label="Primary Goal" value={questionnaire.primaryGoal} />
            )}
            {questionnaire.hasWebsite && (
              <QuestionnaireField label="Has Website" value={questionnaire.hasWebsite} />
            )}
            {questionnaire.websiteUrl && (
              <QuestionnaireField label="Website URL" value={questionnaire.websiteUrl} isLink />
            )}
            {questionnaire.biggestChallenge && (
              <QuestionnaireField label="Biggest Challenge" value={questionnaire.biggestChallenge} />
            )}
            {questionnaire.timeline && (
              <QuestionnaireField label="Timeline" value={questionnaire.timeline} />
            )}
            {questionnaire.preference && (
              <QuestionnaireField label="Preference" value={questionnaire.preference} />
            )}
            {questionnaire.submittedAt && (
              <QuestionnaireField 
                label="Submitted At" 
                value={new Date(questionnaire.submittedAt).toLocaleString()} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionnaireField({ 
  label, 
  value, 
  isLink = false 
}: { 
  label: string; 
  value: string; 
  isLink?: boolean; 
}) {
  return (
    <div className="bg-background/50 rounded-md p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLink ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-sm font-medium">{value}</p>
      )}
    </div>
  );
}

function formatSignalLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
