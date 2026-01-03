const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
        const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'running',
            message: 'Local API Server for GTM Blueprint Research Data',
            endpoints: {
                'POST /data/:name': 'Push research data (JSON body)',
                'GET /data/:name': 'Retrieve research data',
                'GET /data': 'List all stored data files'
            },
            stored_files: files
        }, null, 2));
        return;
    }

    // GET /data - List all stored data
    if (req.method === 'GET' && url.pathname === '/data') {
        const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ files }, null, 2));
        return;
    }

    // GET /data/:name - Retrieve specific data file
    if (req.method === 'GET' && url.pathname.startsWith('/data/')) {
        const name = url.pathname.replace('/data/', '');
        const filePath = path.join(DATA_DIR, `${name}.json`);

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Data file '${name}' not found` }));
        }
        return;
    }

    // POST /data/:name - Store research data
    if (req.method === 'POST' && url.pathname.startsWith('/data/')) {
        const name = url.pathname.replace('/data/', '');
        const filePath = path.join(DATA_DIR, `${name}.json`);

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const jsonData = JSON.parse(body);
                fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

                console.log(`[${new Date().toISOString()}] Saved: ${name}.json (${body.length} bytes)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Data saved as '${name}.json'`,
                    size: body.length,
                    path: filePath
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
            }
        });
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`
====================================================
  LOCAL API SERVER RUNNING
====================================================
  URL: http://localhost:${PORT}

  ENDPOINTS:
  - GET  /           Health check & info
  - GET  /data       List all stored data files
  - GET  /data/:name Get specific data file
  - POST /data/:name Store data (JSON body)

  DATA STORED IN: ${DATA_DIR}

  EXAMPLE USAGE:
  curl -X POST http://localhost:${PORT}/data/app-research \\
       -H "Content-Type: application/json" \\
       -d '{"companies": [...], "research": {...}}'

  Press Ctrl+C to stop
====================================================
`);
});
