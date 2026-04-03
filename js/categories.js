// Category definitions and market-to-category mappings
// Each market has a `direction`: +1 means increasing price supports the narrative,
// -1 means decreasing price supports the narrative.

export const CATEGORIES = [
  {
    id: 'things-getting-worse',
    name: 'Things Getting Worse',
    emoji: '📉',
    description: 'Economic downturns, rising costs, and declining conditions',
  },
  {
    id: 'ai-taking-over',
    name: 'AI Taking Over',
    emoji: '🤖',
    description: 'AI milestones, regulation, and industry disruption',
  },
  {
    id: 'time-to-leave-the-city',
    name: 'Time to Leave the City',
    emoji: '🏃',
    description: 'Urban flight, remote work trends, and housing shifts',
  },
  {
    id: 'end-of-the-world',
    name: 'End of the World (but maybe)',
    emoji: '🌍',
    description: 'Existential risks, geopolitical tensions, and doomsday scenarios',
  },
  {
    id: 'things-heating-up',
    name: 'Things Heating Up',
    emoji: '🔥',
    description: 'Climate milestones, temperature records, and environmental events',
  },
  {
    id: 'cooling-off',
    name: 'Cooling Off',
    emoji: '🧊',
    description: 'Market corrections, hype cycles fading, and de-escalation',
  },
  {
    id: 'human-behavior-weird',
    name: 'Human Behavior is Weird',
    emoji: '🤪',
    description: 'Unusual social trends, celebrity events, and viral moments',
  },
  {
    id: 'scifi-becoming-real',
    name: 'Science Fiction Becoming Real',
    emoji: '🚀',
    description: 'Space exploration, biotech breakthroughs, and futuristic tech',
  },
  {
    id: 'chaos-index',
    name: 'Chaos Index',
    emoji: '🎲',
    description: 'Political surprises, government shutdowns, and black swan events',
  },
  {
    id: 'someones-about-to-win',
    name: "Someone's About to Win",
    emoji: '🏆',
    description: 'Elections, competitions, and races nearing their conclusion',
  },
];

