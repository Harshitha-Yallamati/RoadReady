import axios from 'axios';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';

const DEFAULTS = {
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 15000),
};

const DEFAULT_SWITCH_MESSAGE = 'There is traffic ahead. A faster route is available. Shall I switch?';
const DEFAULT_CHAT_FALLBACK =
  'I can help with routing, traffic, nearby places, and trip planning. Please try again in a moment.';

function getProvider() {
  const explicit = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (['openai', 'gemini', 'openrouter'].includes(explicit)) {
    return explicit;
  }

  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return null;
}

function formatDistance(meters = 0) {
  const value = Number(meters);
  if (!Number.isFinite(value) || value <= 0) return 'unknown distance';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

function formatDuration(seconds = 0) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return 'unknown ETA';
  const totalMinutes = Math.max(1, Math.round(value / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${totalMinutes} min`;
}

function formatDelay(seconds = 0) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '0 min';
  return `${Math.max(1, Math.round(value / 60))} min`;
}

function formatPlace(place = {}, fallback = 'Unknown') {
  return place?.name || fallback;
}

function summarizeRoutes(currentRoute, allRoutes = []) {
  const candidates = Array.isArray(allRoutes) && allRoutes.length > 0
    ? allRoutes
    : currentRoute
      ? [currentRoute]
      : [];

  return candidates.slice(0, 3).map((route, index) => {
    const label = route.summary || `Route ${index + 1}`;
    const duration = formatDuration(route.adjustedDuration || route.duration);
    const distance = formatDistance(route.distance);
    const trafficLevel = route.trafficLevel || 'unknown';
    const trafficDelay = route.trafficDelay ? `, delay ${formatDelay(route.trafficDelay)}` : '';
    return `${label}: ${distance}, ${duration}, traffic ${trafficLevel}${trafficDelay}`;
  });
}

function buildContextSummary(context = {}) {
  const source = formatPlace(context.source, 'Current location');
  const destination = formatPlace(context.destination, 'Destination');
  const currentRoute = context.currentRoute || null;
  const duration = formatDuration(context.totalDurationSeconds || currentRoute?.adjustedDuration || currentRoute?.duration);
  const distance = formatDistance(context.totalDistanceMeters || currentRoute?.distance);
  const trafficLevel = context.trafficLevel || currentRoute?.trafficLevel || 'unknown';
  const trafficScore = Number(context.trafficScore ?? currentRoute?.trafficScore ?? 0);
  const trafficDelay = formatDelay(currentRoute?.trafficDelay || context.trafficDelaySeconds || 0);
  const weather = context.weather
    ? `${context.weather.condition || 'Unknown'}, ${context.weather.temperature ?? '--'} C`
    : 'unknown';
  const routes = summarizeRoutes(currentRoute, context.allRoutes || []);

  return [
    `Trip: ${source} -> ${destination}`,
    `Current route: distance ${distance}, ETA ${duration}`,
    `Traffic: level ${trafficLevel}, score ${trafficScore}/100, delay ${trafficDelay}`,
    `Weather near destination: ${weather}`,
    routes.length > 0 ? `Alternatives: ${routes.join(' | ')}` : null,
    context.latestSearchSummary ? `Search notes: ${context.latestSearchSummary}` : null,
  ].filter(Boolean).join('\n');
}

function buildPrompt({ systemPrompt, userPrompt, contextSummary }) {
  return [systemPrompt, '', 'Navigation context:', contextSummary, '', userPrompt]
    .filter(Boolean)
    .join('\n');
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const parts = [];
  output.forEach((item) => {
    if (item?.type !== 'message') return;
    const content = Array.isArray(item.content) ? item.content : [];
    content.forEach((part) => {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        parts.push(part.text);
      }
    });
  });

  return parts.join('\n').trim() || null;
}

function extractGeminiText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const texts = [];

  candidates.forEach((candidate) => {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) return;
    parts.forEach((part) => {
      if (typeof part?.text === 'string') {
        texts.push(part.text);
      }
    });
  });

  return texts.join('\n').trim() || null;
}

function extractOpenRouterText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim() || null;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : typeof part === 'string' ? part : ''))
      .join('\n')
      .trim() || null;
  }
  return null;
}

async function requestOpenAIText({ systemPrompt, userPrompt, maxOutputTokens = 320 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await axios.post(
    OPENAI_API_URL,
    {
      model: DEFAULTS.openaiModel,
      instructions: systemPrompt,
      input: userPrompt,
      reasoning: { effort: 'low' },
      max_output_tokens: maxOutputTokens,
    },
    {
      timeout: DEFAULTS.timeoutMs,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return extractOpenAIText(response.data);
}

async function requestGeminiText({ systemPrompt, userPrompt, maxOutputTokens = 320, temperature = 0.45 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = DEFAULTS.geminiModel;
  const url =
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPrompt({
                systemPrompt,
                userPrompt,
                contextSummary: '',
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxOutputTokens,
      },
    },
    {
      timeout: DEFAULTS.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  return extractGeminiText(response.data);
}

async function requestOpenRouterText({ systemPrompt, userPrompt, maxOutputTokens = 320, temperature = 0.4 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const response = await axios.post(
    OPENROUTER_API_URL,
    {
      model: DEFAULTS.openrouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxOutputTokens,
    },
    {
      timeout: DEFAULTS.timeoutMs,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return extractOpenRouterText(response.data);
}

async function generateProviderText({ systemPrompt, userPrompt, maxOutputTokens = 320, temperature = 0.45 }) {
  const provider = getProvider();
  if (!provider) return null;

  if (provider === 'openai') {
    return requestOpenAIText({ systemPrompt, userPrompt, maxOutputTokens });
  }

  if (provider === 'gemini') {
    return requestGeminiText({ systemPrompt, userPrompt, maxOutputTokens, temperature });
  }

  return requestOpenRouterText({ systemPrompt, userPrompt, maxOutputTokens, temperature });
}

function buildSystemPrompt() {
  return [
    'You are the AI Navigation Assistant inside a route planner app.',
    'Always ground your answer in the provided route, traffic, weather, and location context first.',
    'Be concise, helpful, and natural.',
    'If the context shows heavy traffic or a faster alternative, mention it clearly.',
    'If the user asks for nearby stops or suggestions, suggest practical options that fit the trip.',
    'Do not invent maps links, live traffic feeds, or unavailable sensor data.',
    'Use plain text only.',
  ].join('\n');
}

function buildEventUserPrompt(event, context = {}) {
  const source = formatPlace(context.source, 'current location');
  const destination = formatPlace(context.destination, 'destination');
  const timeSaved = formatDelay(context.timeSavedSeconds || 0);

  switch (event) {
    case 'route_selected':
      return `The user selected a route from ${source} to ${destination}. Give a warm route briefing in 2-3 sentences.`;
    case 'navigation_started':
      return `Navigation has started from ${source} to ${destination}. Give a short confident start message and mention that you will watch traffic.`;
    case 'traffic_detected':
      return 'Explain the current traffic conditions and what they mean for the trip in 2-3 sentences.';
    case 'reroute_available':
      return `Heavy traffic is affecting the trip. Explain the issue, mention that an alternative can save about ${timeSaved}, and end by asking if the user wants to switch routes.`;
    case 'chat':
      return [
        `User message: "${String(context.userMessage || '').trim()}"`,
        'Answer directly using the navigation context when relevant.',
        'If the user asks about traffic, mention delay, route condition, and whether another route looks better.',
        'If the user asks about places, suggest a few route-relevant stops or landmarks and why they fit.',
      ].join('\n');
    default:
      return `Respond to the user with the available route context for a trip from ${source} to ${destination}.`;
  }
}

function buildFallbackAnalysis(event, context = {}) {
  const source = formatPlace(context.source, 'your location');
  const destination = formatPlace(context.destination, 'your destination');
  const trafficLevel = context.trafficLevel || context.currentRoute?.trafficLevel || 'unknown';
  const delay = context.currentRoute?.trafficDelay || context.trafficDelaySeconds || 0;

  switch (event) {
    case 'route_selected':
      return `Route set from ${source} to ${destination}. The trip is ${formatDistance(context.totalDistanceMeters || context.currentRoute?.distance)} with an ETA of ${formatDuration(context.totalDurationSeconds || context.currentRoute?.adjustedDuration || context.currentRoute?.duration)}.`;
    case 'navigation_started':
      return `Navigation started to ${destination}. I'll keep watching traffic and let you know if a better route opens up.`;
    case 'traffic_detected':
      return `Traffic is currently ${trafficLevel} on your route with about ${formatDelay(delay)} of delay.`;
    case 'reroute_available':
      return context.timeSavedSeconds
        ? `There is heavier traffic ahead. I found another route that could save about ${formatDelay(context.timeSavedSeconds)}. Would you like to switch?`
        : DEFAULT_SWITCH_MESSAGE;
    default:
      return DEFAULT_CHAT_FALLBACK;
  }
}

export async function generateIntelligentAnalysis(context = {}) {
  const event = String(context.event || 'general').trim().toLowerCase();
  const contextSummary = buildContextSummary(context);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildEventUserPrompt(event, context);

  try {
    const response = await generateProviderText({
      systemPrompt,
      userPrompt: buildPrompt({ systemPrompt: '', contextSummary, userPrompt }),
      maxOutputTokens: event === 'chat' ? 420 : 260,
    });

    return response || buildFallbackAnalysis(event, context);
  } catch (error) {
    console.error('[AI] generateIntelligentAnalysis failed:', error.message);
    return buildFallbackAnalysis(event, context);
  }
}

export async function generateSwitchMessage({ timeSavedMinutes, context = {} } = {}) {
  const timeSavedSeconds = Math.max(60, Math.round(Number(timeSavedMinutes || 1) * 60));
  return generateIntelligentAnalysis({
    ...context,
    event: 'reroute_available',
    timeSavedSeconds,
  });
}

function fallbackSearchSummary(query, results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return `No reliable search results were found for "${query}". Try a more specific question.`;
  }

  return results
    .slice(0, 3)
    .map((result, index) => `${index + 1}. ${result.title}`)
    .join('\n');
}

