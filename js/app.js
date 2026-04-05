// Main application — orchestration and rendering
import { getMarkets, getMarketTrades, isUsingMockData, fetchDefaults } from './api.js';
import { CATEGORIES, MARKET_MAPPINGS, getAllTickers, getMappingsForCategory, getCategoryById, initDefaults, resetToDefaults } from './categories.js';
import { getTrendingByCategory, formatProb, formatTrend, computeTrend } from './trend.js';
import { initSearch, showAddToCategoryModal } from './search.js';
import { initDetail, openDetail } from './detail.js';
import { initConfig, openConfig } from './config.js';

// ===== State =====
let allMarkets = [];
let trendingByCategory = new Map();
let currentView = 'grid';
let currentCategoryId = null;
let isLoading = true;

// ===== DOM References =====
const gridEl = document.getElementById('categories-grid');
const detailEl = document.getElementById('category-detail');

// ===== Init =====
async function init() {
  const defaults = await fetchDefaults();
  initDefaults(defaults);

  initSearch(handleMarketAdded, () => allMarkets);
  initDetail(openCategoryTileModal);
  initConfig(handleMarketAdded, handleConfigReset);

  const catTileModal = document.getElementById('cat-tile-modal');
  catTileModal?.querySelector('.modal-close').addEventListener('click', () => catTileModal.classList.add('hidden'));
  catTileModal?.querySelector('.modal-backdrop').addEventListener('click', () => catTileModal.classList.add('hidden'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') catTileModal?.classList.add('hidden');
  });

  // 💼 Manage button opens config
  document.getElementById('portfolio-btn')?.addEventListener('click', () => openConfig('categories'));

  renderLoadingGrid();
  loadVersion();
  await fetchAllMarkets();
  renderCategoryGrid();
}

async function handleConfigReset() {
  resetToDefaults();
  await fetchAllMarkets();
  if (currentView === 'grid') renderCategoryGrid();
  else if (currentView === 'detail' && currentCategoryId) showCategoryDetail(currentCategoryId);
}

// ===== Version Display =====
async function loadVersion() {
  try {
    const resp = await fetch('/version.json');
    if (!resp.ok) return;
    const { version, sha } = await resp.json();
    const el = document.getElementById('version-display');
    if (el) el.textContent = `v${version} · ${sha}`;
  } catch { /* dev environment */ }
}

// ===== Data Fetching =====
async function fetchAllMarkets() {
  isLoading = true;
  const tickers = getAllTickers();
  const previousMarkets = allMarkets;

  try {
    const markets = await getMarkets(tickers);
    allMarkets = markets;
    trendingByCategory = getTrendingByCategory(allMarkets, MARKET_MAPPINGS, CATEGORIES);
  } catch (err) {
    console.error('Failed to fetch markets:', err);
    if (previousMarkets.length > 0) {
      allMarkets = previousMarkets;
      trendingByCategory = getTrendingByCategory(allMarkets, MARKET_MAPPINGS, CATEGORIES);
      showError('Using cached data — unable to refresh from Kalshi API');
    } else {
      showError(`Failed to load market data: ${err.message}`);
    }
  }

  isLoading = false;
}

