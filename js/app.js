// Main application — orchestration and rendering
import { getMarkets, getMarketTrades, isUsingMockData, enrichMarketsWithSlugs, buildKalshiUrl, fetchDefaults } from './api.js';
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
  initDetail();
  initConfig(handleMarketAdded, handleConfigReset);

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
    let markets = await getMarkets(tickers);
    markets = await enrichMarketsWithSlugs(markets);
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

  const trending = trendingByCategory.get(categoryId) || [];
  const allMappings = getMappingsForCategory(categoryId);

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
      ${trending.length > 0 ? trending.map(m => renderMarketCard(m)).join('') : renderEmptyDetail(allMappings.length)}
    </div>
    ${renderInactiveSection(allMappings, trending)}
  `;

  document.getElementById('back-btn').addEventListener('click', () => renderCategoryGrid());
  attachMarketCardListeners(detailEl);
  trending.forEach(m => loadSparkline(m.ticker, m.trend > 0));

  const detailsEl = detailEl.querySelector('details');
  if (detailsEl) {
    detailsEl.addEventListener('toggle', () => {
      if (detailsEl.open) {
        allMappings
          .filter(m => !trending.find(t => t.ticker === m.ticker))
          .forEach(m => {
            const market = allMarkets.find(mk => mk.ticker === m.ticker);
            if (market) {
              const { trend } = computeTrend(market, m.direction);
              loadSparkline(m.ticker, trend > 0);
            }
          });
      }
    });
  }
}

function attachMarketCardListeners(container) {
  // 💼 button → add to category
  container.querySelectorAll('.add-to-cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const market = allMarkets.find(m => m.ticker === btn.dataset.ticker);
      if (market) showAddToCategoryModal(market);
    });
  });

  // Card body click → detail overlay
  container.querySelectorAll('.market-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.market-actions')) return;
      const market = allMarkets.find(m => m.ticker === card.dataset.ticker);
      if (market) openDetail(market);
    });
  });
}

function renderMarketCard(market) {
  const prob = formatProb(market.currentProb);
  const probPct = Math.round(market.currentProb * 100);
  const trendText = formatTrend(market.trend);
  const isUp = market.trend > 0;
  const trendClass = isUp ? 'trend-up' : 'trend-down';
  const barColor = probPct > 60 ? 'var(--green)' : probPct > 40 ? 'var(--orange)' : 'var(--red)';

  return `
    <div class="market-card" data-ticker="${market.ticker}" style="cursor:pointer;">
      <div class="market-info">
        <div class="market-title">${market.title || market.ticker}</div>
        <div class="market-subtitle">${market.ticker} · Vol: ${market.volume_24h_fp || '0'}</div>
      </div>
      <div class="market-chart">
        <canvas data-ticker="${market.ticker}" class="sparkline-canvas"></canvas>
      </div>
      <div class="market-prob">
        <span class="prob-value" style="color:${barColor}">${prob}</span>
        <div class="prob-bar">
          <div class="prob-bar-fill" style="width:${probPct}%;background:${barColor}"></div>
        </div>
      </div>
      <div class="market-trend ${trendClass}">
        <span class="trend-arrow">${isUp ? '▲' : '▼'}</span>
        <span class="trend-value">${trendText}</span>
      </div>
      <div class="market-actions">
        <button class="btn btn-sm add-to-cat-btn" data-ticker="${market.ticker}" title="Add to category">＋</button>
        <a class="market-link" href="${buildKalshiUrl(market)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ Kalshi</a>
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

function renderInactiveSection(allMappings, trending) {
  const trendingTickers = new Set(trending.map(m => m.ticker));
  const inactiveMarkets = allMappings
    .filter(m => !trendingTickers.has(m.ticker))
    .map(mapping => {
      const market = allMarkets.find(m => m.ticker === mapping.ticker);
      return market ? { ...market, mapping } : null;
    })
    .filter(Boolean);

  if (inactiveMarkets.length === 0) return '';

  return `
    <details style="margin-top:1.5rem;">
      <summary style="cursor:pointer;color:var(--text-muted);font-size:0.875rem;margin-bottom:0.75rem;">
        ${inactiveMarkets.length} tracked market${inactiveMarkets.length !== 1 ? 's' : ''} not currently trending
      </summary>
      <div class="market-list">
        ${inactiveMarkets.map(m => {
          const { current } = computeTrend(m, m.mapping.direction);
          const prob = formatProb(current);
          return `
            <div class="market-card" data-ticker="${m.ticker}" style="opacity:0.6;cursor:pointer;">
              <div class="market-info">
                <div class="market-title">${m.title || m.ticker}</div>
                <div class="market-subtitle">${m.ticker}</div>
              </div>
              <div class="market-chart">
                <canvas data-ticker="${m.ticker}" class="sparkline-canvas sparkline-inactive"></canvas>
              </div>
              <div class="market-prob">
                <span class="prob-value" style="font-size:1.125rem;color:var(--text-muted)">${prob}</span>
              </div>
              <div class="market-trend" style="color:var(--text-muted)"><span>—</span></div>
              <div class="market-actions">
                <a class="market-link" href="${buildKalshiUrl(m)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ Kalshi</a>
              </div>
            </div>`;
        }).join('')}
      </div>
    </details>`;
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
