// Main application — orchestration and rendering
import { getMarkets, getMarket } from './api.js';
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

  gridEl.innerHTML = CATEGORIES.map(cat => {
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

  // Attach click handlers
  gridEl.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const catId = card.dataset.catId;
      showCategoryDetail(catId);
    });
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
    ${allMappings.length > trending.length ? renderInactiveSection(allMappings, trending) : ''}
  `;

  document.getElementById('back-btn').addEventListener('click', () => renderCategoryGrid());

  // Attach portfolio add buttons
  detailEl.querySelectorAll('.add-to-pf-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickAddToPortfolio(btn.dataset.ticker);
    });
  });
}

function renderMarketCard(market) {
  const prob = formatProb(market.currentProb);
  const probPct = Math.round(market.currentProb * 100);
  const trendText = formatTrend(market.trend);
  const isUp = market.trend > 0;
  const trendClass = isUp ? 'trend-up' : 'trend-down';

  // Color the prob bar based on value
  const barColor = probPct > 60 ? 'var(--green)' : probPct > 40 ? 'var(--orange)' : 'var(--red)';

  return `
    <div class="market-card">
      <div class="market-info">
        <div class="market-title">${market.title || market.ticker}</div>
        <div class="market-subtitle">${market.ticker} · Vol: ${market.volume_24h_fp || '0'}</div>
      </div>
      <div class="market-prob">
        <span class="prob-value" style="color:${barColor}">${prob}</span>
        <div class="prob-bar">
          <div class="prob-bar-fill" style="width:${probPct}%;background:${barColor}"></div>
        </div>
      </div>
      <div class="market-trend ${trendClass}">
        <span class="trend-arrow">${isUp ? '📈' : '📉'}</span>
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

  return `
    <details style="margin-top:1.5rem;">
      <summary style="cursor:pointer;color:var(--text-muted);font-size:0.875rem;margin-bottom:0.75rem;">
        ${inactive.length} tracked market${inactive.length !== 1 ? 's' : ''} not currently trending
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

  // Fetch market data for all portfolio tickers
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

  // Attach delete handlers
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
    // Open sidebar to create one first
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
