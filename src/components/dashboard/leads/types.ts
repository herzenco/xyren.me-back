export type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  notes: string | null;
  source: string | null;
  qualification_status: string | null;
  lead_score: number | null;
  intent_signals: Record<string, boolean> | null;
  engagement_depth: number | null;
  industry: string | null;
  questionnaire_answers: QuestionnaireAnswers | null;
};

export type QuestionnaireAnswers = {
  businessType?: string;
  primaryGoal?: string;
  hasWebsite?: string;
  websiteUrl?: string;
  biggestChallenge?: string;
  timeline?: string;
  preference?: string;
  submittedAt?: string;
};

export type SortField = 'lead_score' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export const SOURCE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'hero_modal', label: 'Hero Modal' },
  { value: 'project_plan_modal', label: 'Project Plan' },
  { value: 'chatbot', label: 'Chatbot' },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  warm: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cool: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const SCORE_COLORS = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};
