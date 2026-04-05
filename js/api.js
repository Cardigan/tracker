// Kalshi API Client with localStorage caching + mock data fallback
const KALSHI_DIRECT_URL = 'https://api.elections.kalshi.com/trade-api/v2';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Use the proxy on deployed environments (Kalshi blocks non-localhost CORS)
const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const USE_PROXY = !isLocalhost;

// Track whether the API is reachable
let apiAvailable = true;

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
  let url;
  if (USE_PROXY) {
    // Route through our Azure Functions proxy to avoid CORS
    url = new URL('/api/proxy', location.origin);
    url.searchParams.set('path', path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  } else {
    // Direct to Kalshi on localhost
    url = new URL(`${KALSHI_DIRECT_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`Kalshi API error: ${resp.status} ${resp.statusText}`);
  }
  apiAvailable = true;
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

/** Fetch multiple markets by tickers — parallel with mock fallback */
export async function getMarkets(tickers) {
  if (!tickers || tickers.length === 0) return [];

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
    const batchSize = 10;
    let anySuccess = false;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      const fetches = batch.map(async (ticker) => {
        try {
          const data = await apiFetch(`/markets/${encodeURIComponent(ticker)}`);
          const market = data.market || data;
          setCache(`market_${ticker}`, market);
          anySuccess = true;
          return market;
        } catch (err) {
          console.warn(`Failed to fetch ${ticker}:`, err.message);
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

    // If no API data at all, use mock data for uncached tickers
    if (!anySuccess && results.length === 0) {
      apiAvailable = false;
      console.warn('API unreachable — using mock data');
      for (const ticker of tickers) {
        if (!results.find(r => r.ticker === ticker)) {
          results.push(generateMockMarket(ticker));
        }
      }
    }
  }

  return results;
}

/** Fetch recent trades for a market (for sparkline charts) */
export async function getMarketTrades(ticker, limit = 50) {
  const key = `trades_${ticker}_${limit}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await apiFetch('/markets/trades', { ticker, limit });
    const trades = (data.trades || []).map(t => ({
      price: parseFloat(t.yes_price_dollars),
      time: new Date(t.created_time).getTime(),
    })).reverse(); // oldest first for charting
    setCache(key, trades);
    return trades;
  } catch {
    return generateMockTrades(ticker);
  }
}

/** Fetch defaults.json — 24h localStorage cache, falls back to stale on network failure */
export async function fetchDefaults() {
  const STORE_KEY = 'wp_defaults_cache';
  const TTL = 24 * 60 * 60 * 1000;

  // Return fresh cache if within TTL
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < TTL) return data;
    }
  } catch {}

  // Fetch fresh
  try {
    const resp = await fetch('/defaults.json');
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    localStorage.setItem(STORE_KEY, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch (err) {
    console.warn('Could not fetch defaults.json, using stale cache:', err.message);
    // Fall back to stale cached version (ignore TTL)
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw).data;
    } catch {}
    return { categories: [], mappings: [] };
  }
}

/** Build a Kalshi search URL pre-filled with the market title or ticker */
export function buildKalshiUrl(market) {
  const query = encodeURIComponent(market.title || market.ticker);
  return `https://kalshi.com/markets?search=${query}`;
}

/** Search markets using the Kalshi search parameter */
export async function searchMarketsAPI(term, limit = 20) {
  if (!term || term.length < 3) return [];

  const key = `apisearch_${term}_${limit}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await apiFetch('/markets', { search: term, limit });
    const markets = data.markets || [];
    setCache(key, markets);
    return markets;
  } catch {
    return [];
  }
}

/** Check if we're running on mock data */
export function isUsingMockData() {
  return !apiAvailable;
}

/** Clear all cached data */
export function clearCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('wp_cache_'));
  keys.forEach(k => localStorage.removeItem(k));
}

// ===== Mock Data Generators =====

function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}

function generateMockMarket(ticker) {
  const rand = seededRandom(ticker);
  const basePrice = 0.1 + rand() * 0.8;
  const change = (rand() - 0.4) * 0.08; // slight upward bias
  const prevPrice = Math.max(0.01, Math.min(0.99, basePrice - change));

  // Generate a human-readable title from ticker
  const title = ticker
    .replace(/^KX/, '')
    .replace(/-\d+.*$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .replace(/\s+/g, ' ');

  return {
    ticker,
    event_ticker: ticker.replace(/-[^-]*$/, ''),
    title: `${title} (Mock)`,
    subtitle: 'Mock data — API unavailable',
    status: 'active',
    last_price_dollars: basePrice.toFixed(4),
    previous_price_dollars: prevPrice.toFixed(4),
    yes_bid_dollars: (basePrice - 0.01).toFixed(4),
    yes_ask_dollars: (basePrice + 0.01).toFixed(4),
    volume_24h_fp: Math.floor(rand() * 10000).toFixed(2),
    _isMock: true,
  };
}

function generateMockTrades(ticker) {
  const rand = seededRandom(ticker + '_trades');
  const points = [];
  let price = 0.2 + rand() * 0.6;
  const now = Date.now();

  for (let i = 29; i >= 0; i--) {
    price += (rand() - 0.48) * 0.03; // slight upward drift
    price = Math.max(0.02, Math.min(0.98, price));
    points.push({
      price: parseFloat(price.toFixed(4)),
      time: now - i * 86400000,
    });
  }
  return points;
}
