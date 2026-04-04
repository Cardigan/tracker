// Market search UI and logic
import { searchMarketsAPI } from './api.js';
import { CATEGORIES, MARKET_MAPPINGS, addMarketMapping } from './categories.js';
import { formatProb } from './trend.js';

let debounceTimer = null;
let onMarketAdded = null;
let getLoadedMarkets = () => [];

/** Returns true if a market looks like a sports bundle/parlay market */
function isBundleMarket(market) {
  const title = (market.title || '').trim();
  if (/^(yes|no)\s+\w/i.test(title)) return true;
  if ((title.match(/,\s*(yes|no)\s+/gi) || []).length >= 2) return true;
  return false;
}

/** Search within already-loaded markets (have full API data) */
function searchLocalMarkets(term, loadedMarkets) {
  const q = term.toLowerCase();
  return loadedMarkets.filter(m =>
    (m.title || '').toLowerCase().includes(q) ||
    m.ticker.toLowerCase().includes(q)
  );
}

/** Search MARKET_MAPPINGS titles for markets not yet in loadedMarkets */
function searchMappingTitles(term, loadedMarkets) {
  const q = term.toLowerCase();
  const loadedTickers = new Set(loadedMarkets.map(m => m.ticker));
  const seen = new Set();
  const results = [];
  for (const mapping of MARKET_MAPPINGS) {
    if (!mapping.title) continue;
    if (seen.has(mapping.ticker)) continue;
    if (loadedTickers.has(mapping.ticker)) continue;
    if (mapping.title.toLowerCase().includes(q) || mapping.ticker.toLowerCase().includes(q)) {
      seen.add(mapping.ticker);
      results.push({ ticker: mapping.ticker, title: mapping.title, _fromMappingOnly: true });
    }
  }
  return results;
}

/** Initialize search modal */
export function initSearch(onAdded, getMarkets) {
  onMarketAdded = onAdded;
  if (getMarkets) getLoadedMarkets = getMarkets;

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
  document.getElementById('search-modal').classList.remove('hidden');
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-modal').classList.add('hidden');
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

  const loaded = getLoadedMarkets();
  const localResults = searchLocalMarkets(term, loaded);
  const mappingResults = searchMappingTitles(term, loaded);

  // API search — non-fatal
  let apiResults = [];
  let apiUnavailable = false;
  try {
    apiResults = await searchMarketsAPI(term, 30);
  } catch {
    apiUnavailable = true;
  }

  const localTickers = new Set([
    ...localResults.map(m => m.ticker),
    ...mappingResults.map(m => m.ticker),
  ]);
  const merged = [
    ...localResults,
    ...mappingResults,
    ...apiResults.filter(m => !localTickers.has(m.ticker) && !isBundleMarket(m)),
  ];

  if (merged.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">🔍</div><p class="empty-state-text">No markets found</p></div>';
    return;
  }

  resultsEl.innerHTML = merged.map(m => renderSearchResult(m)).join('');

  if (apiUnavailable || apiResults.length === 0) {
    resultsEl.insertAdjacentHTML('beforeend',
      `<div style="color:var(--text-muted);font-size:0.75rem;padding:0.5rem 0;text-align:center;">
        Showing local matches · Kalshi API search unavailable
      </div>`
    );
  }

  attachSearchResultListeners(merged);
}

function renderSearchResult(market) {
  const prob = market._fromMappingOnly
    ? '—'
    : formatProb(market.last_price_dollars || market.yes_bid_dollars || market.currentProb);
  return `
    <div class="search-result-item" data-ticker="${market.ticker}">
      <span class="search-result-title">${market.title || market.ticker}</span>
      <span class="search-result-prob">${prob}</span>
      <div class="search-result-actions">
        <button class="btn btn-sm btn-primary add-to-category-btn" data-ticker="${market.ticker}">+ Category</button>
      </div>
    </div>
  `;
}

function attachSearchResultListeners(markets) {
  document.querySelectorAll('.add-to-category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const market = markets.find(m => m.ticker === btn.dataset.ticker);
      if (market) showAddToCategoryModal(market);
    });
  });
}

export function showAddToCategoryModal(market) {
  const modal = document.getElementById('add-modal');
  const title = document.getElementById('add-modal-title');
  const body = document.getElementById('add-modal-body');

  title.textContent = `Add to Category`;

  body.innerHTML = `
    <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.4;">
      "${market.title || market.ticker}"
    </p>
    <div style="margin-bottom:1rem;">
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
        <button class="direction-btn" data-dir="1">↑ Rising = supports narrative</button>
        <button class="direction-btn" data-dir="-1">↓ Falling = supports narrative</button>
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
      addMarketMapping(market.ticker, selectedCat, parseInt(btn.dataset.dir), market.title || '');
      modal.classList.add('hidden');
      if (onMarketAdded) onMarketAdded();
    });
  });

  const closeBtn = modal.querySelector('.modal-close');
  const backdrop = modal.querySelector('.modal-backdrop');
  closeBtn.onclick = () => modal.classList.add('hidden');
  backdrop.onclick = () => modal.classList.add('hidden');

  modal.classList.remove('hidden');
}
