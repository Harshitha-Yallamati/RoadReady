import { Sparkles } from 'lucide-react';
import { useRoute } from '../context/RouteContext';
import AIAssistantPanel from '../components/AIAssistantPanel';
import useNavigationAI from '../hooks/useNavigationAI';

export default function AISuggestionsPage() {
  const { state } = useRoute();
  const currentRoute = state.routes.find((route) => route.index === state.selectedRouteIndex) || state.routes[0] || null;

  const ai = useNavigationAI({
    source: state.source,
    destination: state.destination,
    currentRoute,
    navigating: false,
    trafficLevel: currentRoute?.trafficLevel || null,
    trafficScore: currentRoute?.trafficScore || 0,
    weather: state.weather,
    allRoutes: state.routes,
  });

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div
          style={{
            padding: 18,
            borderRadius: 20,
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(15,23,42,0.96))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles style={{ width: 22, height: 22, color: '#93c5fd' }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>AI Suggestions</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
            Ask for route tradeoffs, traffic interpretation, destination tips, or smarter stop ideas using your live planner context.
          </div>
        </div>

        <div style={{ height: 'calc(100vh - 220px)', minHeight: 520, borderRadius: 22, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <AIAssistantPanel
            messages={ai.messages}
            isThinking={ai.isThinking}
            pendingSuggestion={ai.pendingSuggestion}
            imagesLoading={ai.imagesLoading}
            imageError={ai.imageError}
            historyLoading={ai.historyLoading}
            historyError={ai.historyError}
            onSendMessage={ai.sendMessage}
            onAcceptSwitch={ai.acceptSuggestion}
            onDismissSwitch={ai.dismissSuggestion}
          />
        </div>
      </div>
    </div>
  );
}
