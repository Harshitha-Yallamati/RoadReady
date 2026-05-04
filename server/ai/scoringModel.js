// ============================================================
// AI Weighted Scoring Model — Core Intelligence Engine
// ============================================================
// This is the heart of the AI Smart Router Planner.
// It scores and ranks routes using a multi-factor weighted
// scoring function with dynamic weights per user preference.
//
// Score = w1*norm(distance) + w2*norm(time) + w3*norm(traffic)
//       + w4*norm(cost) + w5*weatherPenalty + w6*roadTypeScore
//
// Lower score = better route
// ============================================================

// Weight presets for different user preferences
const WEIGHT_PRESETS = {
  fastest: {
    distance: 0.10,
    time: 0.45,
    traffic: 0.25,
    cost: 0.05,
    weather: 0.05,
    roadType: 0.10
  },
  shortest: {
    distance: 0.45,
    time: 0.20,
    traffic: 0.10,
    cost: 0.05,
    weather: 0.05,
    roadType: 0.15
  },
  cheapest: {
    distance: 0.15,
    time: 0.10,
    traffic: 0.10,
    cost: 0.45,
    weather: 0.05,
    roadType: 0.15
  },
  scenic: {
    distance: 0.05,
    time: 0.10,
    traffic: 0.05,
    cost: 0.05,
    weather: 0.15,
    roadType: 0.60
  },
  avoid_tolls: {
    distance: 0.15,
    time: 0.25,
    traffic: 0.20,
    cost: 0.10,
    weather: 0.05,
    roadType: 0.25
  },
  avoid_highways: {
    distance: 0.12,
    time: 0.18,
    traffic: 0.20,
    cost: 0.05,
    weather: 0.05,
    roadType: 0.40
  }
};

// Time-of-day traffic multipliers
function getTrafficMultiplier(hour) {
  if (hour >= 7 && hour < 9) return 1.4;   // Morning rush
  if (hour >= 9 && hour < 11) return 1.15;
  if (hour >= 11 && hour < 16) return 1.0;  // Normal
  if (hour >= 16 && hour < 19) return 1.5;  // Evening rush
  if (hour >= 19 && hour < 22) return 1.1;
  return 0.8;                                // Night (faster)
}

// Road type scoring — lower = better for the preference
function getRoadTypeScore(roadTypes, preference) {
  const { highway = 0, urban = 0, rural = 0 } = roadTypes;

  switch (preference) {
    case 'fastest':
      return (100 - highway) / 100; // More highway = better
    case 'shortest':
      return (highway * 0.15 + urban * 0.25 + rural * 0.10) / 100;
    case 'scenic':
      return (100 - rural) / 100;   // More rural = better
    case 'cheapest':
    case 'avoid_tolls':
      return (highway * 0.5 + urban * 0.3) / 100; // Less highway = fewer tolls
    case 'avoid_highways':
      return (highway * 0.85 + urban * 0.1) / 100;
    default:
      return 0.5;
  }
}

/**
 * Min-max normalization across an array of values
 * Returns 0-1 where 0 is best, 1 is worst
 */
function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
}

/**
 * Score and rank routes using the AI model
 * @param {Array} routes - Array of route objects from ORS
 * @param {string} preference - User preference
 * @param {Object} weather - Weather data
 * @param {string} departureTime - ISO timestamp  
 * @returns {Object} { scoredRoutes, bestRouteIndex, explanation }
 */
export function scoreRoutes(routes, preference = 'fastest', weather = {}, departureTime = null) {
  const weights = WEIGHT_PRESETS[preference] || WEIGHT_PRESETS.fastest;
  const hour = departureTime ? new Date(departureTime).getHours() : new Date().getHours();
  const trafficMult = getTrafficMultiplier(hour);

  // Extract raw features
  const distances = routes.map(r => r.distance);
  const times = routes.map((route) => {
    const adjustedDuration = Number(route.adjustedDuration);
    if (Number.isFinite(adjustedDuration) && adjustedDuration > 0) {
      return adjustedDuration;
    }
    return route.duration * trafficMult;
  });
  const costs = routes.map(r => r.estimatedCost || 0);
  const trafficScores = routes.map((route) => {
    const score = Number(route.trafficScore);
    return Number.isFinite(score) ? Math.max(0, Math.min(score, 100)) : 50;
  });

  // Normalize features (0-1 scale)
  const normDist = normalize(distances);
  const normTime = normalize(times);
  const normCost = normalize(costs);
  const normTraffic = normalize(trafficScores);

  // Weather penalty (same for all routes, but can vary by road type)
  const weatherPenalty = weather.condition ? getWeatherPenaltyValue(weather.condition) : 0;

  // Score each route
  const scores = routes.map((route, i) => {
    const roadScore = getRoadTypeScore(route.roadTypes || {}, preference);
    const tollPenalty = (preference === 'avoid_tolls' && route.hasTolls) ? 0.3 : 0;
    const highwayPenalty = preference === 'avoid_highways'
      ? (route.roadTypes?.highway || 0) / 100 * 0.45
      : 0;
    const computedAdjustedDuration = Math.round(times[i]);
    const computedTrafficLevel = trafficMult > 1.3 ? 'heavy' : trafficMult > 1.1 ? 'moderate' : 'light';

    const score = (
      weights.distance * normDist[i] +
      weights.time * normTime[i] +
      weights.traffic * normTraffic[i] +
      weights.cost * normCost[i] +
      weights.weather * weatherPenalty +
      weights.roadType * roadScore +
      tollPenalty +
      highwayPenalty
    );

    return {
      ...route,
      score: Math.round(score * 1000) / 1000,
      adjustedDuration: Number.isFinite(Number(route.adjustedDuration))
        ? Number(route.adjustedDuration)
        : computedAdjustedDuration,
      trafficLevel: route.trafficLevel || computedTrafficLevel,
      weatherImpact: weatherPenalty > 0.1 ? 'significant' : weatherPenalty > 0 ? 'minor' : 'none',
      // Feature breakdown for explainability
      scoreBreakdown: {
        distance: { value: normDist[i], weight: weights.distance, contribution: weights.distance * normDist[i] },
        time: { value: normTime[i], weight: weights.time, contribution: weights.time * normTime[i] },
        traffic: { value: normTraffic[i], weight: weights.traffic, contribution: weights.traffic * normTraffic[i] },
        cost: { value: normCost[i], weight: weights.cost, contribution: weights.cost * normCost[i] },
        weather: { value: weatherPenalty, weight: weights.weather },
        roadType: { value: roadScore, weight: weights.roadType, contribution: weights.roadType * roadScore }
      }
    };
  });

  // Sort by score (lower = better)
  scores.sort((a, b) => a.score - b.score);

  // Mark best route
  scores.forEach((s, i) => {
    s.isBest = i === 0;
    s.rank = i + 1;
  });

  const bestRouteIndex = routes.findIndex(r => r.index === scores[0].index);
  const explanation = generateExplanation(scores, preference, weather, trafficMult);

  return {
    scoredRoutes: scores,
    bestRouteIndex: scores[0].index,
    explanation
  };
}

