const SWITCH_THRESHOLD_SECONDS = 60; // 1 minute

function routeDuration(route) {
  if (!route || typeof route !== 'object') return NaN;
  const adjusted = Number(route.adjustedDuration);
  const base = Number(route.duration);
  if (Number.isFinite(adjusted) && adjusted > 0) return adjusted;
  if (Number.isFinite(base) && base > 0) return base;
  return NaN;
}

export function isTrafficHigh(prediction) {
  const level = String(prediction?.level || '').toUpperCase();
  const score = Number(prediction?.score);

  if (level === 'HIGH') return true;
  if (Number.isFinite(score) && score > 50) return true;
  return false;
}

export function findBetterRoute(currentRoute, alternatives = []) {
  const currentDuration = routeDuration(currentRoute);
  if (!Number.isFinite(currentDuration) || !Array.isArray(alternatives) || alternatives.length === 0) {
    return { betterRoute: null, timeSaved: 0, improvementRatio: 0 };
  }

  let betterRoute = null;
  let bestDuration = currentDuration;

  for (const route of alternatives) {
    const candidateDuration = routeDuration(route);
    if (!Number.isFinite(candidateDuration)) continue;
    if (candidateDuration < bestDuration) {
      betterRoute = route;
      bestDuration = candidateDuration;
    }
  }

  const timeSaved = Math.max(0, Math.round(currentDuration - bestDuration));
  const improvementRatio = currentDuration > 0
    ? Number((timeSaved / currentDuration).toFixed(4))
    : 0;

  return {
    betterRoute,
    timeSaved,
    improvementRatio,
  };
}

export function shouldSuggestSwitch(timeSaved) {
  const saved = Number(timeSaved);
  return Number.isFinite(saved) && saved >= SWITCH_THRESHOLD_SECONDS;
}

export function buildSwitchMessage(timeSaved) {
  return 'There is traffic ahead. A faster route is available. Shall I switch?';
}

export default {
  isTrafficHigh,
  findBetterRoute,
  shouldSuggestSwitch,
  buildSwitchMessage,
};
