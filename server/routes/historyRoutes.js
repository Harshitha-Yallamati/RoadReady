import { Router } from 'express';
import auth from '../middleware/auth.js';
import RouteHistory from '../models/RouteHistory.js';

const router = Router();

router.use(auth);

router.post('/', async (req, res, next) => {
  try {
    const entry = await RouteHistory.create({
      ...req.body,
      userId: req.user._id,
    });

    return res.status(201).json({ success: true, id: entry._id });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const history = await RouteHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, history });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [totalSearches, breakdown] = await Promise.all([
      RouteHistory.countDocuments({ userId: req.user._id }),
      RouteHistory.aggregate([
        { $match: { userId: req.user._id } },
        { $group: { _id: '$preference', count: { $sum: 1 } } },
      ]),
    ]);

    const preferenceBreakdown = {};
    breakdown.forEach((entry) => {
      preferenceBreakdown[entry._id || 'unknown'] = entry.count;
    });

    return res.json({ success: true, totalSearches, preferenceBreakdown });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await RouteHistory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
