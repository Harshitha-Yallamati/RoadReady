import axios from 'axios';

const MAPILLARY_GRAPH_BASE = 'https://graph.mapillary.com';
const MAPILLARY_TIMEOUT_MS = 6000;
const DEFAULT_LIMIT = 6;
const DEFAULT_RADIUS_METERS = 250;
const DEFAULT_ROUTE_SAMPLE_COUNT = 4;

function normalizeImage(item) {
  const coordinates = item?.computed_geometry?.coordinates || item?.geometry?.coordinates || [];
  const lon = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  return {
    id: item?.id || '',
    capturedAt: item?.captured_at || null,
    thumbUrl: item?.thumb_1024_url || item?.thumb_2048_url || item?.thumb_256_url || '',
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

function normalizeImageList(data) {
  const rawList = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.features)
      ? data.features.map((feature) => ({
          id: feature?.properties?.id || feature?.id || '',
          captured_at: feature?.properties?.captured_at || null,
          computed_geometry: feature?.geometry || null,
          thumb_1024_url: feature?.properties?.thumb_1024_url || '',
          thumb_2048_url: feature?.properties?.thumb_2048_url || '',
          thumb_256_url: feature?.properties?.thumb_256_url || '',
        }))
      : [];

  return rawList
    .map(normalizeImage)
    .filter((image) => image.id && image.thumbUrl)
    .map((image) => ({
      ...image,
      url: image.thumbUrl,
    }));
}

function normalizeCoordinate(point) {
  if (Array.isArray(point) && point.length >= 2) {
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  if (point && typeof point === 'object') {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  return null;
}

function sampleRouteCoordinates(routeCoordinates = [], sampleCount = DEFAULT_ROUTE_SAMPLE_COUNT) {
  const normalized = routeCoordinates
    .map(normalizeCoordinate)
    .filter(Boolean);

  if (normalized.length <= sampleCount) {
    return normalized;
  }

  const sampled = [];
  const lastIndex = normalized.length - 1;

  for (let index = 0; index < sampleCount; index += 1) {
    const sourceIndex = Math.round((index / Math.max(sampleCount - 1, 1)) * lastIndex);
    sampled.push(normalized[sourceIndex]);
  }

  return sampled.filter((point, index, array) => (
    array.findIndex((candidate) => (
      candidate.lat.toFixed(5) === point.lat.toFixed(5)
      && candidate.lon.toFixed(5) === point.lon.toFixed(5)
    )) === index
  ));
}

function dedupeImages(images = []) {
  const seen = new Set();
  return images.filter((image) => {
    if (!image?.id || seen.has(image.id)) {
      return false;
    }
    seen.add(image.id);
    return true;
  });
}

async function fetchMapillaryByClosestPoint({ token, lat, lon, limit, radiusMeters = DEFAULT_RADIUS_METERS }) {
  const response = await axios.get(`${MAPILLARY_GRAPH_BASE}/images`, {
    params: {
      access_token: token,
      fields: 'id,captured_at,computed_geometry,thumb_1024_url',
      closeto: `${lon},${lat}`,
      radius: radiusMeters,
      limit,
    },
    timeout: MAPILLARY_TIMEOUT_MS,
  });
  return normalizeImageList(response.data);
}

function fallbackImageResponse(reason) {
  return {
    images: [],
    source: 'fallback',
    fallback: true,
    error: reason,
  };
}

export async function getNearbyMapillaryImages({ lat, lon, limit = DEFAULT_LIMIT } = {}) {
  const token = process.env.MAPILLARY_TOKEN;
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const parsedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 10));

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return fallbackImageResponse('Invalid lat/lon');
  }

  if (!token) {
    return fallbackImageResponse('MAPILLARY_TOKEN is not configured');
  }

  try {
    const images = await fetchMapillaryByClosestPoint({
      token,
      lat: parsedLat,
      lon: parsedLon,
      limit: parsedLimit,
    });

    return {
      images: images.slice(0, parsedLimit),
      source: 'mapillary',
      fallback: false,
    };
  } catch (err) {
    const reason = err?.response?.data?.error?.message || err?.message || 'Mapillary request failed';
    return fallbackImageResponse(reason);
  }
}

export async function getRouteMapillaryImages({
  coordinates = [],
  limit = DEFAULT_LIMIT,
  sampleCount = DEFAULT_ROUTE_SAMPLE_COUNT,
} = {}) {
  const token = process.env.MAPILLARY_TOKEN;
  const parsedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 12));

  if (!token) {
    return fallbackImageResponse('MAPILLARY_TOKEN is not configured');
  }

  const sampledCoordinates = sampleRouteCoordinates(coordinates, sampleCount);
  if (sampledCoordinates.length === 0) {
    return fallbackImageResponse('No route coordinates available');
  }

  try {
    const requests = sampledCoordinates.map((point) =>
      fetchMapillaryByClosestPoint({
        token,
        lat: point.lat,
        lon: point.lon,
        limit: Math.max(1, Math.ceil(parsedLimit / sampledCoordinates.length)),
      }),
    );

    const resultSets = await Promise.allSettled(requests);
    const failureReasons = resultSets
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message)
      .filter(Boolean);
    const images = dedupeImages(
      resultSets.flatMap((result) => (
        result.status === 'fulfilled' ? result.value : []
      )),
    );

    if (images.length === 0 && failureReasons.length === resultSets.length) {
      return fallbackImageResponse(failureReasons[0] || 'Mapillary request failed');
    }

    return {
      images: images.slice(0, parsedLimit),
      sampledCoordinates,
      source: 'mapillary',
      fallback: false,
      error: null,
    };
  } catch (err) {
    const reason = err?.response?.data?.error?.message || err?.message || 'Mapillary request failed';
    return fallbackImageResponse(reason);
  }
}

export default { getNearbyMapillaryImages, getRouteMapillaryImages };
