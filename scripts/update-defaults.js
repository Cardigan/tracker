#!/usr/bin/env node
// Usage: KALSHI_API_KEY=<key> node scripts/update-defaults.js
//
// Fetches each ticker in defaults.json from Kalshi, updates titles,
// and removes markets that are resolved or no longer found.

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.KALSHI_API_KEY;
if (!API_KEY) {
  console.error('Error: KALSHI_API_KEY env var is required');
  process.exit(1);
}

const DEFAULTS_PATH = path.join(__dirname, '..', 'defaults.json');
const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

function fetchMarket(ticker) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/markets/${encodeURIComponent(ticker)}`;
    https.get(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode !== 200) return reject(new Error(`${ticker}: HTTP ${res.statusCode}`));
        try {
          const data = JSON.parse(body);
          resolve(data.market || data);
        } catch (e) {
          reject(new Error(`${ticker}: bad JSON`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
  const mappings = defaults.mappings;

  let updated = 0;
  let removed = 0;

  const results = await Promise.allSettled(
    mappings.map(async (m) => {
      const market = await fetchMarket(m.ticker);
      return { mapping: m, market };
    })
  );

  const kept = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`Skipping (fetch error): ${result.reason.message}`);
      kept.push(result.value?.mapping);
      continue;
    }

    const { mapping, market } = result.value;
    if (!market) {
      console.log(`Removed (not found): ${mapping.ticker}`);
      removed++;
      continue;
    }

    if (market.status === 'resolved' || market.status === 'settled') {
      console.log(`Removed (${market.status}): ${mapping.ticker}`);
      removed++;
      continue;
    }

    const freshTitle = market.title || market.event_title || mapping.title;
    if (freshTitle && freshTitle !== mapping.title) {
      console.log(`Updated title: ${mapping.ticker}\n  "${mapping.title}" → "${freshTitle}"`);
      updated++;
    }

    kept.push({ ...mapping, title: freshTitle || mapping.title });
  }

  defaults.mappings = kept.filter(Boolean);
  fs.writeFileSync(DEFAULTS_PATH, JSON.stringify(defaults, null, 2) + '\n');

  console.log(`\nDone. ${updated} title(s) updated, ${removed} market(s) removed, ${kept.length} remaining.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
