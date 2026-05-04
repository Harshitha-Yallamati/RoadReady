// ============================================================
// Traffic Simulator — Spatial Zone-Based Traffic Engine
// ============================================================
// Simulates real-time traffic by defining congestion zones
// and calculating delay impact on route segments.
//
// This makes the AI scoring engine produce dynamic, realistic
// route recommendations that change over time — just like
// real traffic-aware routing.
// ============================================================

import { haversine } from '../services/orsService.js';

// ── Traffic Zone Templates ──
// These get dynamically adjusted with random congestion levels

const BASE_TRAFFIC_ZONES = [
  // City center zones (high congestion areas)
  { name: 'City Center Core', radiusKm: 3, baseDelay: 1.4, type: 'urban' },
  { name: 'Business District', radiusKm: 2, baseDelay: 1.3, type: 'commercial' },
  { name: 'Market Area', radiusKm: 1.5, baseDelay: 1.5, type: 'market' },
  // Highway zones (usually clear, occasional congestion)
  { name: 'Highway Junction', radiusKm: 1, baseDelay: 1.15, type: 'highway' },
  { name: 'Toll Plaza', radiusKm: 0.5, baseDelay: 1.25, type: 'toll' },
  // Suburban zones
  { name: 'Residential Area', radiusKm: 2, baseDelay: 1.1, type: 'residential' },
];

// ── Dynamic State ──
let activeTrafficZones = [];
let lastUpdate = 0;
const UPDATE_INTERVAL = 30000; // Refresh every 30 seconds

/**
 * Generate traffic zones around a route's bounding box
 * Zones are placed dynamically based on the actual route area
 */
function generateZonesForArea(sourceLat, sourceLon, destLat, destLon) {
  const centerLat = (sourceLat + destLat) / 2;
  const centerLon = (sourceLon + destLon) / 2;
  const routeDistKm = haversine(sourceLat, sourceLon, destLat, destLon) / 1000;

  // Scale zone count based on route distance
  const zoneCount = Math.min(8, Math.max(3, Math.floor(routeDistKm / 5)));

  const zones = [];
  for (let i = 0; i < zoneCount; i++) {
    const template = BASE_TRAFFIC_ZONES[i % BASE_TRAFFIC_ZONES.length];

    // Place zone at a random point along the route corridor
    const t = (i + 0.5) / zoneCount; // Spread evenly along route
    const jitterLat = (Math.random() - 0.5) * 0.02; // Small random offset
    const jitterLon = (Math.random() - 0.5) * 0.02;

    const zoneLat = sourceLat + (destLat - sourceLat) * t + jitterLat;
    const zoneLon = sourceLon + (destLon - sourceLon) * t + jitterLon;

    // Dynamic congestion level (changes each refresh)
    const congestionVariance = 0.8 + Math.random() * 0.5; // 0.8x to 1.3x of base
    const currentDelay = Math.round((template.baseDelay * congestionVariance) * 100) / 100;

    // Congestion label
    let level = 'light';
    if (currentDelay > 1.4) level = 'heavy';
    else if (currentDelay > 1.2) level = 'moderate';

    zones.push({
      id: `zone_${i}`,
      name: `${template.name} #${i + 1}`,
      lat: Math.round(zoneLat * 10000) / 10000,
      lon: Math.round(zoneLon * 10000) / 10000,
      radiusKm: template.radiusKm * (0.8 + Math.random() * 0.4),
      delayMultiplier: currentDelay,
      congestionLevel: level,
      type: template.type,
      // For map visualization
      color: level === 'heavy' ? '#ef4444' : level === 'moderate' ? '#f59e0b' : '#22c55e',
      opacity: level === 'heavy' ? 0.4 : level === 'moderate' ? 0.3 : 0.15,
    });
  }

  return zones;
}

/**
 * Get or refresh traffic zones for a given area
 */
export function getTrafficZones(sourceLat, sourceLon, destLat, destLon) {
  const now = Date.now();

  // Refresh zones periodically (simulates changing traffic)
  if (now - lastUpdate > UPDATE_INTERVAL || activeTrafficZones.length === 0) {
    activeTrafficZones = generateZonesForArea(sourceLat, sourceLon, destLat, destLon);
    lastUpdate = now;
    console.log(`   🚦 Traffic zones refreshed: ${activeTrafficZones.length} zones`);
  }

  return activeTrafficZones;
}

