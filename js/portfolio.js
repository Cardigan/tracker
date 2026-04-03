// Portfolio CRUD — localStorage-backed

const STORAGE_KEY = 'wp_portfolios';

let portfolios = loadPortfolios();

function loadPortfolios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
}

/** Get all portfolios */
export function getPortfolios() {
  return portfolios;
}

/** Create a new portfolio */
export function createPortfolio(name) {
  if (!name || !name.trim()) return null;
  const portfolio = {
    id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    markets: [], // array of ticker strings
    createdAt: Date.now(),
  };
  portfolios.push(portfolio);
  save();
  return portfolio;
}

/** Delete a portfolio by id */
export function deletePortfolio(id) {
  portfolios = portfolios.filter(p => p.id !== id);
  save();
}

/** Rename a portfolio */
export function renamePortfolio(id, newName) {
  const pf = portfolios.find(p => p.id === id);
  if (pf && newName?.trim()) {
    pf.name = newName.trim();
    save();
  }
}

/** Add a market ticker to a portfolio */
export function addMarketToPortfolio(portfolioId, ticker) {
  const pf = portfolios.find(p => p.id === portfolioId);
  if (!pf) return false;
  if (pf.markets.includes(ticker)) return false;
  pf.markets.push(ticker);
  save();
  return true;
}

/** Remove a market ticker from a portfolio */
export function removeMarketFromPortfolio(portfolioId, ticker) {
  const pf = portfolios.find(p => p.id === portfolioId);
  if (!pf) return;
  pf.markets = pf.markets.filter(t => t !== ticker);
  save();
}

/** Check if a ticker is in any portfolio */
export function isInAnyPortfolio(ticker) {
  return portfolios.some(p => p.markets.includes(ticker));
}
