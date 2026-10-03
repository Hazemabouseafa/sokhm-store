const http = require('http');
const fs = require('fs');
const path = require('path');

const db = process.env.TURSO_DATABASE_URL ? require('./database/turso.js') : require('./database/db.js');

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
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token'
  });
  res.end(JSON.stringify(data));
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-admin-token']) {
    return String(req.headers['x-admin-token']).trim();
  }
  const cookies = req.headers['cookie'] || '';
  const match = cookies.match(/sokhm_admin_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1].trim());
  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // ================= REST API ENDPOINTS (SQLITE DATABASE) =================
  if (pathname.startsWith('/api/')) {
    
    // 0.1 Admin Login: POST /api/admin/login
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { username, password } = body;
        if (!username || !password) {
          return sendJson(res, 400, { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
        }

        const verified = await db.verifyAdminCredentials(username, password);
        if (!verified) {
          return sendJson(res, 401, { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const session = await db.createSession(username);
        return sendJson(res, 200, {
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          token: session.token,
          username: session.username,
          expiresAt: session.expiresAt
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 0.2 Admin Session Verification: GET /api/admin/verify
    if (pathname === '/api/admin/verify' && req.method === 'GET') {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { authenticated: false, error: 'انتهت صلاحية الجلسة أو غير مسجل' });
        }
        return sendJson(res, 200, { 
          authenticated: true, 
          username: session.username,
          user: { username: session.username }
        });
      } catch (err) {
        return sendJson(res, 500, { authenticated: false, error: err.message });
      }
    }

    // 0.3 Admin Change Password: POST /api/admin/change-password
    if (pathname === '/api/admin/change-password' && req.method === 'POST') {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'غير مصرح: يجب تسجيل الدخول أولاً' });
        }

        const body = await readBody(req);
        const { currentPassword, newPassword } = body;
        if (!currentPassword || !newPassword) {
          return sendJson(res, 400, { success: false, error: 'يرجى تقديم كلمة المرور الحالية والجديدة' });
        }

        await db.updateAdminPassword(session.username, currentPassword, newPassword);
        return sendJson(res, 200, { success: true, message: 'تم تحديث كلمة المرور بنجاح في قاعدة البيانات' });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 0.4 Admin Logout: POST /api/admin/logout
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      try {
        const token = getBearerToken(req);
        if (token) await db.revokeSession(token);
        return sendJson(res, 200, { success: true, message: 'تم تسجيل الخروج بنجاح' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 1. GET /api/site-content
    if (pathname === '/api/site-content' && req.method === 'GET') {
      try {
        const content = await db.getSiteContent();
        return sendJson(res, 200, content);
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to read site content from database: ' + e.message });
      }
    }

    // 2. POST /api/site-content
    if (pathname === '/api/site-content' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const updated = await db.saveSiteContent(body);
        return sendJson(res, 200, { success: true, message: 'Site content updated in database successfully', data: updated });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 3. GET /api/products
    if (pathname === '/api/products' && req.method === 'GET') {
      try {
        const products = await db.getProducts();
        return sendJson(res, 200, products);
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to read products from database: ' + e.message });
      }
    }

    // 3.1 Reorder Products: POST or PUT /api/products/reorder
    if (pathname === '/api/products/reorder' && (req.method === 'POST' || req.method === 'PUT')) {
      try {
        const body = await readBody(req);
        const orderedIds = Array.isArray(body) ? body : (body.orderedIds || body.ids || []);
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
          return sendJson(res, 400, { error: 'Missing orderedIds array' });
        }
        const updated = await (db.reorderProducts ? db.reorderProducts(orderedIds) : db.getProducts());
        return sendJson(res, 200, { success: true, count: updated.length, products: updated });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 4. POST /api/products
    if (pathname === '/api/products' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        if (Array.isArray(body)) {
          const updated = await (db.saveProducts ? db.saveProducts(body) : db.getProducts());
          return sendJson(res, 200, { success: true, count: updated.length, data: updated });
        }
        const created = await db.upsertProduct(body);
        return sendJson(res, 201, { success: true, product: created });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }
    if (pathname === '/api/products' && req.method === 'DELETE') {
      try {
        const queryId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('slug');
        let idToDelete = queryId;
        if (!idToDelete) {
          const body = await readBody(req);
          idToDelete = body.id || body.slug;
        }
        if (!idToDelete) return sendJson(res, 400, { error: 'Missing product id to delete' });
        await db.deleteProduct(idToDelete);
        return sendJson(res, 200, { success: true, message: 'Product deleted successfully', id: idToDelete });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 4.1 REST: /api/products/:id
    const prodMatch = pathname.match(/^\/api\/products\/([^\/]+)$/);
    if (prodMatch) {
      const pid = decodeURIComponent(prodMatch[1]);
      if (req.method === 'GET') {
        try {
          const prod = await db.getProductById(pid);
          if (!prod) return sendJson(res, 404, { error: 'Product not found' });
          return sendJson(res, 200, prod);
        } catch (e) {
          return sendJson(res, 500, { error: e.message });
        }
      }
      if (req.method === 'PUT') {
        try {
          const body = await readBody(req);
          body.id = pid;
          const updated = await db.upsertProduct(body);
          return sendJson(res, 200, { success: true, product: updated });
        } catch (e) {
          return sendJson(res, 500, { error: e.message });
        }
      }
      if (req.method === 'DELETE') {
        try {
          await db.deleteProduct(pid);
          return sendJson(res, 200, { success: true, message: 'Product deleted successfully', id: pid });
        } catch (e) {
          return sendJson(res, 500, { error: e.message });
        }
      }
    }

    // 5. GET /api/categories
    if (pathname === '/api/categories' && req.method === 'GET') {
      try {
        const cats = await db.getCategories();
        return sendJson(res, 200, cats);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 6. POST /api/categories
    if (pathname === '/api/categories' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const cats = await db.addCategory(body);
        return sendJson(res, 200, { success: true, categories: cats });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 7. DELETE /api/categories & REST /api/categories/:id
    const catMatch = pathname.match(/^\/api\/categories\/([^\/]+)$/);
    if ((pathname === '/api/categories' || catMatch) && req.method === 'DELETE') {
      try {
        const slug = catMatch ? catMatch[1] : parsedUrl.searchParams.get('slug');
        if (!slug) return sendJson(res, 400, { error: 'Missing slug parameter' });
        const cats = await db.deleteCategory(slug);
        return sendJson(res, 200, { success: true, categories: cats });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 8. GET /api/stats (Database Health & Counts)
    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        const stats = await db.getStats();
        return sendJson(res, 200, stats);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 9. Orders: POST /api/orders & GET /api/orders
    if (pathname === '/api/orders' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const order = await db.createOrder(body);
        return sendJson(res, 201, { success: true, orderId: order.id, order });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }
    if (pathname === '/api/orders' && req.method === 'GET') {
      try {
        const statusFilter = parsedUrl.searchParams.get('status') || 'all';
        const orders = await db.getOrders(statusFilter);
        return sendJson(res, 200, orders);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 10. Orders: Status Update POST /api/orders/status or PATCH /api/orders/:id
    const orderMatch = pathname.match(/^\/api\/orders\/([^\/]+)$/);
    if ((pathname === '/api/orders/status' && req.method === 'POST') || (orderMatch && req.method === 'PATCH')) {
      try {
        const body = await readBody(req);
        const id = orderMatch ? orderMatch[1] : body.id;
        const status = body.status;
        if (!id || !status) return sendJson(res, 400, { error: 'Missing order id or status' });
        const updated = await db.updateOrderStatus(id, status);
        return sendJson(res, 200, { success: true, order: updated });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 11. Orders: DELETE /api/orders or DELETE /api/orders/:id
    if ((pathname === '/api/orders' || orderMatch) && req.method === 'DELETE') {
      try {
        const id = orderMatch ? orderMatch[1] : parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing order id' });
        await db.deleteOrder(id);
        return sendJson(res, 200, { success: true, message: 'Order deleted successfully' });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 12. Orders: GET /api/orders/stats
    if (pathname === '/api/orders/stats' && req.method === 'GET') {
      try {
        const stats = await db.getOrderStats();
        return sendJson(res, 200, stats);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 5. POST /api/upload-image
    if (pathname === '/api/upload-image' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const filename = body.filename || 'upload';
        const base64 = body.base64 || body.image || body.dataUrl;
        if (!base64) {
          return sendJson(res, 400, { success: false, error: 'Missing base64 image data' });
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

        const safeBaseName = path.basename(filename, path.extname(filename))
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase() || 'upload';
        const safeName = `sokhm_${safeBaseName}_${Date.now()}${ext}`;
        const assetsDir = path.join(__dirname, 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }
        const destPath = path.join(assetsDir, safeName);

        try {
          fs.writeFileSync(destPath, buffer);
          console.log(`Image uploaded successfully: ${safeName} (${buffer.length} bytes)`);
          return sendJson(res, 200, {
            success: true,
            url: `assets/${safeName}`,
            path: `assets/${safeName}`,
            name: safeName
          });
        } catch (writeErr) {
          // If disk write is not permitted, return the dataUrl directly
          console.warn('Disk write failed, returning base64 dataUrl:', writeErr.message);
          return sendJson(res, 200, {
            success: true,
            url: base64,
            name: safeName
          });
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    return sendJson(res, 404, { error: 'API route not found' });
  }

  // ================= STATIC FILE SERVING =================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/admin.html' || reqPath === '/admin-sokhm') {
    res.writeHead(302, { Location: '/admin-sokhm/' });
    return res.end();
  } else if (reqPath === '/admin-sokhm/') {
    reqPath = '/admin-sokhm/index.html';
  }

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found: ' + reqPath);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
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
  console.log(`Admin Portal: http://localhost:${PORT}/admin-sokhm/`);
});