export async function summarizeSearchResults({ query, results = [] } = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return 'Search query is empty.';

  if (!Array.isArray(results) || results.length === 0) {
    return fallbackSearchSummary(normalizedQuery, []);
  }

  const compactResults = results.slice(0, 6).map((item, index) => ({
    rank: index + 1,
    title: item.title,
    snippet: item.snippet,
    source: item.source,
  }));

  try {
    const text = await generateProviderText({
      systemPrompt: [
        'You summarize search results for a smart route planner.',
        'Keep the summary factual, compact, and useful to a traveler.',
        'Respond in 3 short bullet-style lines without markdown bullets.',
      ].join('\n'),
      userPrompt: `Query: ${normalizedQuery}\nResults: ${JSON.stringify(compactResults)}`,
      maxOutputTokens: 220,
      temperature: 0.3,
    });

    return text || fallbackSearchSummary(normalizedQuery, compactResults);
  } catch (error) {
    console.error('[AI] summarizeSearchResults failed:', error.message);
    return fallbackSearchSummary(normalizedQuery, compactResults);
  }
}

export async function generateChatReply({ message, context = {} } = {}) {
  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) return 'Please type a question.';

  try {
    const analysis = await generateIntelligentAnalysis({
      ...context,
      event: 'chat',
      userMessage: trimmedMessage,
    });

    return analysis || DEFAULT_CHAT_FALLBACK;
  } catch (error) {
    console.error('[AI] generateChatReply failed:', error.message);
    return DEFAULT_CHAT_FALLBACK;
  }
}

export async function testGeminiDirect() {
  const provider = getProvider();
  if (!provider) {
    return { success: false, error: 'No AI provider API key is configured' };
  }

  try {
    const text = await generateProviderText({
      systemPrompt: 'Reply with a short connectivity confirmation.',
      userPrompt: 'Say hello and confirm that the provider is responding.',
      maxOutputTokens: 80,
      temperature: 0.1,
    });

    return {
      success: Boolean(text),
      provider,
      model:
        provider === 'openai'
          ? DEFAULTS.openaiModel
          : provider === 'gemini'
            ? DEFAULTS.geminiModel
            : DEFAULTS.openrouterModel,
      data: { text: text || 'Connected' },
    };
  } catch (error) {
    return {
      success: false,
      provider,
      error: error.response?.data?.error?.message || error.message,
      details: error.response?.data || null,
    };
  }
}

export async function testGeminiConnection() {
  return testGeminiDirect();
}

export { DEFAULT_SWITCH_MESSAGE };

export default {
  testGeminiConnection,
  testGeminiDirect,
  generateSwitchMessage,
  generateIntelligentAnalysis,
  summarizeSearchResults,
  generateChatReply,
};
