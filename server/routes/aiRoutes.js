import { Router } from 'express';
import { searchWithSerpApi } from '../services/serpService.js';
import { getNearbyMapillaryImages, getRouteMapillaryImages } from '../services/mapillaryService.js';
import { reverseGeocode } from '../services/geocodeService.js';
import auth from '../middleware/auth.js';
import { getAIChatHistory, saveAIChatMessage } from '../services/aiChatHistoryService.js';
import {
  summarizeSearchResults,
  generateChatReply,
  generateIntelligentAnalysis,
  testGeminiConnection,
} from '../services/geminiService.js';

const router = Router();
const ROUTE_IMAGE_EVENTS = new Set(['route_selected', 'navigation_started']);

function getRouteCoordinates(context = {}) {
  const coordinates = context?.currentRoute?.geometry?.coordinates;
  return Array.isArray(coordinates) ? coordinates : [];
}

async function getContextualImages({ lat, lon, context = {}, limit = 6 }) {
  const routeCoordinates = getRouteCoordinates(context);

  if (routeCoordinates.length > 1) {
    return getRouteMapillaryImages({ coordinates: routeCoordinates, limit });
  }

  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return {
      images: [],
      source: 'fallback',
      fallback: true,
      error: 'lat and lon are required when route coordinates are unavailable',
    };
  }

  return getNearbyMapillaryImages({ lat: parsedLat, lon: parsedLon, limit });
}

// â”€â”€â”€ Gemini API test â”€â”€â”€
router.post('/ai/test', async (req, res) => {
  const result = await testGeminiConnection();
  if (!result.success) {
    return res.status(result.status || 500).json(result);
  }
  return res.json(result);
});

// ─── Existing: Web Search ───
router.post('/search', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const location = req.body?.location ? String(req.body.location).trim() : null;

    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters',
      });
    }

    const search = await searchWithSerpApi(query, { location, num: 6 });
    const summary = await summarizeSearchResults({
      query,
      results: search.results,
    });

    return res.json({
      success: true,
      query,
      summary,
      answerBox: search.answerBox || null,
      results: search.results || [],
      source: search.source || 'fallback',
      fallback: Boolean(search.fallback),
      error: search.error || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Search request failed',
    });
  }
});

// ─── Existing: Nearby Images ───
router.get('/images', async (req, res) => {
  try {
    const lat = Number(req.query?.lat);
    const lon = Number(req.query?.lon);
    const limit = Number(req.query?.limit) || 6;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,
        error: 'lat and lon query params are required',
      });
    }

    const [placeResult, imagesResult] = await Promise.allSettled([
      reverseGeocode(lat, lon),
      getNearbyMapillaryImages({ lat, lon, limit }),
    ]);

    const place = placeResult.status === 'fulfilled'
      ? placeResult.value
      : { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };

    const imagesPayload = imagesResult.status === 'fulfilled'
      ? imagesResult.value
      : {
          images: [],
          source: 'fallback',
          fallback: true,
          error: imagesResult.reason?.message || 'Mapillary request failed',
        };

    return res.json({
      success: true,
      place,
      images: imagesPayload.images || [],
      source: imagesPayload.source || 'fallback',
      fallback: Boolean(imagesPayload.fallback),
      error: imagesPayload.error || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Images request failed',
    });
  }
});

router.post('/images/route', async (req, res) => {
  try {
    const coordinates = Array.isArray(req.body?.coordinates) ? req.body.coordinates : [];
    const limit = Number(req.body?.limit) || 6;

    if (coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 route coordinates are required',
      });
    }

    const imagesPayload = await getRouteMapillaryImages({ coordinates, limit });

    return res.json({
      success: true,
      images: imagesPayload.images || [],
      sampledCoordinates: imagesPayload.sampledCoordinates || [],
      source: imagesPayload.source || 'fallback',
      fallback: Boolean(imagesPayload.fallback),
      error: imagesPayload.error || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Route images request failed',
    });
  }
});

// ─── Existing: Chat ───
router.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const context = req.body?.context && typeof req.body.context === 'object'
      ? req.body.context
      : {};

    if (message.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'message is required',
      });
    }

    // Auto-detect intent for visuals and fetch them
    const wantsVisuals = /visual|picture|image|photo|street view|show me/i.test(message);
    let images = [];
    
    // We do image fetch first, and then AI reply generation sequentially
    let processedMessage = message;

    const visualTarget = context.destination?.lat && context.destination?.lon
      ? context.destination
      : context.source;
    const routeCoordinates = getRouteCoordinates(context);

    if (wantsVisuals && ((visualTarget?.lat && visualTarget?.lon) || routeCoordinates.length > 1)) {
      try {
        const imagesResult = await getContextualImages({
          lat: Number(visualTarget?.lat),
          lon: Number(visualTarget?.lon),
          context,
          limit: 4,
        });

        if (imagesResult && imagesResult.images && imagesResult.images.length > 0) {
          images = imagesResult.images;
          processedMessage += ' [System note: Images were successfully fetched and are being displayed to the user right now. Respond acknowledging that you are showing the images.]';
        } else {
          processedMessage += ' [System note: I tried to fetch images for this location but there is no imagery coverage available. Please inform the user politely and focus on navigation assistance.]';
        }
      } catch (err) {
        processedMessage += ' [System note: I tried to fetch images but encountered an error.]';
      }
    }

    const reply = await generateChatReply({ message: processedMessage, context });

    return res.json({
      success: true,
      reply,
      images,
      hasImages: images.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Chat request failed',
    });
  }
});

// ─── NEW: Intelligent AI Analysis ───
// Single endpoint that takes full navigation context and returns rich AI response
router.post('/ai/analyze', async (req, res) => {
  try {
    const context = req.body || {};
    const analysis = await generateIntelligentAnalysis(context);

    return res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'AI analysis failed',
    });
  }
});

// ─── NEW: Navigation Event Handler ───
// Handles system events and returns AI analysis + auto-fetched images in one response
router.post('/ai/navigation-event', async (req, res) => {
  try {
    const { event, lat, lon, ...context } = req.body || {};
    const eventType = String(event || 'general').trim();

    // Run AI analysis and image fetch in parallel
    const tasks = [generateIntelligentAnalysis({ event: eventType, ...context })];

    // Auto-fetch nearby images for location-relevant events
    const shouldFetchImages = ROUTE_IMAGE_EVENTS.has(eventType);
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLon);
    const routeCoordinates = getRouteCoordinates(context);

    if (shouldFetchImages && (hasCoords || routeCoordinates.length > 1)) {
      tasks.push(getContextualImages({ lat: parsedLat, lon: parsedLon, context, limit: 4 }));
    } else {
      tasks.push(Promise.resolve(null));
    }

    const [analysis, imagesResult] = await Promise.all(tasks);

    const images = imagesResult?.images || [];

    return res.json({
      success: true,
      event: eventType,
      analysis,
      images,
      hasImages: images.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Navigation event processing failed',
    });
  }
});

router.post('/ai/save-message', auth, async (req, res) => {
  try {
    const savedMessage = await saveAIChatMessage(req.user._id, req.body || {});
    return res.status(201).json({
      success: true,
      message: savedMessage,
    });
  } catch (err) {
    const status = err.message === 'Message content is required' ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Could not save AI message',
    });
  }
});

router.get('/ai/get-history', auth, async (req, res) => {
  try {
    const messages = await getAIChatHistory(req.user._id);
    return res.json({
      success: true,
      messages,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Could not load AI history',
    });
  }
});

export default router;
