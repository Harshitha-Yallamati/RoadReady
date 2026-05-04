const DEFAULTS = {
  maxAttempts: Number(process.env.HEALTH_MAX_ATTEMPTS || 10),
  retryDelayMs: Number(process.env.HEALTH_RETRY_DELAY_MS || 1000),
  requestTimeoutMs: Number(process.env.HEALTH_REQUEST_TIMEOUT_MS || 2500),
};

const CHECKS = [
  {
    name: 'frontend',
    url: process.env.FRONTEND_HEALTH_URL || 'http://localhost:5173/',
    validate: async (response) => response.ok,
  },
  {
    name: 'backend',
    url: process.env.BACKEND_HEALTH_URL || 'http://localhost:5000/api/health',
    validate: async (response) => {
      if (!response.ok) return false;
      const data = await response.json().catch(() => null);
      return Boolean(data?.success);
    },
  },
  {
    name: 'ml',
    url: process.env.ML_HEALTH_URL || 'http://localhost:5001/health',
    validate: async (response) => {
      if (!response.ok) return false;
      const data = await response.json().catch(() => null);
      return data?.status === 'ok';
    },
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck(check, options) {
  let lastError = '';

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(check.url, options.requestTimeoutMs);
      const isValid = await check.validate(response);
      if (isValid) {
        return {
          name: check.name,
          url: check.url,
          ok: true,
          attempt,
          status: response.status,
        };
      }
      lastError = `Invalid response (HTTP ${response.status})`;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? `Request timeout after ${options.requestTimeoutMs}ms`
        : (error?.message || 'Unknown request error');
    }

    if (attempt < options.maxAttempts) {
      await sleep(options.retryDelayMs);
    }
  }

  return {
    name: check.name,
    url: check.url,
    ok: false,
    attempt: options.maxAttempts,
    status: '-',
    error: lastError,
  };
}

async function main() {
  console.log('Running pre-demo health check...\n');
  console.log(`Attempts per service: ${DEFAULTS.maxAttempts}`);
  console.log(`Retry delay: ${DEFAULTS.retryDelayMs}ms`);
  console.log(`Request timeout: ${DEFAULTS.requestTimeoutMs}ms\n`);

  const results = await Promise.all(CHECKS.map((check) => runCheck(check, DEFAULTS)));

  for (const result of results) {
    if (result.ok) {
      console.log(`[OK] ${result.name} (${result.url}) - attempt ${result.attempt}, HTTP ${result.status}`);
    } else {
      console.log(`[FAIL] ${result.name} (${result.url}) - ${result.error}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.log(`\nHealth check failed: ${failed.length}/${results.length} service(s) not ready.`);
    process.exit(1);
  }

  console.log('\nHealth check passed: all services are ready.');
}

main().catch((error) => {
  console.error('Health check crashed:', error?.message || error);
  process.exit(1);
});
