// ============================================================
// Routing Service — OpenRouteService API (Real Data)
// ============================================================
// PRIMARY: OpenRouteService (requires API key, supports preferences)
// FALLBACK: OSRM (free, no key, used when ORS quota exhausted)
// ============================================================

import axios from 'axios';

const ORS_BASE = 'https://api.openrouteservice.org/v2';
const OSRM_BASE = 'https://router.project-osrm.org';
// Read at call time (not module load time) because dotenv loads AFTER ES module imports
function getOrsKey() { return process.env.ORS_API_KEY || ''; }

// ── Utility ──

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Turn-by-turn instruction formatter ──

function formatORSInstruction(step) {
  const type = step.type || 0;
  const instruction = step.instruction || '';

  // ORS provides human instructions directly
  if (instruction) return instruction;

  // Fallback icon mapping by ORS step type
  const typeMap = {
    0: '↰ Turn left',
    1: '↱ Turn right',
    2: '↰ Sharp left',
    3: '↱ Sharp right',
    4: '↰ Slight left',
    5: '↱ Slight right',
    6: '➡ Continue straight',
    7: '🔄 Enter roundabout',
    8: '🔄 Exit roundabout',
    9: '↩ U-turn',
    10: '🏁 Arrive at destination',
    11: '🚗 Depart',
    12: '↰ Keep left',
    13: '↱ Keep right',
  };
  return typeMap[type] || '➡ Continue';
}

function formatOSRMInstruction(step) {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const name = step.name || step.ref || 'the road';

  const dirMap = {
    'turn-left': '↰ Turn left',
    'turn-right': '↱ Turn right',
    'turn-sharp left': '↰ Sharp left',
    'turn-sharp right': '↱ Sharp right',
    'turn-slight left': '↰ Slight left',
    'turn-slight right': '↱ Slight right',
    'depart-': '🚗 Start',
    'arrive-': '🏁 Arrive',
    'merge-': '⤵ Merge',
    'fork-left': '↰ Keep left at fork',
    'fork-right': '↱ Keep right at fork',
    'roundabout-': '🔄 Roundabout',
    'new name-': '➡ Continue',
    'continue-': '➡ Continue',
  };

  const key = `${type}-${modifier}`;
  const prefix = dirMap[key] || dirMap[`${type}-`] || '➡ Continue';

  if (type === 'depart') return `🚗 Head ${modifier || 'forward'} on ${name}`;
  if (type === 'arrive') return `🏁 Arrive at destination`;
  return `${prefix} onto ${name}`;
}

// ── Map user preference to ORS avoid_features ──

function getAvoidFeatures(preference) {
  switch (preference) {
    case 'avoid_tolls':
      return ['tollways'];
    case 'avoid_highways':
      return ['highways'];
    case 'avoid_both':
      return ['tollways', 'highways'];
    case 'scenic':
      return ['highways']; // Scenic = avoid highways
    default:
      return [];
  }
}

// ============================================================
// PRIMARY: OpenRouteService API
// ============================================================

/**
 * Fetch routes from OpenRouteService with full turn-by-turn + preferences
 */
