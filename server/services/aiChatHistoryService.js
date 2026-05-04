import AIChatHistory from '../models/AIChatHistory.js';

const MAX_HISTORY_MESSAGES = 200;

function normalizeImage(image = {}) {
  return {
    id: String(image.id || '').trim(),
    url: String(image.url || image.thumbUrl || '').trim(),
    thumbUrl: String(image.thumbUrl || image.url || '').trim(),
    lat: Number.isFinite(Number(image.lat)) ? Number(image.lat) : null,
    lon: Number.isFinite(Number(image.lon)) ? Number(image.lon) : null,
    capturedAt: image.capturedAt ? new Date(image.capturedAt) : null,
  };
}

function normalizeMessage(message = {}) {
  const content = String(message.content || message.text || '').trim();
  if (!content) {
    throw new Error('Message content is required');
  }

  const rawRole = String(message.role || 'assistant').trim().toLowerCase();
  const role = rawRole || 'assistant';

  return {
    role,
    content,
    type: String(message.type || 'text').trim() || 'text',
    eventKey: message.eventKey ? String(message.eventKey).trim() : null,
    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    images: Array.isArray(message.images)
      ? message.images.slice(0, 8).map(normalizeImage).filter((image) => image.url)
      : [],
    trafficLevel: message.trafficLevel ? String(message.trafficLevel).trim() : null,
    suggestion: message.suggestion || null,
  };
}

function serializeMessage(message = {}, fallbackIndex = 0) {
  return {
    id: message._id?.toString?.() || `chat-message-${fallbackIndex}`,
    role: message.role || 'assistant',
    content: message.content || '',
    text: message.content || '',
    type: message.type || 'text',
    eventKey: message.eventKey || null,
    timestamp: message.timestamp || null,
    images: Array.isArray(message.images)
      ? message.images.map((image) => ({
          id: image.id || '',
          url: image.url || image.thumbUrl || '',
          thumbUrl: image.thumbUrl || image.url || '',
          lat: Number.isFinite(Number(image.lat)) ? Number(image.lat) : null,
          lon: Number.isFinite(Number(image.lon)) ? Number(image.lon) : null,
          capturedAt: image.capturedAt || null,
        }))
      : [],
    trafficLevel: message.trafficLevel || null,
    suggestion: message.suggestion || null,
  };
}

export async function saveAIChatMessage(userId, message) {
  const normalizedMessage = normalizeMessage(message);

  const history = await AIChatHistory.findOneAndUpdate(
    { userId },
    {
      $push: {
        messages: {
          $each: [normalizedMessage],
          $slice: -MAX_HISTORY_MESSAGES,
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  const savedMessage = history?.messages?.[history.messages.length - 1];
  return serializeMessage(savedMessage, history?.messages?.length || 0);
}

export async function getAIChatHistory(userId) {
  const history = await AIChatHistory.findOne({ userId }).lean();
  const messages = Array.isArray(history?.messages) ? history.messages : [];
  return messages.map((message, index) => serializeMessage(message, index));
}

export default {
  getAIChatHistory,
  saveAIChatMessage,
};