// ===== Sparkline Chart Drawing =====
function drawSparkline(canvas, trades, isPositive) {
  if (!canvas || !trades || trades.length < 2) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const prices = trades.map(t => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01;
  const padding = 2;
  const color = isPositive ? '#22c55e' : '#ef4444';
  const fillColor = isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  for (let i = 0; i < prices.length; i++) {
    const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
    const y = h - padding - ((prices[i] - min) / range) * (h - padding * 2);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w - padding, h - padding);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < prices.length; i++) {
    const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
    const y = h - padding - ((prices[i] - min) / range) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

async function loadSparkline(ticker, isPositive) {
  const canvas = document.querySelector(`canvas[data-ticker="${ticker}"]`);
  if (!canvas) return;
  try {
    const trades = await getMarketTrades(ticker, 50);
    drawSparkline(canvas, trades, isPositive);
  } catch { /* leave empty */ }
}

// ===== Category Grid =====
function renderLoadingGrid() {
  gridEl.innerHTML = Array(10).fill(0).map(() => '<div class="skeleton skeleton-card"></div>').join('');
}

function renderCategoryGrid() {
  currentView = 'grid';
  detailEl.classList.add('hidden');
  gridEl.classList.remove('hidden');

  if (allMarkets.length === 0 && !isLoading) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-emoji">📡</div>
        <p class="empty-state-text">No market data available. The Kalshi API may be unreachable.</p>
        <button class="btn btn-primary" style="margin-top:1rem;" onclick="location.reload()">Retry</button>
      </div>`;
    return;
  }

  const mockBanner = isUsingMockData()
    ? '<div class="error-banner" style="grid-column:1/-1;background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3);color:#f59e0b;">⚠ Using simulated data — Kalshi API unavailable</div>'
    : '';

  gridEl.innerHTML = mockBanner + CATEGORIES.map(cat => {
    const trending = trendingByCategory.get(cat.id) || [];
    const count = trending.length;
    const total = getMappingsForCategory(cat.id).length;
    const isActive = count > 0;
    return `
      <div class="category-card ${isActive ? 'active' : ''}" data-cat-id="${cat.id}">
        <div class="category-pulse ${isActive ? '' : 'inactive'}"></div>
        <div class="category-emoji">${cat.emoji}</div>
        <div class="category-name">${cat.name}</div>
        <div class="category-count">
          ${isActive
            ? `<span class="trending">${count} trending</span> of ${total} tracked`
            : `${total} tracked · no active trends`}
        </div>
        <p style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">${cat.description}</p>
      </div>`;
  }).join('');

  gridEl.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => showCategoryDetail(card.dataset.catId));
  });
}

// ===== Category Detail =====
function showCategoryDetail(categoryId) {
  currentView = 'detail';
  currentCategoryId = categoryId;
  const cat = getCategoryById(categoryId);
  if (!cat) return;

  const allMappings = getMappingsForCategory(categoryId);

  // Build flat list with trend data for every mapped market
  const markets = allMappings.map(mapping => {
    const market = allMarkets.find(m => m.ticker === mapping.ticker);
    if (!market) return null;
    const { trend, current, previous, hasPrevious } = computeTrend(market, mapping.direction);
    return {
      ...market,
      direction: mapping.direction,
      trend,
      currentProb: current,
      previousProb: previous,
      trendPercent: hasPrevious ? Math.abs(current - previous) * 100 : 0,
      _isActive: trend > 0.001,
    };
  }).filter(Boolean);

  // Active (trending) first, then inactive; within each group sort by trend magnitude
  markets.sort((a, b) => {
    if (a._isActive !== b._isActive) return a._isActive ? -1 : 1;
    return Math.abs(b.trend) - Math.abs(a.trend);
  });

  gridEl.classList.add('hidden');
  detailEl.classList.remove('hidden');

  detailEl.innerHTML = `
    <div class="detail-header">
      <div>
        <button class="back-btn" id="back-btn">← Back to categories</button>
        <h2 class="detail-title">${cat.emoji} ${cat.name}</h2>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-top:0.25rem;">${cat.description}</p>
      </div>
    </div>
    <div class="market-list" id="market-list">
      ${markets.length > 0 ? markets.map(m => renderMarketCard(m)).join('') : renderEmptyDetail(allMappings.length)}
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => renderCategoryGrid());
  attachMarketCardListeners(detailEl);
  markets.forEach(m => loadSparkline(m.ticker, m.trend > 0));
}

function attachMarketCardListeners(container) {
  container.querySelectorAll('.add-to-cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const market = allMarkets.find(m => m.ticker === btn.dataset.ticker);
      if (market) showAddToCategoryModal(market);
    });
  });

  container.querySelectorAll('.market-cat-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryTileModal(pill.dataset.catId);
    });
  });

  container.querySelectorAll('.market-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.market-actions')) return;
      const market = allMarkets.find(m => m.ticker === card.dataset.ticker);
      if (market) openDetail(market);
    });
  });
}

