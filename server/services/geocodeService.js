// ============================================================
// Geocoding Service — Multi-Provider (Nominatim + Photon)
// ============================================================
// Uses OpenStreetMap Nominatim as primary + Komoot Photon as 
// fallback for fuzzy/partial matching. Both are FREE, no API key.
// Photon is especially good at handling partial/informal names
// like "mangalagiri barkas" that Nominatim may miss.
// ============================================================

import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const PHOTON_URL = 'https://photon.komoot.io/api';

const INDIA_COUNTRY_CODE = 'in';
const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 38,
  minLon: 68,
  maxLon: 98,
};
const LOCAL_FALLBACK_PLACES = [
  { name: 'Guntur, Andhra Pradesh, India', lat: 16.3067, lon: 80.4365, aliases: ['guntur'] },
  { name: 'Vijayawada, Andhra Pradesh, India', lat: 16.5062, lon: 80.648, aliases: ['vijayawada', 'vija', 'vijay'] },
  { name: 'Amaravati, Andhra Pradesh, India', lat: 16.5417, lon: 80.5167, aliases: ['amaravati'] },
  { name: 'Visakhapatnam, Andhra Pradesh, India', lat: 17.6868, lon: 83.2185, aliases: ['vizag', 'visakhapatnam'] },
  { name: 'Hyderabad, Telangana, India', lat: 17.385, lon: 78.4867, aliases: ['hyderabad', 'hyd'] },
  { name: 'Warangal, Telangana, India', lat: 17.9689, lon: 79.5941, aliases: ['warangal'] },
  { name: 'Bengaluru, Karnataka, India', lat: 12.9716, lon: 77.5946, aliases: ['bangalore', 'bengaluru'] },
  { name: 'Chennai, Tamil Nadu, India', lat: 13.0827, lon: 80.2707, aliases: ['chennai', 'chen'] },
  { name: 'Mumbai, Maharashtra, India', lat: 19.076, lon: 72.8777, aliases: ['mumbai', 'bombay'] },
  { name: 'Pune, Maharashtra, India', lat: 18.5204, lon: 73.8567, aliases: ['pune'] },
  { name: 'Delhi, India', lat: 28.6139, lon: 77.209, aliases: ['delhi', 'new delhi'] },
  { name: 'Kolkata, West Bengal, India', lat: 22.5726, lon: 88.3639, aliases: ['kolkata', 'calcutta'] },
  { name: 'Ahmedabad, Gujarat, India', lat: 23.0225, lon: 72.5714, aliases: ['ahmedabad'] },
  { name: 'Jaipur, Rajasthan, India', lat: 26.9124, lon: 75.7873, aliases: ['jaipur'] },
  { name: 'Lucknow, Uttar Pradesh, India', lat: 26.8467, lon: 80.9462, aliases: ['lucknow'] },
  { name: 'Patna, Bihar, India', lat: 25.5941, lon: 85.1376, aliases: ['patna'] },
  { name: 'Bhubaneswar, Odisha, India', lat: 20.2961, lon: 85.8245, aliases: ['bhubaneswar'] },
  { name: 'Kochi, Kerala, India', lat: 9.9312, lon: 76.2673, aliases: ['kochi', 'cochin'] },
  { name: 'Coimbatore, Tamil Nadu, India', lat: 11.0168, lon: 76.9558, aliases: ['coimbatore'] },
  { name: 'Mysuru, Karnataka, India', lat: 12.2958, lon: 76.6394, aliases: ['mysore', 'mysuru'] },
];

/**
 * Geocode a place name using Foursquare (best for POIs/businesses)
 * falls back to Nominatim (structured) + Photon (fuzzy)
 * @param {string} query - Place name to search
 * @param {number|null} lat - Optional context latitude
 * @param {number|null} lon - Optional context longitude
 * @returns {Array} - Array of { name, lat, lon }
 */
export async function geocode(query, lat = null, lon = null) {
  const localResults = geocodeLocalFallback(query, lat, lon);

  // If Foursquare key is available, attempt Foursquare first.
  const fsqApiKey = getFsqApiKey();
  if (fsqApiKey && fsqApiKey.length > 5 && !query.includes(',')) {
    try {
      const fsqResults = await geocodeFoursquare(query, lat, lon, fsqApiKey);
      const rankedFsq = rankGeocodeResults(query, [...localResults, ...fsqResults], lat, lon);
      if (rankedFsq.length > 0) return rankedFsq.slice(0, 8);
    } catch (err) {
      console.warn('Foursquare API failed or key invalid, falling back to OS/Photon:', err.message);
    }
  }

  // Fallback / Standard: Run both providers in parallel for speed
  const [nominatimResults, photonResults] = await Promise.allSettled([
    geocodeNominatim(query, lat, lon),
    geocodePhoton(query, lat, lon),
  ]);

  const nom = nominatimResults.status === 'fulfilled' ? nominatimResults.value : [];
  const phot = photonResults.status === 'fulfilled' ? photonResults.value : [];

  const primaryResults = rankGeocodeResults(query, [...localResults, ...nom, ...phot], lat, lon).slice(0, 8);
  if (primaryResults.length > 0) return primaryResults;

  // Offline-safe fallback for common places when external providers fail.
  if (localResults.length > 0) {
    console.warn(`Geocode fallback hit for query "${query}"`);
  }
  return localResults;
}

