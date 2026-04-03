// Market search UI and logic
import { searchMarketsAPI } from './api.js';
import { CATEGORIES, addMarketMapping } from './categories.js';
import { getPortfolios, addMarketToPortfolio } from './portfolio.js';
import { formatProb } from './trend.js';

let debounceTimer = null;
let onMarketAdded = null; // callback when a market is added to category/portfolio

/** Initialize search modal */
export function initSearch(onAdded) {
  onMarketAdded = onAdded;

  const modal = document.getElementById('search-modal');
  const searchBtn = document.getElementById('search-btn');
  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  const input = document.getElementById('search-input');

  searchBtn.addEventListener('click', () => openSearchModal());
  closeBtn.addEventListener('click', () => closeSearchModal());
  backdrop.addEventListener('click', () => closeSearchModal());

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleSearch(e.target.value), 400);
  });
}

function openSearchModal() {
  const modal = document.getElementById('search-modal');
  modal.classList.remove('hidden');
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  modal.classList.add('hidden');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}

async function handleSearch(term) {
  const resultsEl = document.getElementById('search-results');

  if (!term || term.length < 3) {
    resultsEl.innerHTML = '<div class="empty-state"><p class="empty-state-text">Type at least 3 characters to search...</p></div>';
    return;
  }

  resultsEl.innerHTML = '<div class="skeleton skeleton-market" style="height:40px;margin-bottom:8px"></div>'.repeat(3);

  try {
    const markets = await searchMarketsAPI(term);

    if (markets.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">🔍</div><p class="empty-state-text">No open markets found</p></div>';
      return;
    }

    resultsEl.innerHTML = markets.map(m => renderSearchResult(m)).join('');
    attachSearchResultListeners(markets);
  } catch (err) {
    resultsEl.innerHTML = `<div class="error-banner">Search failed: ${err.message}</div>`;
  }
}

function renderSearchResult(market) {
  const prob = formatProb(market.last_price_dollars || market.yes_bid_dollars);
  return `
    <div class="search-result-item" data-ticker="${market.ticker}">
      <span class="search-result-title">${market.title || market.ticker}</span>
      <span class="search-result-prob">${prob}</span>
      <div class="search-result-actions">
        <button class="btn btn-sm btn-primary add-to-category-btn" data-ticker="${market.ticker}">+ Category</button>
        <button class="btn btn-sm btn-secondary add-to-portfolio-btn" data-ticker="${market.ticker}">+ Portfolio</button>
      </div>
    </div>
  `;
}

function attachSearchResultListeners(markets) {
  // Add to category buttons
  document.querySelectorAll('.add-to-category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticker = btn.dataset.ticker;
      const market = markets.find(m => m.ticker === ticker);
      showAddToCategoryModal(market);
    });
  });

  // Add to portfolio buttons
  document.querySelectorAll('.add-to-portfolio-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticker = btn.dataset.ticker;
      showAddToPortfolioModal(ticker);
    });
  });
}

function showAddToCategoryModal(market) {
  const modal = document.getElementById('add-modal');
  const title = document.getElementById('add-modal-title');
  const body = document.getElementById('add-modal-body');

  title.textContent = `Add "${market.title || market.ticker}" to Category`;

  body.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <label style="display:block;margin-bottom:0.5rem;color:var(--text-secondary);font-size:0.875rem;">Select category:</label>
      ${CATEGORIES.map(c => `
        <div class="search-result-item category-option" data-cat-id="${c.id}" style="margin-bottom:0.375rem;cursor:pointer;">
          <span>${c.emoji} ${c.name}</span>
        </div>
      `).join('')}
    </div>
    <div id="direction-section" class="hidden" style="margin-top:1rem;">
      <label style="display:block;margin-bottom:0.5rem;color:var(--text-secondary);font-size:0.875rem;">Direction:</label>
      <div class="direction-picker">
        <button class="direction-btn" data-dir="1">↑ Rising = supports</button>
        <button class="direction-btn" data-dir="-1">↓ Falling = supports</button>
      </div>
    </div>
  `;

  let selectedCat = null;

  body.querySelectorAll('.category-option').forEach(opt => {
    opt.addEventListener('click', () => {
      body.querySelectorAll('.category-option').forEach(o => o.style.borderColor = '');
      opt.style.borderColor = 'var(--accent)';
      selectedCat = opt.dataset.catId;
      document.getElementById('direction-section').classList.remove('hidden');
    });
  });

  body.querySelectorAll('.direction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedCat) return;
      const direction = parseInt(btn.dataset.dir);
      addMarketMapping(market.ticker, selectedCat, direction);
      modal.classList.add('hidden');
      if (onMarketAdded) onMarketAdded();
    });
  });

  // Close handlers
  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  closeBtn.onclick = () => modal.classList.add('hidden');
  backdrop.onclick = () => modal.classList.add('hidden');

  modal.classList.remove('hidden');
}

function showAddToPortfolioModal(ticker) {
  const modal = document.getElementById('add-modal');
  const title = document.getElementById('add-modal-title');
  const body = document.getElementById('add-modal-body');
  const portfolios = getPortfolios();

  title.textContent = 'Add to Portfolio';

  if (portfolios.length === 0) {
    body.innerHTML = '<div class="empty-state"><p class="empty-state-text">No portfolios yet. Create one from the sidebar first.</p></div>';
  } else {
    body.innerHTML = portfolios.map(p => `
      <div class="search-result-item portfolio-option" data-pf-id="${p.id}" style="margin-bottom:0.375rem;cursor:pointer;">
        <span>💼 ${p.name}</span>
        <span style="color:var(--text-muted);font-size:0.75rem;">${p.markets.length} markets</span>
      </div>
    `).join('');

    body.querySelectorAll('.portfolio-option').forEach(opt => {
      opt.addEventListener('click', () => {
        addMarketToPortfolio(opt.dataset.pfId, ticker);
        modal.classList.add('hidden');
        if (onMarketAdded) onMarketAdded();
      });
    });
  }

  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  closeBtn.onclick = () => modal.classList.add('hidden');
  backdrop.onclick = () => modal.classList.add('hidden');

  modal.classList.remove('hidden');
}
