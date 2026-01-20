export type QualificationStatus = 'hot' | 'warm' | 'cool' | 'cold';

export interface IntentSignals {
  pricing?: boolean;
  timeline?: boolean;
  specificService?: boolean;
  urgency?: boolean;
  [key: string]: boolean | undefined;
}

export interface LeadScoreInput {
  source: string;
  messageCount?: number;
  intentSignals?: IntentSignals;
  hasWebsite?: boolean;
  hasAiFeedback?: boolean;
}

export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 0;

  // Source scoring
  switch (input.source) {
    case 'project_plan_modal':
      score += 30;
      break;
    case 'chatbot_with_url':
      score += 25;
      break;
    case 'chatbot':
      score += 15;
      break;
    case 'hero_modal':
      score += 10;
      break;
    case 'use_case_page':
    case 'real_estate':
    case 'professional_services':
    case 'home_services':
    case 'education':
      score += 20;
      break;
  }

  // Engagement scoring (message count)
  if (input.messageCount) {
    if (input.messageCount >= 11) {
      score += 35;
    } else if (input.messageCount >= 7) {
      score += 25;
    } else if (input.messageCount >= 4) {
      score += 15;
    } else if (input.messageCount >= 2) {
      score += 5;
    }
  }

  // Intent signals
  if (input.intentSignals) {
    if (input.intentSignals.pricing) score += 15;
    if (input.intentSignals.timeline) score += 15;
    if (input.intentSignals.specificService) score += 10;
    if (input.intentSignals.urgency) score += 10;
  }

  // Website bonus
  if (input.hasWebsite) score += 10;
  if (input.hasAiFeedback) score += 10;

  return score;
}

export function getQualificationStatus(score: number): QualificationStatus {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 20) return 'cool';
  return 'cold';
}

export function getScoreBadgeConfig(status: QualificationStatus) {
  switch (status) {
    case 'hot':
      return {
        label: '🔥 Hot',
        className: 'bg-destructive/20 text-destructive border-destructive/30',
      };
    case 'warm':
      return {
        label: 'Warm',
        className: 'bg-warning/20 text-warning border-warning/30',
      };
    case 'cool':
      return {
        label: 'Cool',
        className: 'bg-primary/20 text-primary border-primary/30',
      };
    case 'cold':
      return {
        label: 'Cold',
        className: 'bg-muted text-muted-foreground border-muted-foreground/30',
      };
  }
}

export function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    hero_modal: 'Hero',
    project_plan_modal: 'Project Plan',
    chatbot: 'Chatbot',
    chatbot_with_url: 'Chatbot',
    use_case_page: 'Use Case',
    real_estate: 'Real Estate',
    professional_services: 'Professional',
    home_services: 'Home Services',
    education: 'Education',
  };
  return sourceMap[source] || source;
}