// Market mappings: ticker → { categoryId, direction }
// direction: +1 = rising price supports narrative, -1 = falling price supports narrative
// Curated from real active Kalshi markets (verified April 2026)
export const MARKET_MAPPINGS = [
  // Things Getting Worse 📉
  { ticker: 'KXU3MAX-30-10', categoryId: 'things-getting-worse', direction: 1 },       // Unemployment hits 10%
  { ticker: 'KXDEBTGROWTH-28DEC31-50', categoryId: 'things-getting-worse', direction: 1 }, // National debt hits $50T
  { ticker: 'CHINAUSGDP-30', categoryId: 'things-getting-worse', direction: 1 },       // China overtakes US GDP
  { ticker: 'KXGDPSHAREMANU-29', categoryId: 'things-getting-worse', direction: -1 },  // Manufacturing NOT coming back

  // AI Taking Over 🤖
  { ticker: 'KXAGICO-COMP-27Q1', categoryId: 'ai-taking-over', direction: 1 },         // AGI by Q1 2027
  { ticker: 'KXAGICO-COMP-27Q2', categoryId: 'ai-taking-over', direction: 1 },         // AGI by Q2 2027
  { ticker: 'KXAGICO-COMP-27Q3', categoryId: 'ai-taking-over', direction: 1 },         // AGI by Q3 2027
  { ticker: 'KXUSTAKEOVER-30', categoryId: 'ai-taking-over', direction: 1 },           // US govt takes over AI company
  { ticker: 'KXOAIANTH-40-OAI', categoryId: 'ai-taking-over', direction: 1 },          // OpenAI IPOs first
  { ticker: 'KXROBOTMARS-35', categoryId: 'ai-taking-over', direction: 1 },            // Robot on Mars before human

  // Time to Leave the City 🏃
  { ticker: 'KXPOPCHANGESTATE10-35', categoryId: 'time-to-leave-the-city', direction: 1 }, // State loses 10% population
  { ticker: 'KXCASECESSION-30', categoryId: 'time-to-leave-the-city', direction: 1 },  // California secession ballot
  { ticker: 'KXEARTHQUAKECALIFORNIA-35', categoryId: 'time-to-leave-the-city', direction: 1 }, // 8.0 earthquake in CA

  // End of the World (but maybe) 🌍
  { ticker: 'KXERUPTSUPER-0-50JAN01', categoryId: 'end-of-the-world', direction: 1 },  // Supervolcano erupts
  { ticker: 'KXEARTHQUAKEJAPAN-30', categoryId: 'end-of-the-world', direction: 1 },    // 8.0 earthquake in Japan
  { ticker: 'KXEARTHQUAKECALIFORNIA-35', categoryId: 'end-of-the-world', direction: 1 }, // 8.0 earthquake in CA
  { ticker: 'KXTAIWANLVL4-29JAN01', categoryId: 'end-of-the-world', direction: 1 },    // US Level 4 warning for Taiwan
  { ticker: 'KXTAIWANLVL4-30JAN01', categoryId: 'end-of-the-world', direction: 1 },    // US Level 4 warning for Taiwan

  // Things Heating Up 🔥
  { ticker: 'KXWARMING-50', categoryId: 'things-heating-up', direction: 1 },            // World passes 2°C warming
  { ticker: 'KXCO2LEVEL-30-445', categoryId: 'things-heating-up', direction: 1 },       // CO2 hits 445ppm
  { ticker: 'KXCO2LEVEL-30-450', categoryId: 'things-heating-up', direction: 1 },       // CO2 hits 450ppm
  { ticker: 'USCLIMATE-2030', categoryId: 'things-heating-up', direction: -1 },         // US MISSES climate goals
  { ticker: 'EUCLIMATE-2030', categoryId: 'things-heating-up', direction: -1 },         // EU MISSES climate goals

  // Cooling Off 🧊
  { ticker: 'KXGOVTCUTS-28-500', categoryId: 'cooling-off', direction: 1 },             // Govt spending cut $500B
  { ticker: 'KXGOVTCUTS-28-1000', categoryId: 'cooling-off', direction: 1 },            // Govt spending cut $1T
  { ticker: 'KXBALANCE-29', categoryId: 'cooling-off', direction: 1 },                  // Trump balances budget
  { ticker: 'KXFDATYPE1DIABETES-33', categoryId: 'cooling-off', direction: 1 },         // FDA approves diabetes cure
  { ticker: 'KXPOLIOELIM-30', categoryId: 'cooling-off', direction: 1 },                // Zero polio year

  // Human Behavior is Weird 🤪
  { ticker: 'KXMUSKTRILLION-27', categoryId: 'human-behavior-weird', direction: 1 },    // Musk trillionaire by 2027
  { ticker: 'KXTRILLIONAIRE-30-EM', categoryId: 'human-behavior-weird', direction: 1 }, // Musk first trillionaire
  { ticker: 'KXTRILLIONAIRE-30-JH', categoryId: 'human-behavior-weird', direction: 1 }, // Jensen Huang trillionaire
  { ticker: 'KXELONMARS-99', categoryId: 'human-behavior-weird', direction: 1 },        // Elon visits Mars in lifetime

  // Science Fiction Becoming Real 🚀
  { ticker: 'KXFUSION-30-JAN01', categoryId: 'scifi-becoming-real', direction: 1 },     // Nuclear fusion by 2030
  { ticker: 'KXSPACEXMARS-30', categoryId: 'scifi-becoming-real', direction: 1 },       // SpaceX lands on Mars
  { ticker: 'STARSHIPMARS-29DEC31', categoryId: 'scifi-becoming-real', direction: 1 },  // Manned Starship to Mars
  { ticker: 'KXCOLONIZEMARS-50', categoryId: 'scifi-becoming-real', direction: 1 },     // Humans colonize Mars
  { ticker: 'KXDATACENTER-30', categoryId: 'scifi-becoming-real', direction: 1 },       // Nuclear-powered data center
  { ticker: 'KXMARSVRAIL-50', categoryId: 'scifi-becoming-real', direction: -1 },       // Mars BEFORE CA high-speed rail

  // Chaos Index 🎲
  { ticker: 'KXFULLTERMSKPRES-29', categoryId: 'chaos-index', direction: -1 },          // SK president doesn't finish term
  { ticker: 'KXNEXTSPEAKER-31-SSCA', categoryId: 'chaos-index', direction: 1 },         // New Speaker of the House
  { ticker: 'KXNEXTSPEAKER-31-JJOR', categoryId: 'chaos-index', direction: 1 },         // Jim Jordan becomes Speaker
  { ticker: 'KXG7LEADEROUT-45JAN01-EMAC', categoryId: 'chaos-index', direction: 1 },    // Macron leaves office
  { ticker: 'AMAZONFTC-29DEC31', categoryId: 'chaos-index', direction: 1 },             // Amazon found monopoly
  { ticker: 'APPLEUS-29DEC31', categoryId: 'chaos-index', direction: 1 },               // Apple found monopoly

  // Someone's About to Win 🏆
  { ticker: 'KXTIMEDECADE20S-30-EMUS', categoryId: 'someones-about-to-win', direction: 1 }, // Musk Person of Decade
  { ticker: 'KXTIMEDECADE20S-30-XJIN', categoryId: 'someones-about-to-win', direction: 1 }, // Xi Person of Decade
  { ticker: 'KXOAIANTH-40-ANTH', categoryId: 'someones-about-to-win', direction: 1 },  // Anthropic IPOs first
  { ticker: 'KXDEELRIP-40-DEEL', categoryId: 'someones-about-to-win', direction: 1 },  // Deel IPOs first
  { ticker: 'EVSHARE-30JAN-30', categoryId: 'someones-about-to-win', direction: 1 },   // EV market share >30%
];

