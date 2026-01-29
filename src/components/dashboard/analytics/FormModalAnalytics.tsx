import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  session_id: string;
}

interface FormModalAnalyticsProps {
  events: AnalyticsEvent[];
}

const FUNNEL_COLORS = ['hsl(var(--primary))', 'hsl(190 80% 45%)', '#51C481'];

export function FormModalAnalytics({ events }: FormModalAnalyticsProps) {
  const funnelData = useMemo(() => {
    const formModalEvents = events.filter(e => 
      e.event_type === 'modal' || e.event_type === 'form'
    );

    const stages = new Map<string, Set<string>>();
    
    // Common funnel stages
    const stageOrder = ['modal_open', 'form_start', 'form_submit'];
    stageOrder.forEach(stage => stages.set(stage, new Set()));

    formModalEvents.forEach(event => {
      const normalizedName = event.event_name.toLowerCase();
      
      if (normalizedName.includes('open') || normalizedName.includes('modal')) {
        stages.get('modal_open')!.add(event.session_id);
      }
      if (normalizedName.includes('start') || normalizedName.includes('focus')) {
        stages.get('form_start')!.add(event.session_id);
      }
      if (normalizedName.includes('submit') || normalizedName.includes('success')) {
        stages.get('form_submit')!.add(event.session_id);
      }
    });

    const modalOpens = stages.get('modal_open')!.size;
    const formStarts = stages.get('form_start')!.size;
    const formSubmits = stages.get('form_submit')!.size;

    return [
      {
        stage: 'Modal Opens',
        count: modalOpens,
        percentage: 100,
      },
      {
        stage: 'Form Starts',
        count: formStarts,
        percentage: modalOpens > 0 ? Math.round((formStarts / modalOpens) * 100) : 0,
      },
      {
        stage: 'Form Submits',
        count: formSubmits,
        percentage: modalOpens > 0 ? Math.round((formSubmits / modalOpens) * 100) : 0,
      },
    ];
  }, [events]);

  const hasData = funnelData.some(d => d.count > 0);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Form & Modal Funnel</h3>
      
      {hasData ? (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value} users`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnelData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 flex justify-between">
            {funnelData.map((data, index) => (
              <div key={data.stage} className="text-center flex-1">
                <div
                  className="text-3xl font-bold"
                  style={{ color: FUNNEL_COLORS[index] }}
                >
                  {data.count}
                </div>
                <div className="text-sm text-muted-foreground">{data.stage}</div>
                {index > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ({data.percentage}% of opens)
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-8">No form/modal data available</p>
      )}
    </div>
  );
}
