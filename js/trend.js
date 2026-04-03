// Trend computation and filtering logic

/**
 * Compute trend for a market given its direction.
 * trend = (current_price - previous_price) * direction
 * Positive trend means the market is moving toward the narrative.
 */
export function computeTrend(market, direction) {
  const current = parseFloat(market.last_price_dollars || market.yes_bid_dollars || '0');
  const prevRaw = market.previous_price_dollars || market.previous_yes_bid_dollars;
  const previous = prevRaw != null ? parseFloat(prevRaw) : NaN;

  // If we can't determine previous price, trend is unknown
  if (isNaN(current) || isNaN(previous)) return { trend: 0, current, previous: current, hasPrevious: false };

  const trend = (current - previous) * direction;
  return { trend, current, previous, hasPrevious: true };
}

/**
 * Filter and sort markets for a category.
 * Only includes markets where trend > 0 (accelerating toward narrative).
 * Returns enriched market objects sorted by trend magnitude (strongest first).
 */
export function filterTrendingMarkets(markets, mappings) {
  const results = [];

  for (const mapping of mappings) {
    const market = markets.find(m => m.ticker === mapping.ticker);
    if (!market) continue;
    // Kalshi uses 'active' for open markets, accept both
    if (market.status && market.status !== 'open' && market.status !== 'active') continue;

    const { trend, current, previous, hasPrevious } = computeTrend(market, mapping.direction);

    // Only include markets with confirmed positive trend (> small threshold for float precision)
    if (trend > 0.001) {
      results.push({
        ...market,
        direction: mapping.direction,
        trend,
        currentProb: current,
        previousProb: previous,
        trendPercent: Math.abs(current - previous) * 100,
      });
    }
  }

  // Sort by trend magnitude (strongest signal first)
  results.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
  return results;
}

/**
 * Get all trending markets grouped by category.
 * Returns a Map of categoryId → trending market array.
 */
export function getTrendingByCategory(allMarkets, allMappings, categories) {
  const result = new Map();

  for (const cat of categories) {
    const catMappings = allMappings.filter(m => m.categoryId === cat.id);
    const trending = filterTrendingMarkets(allMarkets, catMappings);
    result.set(cat.id, trending);
  }

  return result;
}

/**
 * Format a probability value (0-1 dollar amount) as a percentage string.
 */
export function formatProb(dollarValue) {
  const pct = (parseFloat(dollarValue) * 100);
  if (isNaN(pct)) return '—';
  return `${Math.round(pct)}%`;
}

/**
 * Format a trend value as a string with direction arrow.
 */
export function formatTrend(trend) {
  const pct = Math.abs(trend * 100);
  if (pct < 0.1) return '';
  const arrow = trend > 0 ? '↑' : '↓';
  return `${arrow} ${pct.toFixed(1)}%`;
}
