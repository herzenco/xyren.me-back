import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Globe, Sparkles, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function TestFunctions() {
  const { toast } = useToast();
  const { session } = useAuth();

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  // Scrape state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeResult, setScrapeResult] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);

  // Enrich state
  const [enrichLeadId, setEnrichLeadId] = useState('');
  const [enrichUrl, setEnrichUrl] = useState('');
  const [enrichResult, setEnrichResult] = useState('');
  const [enrichLoading, setEnrichLoading] = useState(false);

  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // Chat streaming test
  const handleChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          messages: [...chatMessages, userMessage],
          sessionId, // Include sessionId as required by the chat function
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setChatMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }

      toast({ title: 'Chat Success', description: 'Streaming response completed' });
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Chat Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Scrape test
  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;

    setScrapeLoading(true);
    setScrapeResult('');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/firecrawl-scrape`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const markdown = data.data?.markdown || data.markdown || 'No content returned';
      setScrapeResult(markdown);
      setEnrichUrl(scrapeUrl); // Pre-fill for enrich test
      toast({ title: 'Scrape Success', description: `Scraped ${scrapeUrl}` });
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Scrape Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setScrapeLoading(false);
    }
  };

  // Enrich test - now uses leadId and url as required by the API
  const handleEnrich = async () => {
    if (!enrichLeadId.trim() || !enrichUrl.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Both Lead ID and URL are required',
        variant: 'destructive',
      });
      return;
    }

    setEnrichLoading(true);
    setEnrichResult('');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-lead`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leadId: enrichLeadId, url: enrichUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setEnrichResult(JSON.stringify(data, null, 2));
      toast({ title: 'Enrich Success', description: 'Lead data extracted and updated' });
    } catch (error) {
      console.error('Enrich error:', error);
      toast({
        title: 'Enrich Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setEnrichLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Edge Function Tests</h1>
        
        {!session && (
          <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-600 dark:text-yellow-400">
            <strong>Note:</strong> You must be logged in as an admin to test secured edge functions.
          </div>
        )}

        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="scrape" className="gap-2">
              <Globe className="h-4 w-4" /> Scrape
            </TabsTrigger>
            <TabsTrigger value="enrich" className="gap-2">
              <Sparkles className="h-4 w-4" /> Enrich
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>Chat Streaming Test</CardTitle>
                <CardDescription>Test the Lovable AI chat with streaming responses (Session ID: {sessionId.slice(0, 8)}...)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-64 overflow-y-auto rounded-lg border bg-muted/50 p-4 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-muted-foreground text-sm">Start a conversation...</p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-card mr-8 border'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    disabled={chatLoading}
                  />
                  <Button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                    {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scrape Tab */}
          <TabsContent value="scrape">
            <Card>
              <CardHeader>
                <CardTitle>Firecrawl Scrape Test</CardTitle>
                <CardDescription>Test website scraping via Firecrawl API (requires admin auth)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    disabled={scrapeLoading}
                  />
                  <Button onClick={handleScrape} disabled={scrapeLoading || !scrapeUrl.trim()}>
                    {scrapeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scrape'}
                  </Button>
                </div>
                {scrapeResult && (
                  <Textarea
                    className="h-64 font-mono text-xs"
                    value={scrapeResult}
                    readOnly
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enrich Tab */}
          <TabsContent value="enrich">
            <Card>
              <CardHeader>
                <CardTitle>Lead Enrichment Test</CardTitle>
                <CardDescription>Test AI-powered lead data extraction (requires admin auth, leadId, and URL)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Lead ID</label>
                    <Input
                      placeholder="UUID of the lead to enrich"
                      value={enrichLeadId}
                      onChange={(e) => setEnrichLeadId(e.target.value)}
                      disabled={enrichLoading}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Website URL</label>
                    <Input
                      placeholder="https://example.com"
                      value={enrichUrl}
                      onChange={(e) => setEnrichUrl(e.target.value)}
                      disabled={enrichLoading}
                    />
                  </div>
                </div>
                <Button onClick={handleEnrich} disabled={enrichLoading || !enrichLeadId.trim() || !enrichUrl.trim()}>
                  {enrichLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enriching...
                    </>
                  ) : (
                    'Enrich Lead'
                  )}
                </Button>
                {enrichResult && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">Result:</p>
                    <pre className="text-sm whitespace-pre-wrap">{enrichResult}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
