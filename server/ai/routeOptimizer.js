// ============================================================
// Route Optimizer - Main Orchestrator (ORS + Weather + ML Traffic + AI)
// ============================================================
// 1. Fetches real routes from OpenRouteService/OSRM
// 2. Fetches weather data
// 3. Gets traffic prediction from ML service (Flask API)
// 4. Attaches traffic fields to every route
// 5. Runs graph algorithms for analysis/comparison
// 6. Applies AI scoring and returns ranked routes
// ============================================================

import { getRoutes } from '../services/orsService.js';
import { getWeather } from '../services/weatherService.js';
import { buildGraph, dijkstra } from './dijkstra.js';
import { astar } from './astar.js';
import { scoreRoutes } from './scoringModel.js';
import { predictTraffic } from '../trafficAI.js';
import { isTrafficHigh, findBetterRoute, shouldSuggestSwitch, buildSwitchMessage } from '../routeLogic.js';
import { generateSwitchMessage } from '../services/geminiService.js';
import {
  sampleRouteCoordinates,
  persistTrafficSnapshots,
  listRecentTraffic,
  buildTrafficZones,
} from '../services/trafficPersistenceService.js';
import { getTrafficZones, analyzeRoutesTraffic } from './trafficSimulator.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUGGESTION_COOLDOWN_MS = 10000;
const SAME_ROUTE_REPEAT_SUPPRESS_MS = 120000;
const switchSuggestionCache = new Map();

function toTimeDay(departureTime) {
  const date = departureTime ? new Date(departureTime) : new Date();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    day: DAY_NAMES[date.getDay()],
  };
}

function toRouteTrafficLevel(level) {
  const normalized = String(level || '').toUpperCase();
  if (normalized === 'HIGH') return 'heavy';
  if (normalized === 'LOW') return 'light';
  return 'moderate';
}

function toTrafficMultiplier(level) {
  const normalized = String(level || '').toUpperCase();
  if (normalized === 'HIGH') return 1.35;
  if (normalized === 'LOW') return 1.05;
  return 1.18;
}

function buildSuggestionKey({ source, destination, preference }) {
  const sLat = Number(source?.lat).toFixed(3);
  const sLon = Number(source?.lon).toFixed(3);
  const dLat = Number(destination?.lat).toFixed(3);
  const dLon = Number(destination?.lon).toFixed(3);
  return `${sLat},${sLon}|${dLat},${dLon}|${preference || 'fastest'}`;
}

function shouldSuppressSwitchSuggestion({ key, currentRouteIndex, suggestedRouteIndex }) {
  const now = Date.now();
  const cached = switchSuggestionCache.get(key);
  if (!cached) return false;

  // Cooldown to avoid back-to-back prompts from rapid refresh loops.
  if (now - cached.lastSuggestedAt < SUGGESTION_COOLDOWN_MS) {
    return true;
  }

  // If suggestion is exactly the same route pair, suppress for a longer window.
  const isSamePair = cached.currentRouteIndex === currentRouteIndex
    && cached.suggestedRouteIndex === suggestedRouteIndex;
  if (isSamePair && now - cached.lastSuggestedAt < SAME_ROUTE_REPEAT_SUPPRESS_MS) {
    return true;
  }

  return false;
}

function rememberSwitchSuggestion({ key, currentRouteIndex, suggestedRouteIndex }) {
  switchSuggestionCache.set(key, {
    currentRouteIndex,
    suggestedRouteIndex,
    lastSuggestedAt: Date.now(),
  });
}

/**
 * Main route optimization function
 * @param {Object} params
 * @param {Object} params.source - { lat, lon, name }
 * @param {Object} params.destination - { lat, lon, name }
 * @param {string} params.preference - 'fastest', 'shortest', 'avoid_tolls', 'avoid_highways', 'scenic', 'cheapest'
 * @param {string} params.departureTime - ISO timestamp
 * @param {boolean} params.isRefresh - Whether this is a dynamic refresh call
 * @param {number|null} params.currentRouteIndex - Current route index selected by user
 */
