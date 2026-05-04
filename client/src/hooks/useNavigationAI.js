import { useCallback, useEffect } from 'react';
import { aiChat, aiNavigationEvent, getNearbyImages } from '../services/api';
import { useAIChat } from '../context/AIChatContext';

const TRAFFIC_CHECK_INTERVAL_MS = 15000;
const TRAFFIC_ALERT_COOLDOWN_MS = 30000;

function hasValidCoords(point) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lon));
}

function buildTripKey(source, destination) {
  if (!hasValidCoords(source) || !hasValidCoords(destination)) {
    return null;
  }

  return [
    Number(source.lat).toFixed(4),
    Number(source.lon).toFixed(4),
    Number(destination.lat).toFixed(4),
    Number(destination.lon).toFixed(4),
  ].join(':');
}

function buildRouteKey(route, destination) {
  if (!route || !hasValidCoords(destination)) {
    return null;
  }

  return [
    Number(destination.lat).toFixed(4),
    Number(destination.lon).toFixed(4),
    route.index ?? 0,
    route.adjustedDuration || route.duration || 0,
    route.distance || 0,
  ].join(':');
}

export default function useNavigationAI({
  source = null,
  destination = null,
  currentRoute = null,
  navigating = false,
  trafficLevel = null,
  trafficScore = 0,
  weather = null,
  switchSuggestion = null,
  allRoutes = [],
}) {
  const {
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
  } = useAIChat();

  const routeKey = buildRouteKey(currentRoute, destination);
  const tripKey = buildTripKey(source, destination);

  useEffect(() => {
    if (!routeKey || !currentRoute || !destination) {
      return;
    }

    const eventKey = `route-selected:${routeKey}`;

    runSharedTask(
      eventKey,
      async () => withThinking(async () => withImageLoading(async () => {
        const res = await aiNavigationEvent({
          event: 'route_selected',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute.trafficScore || trafficScore,
          totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
          totalDistanceMeters: currentRoute.distance || 0,
          weather,
        });

        const data = res.data || {};
        if (data.analysis) {
          await appendMessage({
            role: 'assistant',
            type: 'text',
            text: data.analysis,
            eventKey,
          });
        }

        if (Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          setImageError('');
          await appendMessage({
            role: 'assistant',
            type: 'images',
            text: `Street-level views sampled along the route to ${destination.name || 'your destination'}.`,
            images: data.images,
            eventKey: `${eventKey}:images`,
          });
          return;
        }

        setImages([]);
        setImageError('No street-level imagery is available along this route yet.');
      })),
      { ttlMs: 120000 },
    ).catch((error) => {
      console.error('Route analysis failed:', error);
      appendMessage({
        role: 'assistant',
        type: 'text',
        text: `Route ready for ${destination.name || 'your trip'}. I'll keep watching traffic and route quality.`,
        eventKey,
      });
      setImages([]);
      setImageError('Street-level imagery could not be loaded for this route.');
    });
  }, [
    routeKey,
    currentRoute,
    destination,
    source,
    allRoutes,
    trafficLevel,
    trafficScore,
    weather,
    appendMessage,
    runSharedTask,
    setImages,
    setImageError,
    withThinking,
    withImageLoading,
  ]);

  useEffect(() => {
    if (!destination || currentRoute || !hasValidCoords(destination)) {
      return;
    }

    const eventKey = `destination-images:${Number(destination.lat).toFixed(4)}:${Number(destination.lon).toFixed(4)}`;

    runSharedTask(
      eventKey,
      async () => withImageLoading(async () => {
        const res = await getNearbyImages(destination.lat, destination.lon, 4);
        const nextImages = Array.isArray(res.data?.images) ? res.data.images : [];
        setImages(nextImages);
        setImageError(nextImages.length > 0 ? '' : 'No street-level imagery is available near this destination yet.');
      }),
      { ttlMs: 120000 },
    ).catch((error) => {
      console.error('Destination image fetch failed:', error);
      setImages([]);
      setImageError('Street-level imagery could not be loaded for this destination.');
    });
  }, [destination, currentRoute, runSharedTask, setImages, setImageError, withImageLoading]);

  useEffect(() => {
    if (!navigating || !tripKey || !destination) {
      return;
    }

    const eventKey = `navigation-started:${tripKey}:${currentRoute?.index ?? 0}`;

    runSharedTask(
      eventKey,
      async () => withThinking(async () => withImageLoading(async () => {
        const res = await aiNavigationEvent({
          event: 'navigation_started',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute?.trafficScore || trafficScore,
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
          weather,
        });

        const data = res.data || {};
        if (data.analysis) {
          await appendMessage({
            role: 'assistant',
            type: 'text',
            text: data.analysis,
            eventKey,
          });
        }

        if (Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          setImageError('');
        }
      })),
      { ttlMs: 120000 },
    ).catch((error) => {
      console.error('Navigation start analysis failed:', error);
      appendMessage({
        role: 'assistant',
        type: 'text',
        text: "Navigation started. I'll keep tracking traffic and let you know when another route becomes clearly better.",
        eventKey,
      });
    });
  }, [
    navigating,
    tripKey,
    destination,
    source,
    currentRoute,
    allRoutes,
    trafficLevel,
    trafficScore,
    weather,
    appendMessage,
    runSharedTask,
    setImages,
    setImageError,
    withThinking,
    withImageLoading,
  ]);

  useEffect(() => {
    if (!navigating || !tripKey || !currentRoute) {
      return undefined;
    }

    const interval = setInterval(() => {
      const level = currentRoute.trafficLevel || trafficLevel;
      const score = currentRoute.trafficScore || trafficScore;
      if (!level || (level === 'light' && score < 30)) {
        return;
      }

      const alertKey = `traffic:${tripKey}:${currentRoute.index ?? 0}:${level}:${Math.round(score / 5)}`;

      runSharedTask(
        alertKey,
        async () => {
          const res = await aiNavigationEvent({
            event: 'traffic_detected',
            source,
            destination,
            currentRoute,
            allRoutes,
            trafficLevel: level,
            trafficScore: score,
            trafficDelaySeconds: currentRoute.trafficDelay || 0,
            totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
            totalDistanceMeters: currentRoute.distance || 0,
          });

          if (res.data?.analysis && (level === 'heavy' || score > 55)) {
            await appendMessage({
              role: 'assistant',
              type: 'traffic-alert',
              text: res.data.analysis,
              trafficLevel: level,
              eventKey: alertKey,
            });
          }
        },
        { ttlMs: TRAFFIC_ALERT_COOLDOWN_MS },
      ).catch(() => {
        // Background monitoring should stay quiet on failure.
      });
    }, TRAFFIC_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    navigating,
    tripKey,
    currentRoute,
    trafficLevel,
    trafficScore,
    source,
    destination,
    allRoutes,
    appendMessage,
    runSharedTask,
  ]);

  useEffect(() => {
    if (!switchSuggestion?.requiresConfirmation) {
      return;
    }

    const eventKey = `reroute:${tripKey || 'trip'}:${switchSuggestion.proposedRouteIndex ?? 'next'}:${Math.round(switchSuggestion.timeSaved || 0)}`;
    setPendingSuggestion(switchSuggestion);

    runSharedTask(
      eventKey,
      async () => withThinking(async () => {
        const res = await aiNavigationEvent({
          event: 'reroute_available',
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'heavy',
          trafficScore: currentRoute?.trafficScore || trafficScore,
          timeSavedSeconds: switchSuggestion.timeSaved || 0,
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
        });

        await appendMessage({
          role: 'assistant',
          type: 'switch-suggestion',
          text: res.data?.analysis || switchSuggestion.message,
          suggestion: switchSuggestion,
          eventKey,
        });
      }),
      { ttlMs: 180000 },
    ).catch(() => {
      appendMessage({
        role: 'assistant',
        type: 'switch-suggestion',
        text: switchSuggestion.message || 'I found a faster route. Do you want me to switch?',
        suggestion: switchSuggestion,
        eventKey,
      });
    });
  }, [
    switchSuggestion,
    tripKey,
    source,
    destination,
    currentRoute,
    allRoutes,
    trafficLevel,
    trafficScore,
    appendMessage,
    runSharedTask,
    setPendingSuggestion,
    withThinking,
  ]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || isThinking) {
      return;
    }

    await appendMessage({ role: 'user', type: 'text', text: trimmed });

    try {
      await withThinking(async () => {
        const res = await aiChat(trimmed, {
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute?.trafficScore || trafficScore || 0,
          trafficDelaySeconds: currentRoute?.trafficDelay || 0,
          weather,
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
        });

        const data = res.data || {};
        const reply = data.reply || "I couldn't process that right now. Please try again.";

        if (data.hasImages && Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          setImageError('');
          await appendMessage({
            role: 'assistant',
            type: 'images',
            text: reply,
            images: data.images,
          });
          return;
        }

        await appendMessage({
          role: 'assistant',
          type: 'text',
          text: reply,
        });
      });
    } catch (error) {
      console.error('AI chat error:', error);
      await appendMessage({
        role: 'assistant',
        type: 'text',
        text: 'I hit a connection issue while checking your route context. Please try again in a moment.',
      });
    }
  }, [
    isThinking,
    appendMessage,
    source,
    destination,
    currentRoute,
    allRoutes,
    trafficLevel,
    trafficScore,
    weather,
    setImages,
    setImageError,
    withThinking,
  ]);

  const acceptSuggestion = useCallback(async () => {
    if (!pendingSuggestion) {
      return null;
    }

    await appendMessage({
      role: 'user',
      type: 'text',
      text: 'Yes, switch me to the faster route.',
    });
    await appendMessage({
      role: 'assistant',
      type: 'text',
      text: "Done. I've switched to the faster route and will keep monitoring the trip from here.",
    });

    const suggestion = pendingSuggestion;
    setPendingSuggestion(null);
    return suggestion;
  }, [pendingSuggestion, appendMessage, setPendingSuggestion]);

  const dismissSuggestion = useCallback(async () => {
    await appendMessage({
      role: 'user',
      type: 'text',
      text: 'Keep the current route for now.',
    });
    await appendMessage({
      role: 'assistant',
      type: 'text',
      text: "Understood. I'll keep watching the route and let you know if conditions change again.",
    });
    setPendingSuggestion(null);
  }, [appendMessage, setPendingSuggestion]);

  return {
    messages,
    images,
    isThinking,
    pendingSuggestion,
    imagesLoading,
    imageError,
    historyLoading,
    historyError,
    sendMessage,
    acceptSuggestion,
    dismissSuggestion,
  };
}