function renderMarketCard(market) {
  const isActive = market._isActive;
  const prob = formatProb(market.currentProb);
  const probPct = Math.round((market.currentProb || 0) * 100);
  const isUp = market.trend > 0;
  const trendText = isActive ? formatTrend(market.trend) : '';
  const trendClass = isActive ? (isUp ? 'trend-up' : 'trend-down') : '';
  const barColor = probPct > 60 ? 'var(--green)' : probPct > 40 ? 'var(--orange)' : 'var(--red)';
  const activeColor = isActive ? barColor : 'var(--text-muted)';

  const catPills = MARKET_MAPPINGS
    .filter(m => m.ticker === market.ticker)
    .map(m => getCategoryById(m.categoryId))
    .filter(Boolean)
    .map(c => `<button class="market-cat-pill" data-cat-id="${c.id}">${c.emoji} ${c.name}</button>`)
    .join('');

  return `
    <div class="market-card${isActive ? '' : ' market-card-inactive'}" data-ticker="${market.ticker}" style="cursor:pointer;">
      <div class="market-info">
        <div class="market-title">${market.title || market.ticker}</div>
        <div class="market-subtitle">${market.ticker}${!isActive ? ' · <span class="stable-badge">stable</span>' : ''} · Vol: ${market.volume_24h_fp || '0'}</div>
      </div>
      <div class="market-chart">
        <canvas data-ticker="${market.ticker}" class="sparkline-canvas"></canvas>
      </div>
      <div class="market-prob">
        <span class="prob-value" style="color:${activeColor}">${prob}</span>
        <div class="prob-bar">
          <div class="prob-bar-fill" style="width:${probPct}%;background:${activeColor}"></div>
        </div>
      </div>
      <div class="market-trend ${trendClass}">
        <span class="trend-arrow">${isActive ? (isUp ? '▲' : '▼') : ''}</span>
        <span class="trend-value">${trendText}</span>
      </div>
      <div class="market-actions">
        <button class="btn btn-sm add-to-cat-btn" data-ticker="${market.ticker}" title="Add to category">＋</button>
        <div class="market-cat-pills-wrap">${catPills}</div>
      </div>
    </div>`;
}

function renderEmptyDetail(totalMapped) {
  return `
    <div class="empty-state">
      <div class="empty-state-emoji">😴</div>
      <p class="empty-state-text">
        ${totalMapped > 0
          ? 'No markets are currently trending toward this narrative. Check back later!'
          : 'No markets mapped to this category yet. Use Search to add some.'}
      </p>
    </div>`;
}

// ===== Category Tile Modal =====
const catTileTradesCache = new Map(); // ticker → trades[]
const catTileRanges     = new Map(); // ticker → range key

const CAT_TILE_RANGES = {
  '1h': 60 * 60 * 1000,
  '1w': 7  * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  '5y': 5 * 365 * 24 * 60 * 60 * 1000,
  'all': null,
};

function openCategoryTileModal(categoryId) {
  const cat = getCategoryById(categoryId);
  if (!cat) return;

  const mappings = getMappingsForCategory(categoryId);
  const markets = mappings.map(mapping => {
    const market = allMarkets.find(m => m.ticker === mapping.ticker);
    if (!market) return null;
    const { trend, current } = computeTrend(market, mapping.direction);
    return { ...market, direction: mapping.direction, trend, currentProb: current, _isActive: trend > 0.001 };
  }).filter(Boolean).sort((a, b) => {
    if (a._isActive !== b._isActive) return a._isActive ? -1 : 1;
    return Math.abs(b.trend) - Math.abs(a.trend);
  });

  const modal = document.getElementById('cat-tile-modal');
  document.getElementById('cat-tile-title').textContent = `${cat.emoji} ${cat.name}`;

  const body = document.getElementById('cat-tile-body');
  if (markets.length === 0) {
    body.innerHTML = '<div class="empty-state"><p class="empty-state-text">No market data available for this category.</p></div>';
    modal.classList.remove('hidden');
    return;
  }

  body.innerHTML = `<div class="cat-tile-grid">${markets.map(renderCatTile).join('')}</div>`;

  // Wire range buttons and open-detail click per tile
  body.querySelectorAll('.cat-tile').forEach(tile => {
    const ticker = tile.dataset.ticker;
    catTileRanges.set(ticker, 'all');

    tile.querySelector('.cat-tile-open')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const market = markets.find(m => m.ticker === ticker);
      if (market) openDetail(market);
    });

    tile.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        catTileRanges.set(ticker, btn.dataset.range);
        tile.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const trades = catTileTradesCache.get(ticker) || [];
        drawCatTileChart(tile, trades, catTileRanges.get(ticker));
      });
    });
  });

  modal.classList.remove('hidden');

  // Fetch trades for all tiles in parallel and draw charts
  markets.forEach(async (market) => {
    const tile = body.querySelector(`.cat-tile[data-ticker="${market.ticker}"]`);
    if (!tile) return;
    try {
      const trades = await getMarketTrades(market.ticker, 500);
      catTileTradesCache.set(market.ticker, trades);
      drawCatTileChart(tile, trades, catTileRanges.get(market.ticker) || 'all');
    } catch { /* leave as loading */ }
  });
}

