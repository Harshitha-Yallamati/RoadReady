import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAIHistory, saveAIMessage } from '../services/api';
import { useAuth } from './AuthContext';

const AIChatContext = createContext(null);

function createWelcomeMessage() {
  return {
    id: 'welcome',
    role: 'assistant',
    type: 'text',
    eventKey: 'welcome',
    text: "I'm your navigation co-pilot. Ask about route tradeoffs, traffic, safer alternatives, or nearby stops anytime.",
    content: "I'm your navigation co-pilot. Ask about route tradeoffs, traffic, safer alternatives, or nearby stops anytime.",
    timestamp: new Date().toISOString(),
    isWelcome: true,
  };
}

function normalizeMessage(message = {}) {
  const timestamp = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
  const content = String(message.content || message.text || '').trim();

  return {
    id: message.id || message._id || `${message.type || 'text'}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    role: message.role || 'assistant',
    type: message.type || 'text',
    eventKey: message.eventKey || null,
    text: content,
    content,
    images: Array.isArray(message.images) ? message.images : [],
    trafficLevel: message.trafficLevel || null,
    suggestion: message.suggestion || null,
    timestamp,
    isWelcome: Boolean(message.isWelcome),
  };
}

function toPersistedMessage(message = {}) {
  return {
    role: message.role || 'assistant',
    content: String(message.content || message.text || '').trim(),
    type: message.type || 'text',
    eventKey: message.eventKey || null,
    timestamp: message.timestamp || new Date().toISOString(),
    images: Array.isArray(message.images) ? message.images : [],
    trafficLevel: message.trafficLevel || null,
    suggestion: message.suggestion || null,
  };
}

export function AIChatProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const activeThinkingCountRef = useRef(0);
  const activeImageLoadsRef = useRef(0);
  const pendingTasksRef = useRef(new Map());
  const completedTaskTimesRef = useRef(new Map());
  const hydratedUserRef = useRef(null);

  const resetSharedState = useCallback(() => {
    activeThinkingCountRef.current = 0;
    activeImageLoadsRef.current = 0;
    pendingTasksRef.current.clear();
    completedTaskTimesRef.current.clear();
    setIsThinking(false);
    setPendingSuggestion(null);
    setImages([]);
    setImagesLoading(false);
    setImageError('');
    setHistoryLoading(false);
    setHistoryError('');
    setMessages([createWelcomeMessage()]);
  }, []);

  const beginThinking = useCallback(() => {
    activeThinkingCountRef.current += 1;
    setIsThinking(true);
  }, []);

  const endThinking = useCallback(() => {
    activeThinkingCountRef.current = Math.max(0, activeThinkingCountRef.current - 1);
    if (activeThinkingCountRef.current === 0) {
      setIsThinking(false);
    }
  }, []);

  const withThinking = useCallback(async (task) => {
    beginThinking();
    try {
      return await task();
    } finally {
      endThinking();
    }
  }, [beginThinking, endThinking]);

  const beginImageLoad = useCallback(() => {
    activeImageLoadsRef.current += 1;
    setImagesLoading(true);
    setImageError('');
  }, []);

  const endImageLoad = useCallback(() => {
    activeImageLoadsRef.current = Math.max(0, activeImageLoadsRef.current - 1);
    if (activeImageLoadsRef.current === 0) {
      setImagesLoading(false);
    }
  }, []);

  const withImageLoading = useCallback(async (task) => {
    beginImageLoad();
    try {
      return await task();
    } finally {
      endImageLoad();
    }
  }, [beginImageLoad, endImageLoad]);

  const runSharedTask = useCallback(async (taskKey, task, { ttlMs = 45000 } = {}) => {
    if (!taskKey) {
      return task();
    }

    const now = Date.now();
    const lastCompletedAt = completedTaskTimesRef.current.get(taskKey);
    if (lastCompletedAt && now - lastCompletedAt < ttlMs) {
      return { skipped: true };
    }

    const pendingTask = pendingTasksRef.current.get(taskKey);
    if (pendingTask) {
      return pendingTask;
    }

    const promise = (async () => {
      try {
        return await task();
      } finally {
        pendingTasksRef.current.delete(taskKey);
        completedTaskTimesRef.current.set(taskKey, Date.now());
      }
    })();

    pendingTasksRef.current.set(taskKey, promise);
    return promise;
  }, []);

  const appendMessage = useCallback(async (message, { persist = true } = {}) => {
    const normalizedMessage = normalizeMessage(message);

    setMessages((previousMessages) => {
      const nextBase = previousMessages.filter((item) => !item.isWelcome);
      return [...nextBase, normalizedMessage];
    });

    if (!persist || normalizedMessage.isWelcome || !isAuthenticated) {
      return normalizedMessage;
    }

    try {
      await saveAIMessage(toPersistedMessage(normalizedMessage));
      setHistoryError('');
    } catch (error) {
      console.error('Failed to persist AI chat message:', error);
      setHistoryError('Messages are not syncing right now.');
    }

    return normalizedMessage;
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      hydratedUserRef.current = null;
      resetSharedState();
    }
  }, [authLoading, isAuthenticated, resetSharedState]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) {
      return;
    }

    if (hydratedUserRef.current === user.id) {
      return;
    }

    let active = true;
    hydratedUserRef.current = user.id;
    setHistoryLoading(true);
    setHistoryError('');

    getAIHistory()
      .then((response) => {
        if (!active) {
          return;
        }

        const nextMessages = Array.isArray(response.data?.messages)
          ? response.data.messages.map(normalizeMessage)
          : [];

        setMessages(nextMessages.length > 0 ? nextMessages : [createWelcomeMessage()]);
        completedTaskTimesRef.current.clear();
        nextMessages.forEach((message) => {
          if (message.eventKey && message.timestamp) {
            completedTaskTimesRef.current.set(message.eventKey, new Date(message.timestamp).getTime());
          }
        });

        const latestImageMessage = [...nextMessages].reverse().find(
          (message) => message.type === 'images' && Array.isArray(message.images) && message.images.length > 0,
        );
        setImages(latestImageMessage?.images || []);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.error('Failed to load AI history:', error);
        setHistoryError('Could not load previous AI messages.');
        setMessages([createWelcomeMessage()]);
      })
      .finally(() => {
        if (active) {
          setHistoryLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  const value = useMemo(() => ({
    messages,
    isThinking,
    pendingSuggestion,
    setPendingSuggestion,
    images,
    setImages,
    imagesLoading,
    imageError,
    setImageError,
    historyLoading,
    historyError,
    appendMessage,
    withThinking,
    withImageLoading,
    runSharedTask,
    resetSharedState,
  }), [
    messages,
    isThinking,
    pendingSuggestion,
    images,
    imagesLoading,
    imageError,
    historyLoading,
    historyError,
    appendMessage,
    withThinking,
    withImageLoading,
    runSharedTask,
    resetSharedState,
  ]);

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChat must be used within AIChatProvider');
  }
  return context;
}

export default AIChatContext;
