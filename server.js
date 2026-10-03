const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./database/db.js');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // 10MB limit for base64 image uploads
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // ================= REST API ENDPOINTS (SQLITE DATABASE) =================
  if (pathname.startsWith('/api/')) {
    
    // 1. GET /api/site-content
    if (pathname === '/api/site-content' && req.method === 'GET') {
      try {
        const content = db.getSiteContent();
        return sendJson(res, 200, content);
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to read site content from database: ' + e.message });
      }
    }

    // 2. POST /api/site-content
    if (pathname === '/api/site-content' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const updated = db.saveSiteContent(body);
        return sendJson(res, 200, { success: true, message: 'Site content updated in database successfully', data: updated });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 3. GET /api/products
    if (pathname === '/api/products' && req.method === 'GET') {
      try {
        const products = db.getProducts();
        return sendJson(res, 200, products);
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to read products from database: ' + e.message });
      }
    }

    // 4. POST /api/products
    if (pathname === '/api/products' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const updated = db.saveProducts(body);
        return sendJson(res, 200, { success: true, message: 'Products updated in database successfully', count: updated.length });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 5. GET /api/categories
    if (pathname === '/api/categories' && req.method === 'GET') {
      try {
        return sendJson(res, 200, db.getCategories());
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 6. POST /api/categories
    if (pathname === '/api/categories' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const cats = db.addCategory(body);
        return sendJson(res, 200, { success: true, categories: cats });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 7. DELETE /api/categories
    if (pathname === '/api/categories' && req.method === 'DELETE') {
      try {
        const slug = parsedUrl.searchParams.get('slug');
        if (!slug) return sendJson(res, 400, { error: 'Missing slug parameter' });
        const cats = db.deleteCategory(slug);
        return sendJson(res, 200, { success: true, categories: cats });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 8. GET /api/stats (Database Health & Counts)
    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        return sendJson(res, 200, db.getStats());
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 9. Orders: POST /api/orders & GET /api/orders
    if (pathname === '/api/orders' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const order = db.createOrder(body);
        return sendJson(res, 201, { success: true, orderId: order.id, order });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }
    if (pathname === '/api/orders' && req.method === 'GET') {
      try {
        const statusFilter = parsedUrl.searchParams.get('status') || 'all';
        return sendJson(res, 200, db.getOrders(statusFilter));
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 10. Orders: Status Update POST /api/orders/status
    if (pathname === '/api/orders/status' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { id, status } = body;
        if (!id || !status) return sendJson(res, 400, { error: 'Missing order id or status' });
        const updated = db.updateOrderStatus(id, status);
        return sendJson(res, 200, { success: true, order: updated });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 11. Orders: DELETE /api/orders
    if (pathname === '/api/orders' && req.method === 'DELETE') {
      try {
        const id = parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing order id' });
        db.deleteOrder(id);
        return sendJson(res, 200, { success: true, message: 'Order deleted successfully' });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 12. Orders: GET /api/orders/stats
    if (pathname === '/api/orders/stats' && req.method === 'GET') {
      try {
        return sendJson(res, 200, db.getOrderStats());
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 5. POST /api/upload-image
    if (pathname === '/api/upload-image' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const filename = body.filename;
        const base64 = body.base64 || body.image;
        if (!base64) {
          return sendJson(res, 400, { error: 'Missing base64 image data' });
        }

        // Clean base64 data
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let ext = '.jpg';
        let buffer;
        if (matches && matches.length === 3) {
          const mime = matches[1];
          if (mime.includes('png')) ext = '.png';
          else if (mime.includes('webp')) ext = '.webp';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(base64, 'base64');
        }

        const safeBaseName = (filename ? path.basename(filename, path.extname(filename)) : 'upload')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase();
        const safeName = `${safeBaseName}_${Date.now()}${ext}`;
        const destPath = path.join(__dirname, 'assets', safeName);

        fs.writeFileSync(destPath, buffer);
        console.log(`Image uploaded successfully: ${safeName} (${buffer.length} bytes)`);

        return sendJson(res, 200, {
          success: true,
          url: `assets/${safeName}`,
          path: `assets/${safeName}`,
          name: safeName
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    return sendJson(res, 404, { error: 'API route not found' });
  }

  // ================= STATIC FILE SERVING =================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + reqPath);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`SOKHM STORE with CMS API is live at http://localhost:${PORT}`);
  console.log(`Storefront: http://localhost:${PORT}/index.html`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin.html`);
});
