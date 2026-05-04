import axios from 'axios';

const ML_PREDICT_URL = process.env.ML_PREDICT_URL || 'http://localhost:5001/predict';
const ML_TIMEOUT_MS = 2000;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nowAsTimeDay() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    day: DAYS[now.getDay()],
  };
}

function fallbackTraffic(reason = 'ML API unavailable') {
  return {
    level: 'MEDIUM',
    score: 50,
    source: 'fallback',
    fallback: true,
    error: reason,
  };
}

export async function predictTraffic({ time, day } = {}) {
  const defaults = nowAsTimeDay();
  const payload = {
    time: time ?? defaults.time,
    day: day ?? defaults.day,
  };

  try {
    const res = await axios.post(ML_PREDICT_URL, payload, {
      timeout: ML_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    const level = typeof res?.data?.level === 'string' ? res.data.level.toUpperCase() : null;
    const score = Number(res?.data?.score);

    if (!level || Number.isNaN(score)) {
      return fallbackTraffic('Invalid ML response shape');
    }

    return {
      level,
      score,
      source: 'ml',
      fallback: false,
    };
  } catch (err) {
    const reason = err?.code === 'ECONNABORTED'
      ? 'ML API timeout (2s)'
      : err?.message || 'ML API request failed';
    return fallbackTraffic(reason);
  }
}

export default { predictTraffic };