/**
 * Force regenerate traffic (for dynamic refresh endpoint)
 */
export function refreshTraffic(sourceLat, sourceLon, destLat, destLon) {
  lastUpdate = 0; // Force regeneration
  return getTrafficZones(sourceLat, sourceLon, destLat, destLon);
}

/**
 * Calculate traffic delay for a route based on how much it
 * passes through congestion zones
 *
 * @param {Array} coordinates - Route coordinates [[lon, lat], ...]
 * @param {Array} zones - Traffic zones to check against
 * @returns {Object} { totalDelay, affectedZones, adjustedDuration }
 */
export function calculateRouteTrafficDelay(coordinates, zones, baseDuration) {
  if (!coordinates || coordinates.length === 0 || !zones || zones.length === 0) {
    return {
      totalDelaySeconds: 0,
      delayMultiplier: 1.0,
      adjustedDuration: baseDuration,
      affectedZones: [],
    };
  }

  let totalWeightedDelay = 0;
  let totalSegments = 0;
  const affectedZoneIds = new Set();

  // Sample route coordinates (every 5th point for performance)
  const sampleRate = Math.max(1, Math.floor(coordinates.length / 50));

  for (let i = 0; i < coordinates.length; i += sampleRate) {
    const [lon, lat] = coordinates[i];
    totalSegments++;

    for (const zone of zones) {
      const distToZone = haversine(lat, lon, zone.lat, zone.lon) / 1000; // km

      if (distToZone <= zone.radiusKm) {
        // Inside zone — apply full delay
        totalWeightedDelay += zone.delayMultiplier - 1.0;
        affectedZoneIds.add(zone.id);
      } else if (distToZone <= zone.radiusKm * 1.5) {
        // Near zone edge — apply partial delay (linear falloff)
        const falloff = 1 - (distToZone - zone.radiusKm) / (zone.radiusKm * 0.5);
        totalWeightedDelay += (zone.delayMultiplier - 1.0) * falloff;
        affectedZoneIds.add(zone.id);
      }
    }
  }

  // Average delay across sampled points
  const avgDelay = totalSegments > 0 ? totalWeightedDelay / totalSegments : 0;
  const routeDelayMultiplier = Math.round((1.0 + avgDelay) * 100) / 100;
  const delaySeconds = Math.round(baseDuration * avgDelay);

  const affectedZones = zones.filter(z => affectedZoneIds.has(z.id)).map(z => ({
    name: z.name,
    congestionLevel: z.congestionLevel,
    delayMultiplier: z.delayMultiplier,
  }));

  return {
    totalDelaySeconds: delaySeconds,
    delayMultiplier: routeDelayMultiplier,
    adjustedDuration: Math.round(baseDuration * routeDelayMultiplier),
    affectedZones,
    affectedZoneCount: affectedZones.length,
  };
}

/**
 * Apply traffic analysis to an array of routes
 * Attaches trafficDelay data to each route for AI scoring
 */
export function analyzeRoutesTraffic(routes, sourceLat, sourceLon, destLat, destLon) {
  const zones = getTrafficZones(sourceLat, sourceLon, destLat, destLon);

  return routes.map(route => {
    const coords = route.geometry?.coordinates || [];
    const trafficAnalysis = calculateRouteTrafficDelay(coords, zones, route.duration);

    return {
      ...route,
      trafficDelay: trafficAnalysis.totalDelaySeconds,
      trafficMultiplier: trafficAnalysis.delayMultiplier,
      adjustedDuration: trafficAnalysis.adjustedDuration,
      trafficLevel: trafficAnalysis.delayMultiplier > 1.3 ? 'heavy'
        : trafficAnalysis.delayMultiplier > 1.15 ? 'moderate' : 'light',
      affectedZones: trafficAnalysis.affectedZones,
    };
  });
}

export default {
  getTrafficZones,
  refreshTraffic,
  calculateRouteTrafficDelay,
  analyzeRoutesTraffic,
};
