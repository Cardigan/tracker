// Category and mapping state — populated from defaults.json at startup,
// then layered with per-browser customizations from localStorage.

export const CATEGORIES = [];
export const MARKET_MAPPINGS = [];

// Tracks which keys came from defaults.json (vs user-added)
const defaultCategoryIds = new Set();
const defaultMappingKeys = new Set(); // "ticker:categoryId"

// Tracks which defaults the user has hidden on this browser
let removedDefaultCats     = new Set();
let removedDefaultMappings = new Set();

// Kept for re-running after a reset
let lastDefaults = null;

// ===== Bootstrap =====

/**
 * Called once at startup with the fetched defaults.json content.
 * Safe to call again (e.g. after reset) — clears and repopulates.
 */
export function initDefaults({ categories = [], mappings = [] } = {}) {
  lastDefaults = { categories, mappings };

  // Load the user's hidden-defaults lists
  try {
    removedDefaultCats     = new Set(JSON.parse(localStorage.getItem('wp_removed_defaults_cats')     || '[]'));
    removedDefaultMappings = new Set(JSON.parse(localStorage.getItem('wp_removed_defaults_mappings') || '[]'));
  } catch {
    removedDefaultCats     = new Set();
    removedDefaultMappings = new Set();
  }

  // Clear everything and rebuild from scratch
  CATEGORIES.length    = 0;
  MARKET_MAPPINGS.length = 0;
  defaultCategoryIds.clear();
  defaultMappingKeys.clear();

  // Push defaults (skip ones the user has hidden)
  for (const cat of categories) {
    defaultCategoryIds.add(cat.id);
    if (!removedDefaultCats.has(cat.id)) {
      CATEGORIES.push({ ...cat, _isDefault: true });
    }
  }
  for (const m of mappings) {
    const key = `${m.ticker}:${m.categoryId}`;
    defaultMappingKeys.add(key);
    if (!removedDefaultMappings.has(key)) {
      MARKET_MAPPINGS.push({ ...m, _isDefault: true });
    }
  }

  // Layer user additions on top
  _loadCustomCategories();
  _loadCustomMappings();
}

/**
 * Restore all hidden defaults and re-initialize.
 * Preserves user-added categories and mappings.
 */
export function resetToDefaults() {
  localStorage.removeItem('wp_removed_defaults_cats');
  localStorage.removeItem('wp_removed_defaults_mappings');
  initDefaults(lastDefaults || {});
}

// ===== Accessors =====

export function getAllTickers() {
  return [...new Set(MARKET_MAPPINGS.map(m => m.ticker))];
}

export function getMappingsForCategory(categoryId) {
  return MARKET_MAPPINGS.filter(m => m.categoryId === categoryId);
}

export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id);
}

export function getRemovedDefaultsCount() {
  return { categories: removedDefaultCats.size, mappings: removedDefaultMappings.size };
}

// ===== Mutations =====

export function addMarketMapping(ticker, categoryId, direction) {
  if (MARKET_MAPPINGS.find(m => m.ticker === ticker && m.categoryId === categoryId)) return;
  // If user had previously hidden this default, un-hide it instead of adding a duplicate
  const key = `${ticker}:${categoryId}`;
  if (removedDefaultMappings.has(key)) {
    removedDefaultMappings.delete(key);
    _saveRemovedDefaults();
    MARKET_MAPPINGS.push({ ticker, categoryId, direction, _isDefault: true });
  } else {
    MARKET_MAPPINGS.push({ ticker, categoryId, direction });
  }
  _saveCustomMappings();
}

export function removeMarketMapping(ticker, categoryId) {
  const idx = MARKET_MAPPINGS.findIndex(m => m.ticker === ticker && m.categoryId === categoryId);
  if (idx === -1) return;
  const key = `${ticker}:${categoryId}`;
  if (defaultMappingKeys.has(key)) {
    removedDefaultMappings.add(key);
    _saveRemovedDefaults();
  }
  MARKET_MAPPINGS.splice(idx, 1);
  _saveCustomMappings();
}

export function addCategory(cat) {
  if (CATEGORIES.find(c => c.id === cat.id)) return;
  CATEGORIES.push({ ...cat, _isCustom: true });
  _saveCustomCategories();
}

export function removeCategory(id) {
  const idx = CATEGORIES.findIndex(c => c.id === id);
  if (idx === -1) return;
  if (defaultCategoryIds.has(id)) {
    removedDefaultCats.add(id);
    _saveRemovedDefaults();
  }
  CATEGORIES.splice(idx, 1);
  _saveCustomCategories();
}

// ===== Private: localStorage persistence =====

function _loadCustomMappings() {
  try {
    const custom = JSON.parse(localStorage.getItem('wp_custom_mappings') || '[]');
    for (const m of custom) {
      // Skip anything that's already in the list (from defaults)
      if (MARKET_MAPPINGS.find(e => e.ticker === m.ticker && e.categoryId === m.categoryId)) continue;
      // Skip orphaned entries pointing to non-existent categories
      if (!CATEGORIES.find(c => c.id === m.categoryId)) continue;
      MARKET_MAPPINGS.push({ ...m });
    }
  } catch { /* ignore corrupt data */ }
}

function _saveCustomMappings() {
  // Persist only user-added entries (not defaults)
  const custom = MARKET_MAPPINGS.filter(m => !defaultMappingKeys.has(`${m.ticker}:${m.categoryId}`));
  localStorage.setItem('wp_custom_mappings', JSON.stringify(custom));
}

function _loadCustomCategories() {
  try {
    const custom = JSON.parse(localStorage.getItem('wp_custom_categories') || '[]');
    for (const cat of custom) {
      if (CATEGORIES.find(c => c.id === cat.id)) continue;
      CATEGORIES.push({ ...cat, _isCustom: true });
    }
  } catch { /* ignore corrupt data */ }
}

function _saveCustomCategories() {
  const custom = CATEGORIES.filter(c => c._isCustom);
  localStorage.setItem('wp_custom_categories', JSON.stringify(custom));
}

function _saveRemovedDefaults() {
  localStorage.setItem('wp_removed_defaults_cats',     JSON.stringify([...removedDefaultCats]));
  localStorage.setItem('wp_removed_defaults_mappings', JSON.stringify([...removedDefaultMappings]));
}