export async function optimizeRoute({
  source,
  destination,
  preference = 'fastest',
  departureTime = null,
  isRefresh = false,
  currentRouteIndex = null,
}) {
  console.log(`\nAI Route Optimizer ${isRefresh ? '(REFRESH)' : ''}`);
  console.log(`   From: (${source.lat}, ${source.lon}) ${source.name || ''}`);
  console.log(`   To: (${destination.lat}, ${destination.lon}) ${destination.name || ''}`);
  console.log(`   Preference: ${preference}`);

  // Step 1: Fetch real routes from ORS/OSRM
  const routes = await getRoutes(source.lat, source.lon, destination.lat, destination.lon, preference);
  console.log(`   Got ${routes.length} routes (source: ${routes[0]?.dataSource || 'unknown'})`);
  routes.forEach((r, i) => console.log(`      Route ${i}: ${(r.distance / 1000).toFixed(1)} km, ${Math.round(r.duration / 60)} min`));

  // Step 2: Fetch weather
  let weather = { condition: 'Clear', temperature: 25 };
  try {
    weather = await getWeather(destination.lat, destination.lon);
    console.log(`   Weather: ${weather.condition}, ${weather.temperature} C`);
  } catch (e) {
    console.log('   Weather fetch failed, using defaults');
  }

  // Step 3: Predict traffic from ML API and attach to each route
  let routesWithTraffic = routes;
  let trafficPrediction = { level: 'MEDIUM', score: 50, source: 'fallback', fallback: true };
  try {
    const { time, day } = toTimeDay(departureTime);
    trafficPrediction = await predictTraffic({ time, day });

    const trafficLevel = toRouteTrafficLevel(trafficPrediction.level);
    const trafficScore = Number.isFinite(Number(trafficPrediction.score)) ? Number(trafficPrediction.score) : 50;
    const trafficSource = trafficPrediction.source === 'ml' ? 'ml' : 'fallback';
    const trafficMultiplier = toTrafficMultiplier(trafficPrediction.level);

    routesWithTraffic = routes.map((route) => {
      const adjustedDuration = Math.round(route.duration * trafficMultiplier);
      const trafficDelay = Math.max(0, adjustedDuration - route.duration);
      return {
        ...route,
        trafficLevel,
        trafficScore,
        trafficSource,
        trafficMultiplier,
        trafficDelay,
        adjustedDuration,
      };
    });

    console.log(`   Traffic predicted: ${trafficLevel} (score ${trafficScore}, source: ${trafficSource})`);
  } catch (e) {
    console.log(`   Traffic prediction failed, using spatial traffic simulator: ${e.message}`);
    // Fallback to spatial traffic simulator
    routesWithTraffic = analyzeRoutesTraffic(routes, source.lat, source.lon, destination.lat, destination.lon);
    
    // Default to the primary route's traffic scores
    const primary = routesWithTraffic[0];
    if (primary) {
      trafficPrediction = {
        level: primary.trafficLevel.toUpperCase(),
        score: primary.trafficScore || (primary.trafficMultiplier > 1.3 ? 80 : 40),
        source: 'simulator',
        fallback: true
      };
    }
  }

  // Generate visual map zones directly from the traffic simulator
  let trafficZones = getTrafficZones(source.lat, source.lon, destination.lat, destination.lon);

  // We can still optionally persist the snapshots asynchronously
  try {
    const primaryRoute = routesWithTraffic[0];
    const routeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sampledPoints = sampleRouteCoordinates(primaryRoute, 7);

    if (sampledPoints.length > 0) {
      persistTrafficSnapshots(sampledPoints, {
        level: primaryRoute?.trafficLevel || toRouteTrafficLevel(trafficPrediction.level),
        score: primaryRoute?.trafficScore ?? trafficPrediction.score ?? 50,
        source: primaryRoute?.trafficSource || trafficPrediction.source || 'fallback',
        routeId,
      }).catch(err => console.log('Background persistence silent error:', err.message));
    }
  } catch (e) {
    console.log(`   Traffic persistence skipped: ${e.message}`);
  }

  // Step 4: Run graph algorithms on the best route for analysis/comparison
  const algorithmComparison = [];
  try {
    const mainRoute = routesWithTraffic[0];
    if (mainRoute.geometry?.coordinates?.length > 2) {
      const coords = mainRoute.geometry.coordinates;
      const graph = buildGraph(coords, {
        distanceWeight: 1,
        timeWeight: preference === 'fastest' ? 2 : 0.5,
        trafficWeight: 0.5,
      });

      const startNode = '0';
      const endNode = `${coords.length - 1}`;
      const dijkstraResult = dijkstra(graph, startNode, endNode);
      const astarResult = astar(graph, startNode, endNode, coords);

      algorithmComparison.push({
        routeIndex: 0,
        dijkstra: {
          cost: Math.round(dijkstraResult.totalCost),
          nodesVisited: dijkstraResult.nodesVisited,
        },
        astar: {
          cost: Math.round(astarResult.totalCost),
          nodesVisited: astarResult.nodesVisited,
          improvement: dijkstraResult.nodesVisited > 0
            ? Math.round((1 - astarResult.nodesVisited / dijkstraResult.nodesVisited) * 100)
            : 0,
        },
      });
    }
  } catch (e) {
    console.log(`   Graph analysis skipped: ${e.message}`);
  }

  // Step 5: Route scoring with deterministic backend logic
  const { scoredRoutes, bestRouteIndex, explanation } = scoreRoutes(routesWithTraffic, preference, weather, departureTime);
  console.log(`   Best route: #${bestRouteIndex} (score: ${scoredRoutes[0].score})`);

  // Step 6: Gemini is used only for user-facing message generation
  // Condition gate: traffic HIGH + better route exists.
  let switchSuggestion = null;
  try {
    const hasCurrentIndex = Number.isInteger(Number(currentRouteIndex));
    const selectedIndex = hasCurrentIndex ? Number(currentRouteIndex) : 0;
    const currentRoute = scoredRoutes.find((route) => route.index === selectedIndex) || scoredRoutes[0];
    const alternatives = scoredRoutes.filter((route) => route.index !== currentRoute?.index);
    const { betterRoute, timeSaved } = findBetterRoute(currentRoute, alternatives);

    if (isTrafficHigh(trafficPrediction) && betterRoute && shouldSuggestSwitch(timeSaved)) {
      const key = buildSuggestionKey({ source, destination, preference });
      const suppressed = shouldSuppressSwitchSuggestion({
        key,
        currentRouteIndex: currentRoute.index,
        suggestedRouteIndex: betterRoute.index,
      });
      if (suppressed) {
        console.log('   Switch suggestion suppressed (cooldown/duplicate)');
      } else {
        const timeSavedMinutes = Math.max(1, Math.round(timeSaved / 60));
        const aiMessage = await generateSwitchMessage({
          timeSavedMinutes,
          context: {
            source,
            destination,
            currentRoute,
            alternativeRoute: betterRoute,
            allRoutes: scoredRoutes,
            trafficLevel: currentRoute?.trafficLevel || trafficPrediction.level?.toLowerCase?.() || 'heavy',
            trafficScore: currentRoute?.trafficScore ?? trafficPrediction.score ?? 0,
            timeSavedSeconds: timeSaved,
            totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
            totalDistanceMeters: currentRoute?.distance || 0,
            weather,
          },
        });
        switchSuggestion = {
          message: aiMessage || buildSwitchMessage(timeSaved),
          timeSaved,
          proposedRouteIndex: betterRoute.index,
          requiresConfirmation: true,
        };
        console.log(`   Switch suggestion prepared: ${currentRoute.index} -> ${betterRoute.index}, save ~${timeSavedMinutes} min`);
        rememberSwitchSuggestion({
          key,
          currentRouteIndex: currentRoute.index,
          suggestedRouteIndex: betterRoute.index,
        });
      }
    }
  } catch (e) {
    console.log(`   Switch suggestion skipped: ${e.message}`);
  }

  const noChange = Boolean(isRefresh && !switchSuggestion);

  return {
    success: true,
    noChange,
    bestRouteIndex,
    routes: scoredRoutes,
    explanation,
    switchSuggestion,
    weather,
    trafficZones,
    algorithmComparison,
    metadata: {
      source,
      destination,
      preference,
      departureTime: departureTime || new Date().toISOString(),
      processedAt: new Date().toISOString(),
      dataSource: routes[0]?.dataSource || 'unknown',
      isRefresh,
      trafficZoneCount: trafficZones.length,
      trafficSource: trafficPrediction.source === 'ml' ? 'ml' : 'fallback',
      currentRouteIndex: Number.isInteger(Number(currentRouteIndex)) ? Number(currentRouteIndex) : null,
      switchSuggestionActive: Boolean(switchSuggestion?.requiresConfirmation),
    },
  };
}

export default { optimizeRoute };
