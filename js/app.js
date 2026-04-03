// Main application — orchestration and rendering
import { getMarkets, getMarketTrades, isUsingMockData } from './api.js';
import { CATEGORIES, MARKET_MAPPINGS, getAllTickers, getMappingsForCategory, getCategoryById } from './categories.js';
import { getTrendingByCategory, filterTrendingMarkets, formatProb, formatTrend, computeTrend } from './trend.js';
import { getPortfolios, createPortfolio, deletePortfolio, addMarketToPortfolio, removeMarketFromPortfolio } from './portfolio.js';
import { initSearch } from './search.js';

// ===== State =====
let allMarkets = [];
let trendingByCategory = new Map();
let currentView = 'grid'; // 'grid' | 'detail'
let currentCategoryId = null;
let isLoading = true;

// ===== DOM References =====
const gridEl = document.getElementById('categories-grid');
const detailEl = document.getElementById('category-detail');

// ===== Init =====
async function init() {
  initSearch(handleMarketAdded);
  initPortfolioSidebar();
  renderLoadingGrid();
  await fetchAllMarkets();
  renderCategoryGrid();
}

// ===== Data Fetching =====
async function fetchAllMarkets() {
  isLoading = true;
  const tickers = getAllTickers();
  const previousMarkets = allMarkets;

  try {
    allMarkets = await getMarkets(tickers);
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

  // Draw filled area
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

  // Draw line
  ctx.beginPath();
  for (let i = 0; i < prices.length; i++) {
    const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
    const y = h - padding - ((prices[i] - min) / range) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// Load trade data and render a sparkline for a market card
async function loadSparkline(ticker, isPositive) {
  const canvas = document.querySelector(`canvas[data-ticker="${ticker}"]`);
  if (!canvas) return;

  try {
    const trades = await getMarketTrades(ticker, 50);
    drawSparkline(canvas, trades, isPositive);
  } catch {
    // Leave canvas empty on error
  }
}

// ===== Category Grid =====
function renderLoadingGrid() {
  gridEl.innerHTML = Array(10).fill(0)
    .map(() => '<div class="skeleton skeleton-card"></div>')
    .join('');
}

function renderCategoryGrid() {
  currentView = 'grid';
  detailEl.classList.add('hidden');
  gridEl.classList.remove('hidden');

  if (allMarkets.length === 0 && !isLoading) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-emoji">📡</div>
        <p class="empty-state-text">No market data available. The Kalshi API may be unreachable.</p>
        <button class="btn btn-primary" style="margin-top:1rem;" onclick="location.reload()">Retry</button>
      </div>
    `;
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
            : `${total} tracked · no active trends`
          }
        </div>
        <p style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">${cat.description}</p>
      </div>
    `;
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
      ${trending.length > 0
        ? trending.map(m => renderMarketCard(m)).join('')
        : renderEmptyDetail(allMappings.length)
      }
    </div>
    ${renderInactiveSection(allMappings, trending)}
  `;

  document.getElementById('back-btn').addEventListener('click', () => renderCategoryGrid());

  detailEl.querySelectorAll('.add-to-pf-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickAddToPortfolio(btn.dataset.ticker);
    });
  });

  // Load sparkline charts for all visible markets
  trending.forEach(m => loadSparkline(m.ticker, m.trend > 0));

  // Load inactive sparklines when the details section is opened
  const detailsEl = detailEl.querySelector('details');
  if (detailsEl) {
    detailsEl.addEventListener('toggle', () => {
      if (detailsEl.open) {
        const inactiveTickers = allMappings
          .filter(m => !trending.find(t => t.ticker === m.ticker))
          .map(m => m.ticker);
        inactiveTickers.forEach(t => {
          const market = allMarkets.find(mk => mk.ticker === t);
          const mapping = allMappings.find(mp => mp.ticker === t);
          if (market && mapping) {
            const { trend } = computeTrend(market, mapping.direction);
            loadSparkline(t, trend > 0);
          }
        });
      }
    });
  }
}

function renderMarketCard(market) {
  const prob = formatProb(market.currentProb);
  const probPct = Math.round(market.currentProb * 100);
  const trendText = formatTrend(market.trend);
  const isUp = market.trend > 0;
  const trendClass = isUp ? 'trend-up' : 'trend-down';
  const barColor = probPct > 60 ? 'var(--green)' : probPct > 40 ? 'var(--orange)' : 'var(--red)';

  return `
    <div class="market-card">
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
        <button class="btn btn-sm add-to-pf-btn" data-ticker="${market.ticker}" title="Add to portfolio">💼</button>
        <a class="market-link" href="https://kalshi.com/markets/${market.event_ticker || market.ticker}" target="_blank" rel="noopener" title="View on Kalshi">↗ Kalshi</a>
      </div>
    </div>
  `;
}

function renderEmptyDetail(totalMapped) {
  return `
    <div class="empty-state">
      <div class="empty-state-emoji">😴</div>
      <p class="empty-state-text">
        ${totalMapped > 0
          ? 'No markets are currently trending toward this narrative. Check back later!'
          : 'No markets mapped to this category yet. Use Search to add some.'
        }
      </p>
    </div>
  `;
}

function renderInactiveSection(allMappings, trending) {
  const trendingTickers = new Set(trending.map(m => m.ticker));
  const inactive = allMappings.filter(m => !trendingTickers.has(m.ticker));
  if (inactive.length === 0) return '';

  const inactiveMarkets = inactive.map(mapping => {
    const market = allMarkets.find(m => m.ticker === mapping.ticker);
    return market ? { ...market, mapping } : null;
  }).filter(Boolean);

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
            <div class="market-card" style="opacity:0.6;">
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
              <div class="market-trend" style="color:var(--text-muted)">
                <span>—</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </details>
  `;
}

// ===== Portfolio Sidebar =====
function initPortfolioSidebar() {
  const sidebar = document.getElementById('portfolio-sidebar');
  const portfolioBtn = document.getElementById('portfolio-btn');
  const closeBtn = sidebar.querySelector('.sidebar-close');
  const createBtn = document.getElementById('create-portfolio-btn');
  const nameInput = document.getElementById('new-portfolio-name');

  portfolioBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    renderPortfolioList();
  });

  closeBtn.addEventListener('click', () => sidebar.classList.add('hidden'));

  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
      createPortfolio(name);
      nameInput.value = '';
      renderPortfolioList();
    }
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });
}

