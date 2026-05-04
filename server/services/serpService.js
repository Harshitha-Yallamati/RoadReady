import axios from 'axios';

const SERP_API_URL = 'https://serpapi.com/search.json';
const SERP_TIMEOUT_MS = 6000;
const DEFAULT_RESULT_COUNT = 6;

function toHostname(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeOrganicResult(item, index) {
  return {
    position: Number(item?.position) || index + 1,
    title: item?.title || 'Untitled result',
    link: item?.link || '',
    snippet: item?.snippet || item?.snippet_highlighted_words?.join(' ') || '',
    source: toHostname(item?.link || ''),
  };
}

function normalizeLocalResult(item, index) {
  const website = item?.links?.website || item?.website || '';
  return {
    position: index + 1,
    title: item?.title || item?.name || 'Local result',
    link: website,
    snippet: item?.address || item?.description || '',
    source: toHostname(website),
  };
}

function fallbackSearchResponse(query, reason) {
  return {
    query,
    results: [],
    answerBox: null,
    source: 'fallback',
    fallback: true,
    error: reason,
  };
}

export async function searchWithSerpApi(query, { location = null, num = DEFAULT_RESULT_COUNT } = {}) {
  const apiKey = process.env.SERP_API_KEY;
  const q = String(query || '').trim();
  const requestedNum = Math.max(1, Math.min(Number(num) || DEFAULT_RESULT_COUNT, 10));

  if (!q) {
    return fallbackSearchResponse(query, 'Query is empty');
  }

  if (!apiKey) {
    return fallbackSearchResponse(query, 'SERP_API_KEY is not configured');
  }

  try {
    const response = await axios.get(SERP_API_URL, {
      params: {
        engine: 'google',
        q,
        num: requestedNum,
        location: location || undefined,
        hl: 'en',
        gl: 'us',
        api_key: apiKey,
      },
      timeout: SERP_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
      },
    });

    const data = response?.data || {};
    const organic = Array.isArray(data?.organic_results)
      ? data.organic_results.map(normalizeOrganicResult)
      : [];
    const local = Array.isArray(data?.local_results?.places)
      ? data.local_results.places.map(normalizeLocalResult)
      : [];

    const merged = [...organic, ...local].slice(0, requestedNum);
    const answerBox = data?.answer_box
      ? {
          title: data.answer_box.title || data.answer_box.type || 'Answer',
          answer: data.answer_box.answer || data.answer_box.snippet || data.answer_box.result || '',
          source: data.answer_box.link || '',
        }
      : null;

    return {
      query: q,
      results: merged,
      answerBox,
      source: 'serpapi',
      fallback: false,
      searchMetadata: data?.search_metadata
        ? {
            status: data.search_metadata.status || '',
            id: data.search_metadata.id || '',
          }
        : null,
    };
  } catch (err) {
    const reason = err?.response?.data?.error || err?.message || 'SerpAPI request failed';
    return fallbackSearchResponse(query, reason);
  }
}

export default { searchWithSerpApi };
