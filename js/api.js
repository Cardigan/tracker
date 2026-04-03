// Kalshi API Client with localStorage caching
const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function cacheKey(key) {
  return `wp_cache_${key}`;
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(key));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full — clear old cache entries
    clearStaleCache();
  }
}

function clearStaleCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('wp_cache_'));
  for (const k of keys) {
    try {
      const { ts } = JSON.parse(localStorage.getItem(k));
      if (Date.now() - ts > CACHE_TTL_MS) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`Kalshi API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

/** Fetch a single market by ticker */
export async function getMarket(ticker) {
  const cached = getCached(`market_${ticker}`);
  if (cached) return cached;

  const result = await apiFetch(`/markets/${encodeURIComponent(ticker)}`);
  const market = result.market || result;
  setCache(`market_${ticker}`, market);
  return market;
}

/** Fetch multiple markets by tickers (batched into single request if possible) */
export async function getMarkets(tickers) {
  if (!tickers || tickers.length === 0) return [];

  // Check which ones are cached
  const results = [];
  const uncached = [];

  for (const ticker of tickers) {
    const cached = getCached(`market_${ticker}`);
    if (cached) {
      results.push(cached);
    } else {
      uncached.push(ticker);
    }
  }

  if (uncached.length > 0) {
    // Fetch individually since Kalshi doesn't support multi-ticker in one request reliably
    // Use Promise.allSettled for parallel fetching with error tolerance
    const batchSize = 10;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      const fetches = batch.map(async (ticker) => {
        try {
          const data = await apiFetch(`/markets/${encodeURIComponent(ticker)}`);
          const market = data.market || data;
          setCache(`market_${ticker}`, market);
          return market;
        } catch (err) {
          console.warn(`Failed to fetch market ${ticker}:`, err.message);
          return null;
        }
      });
      const settled = await Promise.allSettled(fetches);
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }
  }

  return results;
}

/** Search markets by text query */
export async function searchMarkets(term, limit = 20) {
  if (!term || term.length < 2) return [];

  const key = `search_${term}_${limit}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await apiFetch('/markets', {
      status: 'open',
      limit,
    });
    // Client-side filter since the search param may not be available on all endpoints
    const markets = (data.markets || []).filter(m =>
      m.title?.toLowerCase().includes(term.toLowerCase()) ||
      m.subtitle?.toLowerCase().includes(term.toLowerCase()) ||
      m.event_ticker?.toLowerCase().includes(term.toLowerCase())
    );
    setCache(key, markets);
    return markets;
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

/** Search markets using the Kalshi search parameter */
export async function searchMarketsAPI(term, limit = 20) {
  if (!term || term.length < 3) return [];

  const key = `apisearch_${term}_${limit}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    // Try with search parameter first
    const data = await apiFetch('/markets', {
      search: term,
      status: 'open',
      limit,
    });
    const markets = data.markets || [];
    setCache(key, markets);
    return markets;
  } catch {
    // Fallback to client-side filtering
    return searchMarkets(term, limit);
  }
}

/** Fetch a page of open markets (for browsing/discovery) */
export async function listMarkets(cursor = null, limit = 50) {
  const params = { status: 'open', limit };
  if (cursor) params.cursor = cursor;

  const data = await apiFetch('/markets', params);
  return {
    markets: data.markets || [],
    cursor: data.cursor || null,
  };
}

/** Clear all cached data */
export function clearCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('wp_cache_'));
  keys.forEach(k => localStorage.removeItem(k));
}
