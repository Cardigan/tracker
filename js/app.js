// Main application — orchestration and rendering
import { getMarkets, getMarketTrades, isUsingMockData, fetchDefaults } from './api.js';
import { CATEGORIES, MARKET_MAPPINGS, getAllTickers, getMappingsForCategory, getCategoryById, initDefaults, resetToDefaults } from './categories.js';
import { getTrendingByCategory, formatProb, formatTrend, computeTrend } from './trend.js';
import { initSearch, showAddToCategoryModal } from './search.js';
import { initDetail, openDetail, drawChart } from './detail.js';
import { initConfig, openConfig } from './config.js';

// ===== State =====
let allMarkets = [];
let trendingByCategory = new Map();
let currentFilterCategoryId = null;
let isLoading = true;

// ===== DOM References =====
const gridEl = document.getElementById('categories-grid');

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

  document.getElementById('show-all-btn')?.addEventListener('click', () => renderMarketList(null));

  renderLoadingGrid();
  loadVersion();
  await fetchAllMarkets();
  renderCategoryGrid();
  renderMarketList();
}

async function handleConfigReset() {
  resetToDefaults();
  await fetchAllMarkets();
  renderCategoryGrid();
  renderMarketList(null);
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
    const isFiltered = cat.id === currentFilterCategoryId;
    return `
      <div class="category-card ${isActive ? 'active' : ''}${isFiltered ? ' category-card-filtered' : ''}" data-cat-id="${cat.id}">
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
    card.addEventListener('click', () => renderMarketList(card.dataset.catId));
  });
}

// ===== Market List =====
function renderMarketList(categoryId = null) {
  currentFilterCategoryId = categoryId;

  const marketListEl = document.getElementById('market-list');
  const titleEl      = document.getElementById('market-list-title');
  const showAllBtn   = document.getElementById('show-all-btn');
  if (!marketListEl) return;

  const mappings = categoryId ? getMappingsForCategory(categoryId) : MARKET_MAPPINGS;
  const markets  = buildMarketsForList(mappings);

  if (titleEl) {
    if (categoryId) {
      const cat = getCategoryById(categoryId);
      titleEl.textContent = cat ? `${cat.emoji} ${cat.name} — ${markets.length} market${markets.length !== 1 ? 's' : ''}` : '';
    } else {
      titleEl.textContent = `All tracked markets — ${markets.length}`;
    }
  }
  if (showAllBtn) showAllBtn.classList.toggle('hidden', !categoryId);

  // Highlight filtered category card
  document.querySelectorAll('.category-card').forEach(card => {
    card.classList.toggle('category-card-filtered', card.dataset.catId === categoryId);
  });

  marketListEl.innerHTML = markets.length > 0
    ? markets.map(m => renderMarketCard(m)).join('')
    : renderEmptyDetail(mappings.length);

  attachMarketCardListeners(marketListEl);
  markets.forEach(m => loadSparkline(m.ticker, m.trend > 0));
}

function buildMarketsForList(mappings) {
  const seen = new Set();
  const markets = [];
  for (const mapping of mappings) {
    if (seen.has(mapping.ticker)) continue;
    seen.add(mapping.ticker);
    const market = allMarkets.find(m => m.ticker === mapping.ticker);
    if (!market) continue;
    const { trend, current, previous, hasPrevious } = computeTrend(market, mapping.direction);
    markets.push({
      ...market,
      direction: mapping.direction,
      trend,
      currentProb: current,
      previousProb: previous,
      trendPercent: hasPrevious ? Math.abs(current - previous) * 100 : 0,
      _isActive: trend > 0.001,
    });
  }
  markets.sort((a, b) => {
    if (a._isActive !== b._isActive) return a._isActive ? -1 : 1;
    return Math.abs(b.trend) - Math.abs(a.trend);
  });
  return markets;
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
const catTileTradesCache = new Map();
const catTileRanges = new Map();

const TILE_RANGES_MS = {
  '1h':  60 * 60 * 1000,
  '1w':  7  * 24 * 60 * 60 * 1000,
  '1m':  30 * 24 * 60 * 60 * 1000,
  '6m':  180 * 24 * 60 * 60 * 1000,
  '1y':  365 * 24 * 60 * 60 * 1000,
  '5y':  5 * 365 * 24 * 60 * 60 * 1000,
  'all': null,
};

function renderDetailTile(market) {
  const prob = Math.round((market.currentProb || 0) * 100);
  const probColor = prob > 60 ? 'var(--green)' : prob > 40 ? 'var(--orange)' : 'var(--red)';
  return `
    <div class="detail-tile" data-ticker="${market.ticker}">
      <div class="detail-tile-header">
        <div class="detail-tile-title">${market.title || market.ticker}</div>
        <div class="detail-tile-meta">
          <span style="font-size:1.5rem;font-weight:700;color:${probColor};font-variant-numeric:tabular-nums;">${prob}%</span>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:0.75rem;">${market.ticker} · Vol: ${market.volume_24h_fp || '—'}</span>
        </div>
      </div>
      <div class="range-selector">
        <button class="range-btn" data-range="1h">1H</button>
        <button class="range-btn" data-range="1w">1W</button>
        <button class="range-btn" data-range="1m">1M</button>
        <button class="range-btn" data-range="6m">6M</button>
        <button class="range-btn" data-range="1y">1Y</button>
        <button class="range-btn" data-range="5y">5Y</button>
        <button class="range-btn active" data-range="all">ALL</button>
      </div>
      <div class="detail-tile-chart-area">
        <canvas class="detail-tile-canvas" data-ticker="${market.ticker}"></canvas>
      </div>
    </div>`;
}

function showTileMessage(canvas, msg) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
}

function renderDetailTileChart(ticker) {
  const canvas = document.querySelector(`.detail-tile-canvas[data-ticker="${ticker}"]`);
  if (!canvas) return;
  const allTrades = catTileTradesCache.get(ticker) || [];
  const rangeKey = catTileRanges.get(ticker) || 'all';
  const rangeMs = TILE_RANGES_MS[rangeKey];
  let trades = allTrades;
  if (rangeMs !== null) trades = allTrades.filter(t => t.time >= Date.now() - rangeMs);
  if (trades.length < 2) {
    showTileMessage(canvas, allTrades.length === 0 ? 'No trade data' : 'No data in range');
    return;
  }
  drawChart(canvas, trades);
}

async function loadDetailTile(market) {
  const canvas = document.querySelector(`.detail-tile-canvas[data-ticker="${market.ticker}"]`);
  if (!canvas) return;
  showTileMessage(canvas, 'Loading...');
  try {
    const trades = await getMarketTrades(market.ticker, 500);
    catTileTradesCache.set(market.ticker, trades);
    renderDetailTileChart(market.ticker);
  } catch {
    showTileMessage(canvas, 'No chart data');
  }
}

function openCategoryTileModal(categoryId) {
  const cat = getCategoryById(categoryId);
  if (!cat) return;

  catTileTradesCache.clear();
  catTileRanges.clear();

  const markets = buildMarketsForList(getMappingsForCategory(categoryId));
  const modal = document.getElementById('cat-tile-modal');
  document.getElementById('cat-tile-title').textContent = `${cat.emoji} ${cat.name}`;

  const body = document.getElementById('cat-tile-body');
  body.innerHTML = markets.length > 0
    ? `<div class="detail-tile-grid">${markets.map(m => renderDetailTile(m)).join('')}</div>`
    : '<div class="empty-state"><p class="empty-state-text">No market data available for this category.</p></div>';

  body.querySelectorAll('.detail-tile').forEach(tile => {
    const ticker = tile.dataset.ticker;
    catTileRanges.set(ticker, 'all');
    tile.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tile.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        catTileRanges.set(ticker, btn.dataset.range);
        renderDetailTileChart(ticker);
      });
    });
    tile.querySelector('.detail-tile-header')?.addEventListener('click', () => {
      const market = allMarkets.find(m => m.ticker === ticker);
      if (market) openDetail(market);
    });
  });

  modal.classList.remove('hidden');
  markets.forEach(m => loadDetailTile(m));
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
  renderCategoryGrid();
  renderMarketList(currentFilterCategoryId);
}

// ===== Start =====
init();
