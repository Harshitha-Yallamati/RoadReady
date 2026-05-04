// ============================================================
// Weather Service — OpenWeatherMap (Real API)
// ============================================================

import axios from 'axios';

const API_KEY = process.env.WEATHER_API_KEY || '';

export async function getWeather(lat, lon) {
  // If no API key, return basic fallback (but NOT fake data)
  if (!API_KEY) {
    return { condition: 'N/A (no API key)', temperature: null, humidity: null, windSpeed: null };
  }

  try {
    const res = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: { lat, lon, appid: API_KEY, units: 'metric' },
      timeout: 5000,
    });
    return {
      condition: res.data.weather?.[0]?.main || 'Clear',
      description: res.data.weather?.[0]?.description || '',
      temperature: Math.round(res.data.main?.temp || 25),
      humidity: res.data.main?.humidity,
      windSpeed: res.data.wind?.speed,
    };
  } catch (err) {
    console.error('Weather API error:', err.message);
    return { condition: 'N/A', temperature: null };
  }
}