// Track how many default mappings we have (for distinguishing user-added ones)
const DEFAULT_MAPPING_COUNT = MARKET_MAPPINGS.length;

/** Get all unique tickers from mappings */
export function getAllTickers() {
  return [...new Set(MARKET_MAPPINGS.map(m => m.ticker))];
}

/** Get mappings for a specific category */
export function getMappingsForCategory(categoryId) {
  return MARKET_MAPPINGS.filter(m => m.categoryId === categoryId);
}

/** Get category by ID */
export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id);
}

/** Add a new market mapping (persisted to localStorage for user-added markets) */
export function addMarketMapping(ticker, categoryId, direction) {
  const existing = MARKET_MAPPINGS.find(m => m.ticker === ticker && m.categoryId === categoryId);
  if (existing) return;
  MARKET_MAPPINGS.push({ ticker, categoryId, direction });
  saveCustomMappings();
}

/** Load custom mappings from localStorage */
export function loadCustomMappings() {
  try {
    const raw = localStorage.getItem('wp_custom_mappings');
    if (!raw) return;
    const custom = JSON.parse(raw);
    for (const m of custom) {
      const exists = MARKET_MAPPINGS.find(
        e => e.ticker === m.ticker && e.categoryId === m.categoryId
      );
      if (!exists) MARKET_MAPPINGS.push(m);
    }
  } catch { /* ignore */ }
}

function saveCustomMappings() {
  // Save only user-added mappings (not the hardcoded defaults)
  const defaultTickers = new Set(
    MARKET_MAPPINGS.slice(0, DEFAULT_MAPPING_COUNT).map(m => `${m.ticker}:${m.categoryId}`)
  );

  const custom = MARKET_MAPPINGS.filter(
    m => !defaultTickers.has(`${m.ticker}:${m.categoryId}`)
  );
  localStorage.setItem('wp_custom_mappings', JSON.stringify(custom));
}

// Auto-load custom mappings on module load
loadCustomMappings();
