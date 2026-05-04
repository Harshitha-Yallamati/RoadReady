import mongoose from 'mongoose';
import TrafficData from '../models/TrafficData.js';

const MEMORY_LIMIT = 300;
const memoryTrafficRecords = [];

function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeLevel(level, score = 0) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'heavy' || normalized === 'moderate' || normalized === 'light') {
    return normalized;
  }

  const numericScore = toFiniteNumber(score, 0);
  if (numericScore > 70) return 'heavy';
  if (numericScore > 40) return 'moderate';
  return 'light';
}

function normalizeSource(source) {
  const normalized = String(source || '').toLowerCase();
  if (['ml', 'simulator', 'manual', 'fallback'].includes(normalized)) {
    return normalized;
  }
  return 'fallback';
}

function toTrafficRecord(point, options = {}) {
  const lat = toFiniteNumber(point?.lat, NaN);
  const lon = toFiniteNumber(point?.lon ?? point?.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const level = normalizeLevel(options.level, options.score);
  const score = toFiniteNumber(options.score, 0);
  const source = normalizeSource(options.source);

  return {
    lat,
    lon,
    lng: lon,
    level,
    score,
    source,
    routeId: options.routeId || null,
    createdAt: new Date(),
  };
}

function rememberInMemory(records = []) {
  if (!records.length) return;
  memoryTrafficRecords.unshift(...records);
  if (memoryTrafficRecords.length > MEMORY_LIMIT) {
    memoryTrafficRecords.splice(MEMORY_LIMIT);
  }
}

export function sampleRouteCoordinates(route, maxSamples = 6) {
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return [];

  if (coords.length <= maxSamples) {
    return coords.map(([lon, lat]) => ({ lat, lon }));
  }

  const step = Math.max(1, Math.floor((coords.length - 1) / Math.max(1, maxSamples - 1)));
  const sampled = [];

  for (let i = 0; i < coords.length; i += step) {
    const [lon, lat] = coords[i];
    sampled.push({ lat, lon });
    if (sampled.length >= maxSamples - 1) break;
  }

  const last = coords[coords.length - 1];
  sampled.push({ lat: last[1], lon: last[0] });
  return sampled.slice(0, maxSamples);
}

export async function persistTrafficSnapshots(points = [], options = {}) {
  const records = points
    .map((point) => toTrafficRecord(point, options))
    .filter(Boolean);

  if (!records.length) return { saved: 0, mode: 'none' };

  if (isDBConnected()) {
    try {
      await TrafficData.insertMany(records, { ordered: false });
      return { saved: records.length, mode: 'db' };
    } catch (error) {
      rememberInMemory(records);
      return { saved: records.length, mode: 'memory', error: error.message };
    }
  }

  rememberInMemory(records);
  return { saved: records.length, mode: 'memory' };
}

export async function listRecentTraffic({ limit = 120, maxAgeMinutes = 120 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, toFiniteNumber(limit, 120)));
  const cutoff = new Date(Date.now() - Math.max(1, toFiniteNumber(maxAgeMinutes, 120)) * 60 * 1000);

  if (isDBConnected()) {
    try {
      return await TrafficData.find({ createdAt: { $gte: cutoff } })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();
    } catch {
      // Fall through to memory.
    }
  }

  return memoryTrafficRecords
    .filter((item) => new Date(item.createdAt) >= cutoff)
    .slice(0, safeLimit);
}

function delayMultiplier(level, score) {
  const normalizedLevel = normalizeLevel(level, score);
  const numericScore = toFiniteNumber(score, 0);
  const scoreBoost = Math.min(0.25, numericScore / 400);

  if (normalizedLevel === 'heavy') return 1.35 + scoreBoost;
  if (normalizedLevel === 'moderate') return 1.18 + scoreBoost;
  return 1.05 + scoreBoost / 2;
}

function radiusForLevel(level) {
  if (level === 'heavy') return 1.3;
  if (level === 'moderate') return 1.0;
  return 0.7;
}

export function buildTrafficZones(records = [], maxZones = 30) {
  if (!Array.isArray(records) || records.length === 0) return [];

  const seen = new Set();
  const zones = [];

  for (const record of records) {
    const lat = toFiniteNumber(record?.lat, NaN);
    const lon = toFiniteNumber(record?.lon ?? record?.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const level = normalizeLevel(record?.level, record?.score);
    const score = toFiniteNumber(record?.score, 0);
    const cell = `${lat.toFixed(3)}:${lon.toFixed(3)}`;
    if (seen.has(cell)) continue;
    seen.add(cell);

    zones.push({
      id: record?._id ? String(record._id) : `mem-${cell}`,
      lat,
      lon,
      radiusKm: radiusForLevel(level),
      delayMultiplier: Number(delayMultiplier(level, score).toFixed(2)),
      congestionLevel: level,
      score,
      source: record?.source || 'fallback',
      createdAt: record?.createdAt || new Date().toISOString(),
    });

    if (zones.length >= maxZones) break;
  }

  return zones;
}

export default {
  sampleRouteCoordinates,
  persistTrafficSnapshots,
  listRecentTraffic,
  buildTrafficZones,
};