function renderCatTile(market) {
  const prob = formatProb(market.currentProb);
  const probPct = Math.round((market.currentProb || 0) * 100);
  const isActive = market._isActive;
  const isUp = market.trend > 0;
  const barColor = probPct > 60 ? 'var(--green)' : probPct > 40 ? 'var(--orange)' : 'var(--red)';
  const trendText = isActive ? formatTrend(market.trend) : 'stable';

  return `
    <div class="cat-tile${isActive ? '' : ' cat-tile-inactive'}" data-ticker="${market.ticker}">
      <div class="cat-tile-header">
        <div style="flex:1;min-width:0;">
          <div class="cat-tile-title">${market.title || market.ticker}</div>
          <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.25rem;flex-wrap:wrap;">
            <span class="cat-tile-prob" style="color:${isActive ? barColor : 'var(--text-muted)'}">${prob}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;">${market.ticker}</span>
            <span class="cat-tile-trend ${isActive ? (isUp ? 'trend-up' : 'trend-down') : ''}" style="${!isActive ? 'color:var(--text-muted);' : ''}font-size:0.8125rem;">
              ${isActive ? (isUp ? '▲' : '▼') + ' ' : ''}${trendText}
            </span>
          </div>
        </div>
        <button class="btn btn-sm cat-tile-open" title="Open full chart">⤢</button>
      </div>
      <div class="range-selector" style="margin:0.625rem 0 0.375rem;">
        <button class="range-btn" data-range="1h">1H</button>
        <button class="range-btn" data-range="1w">1W</button>
        <button class="range-btn" data-range="1m">1M</button>
        <button class="range-btn" data-range="6m">6M</button>
        <button class="range-btn" data-range="1y">1Y</button>
        <button class="range-btn" data-range="5y">5Y</button>
        <button class="range-btn active" data-range="all">ALL</button>
      </div>
      <div class="cat-tile-chart-area">
        <canvas class="cat-tile-canvas"></canvas>
      </div>
    </div>`;
}

function drawCatTileChart(tile, allTrades, rangeKey) {
  const canvas = tile.querySelector('.cat-tile-canvas');
  if (!canvas) return;

  const rangeMs = CAT_TILE_RANGES[rangeKey];
  const trades = rangeMs !== null
    ? allTrades.filter(t => t.time >= Date.now() - rangeMs)
    : allTrades;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 400;
  const h = canvas.clientHeight || 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (trades.length < 2) {
    ctx.fillStyle = 'rgba(148,163,184,0.4)';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(allTrades.length === 0 ? 'Loading…' : 'No data in range', w / 2, h / 2);
    return;
  }

  const prices = trades.map(t => t.price);
  const times  = trades.map(t => t.time);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;
  const pad = { top: 20, right: 12, bottom: 28, left: 44 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const xAt = i => pad.left + (i / (prices.length - 1)) * cw;
  const yAt = p => pad.top + ch - ((p - minP) / range) * ch;

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor  = isUp ? '#22c55e' : '#ef4444';
  const fillColor  = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

  // Grid + Y labels
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const p = minP + (range / 4) * (4 - i);
    const y = pad.top + (ch / 4) * i;
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText(`${Math.round(p * 100)}%`, pad.left - 4, y + 3);
  }

  // Fill
  ctx.beginPath();
  ctx.moveTo(xAt(0), pad.top + ch);
  for (let i = 0; i < prices.length; i++) ctx.lineTo(xAt(i), yAt(prices[i]));
  ctx.lineTo(xAt(prices.length - 1), pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) ctx.moveTo(xAt(0), yAt(prices[0]));
    else ctx.lineTo(xAt(i), yAt(prices[i]));
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // End dot
  ctx.beginPath();
  ctx.arc(xAt(prices.length - 1), yAt(prices[prices.length - 1]), 3, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();

  // X labels
  ctx.fillStyle = 'rgba(148,163,184,0.65)';
  ctx.font = '10px -apple-system, sans-serif';
  [[0, 'left'], [Math.floor(prices.length / 2), 'center'], [prices.length - 1, 'right']].forEach(([i, align]) => {
    const d = new Date(times[i]);
    const diffDays = (Date.now() - times[i]) / 86400000;
    const label = diffDays < 1
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : diffDays < 365
        ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : d.toLocaleDateString([], { month: 'short', year: '2-digit' });
    ctx.textAlign = align;
    ctx.fillText(label, xAt(i), h - 6);
  });
}

// ===== Error Display =====
function showError(message) {
  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = message;
  document.querySelector('main').prepend(banner);
}

// ===== Callbacks =====
async function handleMarketAdded() {
  await fetchAllMarkets();
  if (currentView === 'grid') renderCategoryGrid();
  else if (currentView === 'detail' && currentCategoryId) showCategoryDetail(currentCategoryId);
}

// ===== Start =====
init();