function getWeatherPenaltyValue(condition) {
  const map = {
    'Clear': 0, 'Clouds': 0.02, 'Haze': 0.05, 'Mist': 0.08,
    'Drizzle': 0.10, 'Rain': 0.15, 'Thunderstorm': 0.25,
    'Snow': 0.30, 'Fog': 0.20
  };
  return map[condition] || 0.05;
}

/**
 * Generate human-readable AI explanation
 */
function generateExplanation(scoredRoutes, preference, weather, trafficMult) {
  const best = scoredRoutes[0];
  const others = scoredRoutes.slice(1);
  const prefLabel = {
    fastest: 'speed',
    shortest: 'distance',
    cheapest: 'cost efficiency',
    scenic: 'scenic value',
    avoid_tolls: 'toll avoidance',
    avoid_highways: 'highway avoidance',
  };

  let summary = `🏆 ${best.summary || 'Route ' + (best.index + 1)} selected as the best route, optimized for ${prefLabel[preference] || preference}. `;

  // Compare with runner-up
  if (others.length > 0) {
    const second = others[0];
    const timeDiff = Math.round(Math.abs(best.adjustedDuration - second.adjustedDuration) / 60);
    const distDiff = Math.round(Math.abs(best.distance - second.distance) / 1000);
    const costDiff = Math.abs(best.estimatedCost - second.estimatedCost);

    if (timeDiff > 0) summary += `It is ${timeDiff} min ${best.adjustedDuration < second.adjustedDuration ? 'faster' : 'slower'} than ${second.summary || 'Route ' + (second.index + 1)}. `;
    if (distDiff > 0) summary += `Distance difference: ${distDiff} km. `;
    if (costDiff > 0) summary += `Cost difference: ₹${Math.round(costDiff)}. `;
  }

  // Traffic context
  if (trafficMult > 1.3) summary += `⚠️ Heavy traffic expected — times adjusted by ${Math.round((trafficMult - 1) * 100)}%. `;
  else if (trafficMult < 0.9) summary += `🌙 Light night traffic — faster travel expected. `;

  // Weather context
  if (weather.condition && weather.condition !== 'Clear') {
    summary += `🌧️ Weather: ${weather.condition} (${weather.temperature || '?'}°C) — route times adjusted. `;
  }

  const factors = [
    {
      factor: 'Travel Time',
      impact: best.scoreBreakdown.time.weight > 0.3 ? 'high' : 'medium',
      detail: `${Math.round(best.adjustedDuration / 60)} min (adjusted for traffic)`
    },
    {
      factor: 'Distance',
      impact: best.scoreBreakdown.distance.weight > 0.15 ? 'high' : 'low',
      detail: `${(best.distance / 1000).toFixed(1)} km`
    },
    {
      factor: 'Estimated Cost',
      impact: best.scoreBreakdown.cost.weight > 0.3 ? 'high' : 'low',
      detail: `₹${best.estimatedCost}`
    },
    {
      factor: 'Traffic',
      impact: trafficMult > 1.3 ? 'high' : 'low',
      detail: `${best.trafficLevel} traffic (${trafficMult}x multiplier)`
    },
    {
      factor: 'Road Type',
      impact: best.scoreBreakdown.roadType.weight > 0.2 ? 'high' : 'low',
      detail: `${best.roadTypes?.highway || 0}% highway, ${best.roadTypes?.urban || 0}% urban`
    }
  ];

  return { summary, factors };
}

export default { scoreRoutes };