function getFsqApiKey() {
  return process.env.FSQ_API_KEY || '';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoords(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
}

function isWithinIndia(lat, lon) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  return Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= INDIA_BOUNDS.minLat &&
    parsedLat <= INDIA_BOUNDS.maxLat &&
    parsedLon >= INDIA_BOUNDS.minLon &&
    parsedLon <= INDIA_BOUNDS.maxLon;
}

function isIndianResult(result) {
  const countryCode = normalizeText(result.countryCode || result.countrycode);
  if (countryCode === INDIA_COUNTRY_CODE) return true;
  if (normalizeText(result.fullName || result.name).includes('india')) return true;
  return isWithinIndia(result.lat, result.lon);
}

function textMatchScore(query, result) {
  const q = normalizeText(query);
  const name = normalizeText(result.name);
  const fullName = normalizeText(result.fullName);
  const aliases = Array.isArray(result.aliases) ? result.aliases.map(normalizeText) : [];
  const terms = [name, fullName, ...aliases].filter(Boolean);

  if (!q) return 0;
  if (terms.some((term) => term === q)) return 190;
  if (aliases.some((alias) => alias === q)) return 185;
  if (terms.some((term) => term.startsWith(q))) return 120;
  if (terms.some((term) => term.split(/[\s,-]+/).some((part) => part.startsWith(q)))) return 85;
  if (terms.some((term) => term.includes(q))) return 50;
  return 0;
}

function typeScore(type = '') {
  const normalized = normalizeText(type);
  if (['city', 'town', 'municipality'].includes(normalized)) return 48;
  if (['administrative', 'village', 'suburb', 'locality'].includes(normalized)) return 24;
  if (['station', 'aerodrome', 'airport'].includes(normalized)) return 14;
  if (['restaurant', 'books', 'company', 'farmland', 'fixme', 'yes'].includes(normalized)) return -20;
  return 0;
}

