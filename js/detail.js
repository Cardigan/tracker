// Market detail overlay with historical chart
import { getMarketTrades } from './api.js';
import { MARKET_MAPPINGS, getCategoryById } from './categories.js';
import { showAddToCategoryModal } from './search.js';

let currentMarket = null;
let allTrades = [];
let selectedRange = 'all';

const RANGES = {
  '1h':  60 * 60 * 1000,
  '1w':  7  * 24 * 60 * 60 * 1000,
  '1m':  30 * 24 * 60 * 60 * 1000,
  '6m':  180 * 24 * 60 * 60 * 1000,
  '1y':  365 * 24 * 60 * 60 * 1000,
  '5y':  5 * 365 * 24 * 60 * 60 * 1000,
  'all': null,
};

export function initDetail() {
  const modal = document.getElementById('detail-modal');
  if (!modal) return;

  modal.querySelector('.modal-close').addEventListener('click', closeDetail);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeDetail);
  modal.querySelector('#detail-add-btn').addEventListener('click', () => {
    if (currentMarket) showAddToCategoryModal(currentMarket);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeDetail();
  });

  modal.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      modal.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart();
    });
  });
}

export async function openDetail(market) {
  currentMarket = market;
  selectedRange = 'all';
  allTrades = [];

  const modal = document.getElementById('detail-modal');
  modal.classList.remove('hidden');

  // Populate header
  modal.querySelector('.detail-market-title').textContent = market.title || market.ticker;
  const prob = Math.round((market.currentProb ?? parseFloat(market.last_price_dollars) ?? 0) * 100);
  modal.querySelector('.detail-market-prob-display').textContent = `${prob}%`;
  modal.querySelector('.detail-ticker-label').textContent = market.ticker;
  modal.querySelector('.detail-volume-label').textContent = market.volume_24h_fp || '—';

  // Category pills
  const pillsEl = modal.querySelector('#detail-category-pills');
  if (pillsEl) {
    const catIds = [...new Set(MARKET_MAPPINGS.filter(m => m.ticker === market.ticker).map(m => m.categoryId))];
    if (catIds.length > 0) {
      pillsEl.innerHTML = catIds.map(id => {
        const cat = getCategoryById(id);
        return cat ? `<span class="detail-cat-pill">${cat.emoji} ${cat.name}</span>` : '';
      }).join('');
      pillsEl.style.display = 'flex';
    } else {
      pillsEl.innerHTML = '';
      pillsEl.style.display = 'none';
    }
  }

  // Reset range buttons
  modal.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  modal.querySelector('[data-range="all"]').classList.add('active');

  // Show loading
  showChartMessage('Loading chart data...');

  // Fetch trade history (500 trades for decent coverage)
  try {
    allTrades = await getMarketTrades(market.ticker, 500);
    renderChart();
  } catch {
    showChartMessage('Unable to load chart data');
  }
}

function closeDetail() {
  document.getElementById('detail-modal').classList.add('hidden');
  currentMarket = null;
  allTrades = [];
}

function showChartMessage(msg) {
  const canvas = document.querySelector('.detail-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
}

function renderChart() {
  const canvas = document.querySelector('.detail-chart-canvas');
  if (!canvas) return;

  const rangeMs = RANGES[selectedRange];
  let trades = allTrades;

  if (rangeMs !== null) {
    const cutoff = Date.now() - rangeMs;
    trades = allTrades.filter(t => t.time >= cutoff);
  }

  if (trades.length < 2) {
    showChartMessage(allTrades.length === 0 ? 'No trade data available' : 'No data in this time range');
    return;
  }

  drawChart(canvas, trades);
}

function drawChart(canvas, trades) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const prices = trades.map(t => t.price);
  const times = trades.map(t => t.time);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;
  const pad = { top: 24, right: 16, bottom: 32, left: 48 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const xAt = i => pad.left + (i / (prices.length - 1)) * cw;
  const yAt = p => pad.top + ch - ((p - minP) / range) * ch;

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#22c55e' : '#ef4444';
  const fillColor = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

  // Grid lines + Y labels
  ctx.font = `11px -apple-system, sans-serif`;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const p = minP + (range / 4) * (4 - i);
    const y = pad.top + (ch / 4) * i;
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText(`${Math.round(p * 100)}%`, pad.left - 6, y + 4);
  }

  // Filled area
  ctx.beginPath();
  ctx.moveTo(xAt(0), pad.top + ch);
  for (let i = 0; i < prices.length; i++) ctx.lineTo(xAt(i), yAt(prices[i]));
  ctx.lineTo(xAt(prices.length - 1), pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Price line
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
  ctx.arc(xAt(prices.length - 1), yAt(prices[prices.length - 1]), 4, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();

  // X axis time labels (start, mid, end)
  ctx.fillStyle = 'rgba(148,163,184,0.65)';
  ctx.font = `11px -apple-system, sans-serif`;
  [[0, 'left'], [Math.floor(prices.length / 2), 'center'], [prices.length - 1, 'right']].forEach(([i, align]) => {
    ctx.textAlign = align;
    ctx.fillText(formatTimeLabel(new Date(times[i])), xAt(i), h - 8);
  });
}

function formatTimeLabel(date) {
  const diffMs = Date.now() - date;
  const diffDays = diffMs / 86400000;
  if (diffDays < 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 365) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
}
