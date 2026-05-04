import { Router } from 'express';
import SavedPlace from '../models/SavedPlace.js';
import auth from '../middleware/auth.js';

const router = Router();

function normalizePlacePayload(payload = {}) {
  const lat = Number(payload.lat);
  const lon = Number(payload.lon ?? payload.lng);

  return {
    name: String(payload.name || '').trim(),
    address: String(payload.address || '').trim(),
    category: String(payload.category || 'favorite').trim().toLowerCase(),
    notes: String(payload.notes || '').trim(),
    lat,
    lon,
    lng: Number.isFinite(lon) ? lon : undefined,
  };
}

function validatePlacePayload(payload) {
  if (!payload.name) {
    return 'Place name is required';
  }
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
    return 'Valid latitude and longitude are required';
  }
  if (!['home', 'work', 'favorite', 'food', 'scenic', 'other'].includes(payload.category)) {
    return 'Category must be one of home, work, favorite, food, scenic, or other';
  }
  return null;
}

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const places = await SavedPlace.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, places });
  } catch (error) {
    console.error('[Saved Places] Fetch error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch saved places' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const place = await SavedPlace.findOne({ _id: req.params.id, userId: req.user._id });
    if (!place) {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }

    return res.json({ success: true, place });
  } catch (error) {
    console.error('[Saved Places] Get error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch saved place' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = normalizePlacePayload(req.body);
    const validationError = validatePlacePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const place = await SavedPlace.create({
      ...payload,
      userId: req.user._id,
    });

    return res.status(201).json({ success: true, place });
  } catch (error) {
    console.error('[Saved Places] Create error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to save place' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = normalizePlacePayload(req.body);
    const validationError = validatePlacePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const place = await SavedPlace.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      payload,
      { new: true, runValidators: true },
    );

    if (!place) {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }

    return res.json({ success: true, place });
  } catch (error) {
    console.error('[Saved Places] Update error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update place' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await SavedPlace.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }

    return res.json({ success: true, message: 'Place deleted' });
  } catch (error) {
    console.error('[Saved Places] Delete error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to delete place' });
  }
});

export default router;