function rankGeocodeResults(query, results, lat = null, lon = null) {
  const preferIndia = !hasCoords(lat, lon) || isWithinIndia(lat, lon);
  const ranked = [];

  for (const result of results) {
    if (!result || !hasCoords(result.lat, result.lon)) continue;

    const matchScore = textMatchScore(query, result);
    const indian = isIndianResult(result);
    const importance = Number(result.importance) || 0;
    let score = matchScore + typeScore(result.type) + Math.min(importance * 100, 60);

    if (result.type === 'local-fallback') score += 130;
    if (preferIndia && indian) score += 90;
    if (preferIndia && !indian) score -= 140;

    if (hasCoords(lat, lon)) {
      const distanceKm = haversineKm(Number(lat), Number(lon), Number(result.lat), Number(result.lon));
      score += Math.max(0, 45 - distanceKm / 12);
    }

    ranked.push({
      ...result,
      _rankScore: score,
    });
  }

  ranked.sort((a, b) => b._rankScore - a._rankScore);

  const seen = new Set();
  return ranked
    .filter((result) => {
      const key = `${Number(result.lat).toFixed(3)}_${Number(result.lon).toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ _rankScore, aliases, ...result }) => result);
}

function geocodeLocalFallback(query, lat = null, lon = null) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const ranked = LOCAL_FALLBACK_PLACES.map((place) => {
    const terms = [place.name, ...(place.aliases || [])].map(normalizeText);
    let score = 0;

    if (terms.some((t) => t === q)) score += 100;
    if (terms.some((t) => t.startsWith(q))) score += 60;
    if (terms.some((t) => t.includes(q))) score += 35;

    if (lat !== null && lon !== null) {
      const distanceKm = haversineKm(lat, lon, place.lat, place.lon);
      score += Math.max(0, 25 - distanceKm / 20);
    }

    return {
      ...place,
      score,
    };
  })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return ranked.map((p) => ({
    name: p.name.split(',').slice(0, 2).join(',').trim(),
    fullName: p.name,
    aliases: p.aliases || [],
    lat: p.lat,
    lon: p.lon,
    type: 'local-fallback',
    countryCode: INDIA_COUNTRY_CODE,
    importance: 0,
  }));
}

function nearestFallbackPlace(lat, lon, maxDistanceKm = 25) {
  let best = null;
  let bestDistance = Infinity;

  for (const place of LOCAL_FALLBACK_PLACES) {
    const d = haversineKm(lat, lon, place.lat, place.lon);
    if (d < bestDistance) {
      best = place;
      bestDistance = d;
    }
  }

  return bestDistance <= maxDistanceKm ? best : null;
}

/**
 * Foursquare Places API (Industry-standard POI search)
 */
async function geocodeFoursquare(query, lat, lon, apiKey) {
  try {
    const params = { query, limit: 8 };
    if (lat && lon) params.ll = `${lat},${lon}`;
    
    const res = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: { Authorization: apiKey, Accept: 'application/json' },
      params,
      timeout: 5000,
    });
    
    if (res.data?.results) {
      return res.data.results.map(p => ({
        name: p.name + (p.location?.address ? `, ${p.location.address}` : ''),
        fullName: `${p.name}, ${p.location?.formatted_address || ''}`,
        lat: p.geocodes?.main?.latitude,
        lon: p.geocodes?.main?.longitude,
        type: p.categories?.[0]?.name || 'Place',
        countryCode: p.location?.country || '',
        importance: 1, // High importance for explicit POI answers
      })).filter(p => p.lat && p.lon);
    }
    return [];
  } catch (err) {
    throw err;
  }
}

/**
 * Nominatim geocoder — best for structured addresses
 */
async function geocodeNominatim(query, lat, lon) {
  try {
    const params = {
      q: query,
      format: 'json',
      limit: 6,
      addressdetails: 1,
      'accept-language': 'en',
      countrycodes: INDIA_COUNTRY_CODE,
    };
    if (lat && lon) {
      params.viewbox = `${Number(lon) - 3},${Number(lat) + 3},${Number(lon) + 3},${Number(lat) - 3}`;
    }
    const res = await axios.get(`${NOMINATIM_URL}/search`, {
      params,
      headers: {
        'User-Agent': 'AISmartRouterPlanner/1.0',
      },
      timeout: 6000,
    });

    if (res.data && res.data.length > 0) {
      return res.data.map(item => ({
        name: formatDisplayName(item.display_name, item.address),
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        countryCode: item.address?.country_code || '',
        importance: item.importance || 0,
      }));
    }
    return [];
  } catch (err) {
    console.error('Nominatim geocode error:', err.message);
    return [];
  }
}

/**
 * Photon geocoder (by Komoot) — excellent at fuzzy/partial matching
 * This is what makes "mangalagiri barkas" or "bglr railway stn" work!
 */
async function geocodePhoton(query, lat, lon) {
  try {
    const params = { q: query, limit: 6, lang: 'en' };
    if (lat && lon) { params.lat = lat; params.lon = lon; }
    
    const res = await axios.get(PHOTON_URL, {
      params,
      headers: {
        'User-Agent': 'AISmartRouterPlanner/1.0',
      },
      timeout: 6000,
    });

    if (res.data?.features?.length > 0) {
      return res.data.features.map(f => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        
        // Build a rich display name from Photon's structured data
        const parts = [
          props.name,
          props.street,
          props.district || props.locality,
          props.city || props.county,
          props.state,
          props.country,
        ].filter(Boolean);

        // Remove duplicates in parts (e.g., "Hyderabad, Hyderabad, Telangana")
        const unique = [];
        for (const p of parts) {
          if (!unique.some(u => u.toLowerCase() === p.toLowerCase())) {
            unique.push(p);
          }
        }

        return {
          name: unique.slice(0, 4).join(', '),
          fullName: unique.join(', '),
          lat: coords[1],
          lon: coords[0],
          type: props.osm_value || props.type || '',
          countryCode: props.countrycode || '',
          importance: 0,
        };
      });
    }
    return [];
  } catch (err) {
    console.error('Photon geocode error:', err.message);
    return [];
  }
}

/**
 * Format display name smartly — show relevant parts, not raw Nominatim output
 */
function formatDisplayName(displayName, address = {}) {
  // Try to build a sensible name from address components
  const parts = [
    address.amenity || address.building || address.shop || address.tourism,
    address.road || address.pedestrian,
    address.suburb || address.neighbourhood || address.hamlet,
    address.city || address.town || address.village,
    address.state,
  ].filter(Boolean);

  if (parts.length >= 2) {
    // Remove duplicates
    const unique = [];
    for (const p of parts) {
      if (!unique.some(u => u.toLowerCase() === p.toLowerCase())) {
        unique.push(p);
      }
    }
    return unique.slice(0, 4).join(', ');
  }

  // Fallback: use display_name but limit to useful parts
  return displayName.split(',').slice(0, 4).join(', ').trim();
}

/**
 * Reverse geocode coordinates to place name
 */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: { lat, lon, format: 'json', addressdetails: 1, 'accept-language': 'en' },
      headers: { 'User-Agent': 'AISmartRouterPlanner/1.0' },
      timeout: 5000,
    });

    if (res.data && res.data.display_name) {
      return {
        name: formatDisplayName(res.data.display_name, res.data.address),
        lat, lon,
      };
    }
    const nearest = nearestFallbackPlace(lat, lon);
    if (nearest) return { name: nearest.name, lat, lon };
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    const nearest = nearestFallbackPlace(lat, lon);
    if (nearest) return { name: nearest.name, lat, lon };
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  }
}
