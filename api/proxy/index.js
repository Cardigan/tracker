const https = require('https');

module.exports = async function (context, req) {
  const path = req.query.path || '';
  const params = { ...req.query };
  delete params.path;

  const qs = new URLSearchParams(params).toString();
  const url = `https://api.elections.kalshi.com/trade-api/v2${path}${qs ? '?' + qs : ''}`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        context.res = {
          status: res.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: body,
        };
        resolve();
      });
    }).on('error', (err) => {
      context.res = {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
      resolve();
    });
  });
};
