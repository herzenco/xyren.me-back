import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, User, Globe, Mail, Phone, Building2, FileText, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CollectedData = {
  name?: string;
  email?: string;
  url?: string;
  phone?: string;
  websiteFeedback?: string;
};

type ChatInteraction = {
  id: string;
  session_id: string;
  interaction_type: string;
  user_message: string | null;
  assistant_message: string | null;
  url_scraped: string | null;
  lead_id: string | null;
  metadata: unknown;
  created_at: string;
};

type GroupedSession = {
  session_id: string;
  started_at: string;
  last_activity: string;
  interaction_count: number;
  lead_id: string | null;
  lead_name: string | null;
  first_message: string | null;
  conversation_history: ConversationMessage[];
  collected_data: CollectedData;
  has_url_scraped: boolean;
  interactions: ChatInteraction[];
};

interface ConversationDetailModalProps {
  session: GroupedSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationDetailModal({
  session,
  open,
  onOpenChange,
}: ConversationDetailModalProps) {
  if (!session) return null;

  const { collected_data, conversation_history, interactions } = session;

  // Get URL scraped info
  const scrapedUrls = interactions.filter(i => i.url_scraped).map(i => i.url_scraped);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversation with {session.lead_name || 'Anonymous'}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>Started {format(parseISO(session.started_at), 'MMM d, yyyy h:mm a')}</span>
            {session.lead_id && (
              <Badge variant="secondary" className="text-xs bg-success/20 text-success">
                Lead Linked
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Collected Data Summary */}
          {Object.keys(collected_data).length > 0 && (
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">Collected Information</h4>
              <div className="grid grid-cols-2 gap-3">
                {collected_data.name && (
                  <DataItem icon={User} label="Name" value={collected_data.name} />
                )}
                {collected_data.email && (
                  <DataItem icon={Mail} label="Email" value={collected_data.email} />
                )}
                {collected_data.phone && (
                  <DataItem icon={Phone} label="Phone" value={collected_data.phone} />
                )}
                {collected_data.url && (
                  <DataItem 
                    icon={Globe} 
                    label="Website" 
                    value={collected_data.url}
                    isLink
                  />
                )}
              </div>
              {collected_data.websiteFeedback && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Website Feedback</span>
                      <p className="text-sm">{collected_data.websiteFeedback}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scraped URLs */}
          {scrapedUrls.length > 0 && (
            <div className="px-6 py-3 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Scraped URLs:</span>
                {scrapedUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {url?.replace(/^https?:\/\//, '').slice(0, 30)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4">
              {conversation_history.length > 0 ? (
                conversation_history.map((message, index) => (
                  <ChatBubble key={index} message={message} />
                ))
              ) : (
                // Fallback to individual interactions if no conversation_history
                interactions
                  .filter(i => i.user_message || i.assistant_message)
                  .map((interaction) => (
                    <div key={interaction.id} className="space-y-4">
                      {interaction.user_message && (
                        <ChatBubble message={{ role: 'user', content: interaction.user_message }} />
                      )}
                      {interaction.assistant_message && (
                        <ChatBubble message={{ role: 'assistant', content: interaction.assistant_message }} />
                      )}
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>

          {/* Footer with session info */}
          <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Session ID: {session.session_id.slice(0, 8)}...</span>
              <span>{session.interaction_count} interaction{session.interaction_count !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DataItem({
  icon: Icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        {isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block"
          >
            {value.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-sm truncate block">{value}</span>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
