// Config page — manage categories and market mappings
import {
  CATEGORIES, MARKET_MAPPINGS,
  addCategory, removeCategory,
  addMarketMapping, removeMarketMapping,
  getRemovedDefaultsCount,
} from './categories.js';

let onConfigChanged = null;
let onConfigReset = null;

/** Programmatically open the config modal from outside this module */
export function openConfig(tab = 'categories') {
  const modal = document.getElementById('config-modal');
  if (!modal) return;
  modal.querySelectorAll('.config-tab-btn').forEach(t => t.classList.remove('active'));
  const activeTab = modal.querySelector(`.config-tab-btn[data-tab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');
  renderTab(tab);
  modal.classList.remove('hidden');
}

export function initConfig(onChange, onReset) {
  onConfigChanged = onChange;
  onConfigReset = onReset;

  const configBtn = document.getElementById('config-btn');
  const modal = document.getElementById('config-modal');
  if (!configBtn || !modal) return;

  configBtn.addEventListener('click', () => {
    renderTab('categories');
    modal.classList.remove('hidden');
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));

  modal.querySelectorAll('.config-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.config-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(tab.dataset.tab);
    });
  });
}

function renderTab(tab) {
  const body = document.getElementById('config-modal-body');
  if (tab === 'categories') renderCategoriesTab(body);
  else renderMarketsTab(body);
}

// ===== Categories Tab =====

function renderCategoriesTab(body) {
  const { categories: removedCats } = getRemovedDefaultsCount();

  body.innerHTML = `
    <div class="config-section">
      ${removedCats > 0 ? `
        <div class="config-reset-notice">
          ${removedCats} default categor${removedCats === 1 ? 'y' : 'ies'} hidden on this browser.
          <button class="btn btn-sm" id="reset-cats-btn">Restore all defaults</button>
        </div>
      ` : ''}
      <div class="config-list" id="config-cat-list">
        ${CATEGORIES.map(renderCategoryRow).join('')}
      </div>
      <div class="config-add-form">
        <h4 style="margin-bottom:0.75rem;color:var(--text-secondary);font-size:0.875rem;">Add Category</h4>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <input type="text" id="new-cat-emoji" class="input" placeholder="Emoji" style="width:72px;flex-shrink:0;">
          <input type="text" id="new-cat-name"  class="input" placeholder="Name" style="flex:1;min-width:120px;">
          <input type="text" id="new-cat-desc"  class="input" placeholder="Description" style="flex:2;min-width:180px;">
          <button class="btn btn-primary" id="add-cat-btn">Add</button>
        </div>
      </div>
    </div>
  `;

  body.querySelector('#reset-cats-btn')?.addEventListener('click', () => {
    if (onConfigReset) onConfigReset();
    renderCategoriesTab(body);
  });

  attachCategoryListeners(body);
}

function renderCategoryRow(cat) {
  const badge = cat._isCustom
    ? `<span class="config-badge config-badge-custom">custom</span>`
    : `<span class="config-badge config-badge-default">default</span>`;
  return `
    <div class="config-item" data-cat-id="${cat.id}">
      <span style="font-size:0.9375rem;white-space:nowrap;">${cat.emoji} ${cat.name}</span>
      ${badge}
      <span style="font-size:0.75rem;color:var(--text-muted);flex:1;margin:0 0.5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat.description}</span>
      <button class="btn btn-sm btn-danger remove-cat-btn" data-cat-id="${cat.id}">Remove</button>
    </div>
  `;
}

function attachCategoryListeners(body) {
  body.querySelectorAll('.remove-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeCategory(btn.dataset.catId);
      body.querySelector('#config-cat-list').innerHTML = CATEGORIES.map(renderCategoryRow).join('');
      updateResetNotice(body, 'cats');
      attachCategoryListeners(body);
      if (onConfigChanged) onConfigChanged();
    });
  });

  body.querySelector('#add-cat-btn')?.addEventListener('click', () => {
    const emoji = body.querySelector('#new-cat-emoji').value.trim() || '📌';
    const name  = body.querySelector('#new-cat-name').value.trim();
    const desc  = body.querySelector('#new-cat-desc').value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    addCategory({ id, name, emoji, description: desc });
    body.querySelector('#new-cat-emoji').value = '';
    body.querySelector('#new-cat-name').value  = '';
    body.querySelector('#new-cat-desc').value  = '';
    body.querySelector('#config-cat-list').innerHTML = CATEGORIES.map(renderCategoryRow).join('');
    attachCategoryListeners(body);
    if (onConfigChanged) onConfigChanged();
  });
}

// ===== Markets Tab =====

function renderMarketsTab(body) {
  const { mappings: removedMappings } = getRemovedDefaultsCount();

  body.innerHTML = `
    <div class="config-section">
      ${removedMappings > 0 ? `
        <div class="config-reset-notice">
          ${removedMappings} default mapping${removedMappings === 1 ? '' : 's'} hidden on this browser.
          <button class="btn btn-sm" id="reset-mappings-btn">Restore all defaults</button>
        </div>
      ` : ''}
      <div style="margin-bottom:0.75rem;">
        <select id="config-cat-filter" class="input" style="width:auto;">
          <option value="">All categories (${MARKET_MAPPINGS.length} total)</option>
          ${CATEGORIES.map(c => {
            const count = MARKET_MAPPINGS.filter(m => m.categoryId === c.id).length;
            return `<option value="${c.id}">${c.emoji} ${c.name} (${count})</option>`;
          }).join('')}
        </select>
      </div>
      <div class="config-list" id="config-mappings-list">
        ${renderMappingRows('')}
      </div>
    </div>
  `;

  body.querySelector('#reset-mappings-btn')?.addEventListener('click', () => {
    if (onConfigReset) onConfigReset();
    renderMarketsTab(body);
  });

  body.querySelector('#config-cat-filter').addEventListener('change', (e) => {
    body.querySelector('#config-mappings-list').innerHTML = renderMappingRows(e.target.value);
    attachMappingListeners(body);
  });

  attachMappingListeners(body);
}

function renderMappingRows(filterCatId) {
  const mappings = filterCatId
    ? MARKET_MAPPINGS.filter(m => m.categoryId === filterCatId)
    : MARKET_MAPPINGS;

  if (mappings.length === 0) return '<div style="color:var(--text-muted);padding:1rem 0;">No mappings</div>';

  return mappings.map(m => {
    const cat = CATEGORIES.find(c => c.id === m.categoryId);
    const badge = m._isDefault
      ? `<span class="config-badge config-badge-default">default</span>`
      : `<span class="config-badge config-badge-custom">custom</span>`;
    return `
      <div class="config-item">
        ${badge}
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.875rem;font-weight:500;">${m.title || m.ticker}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;">${m.ticker} · ${cat ? `${cat.emoji} ${cat.name}` : m.categoryId} · ${m.direction === 1 ? '↑' : '↓'}</div>
        </div>
        <button class="btn btn-sm btn-danger remove-mapping-btn"
          data-ticker="${m.ticker}" data-cat="${m.categoryId}">Remove</button>
      </div>
    `;
  }).join('');
}

function attachMappingListeners(body) {
  body.querySelectorAll('.remove-mapping-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeMarketMapping(btn.dataset.ticker, btn.dataset.cat);
      const filterVal = body.querySelector('#config-cat-filter')?.value || '';
      body.querySelector('#config-mappings-list').innerHTML = renderMappingRows(filterVal);
      updateResetNotice(body, 'mappings');
      // Update dropdown counts
      const allOpt = body.querySelector('option[value=""]');
      if (allOpt) allOpt.textContent = `All categories (${MARKET_MAPPINGS.length} total)`;
      CATEGORIES.forEach(c => {
        const opt = body.querySelector(`option[value="${c.id}"]`);
        if (opt) opt.textContent = `${c.emoji} ${c.name} (${MARKET_MAPPINGS.filter(m => m.categoryId === c.id).length})`;
      });
      attachMappingListeners(body);
      if (onConfigChanged) onConfigChanged();
    });
  });
}

// ===== Helpers =====

function updateResetNotice(body, type) {
  const { categories, mappings } = getRemovedDefaultsCount();
  const count = type === 'cats' ? categories : mappings;
  const btnId = type === 'cats' ? '#reset-cats-btn' : '#reset-mappings-btn';
  const notice = body.querySelector(btnId)?.closest('.config-reset-notice');
  if (!notice) return;
  if (count === 0) {
    notice.remove();
  } else {
    notice.querySelector(btnId)?.previousSibling;
    notice.firstChild.textContent = type === 'cats'
      ? `${count} default categor${count === 1 ? 'y' : 'ies'} hidden on this browser. `
      : `${count} default mapping${count === 1 ? '' : 's'} hidden on this browser. `;
  }
}
