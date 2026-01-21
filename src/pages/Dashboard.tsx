import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadsTab } from '@/components/dashboard/LeadsTab';
import { ChatTab } from '@/components/dashboard/ChatTab';
import { AnalyticsTab } from '@/components/dashboard/AnalyticsTab';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrichLeads = async () => {
    setIsEnriching(true);
    try {
      // Fetch leads with websites that haven't been enriched (no industry yet)
      const { data: leads, error: fetchError } = await supabase
        .from('leads')
        .select('id, website')
        .not('website', 'is', null)
        .is('industry', null);

      if (fetchError) throw fetchError;

      if (!leads || leads.length === 0) {
        toast({ title: 'Info', description: 'No leads to enrich' });
        setIsEnriching(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const lead of leads) {
        try {
          const { error } = await supabase.functions.invoke('enrich-lead', {
            body: { leadId: lead.id, url: lead.website },
          });
          if (error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      toast({
        title: 'Enrichment Complete',
        description: `${successCount} leads enriched${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to enrich leads', variant: 'destructive' });
    }
    setIsEnriching(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Xyren Dashboard</h1>
          </motion.div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleEnrichLeads} disabled={isEnriching}>
              {isEnriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Enrich Leads
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="leads"><LeadsTab /></TabsContent>
          <TabsContent value="chat"><ChatTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
