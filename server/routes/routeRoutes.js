// ============================================================
// Route API Endpoints
// ============================================================

import { Router } from 'express';
import { optimizeRoute } from '../ai/routeOptimizer.js';
import { optimizeMultiStop } from '../ai/multiStopOptimizer.js';
import { geocode, reverseGeocode } from '../services/geocodeService.js';
import { getTrafficZones, refreshTraffic } from '../ai/trafficSimulator.js';

const router = Router();

/**
 * POST /api/routes/optimize
 * Single route optimization (A → B) with preference support
 */
router.post('/optimize', async (req, res, next) => {
  try {
    const { source, destination, preference = 'fastest', departureTime, currentRouteIndex = null } = req.body;

    if (!source?.lat || !source?.lon || !destination?.lat || !destination?.lon) {
      return res.status(400).json({ success: false, error: 'Source and destination with lat/lon are required' });
    }

    const result = await optimizeRoute({ source, destination, preference, departureTime, currentRouteIndex });
    res.json(result);
  } catch (err) {
    console.error('Route optimize error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/routes/refresh
 * Dynamic route refresh — recalculates with updated traffic
 * Call this periodically (every 15-30 sec) for dynamic updates
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { source, destination, preference = 'fastest', departureTime, currentRouteIndex = null } = req.body;

    if (!source?.lat || !source?.lon || !destination?.lat || !destination?.lon) {
      return res.status(400).json({ success: false, error: 'Source and destination with lat/lon are required' });
    }

    const result = await optimizeRoute({
      source, destination, preference, departureTime, currentRouteIndex,
      isRefresh: true, // Forces traffic zone regeneration
    });
    res.json(result);
  } catch (err) {
    console.error('Route refresh error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/routes/traffic-zones
 * Returns current simulated traffic zones for map overlay
 */
router.get('/traffic-zones', async (req, res, next) => {
  try {
    const { sourceLat, sourceLon, destLat, destLon, refresh } = req.query;

    if (!sourceLat || !sourceLon || !destLat || !destLon) {
      return res.status(400).json({
        success: false,
        error: 'sourceLat, sourceLon, destLat, destLon query params required',
      });
    }

    const zones = refresh === 'true'
      ? refreshTraffic(parseFloat(sourceLat), parseFloat(sourceLon), parseFloat(destLat), parseFloat(destLon))
      : getTrafficZones(parseFloat(sourceLat), parseFloat(sourceLon), parseFloat(destLat), parseFloat(destLon));

    res.json({
      success: true,
      zones,
      count: zones.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Traffic zones error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/routes/multi-stop
 * Multi-stop delivery optimization (TSP)
 * This is the CORE FEATURE — what Google Maps can't do!
 */
router.post('/multi-stop', async (req, res, next) => {
  try {
    const { source, destination, stops = [] } = req.body;

    if (!source?.lat || !destination?.lat) {
      return res.status(400).json({ success: false, error: 'Source and destination required' });
    }
    if (stops.length === 0) {
      return res.status(400).json({ success: false, error: 'At least 1 delivery stop required' });
    }
    if (stops.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 stops allowed' });
    }

    const result = await optimizeMultiStop(source, destination, stops);
    res.json(result);
  } catch (err) {
    console.error('Multi-stop optimize error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/routes/geocode?q=
 */
router.get('/geocode', async (req, res, next) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ success: false, error: 'Query too short' });

    const results = await geocode(q, lat ? parseFloat(lat) : null, lon ? parseFloat(lon) : null);
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/routes/reverse-geocode?lat=&lon=
 */
router.get('/reverse-geocode', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon required' });
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

export default router;
