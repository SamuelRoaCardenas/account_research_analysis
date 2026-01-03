const http = require('http');

const PORT = process.env.PORT || 3000;

// In-memory storage (persists during runtime, not across redeploys)
const dataStore = {};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // GET / - Health check and list available data
    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'running',
            message: 'GTM Blueprint Research Data API',
            endpoints: {
                'POST /data/:name': 'Push research data (JSON body)',
                'GET /data/:name': 'Retrieve research data',
                'GET /data': 'List all stored data',
                'GET /all': 'Get all stored data in one response'
            },
            stored_keys: Object.keys(dataStore),
            total_entries: Object.keys(dataStore).length
        }, null, 2));
        return;
    }

    // GET /data - List all stored data keys
    if (req.method === 'GET' && url.pathname === '/data') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            keys: Object.keys(dataStore),
            count: Object.keys(dataStore).length
        }, null, 2));
        return;
    }

    // GET /all - Get ALL stored data in one response
    if (req.method === 'GET' && url.pathname === '/all') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dataStore, null, 2));
        return;
    }

    // GET /data/:name - Retrieve specific data
    if (req.method === 'GET' && url.pathname.startsWith('/data/')) {
        const name = decodeURIComponent(url.pathname.replace('/data/', ''));

        if (dataStore[name]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(dataStore[name], null, 2));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: `Data '${name}' not found`,
                available_keys: Object.keys(dataStore)
            }));
        }
        return;
    }

    // POST /data/:name - Store research data
    if (req.method === 'POST' && url.pathname.startsWith('/data/')) {
        const name = decodeURIComponent(url.pathname.replace('/data/', ''));

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const jsonData = JSON.parse(body);
                dataStore[name] = {
                    ...jsonData,
                    _metadata: {
                        received_at: new Date().toISOString(),
                        size_bytes: body.length
                    }
                };

                console.log(`[${new Date().toISOString()}] Stored: ${name} (${body.length} bytes)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Data saved as '${name}'`,
                    size: body.length,
                    total_stored: Object.keys(dataStore).length
                }));
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Error parsing JSON:`, err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
            }
        });
        return;
    }

    // POST /data - Store with auto-generated key or company_name from body
    if (req.method === 'POST' && url.pathname === '/data') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const jsonData = JSON.parse(body);
                const name = jsonData.company_name || `entry_${Date.now()}`;

                dataStore[name] = {
                    ...jsonData,
                    _metadata: {
                        received_at: new Date().toISOString(),
                        size_bytes: body.length
                    }
                };

                console.log(`[${new Date().toISOString()}] Stored: ${name} (${body.length} bytes)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Data saved as '${name}'`,
                    key: name,
                    size: body.length,
                    total_stored: Object.keys(dataStore).length
                }));
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Error:`, err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
            }
        });
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
});

server.listen(PORT, () => {
    console.log(`
====================================================
  GTM RESEARCH API - RUNNING ON PORT ${PORT}
====================================================
  Endpoints:
  - GET  /            Health check & stored keys
  - GET  /data        List all stored data keys
  - GET  /all         Get ALL data in one response
  - GET  /data/:name  Get specific data
  - POST /data/:name  Store data with key
  - POST /data        Store data (uses company_name as key)
====================================================
`);
});
