import { Router } from 'express';
import {
  listRecentTraffic,
  buildTrafficZones,
  persistTrafficSnapshots,
} from '../services/trafficPersistenceService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query?.limit) || 120;
    const maxAgeMinutes = Number(req.query?.maxAgeMinutes) || 120;
    const records = await listRecentTraffic({ limit, maxAgeMinutes });
    const zones = buildTrafficZones(records, 40);

    return res.json({
      success: true,
      count: records.length,
      records,
      zones,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch traffic data',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const points = Array.isArray(req.body?.points) ? req.body.points : [];
    const result = await persistTrafficSnapshots(points, {
      level: req.body?.level,
      score: req.body?.score,
      source: req.body?.source,
      routeId: req.body?.routeId,
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to store traffic data',
    });
  }
});

export default router;
