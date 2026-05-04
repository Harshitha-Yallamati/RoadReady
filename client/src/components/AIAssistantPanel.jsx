import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';

export default function AIAssistantPanel({
  messages = [],
  isThinking = false,
  pendingSuggestion = null,
  imagesLoading = false,
  imageError = '',
  historyLoading = false,
  historyError = '',
  onSendMessage,
  onAcceptSwitch,
  onDismissSwitch,
  variant = 'grid',
}) {
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const isCompact = variant === 'compact';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking, pendingSuggestion, imagesLoading, historyLoading]);

  const handleSend = () => {
    const value = draft.trim();
    if (!value || isThinking) return;
    onSendMessage?.(value);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="ai-assistant-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.96))',
      }}
    >
      <div
        className="ai-assistant-panel__header"
        style={{
          padding: isCompact ? '14px 16px' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: isCompact ? 36 : 38,
              height: isCompact ? 36 : 38,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 24px rgba(37,99,235,0.24)',
              flexShrink: 0,
            }}
          >
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isCompact ? 13 : 14, fontWeight: 800, color: '#f8fafc' }}>
              Navigation Assistant
            </div>
            <div style={{ fontSize: isCompact ? 11 : 12, color: '#94a3b8', lineHeight: 1.5 }}>
              {isThinking
                ? 'Reviewing your current trip context...'
                : 'Ask about traffic, routes, stops, or arrival tips.'}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: isCompact ? '6px 10px' : '6px 12px',
            borderRadius: 999,
            background: isThinking ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
            color: isThinking ? '#fcd34d' : '#86efac',
            fontSize: 11,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {isThinking ? 'Thinking' : 'Live'}
        </div>
      </div>

      <div
        className="ai-assistant-panel__body"
        style={{
          padding: isCompact ? '12px 14px 14px' : undefined,
        }}
      >
        <section className="ai-assistant-panel__section ai-assistant-panel__section--conversation">
          <div
            className="ai-assistant-panel__chat-scroll"
            style={{
              padding: isCompact ? '14px' : undefined,
            }}
          >
            {historyLoading && (
              <div
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.14)',
                  color: '#bfdbfe',
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                Restoring shared AI history...
              </div>
            )}

            {historyError && (
              <div
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.16)',
                  color: '#fcd34d',
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {historyError}
              </div>
            )}

            {imagesLoading && (
              <div
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.16)',
                  color: '#bbf7d0',
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                Loading street-level images...
              </div>
            )}

            {!imagesLoading && imageError && (
              <div
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.16)',
                  color: '#cbd5e1',
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {imageError}
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} compact={isCompact} />
            ))}

            {pendingSuggestion && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  width: isCompact ? '100%' : '94%',
                  padding: isCompact ? '12px 14px' : '14px 16px',
                  borderRadius: 20,
                  border: '1px solid rgba(34,197,94,0.22)',
                  background: 'rgba(34,197,94,0.08)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#bbf7d0',
                  }}
                >
                  Route Update Ready
                </div>
                <div style={{ marginTop: 8, color: '#dcfce7', fontSize: 13, lineHeight: 1.6 }}>
                  {pendingSuggestion.message || 'A faster route is available. Do you want to switch?'}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={onAcceptSwitch}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 14,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <CheckCircle style={{ width: 14, height: 14 }} />
                    Switch Route
                  </button>
                  <button
                    type="button"
                    onClick={onDismissSwitch}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 14,
                      border: '1px solid rgba(148,163,184,0.18)',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <XCircle style={{ width: 14, height: 14 }} />
                    Keep Current Route
                  </button>
                </div>
              </div>
            )}

            {isThinking && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 16,
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.14)',
                  color: '#bfdbfe',
                  fontSize: 12,
                }}
              >
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                Analyzing route context...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div
            className="ai-assistant-panel__composer"
            style={{
              padding: isCompact ? '12px 14px 14px' : undefined,
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about traffic, better routes, nearby food, or arrival tips..."
              disabled={isThinking}
              className="input-field"
              style={{
                minHeight: isCompact ? 74 : 90,
                maxHeight: isCompact ? 160 : 180,
                resize: 'vertical',
                borderRadius: 18,
                padding: isCompact ? '12px 14px' : '14px 16px',
                background: 'rgba(15,23,42,0.92)',
                lineHeight: 1.55,
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isThinking}
              style={{
                width: isCompact ? 44 : 48,
                height: isCompact ? 44 : 48,
                borderRadius: 16,
                border: 'none',
                cursor: isThinking ? 'default' : 'pointer',
                background: isThinking ? 'rgba(148,163,184,0.2)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isThinking ? 'none' : '0 12px 22px rgba(37,99,235,0.24)',
              }}
            >
              <Send style={{ width: isCompact ? 16 : 17, height: isCompact ? 16 : 17 }} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message, compact = false }) {
  const { role, type, text, images, trafficLevel } = message;
  const isUser = role === 'user';
  const isTrafficAlert = type === 'traffic-alert';
  const isSwitchSuggestion = type === 'switch-suggestion';
  const isImageMessage = type === 'images';

  const accent = isTrafficAlert
    ? trafficLevel === 'heavy'
      ? '#f87171'
      : '#fbbf24'
    : isSwitchSuggestion
      ? '#60a5fa'
      : isImageMessage
        ? '#4ade80'
        : '#93c5fd';

  const label = isTrafficAlert
    ? 'Traffic Alert'
    : isSwitchSuggestion
      ? 'Route Recommendation'
      : isImageMessage
        ? 'Nearby Views'
        : isUser
          ? 'You'
          : 'Co-Pilot';

  const icon = isTrafficAlert
    ? <AlertTriangle style={{ width: 13, height: 13, color: accent }} />
    : isImageMessage
      ? <MapPin style={{ width: 13, height: 13, color: accent }} />
      : <Bot style={{ width: 13, height: 13, color: accent }} />;

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: compact ? '100%' : isUser ? '82%' : '94%',
        width: compact ? '100%' : 'auto',
      }}
    >
      {!isUser && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 5,
            color: accent,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {icon}
          {label}
        </div>
      )}

      <div
        style={{
          padding: compact ? '10px 12px' : '11px 14px',
          borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(14,165,233,0.12))'
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isUser ? 'rgba(59,130,246,0.24)' : 'rgba(148,163,184,0.12)'}`,
          color: isUser ? '#eff6ff' : '#dbeafe',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.65,
          fontSize: compact ? 12 : 13,
        }}
      >
        {text}
      </div>

      {isImageMessage && images?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
          {images.map((image) => (
            <a key={image.id || image.url} href={image.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              <img
                src={image.url}
                alt="Street view"
                loading="lazy"
                style={{
                  width: '100%',
                  height: 92,
                  objectFit: 'cover',
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