async function getRoutesORS(sourceLat, sourceLon, destLat, destLon, preference = 'fastest') {
  const avoidFeatures = getAvoidFeatures(preference);

  const body = {
    coordinates: [
      [sourceLon, sourceLat],
      [destLon, destLat],
    ],
    instructions: true,
    geometry: true,
    alternative_routes: {
      share_factor: 0.6,
      target_count: 3,
      weight_factor: 1.6,
    },
    units: 'm',
    language: 'en',
    instructions_format: 'text',
  };

  // Add avoid features if the preference requires it
  if (avoidFeatures.length > 0) {
    body.options = {
      avoid_features: avoidFeatures,
    };
  }

  // Choose optimization metric
  body.preference = preference === 'shortest' ? 'shortest' : 'fastest';

  const response = await axios.post(`${ORS_BASE}/directions/driving-car/json`, body, {
    headers: {
      'Authorization': getOrsKey(),
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  if (!response.data?.routes?.length) {
    throw new Error('ORS: No routes found');
  }

  // Decode geometry once for ORS maneuver location lookup
  const allDecodedCoords = {};

  return response.data.routes.map((route, idx) => {
    const distance = Math.round(route.summary.distance);
    const duration = Math.round(route.summary.duration);
    const fuelCost = Math.round((distance / 1000) * 6.5);
    const avgSpeed = duration > 0 ? (distance / duration) * 3.6 : 0;
    const tollCost = (avgSpeed > 60 && !avoidFeatures.includes('tollways'))
      ? Math.round(distance / 1000 * 1.2)
      : 0;

    // Decode polyline for maneuver location extraction
    const decodedCoords = route.geometry ? decodePolyline(route.geometry) : [];

    // Full turn-by-turn directions
    const directions = [];
    let cumDist = 0;
    let cumTime = 0;

    for (const segment of (route.segments || [])) {
      for (const step of (segment.steps || [])) {
        cumDist += step.distance;
        cumTime += step.duration;

        // ORS provides way_points indices that map into the decoded polyline
        const wpIdx = step.way_points?.[0];
        let maneuverLocation = null;
        if (wpIdx != null && decodedCoords[wpIdx]) {
          maneuverLocation = decodedCoords[wpIdx]; // [lon, lat]
        }

        directions.push({
          instruction: step.instruction || formatORSInstruction(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          cumulativeDistance: Math.round(cumDist),
          cumulativeTime: Math.round(cumTime),
          remainingDistance: Math.round(distance - cumDist),
          remainingTime: Math.round(duration - cumTime),
          name: step.name || '',
          type: step.type || 0,
          maneuverLocation,
        });
      }
    }

    // Road type analysis from segments
    let highwayDist = 0, urbanDist = 0, ruralDist = 0;
    for (const segment of (route.segments || [])) {
      for (const step of (segment.steps || [])) {
        // Estimate road type from average speed of segment
        const segSpeed = step.duration > 0 ? (step.distance / step.duration) * 3.6 : 0;
        if (segSpeed > 70) highwayDist += step.distance;
        else if (segSpeed > 30) urbanDist += step.distance;
        else ruralDist += step.distance;
      }
    }
    const totalRoad = highwayDist + urbanDist + ruralDist || 1;

    // Convert ORS geometry to GeoJSON format (same as OSRM output)
    const geometry = route.geometry
      ? { type: 'LineString', coordinates: decodePolyline(route.geometry) }
      : null;

    return {
      index: idx,
      distance,
      duration,
      estimatedCost: fuelCost + tollCost,
      summary: route.segments?.[0]?.steps?.[0]?.name
        ? `via ${route.segments[0].steps[0].name}`
        : `Route ${idx + 1}`,
      geometry,
      directions,
      roadTypes: {
        highway: Math.round((highwayDist / totalRoad) * 100),
        urban: Math.round((urbanDist / totalRoad) * 100),
        rural: Math.round((ruralDist / totalRoad) * 100),
      },
      tollCost,
      hasTolls: tollCost > 0,
      avoidedFeatures: avoidFeatures,
      dataSource: 'OpenRouteService',
    };
  });
}

/**
 * Decode ORS encoded polyline to coordinates array
 * ORS uses Google Encoded Polyline with precision 5
 */
function decodePolyline(encoded) {
  const coordinates = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push([lng / 1e5, lat / 1e5]); // [lon, lat] for GeoJSON
  }

  return coordinates;
}

// ============================================================
// FALLBACK: OSRM (Free, No Key Required)
// ============================================================

async function getRoutesOSRM(sourceLat, sourceLon, destLat, destLon) {
  const url = `${OSRM_BASE}/route/v1/driving/${sourceLon},${sourceLat};${destLon},${destLat}`;

  const response = await axios.get(url, {
    params: { overview: 'full', geometries: 'geojson', alternatives: 'true', steps: 'true', annotations: 'duration,distance,speed' },
    timeout: 10000,
  });

  if (response.data.code !== 'Ok') throw new Error('OSRM: ' + (response.data.message || 'No routes'));

  return response.data.routes.map((route, idx) => {
    const distance = Math.round(route.distance);
    const duration = Math.round(route.duration);
    const fuelCost = Math.round((distance / 1000) * 6.5);
    const avgSpeed = (distance / duration) * 3.6;
    const tollCost = avgSpeed > 60 ? Math.round(distance / 1000 * 1.2) : 0;

    const directions = [];
    let cumDist = 0, cumTime = 0;
    for (const leg of route.legs) {
      for (const step of (leg.steps || [])) {
        if (step.distance < 5 && step.maneuver?.type !== 'depart' && step.maneuver?.type !== 'arrive') continue;
        cumDist += step.distance;
        cumTime += step.duration;
        directions.push({
          instruction: formatOSRMInstruction(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          cumulativeDistance: Math.round(cumDist),
          cumulativeTime: Math.round(cumTime),
          remainingDistance: Math.round(distance - cumDist),
          remainingTime: Math.round(duration - cumTime),
          name: step.name || '',
          type: step.maneuver?.type || 'continue',
          modifier: step.maneuver?.modifier || '',
          maneuverLocation: step.maneuver?.location || null, // [lon, lat]
        });
      }
    }

    let highwayDist = 0, urbanDist = 0, ruralDist = 0;
    for (const leg of route.legs) {
      for (const step of (leg.steps || [])) {
        const spd = step.distance > 0 ? (step.distance / step.duration) * 3.6 : 0;
        if (spd > 70) highwayDist += step.distance;
        else if (spd > 30) urbanDist += step.distance;
        else ruralDist += step.distance;
      }
    }
    const total = highwayDist + urbanDist + ruralDist || 1;

    return {
      index: idx,
      distance, duration,
      estimatedCost: fuelCost + tollCost,
      summary: route.legs?.[0]?.summary || `Route ${idx + 1}`,
      geometry: route.geometry,
      directions,
      roadTypes: {
        highway: Math.round((highwayDist / total) * 100),
        urban: Math.round((urbanDist / total) * 100),
        rural: Math.round((ruralDist / total) * 100),
      },
      tollCost, hasTolls: tollCost > 0,
      avoidedFeatures: [],
      dataSource: 'OSRM (fallback)',
    };
  });
}

// ============================================================
// PUBLIC API — Auto-selects ORS or OSRM
// ============================================================

/**
 * Fetch REAL routes — ORS primary, OSRM fallback
 * @param {number} sourceLat
 * @param {number} sourceLon
 * @param {number} destLat
 * @param {number} destLon
 * @param {string} preference - 'fastest', 'shortest', 'avoid_tolls', 'avoid_highways', 'scenic', etc.
 * @returns {Array} route objects
 */
export async function getRoutes(sourceLat, sourceLon, destLat, destLon, preference = 'fastest') {
  // Try ORS first (has preferences support)
  if (getOrsKey()) {
    try {
      const routes = await getRoutesORS(sourceLat, sourceLon, destLat, destLon, preference);
      console.log(`   ✅ OpenRouteService: ${routes.length} routes fetched`);
      return routes;
    } catch (err) {
      console.warn(`   ⚠️ ORS failed (${err.response?.status || err.message}), falling back to OSRM`);
    }
  }

  // Fallback to OSRM (no preferences, but always available)
  console.log(`   🔄 Using OSRM fallback (no preferences support)`);
  return getRoutesOSRM(sourceLat, sourceLon, destLat, destLon);
}

/**
 * Get route between two specific points (for matrix building)
 */
export async function getRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await axios.get(url, { timeout: 8000 });
    if (res.data.code === 'Ok' && res.data.routes?.[0]) {
      return { distance: Math.round(res.data.routes[0].distance), duration: Math.round(res.data.routes[0].duration) };
    }
  } catch {}
  return null;
}

/**
 * Get distance matrix — ORS primary, OSRM fallback
 */
export async function getDistanceMatrix(points) {
  // Try ORS Matrix API first
  if (getOrsKey()) {
    try {
      const body = {
        locations: points.map(p => [p.lon, p.lat]),
        metrics: ['distance', 'duration'],
        units: 'm',
      };

      const res = await axios.post(`${ORS_BASE}/matrix/driving-car/json`, body, {
        headers: {
          'Authorization': getOrsKey(),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      if (res.data?.distances && res.data?.durations) {
        console.log(`   ✅ ORS Matrix: ${points.length}x${points.length}`);
        return { distances: res.data.distances, durations: res.data.durations };
      }
    } catch (err) {
      console.warn(`   ⚠️ ORS Matrix failed (${err.response?.status || err.message}), falling back to OSRM`);
    }
  }

  // Fallback: OSRM Table API
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=distance,duration`;
  const res = await axios.get(url, { timeout: 15000 });
  if (res.data.code === 'Ok') {
    return { distances: res.data.distances, durations: res.data.durations };
  }
  throw new Error('Failed to get distance matrix');
}

/**
 * Get optimized trip using OSRM Trip API
 */
export async function getOptimizedTrip(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`;

  const res = await axios.get(url, { timeout: 15000 });
  if (res.data.code === 'Ok' && res.data.trips?.[0]) {
    const trip = res.data.trips[0];
    const directions = [];
    let legIdx = 0;
    for (const leg of trip.legs) {
      for (const step of (leg.steps || [])) {
        if (step.distance < 5 && step.maneuver?.type !== 'depart' && step.maneuver?.type !== 'arrive') continue;
        directions.push({
          instruction: formatOSRMInstruction(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          name: step.name || '',
          type: step.maneuver?.type || '',
          modifier: step.maneuver?.modifier || '',
          maneuverLocation: step.maneuver?.location || null, // [lon, lat]
          legIndex: legIdx,
        });
      }
      legIdx++;
    }

    return {
      geometry: trip.geometry,
      distance: Math.round(trip.distance),
      duration: Math.round(trip.duration),
      directions,
      waypoints: res.data.waypoints.map((wp, i) => ({
        waypointIndex: wp.waypoint_index,
        name: wp.name || points[i]?.name || `Stop ${i + 1}`,
        lat: wp.location[1], lon: wp.location[0],
        originalIndex: i,
      })),
      legs: trip.legs.map((leg, i) => ({
        distance: Math.round(leg.distance),
        duration: Math.round(leg.duration),
        summary: leg.summary || '',
      })),
    };
  }
  return null;
}