async function renderPortfolioList() {
  const listEl = document.getElementById('portfolio-list');
  const portfolios = getPortfolios();

  if (portfolios.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">💼</div><p class="empty-state-text">No portfolios yet</p></div>';
    return;
  }

  const allTickers = [...new Set(portfolios.flatMap(p => p.markets))];
  let marketData = [];
  if (allTickers.length > 0) {
    try {
      marketData = await getMarkets(allTickers);
    } catch { /* use what we have */ }
  }

  listEl.innerHTML = portfolios.map(pf => {
    const markets = pf.markets.map(ticker => {
      const m = marketData.find(d => d.ticker === ticker);
      return { ticker, market: m };
    });

    return `
      <div class="portfolio-item" data-pf-id="${pf.id}">
        <div class="portfolio-item-header">
          <span class="portfolio-name">${pf.name}</span>
          <button class="btn btn-sm btn-danger delete-pf-btn" data-pf-id="${pf.id}">🗑</button>
        </div>
        ${markets.length > 0
          ? markets.map(({ ticker, market }) => `
            <div class="portfolio-market">
              <span class="portfolio-market-title">${market?.title || ticker}</span>
              <span class="portfolio-market-prob">${market ? formatProb(market.last_price_dollars) : '—'}</span>
              <button class="remove-market-btn" data-pf-id="${pf.id}" data-ticker="${ticker}">×</button>
            </div>
          `).join('')
          : '<div style="padding:0.5rem 0;color:var(--text-muted);font-size:0.8125rem;">No markets added</div>'
        }
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.delete-pf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePortfolio(btn.dataset.pfId);
      renderPortfolioList();
    });
  });

  listEl.querySelectorAll('.remove-market-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeMarketFromPortfolio(btn.dataset.pfId, btn.dataset.ticker);
      renderPortfolioList();
    });
  });
}

function showQuickAddToPortfolio(ticker) {
  const portfolios = getPortfolios();
  if (portfolios.length === 0) {
    document.getElementById('portfolio-sidebar').classList.remove('hidden');
    return;
  }

  const modal = document.getElementById('add-modal');
  const title = document.getElementById('add-modal-title');
  const body = document.getElementById('add-modal-body');

  title.textContent = 'Add to Portfolio';
  body.innerHTML = portfolios.map(p => `
    <div class="search-result-item" data-pf-id="${p.id}" style="margin-bottom:0.375rem;cursor:pointer;">
      <span>💼 ${p.name}</span>
      <span style="color:var(--text-muted);font-size:0.75rem;">${p.markets.length} markets</span>
    </div>
  `).join('');

  body.querySelectorAll('[data-pf-id]').forEach(opt => {
    opt.addEventListener('click', () => {
      addMarketToPortfolio(opt.dataset.pfId, ticker);
      modal.classList.add('hidden');
    });
  });

  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  closeBtn.onclick = () => modal.classList.add('hidden');
  backdrop.onclick = () => modal.classList.add('hidden');

  modal.classList.remove('hidden');
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

// ===== Callback for search/add =====
async function handleMarketAdded() {
  await fetchAllMarkets();
  if (currentView === 'grid') {
    renderCategoryGrid();
  } else if (currentView === 'detail' && currentCategoryId) {
    showCategoryDetail(currentCategoryId);
  }
}

// ===== Start =====
init();
