const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { generateCsvExport, generateFullJsonBackup } = require('./database/csv-export.js');

const driver = String(process.env.DB_DRIVER || '').toLowerCase().trim();
const pgUrl =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

let db;
if (driver === 'sqlite' || process.env.USE_LOCAL_SQLITE === 'true' || process.env.USE_LOCAL_SQLITE === '1') {
  db = require('./database/db.js');
} else if (driver === 'neon' || pgUrl.includes('neon.tech')) {
  db = require('./database/neon.js');
} else if (driver === 'turso' || process.env.TURSO_DATABASE_URL) {
  db = require('./database/turso.js');
} else {
  db = require('./database/db.js');
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const STORAGE_ROOT = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : null;
const PERSISTENT_UPLOADS_DIR = STORAGE_ROOT
  ? path.join(STORAGE_ROOT, 'uploads')
  : path.join(__dirname, 'assets', 'uploads');

if (!fs.existsSync(PERSISTENT_UPLOADS_DIR)) {
  try {
    fs.mkdirSync(PERSISTENT_UPLOADS_DIR, { recursive: true });
  } catch (_) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // 50MB limit for multi-image base64 uploads
      if (body.length > 50 * 1024 * 1024) {
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

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);
  let pathname = parsedUrl.pathname || '';
  if (pathname.endsWith('/') && pathname.length > 1 && pathname.startsWith('/api/')) {
    pathname = pathname.slice(0, -1);
  }

  // ================= REST API ENDPOINTS (SQLITE DATABASE) =================
  if (pathname.startsWith('/api/')) {

    // 0.0 Healthcheck Endpoint (Coolify / Docker Healthcheck)
    if (pathname === '/api/health' && req.method === 'GET') {
      try {
        const stats = await db.getStats();
        return sendJson(res, 200, {
          status: 'ok',
          service: 'sokhm-store',
          engine: stats.engine,
          dbPath: stats.dbPath,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        return sendJson(res, 500, { status: 'error', error: err.message });
      }
    }
    
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

    // 0.5 Admin Seed Database: POST /api/admin/seed-database
    if ((pathname === '/api/admin/seed-turso' || pathname === '/api/admin/seed-neon' || pathname === '/api/admin/seed-database') && req.method === 'POST') {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول أولاً' });
        }
        if (db.seedNeonDatabase) {
          const result = await db.seedNeonDatabase(true);
          return sendJson(res, 200, result);
        }
        if (db.seedTursoDatabase) {
          const result = await db.seedTursoDatabase(true);
          return sendJson(res, 200, result);
        }
        const prods = await db.getProducts();
        const cats = await db.getCategories();
        return sendJson(res, 200, { success: true, products: prods.length, categories: cats.length, message: 'قاعدة البيانات المحلية جاهزة ومحدثة' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 0.6 Admin Data Export (CSV & Full JSON Backup)
    if (pathname === '/api/admin/export' && req.method === 'GET') {
      try {
        const token = getBearerToken(req) || parsedUrl.searchParams.get('token');
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول لتصدير البيانات' });
        }
        const exportType = parsedUrl.searchParams.get('type') || 'orders';
        const statusFilter = parsedUrl.searchParams.get('status') || 'all';
        const { filename, csv } = await generateCsvExport(db, exportType, { status: statusFilter });
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=UTF-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(csv, 'utf8');
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (pathname === '/api/admin/backup-json' && req.method === 'GET') {
      try {
        const token = getBearerToken(req) || parsedUrl.searchParams.get('token');
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول لتحميل النسخة الاحتياطية' });
        }
        const backup = await generateFullJsonBackup(db);
        const filename = `sokhm-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(backup, null, 2), 'utf8');
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
        const queryId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('slug');
        if (queryId) {
          const prod = await db.getProductById(queryId);
          if (!prod) return sendJson(res, 404, { success: false, error: 'Product not found' });
          return sendJson(res, 200, prod);
        }
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
        const slug = catMatch
          ? decodeURIComponent(catMatch[1])
          : (parsedUrl.searchParams.get('slug') || parsedUrl.searchParams.get('id'));
        if (!slug) return sendJson(res, 400, { error: 'Missing slug parameter' });
        const cats = await db.deleteCategory(slug);
        return sendJson(res, 200, { success: true, categories: cats });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 7.5 Site Visits Tracking & Analytics
    if ((pathname === '/api/visits' || pathname === '/api/track-visit') && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || '';
        if (db.recordVisit) {
          await db.recordVisit({
            page: body.page || '/',
            visitorId: body.visitorId || body.visitor_id,
            referrer: body.referrer || req.headers['referer'] || '',
            userAgent,
            ip
          });
        }
        return sendJson(res, 200, { success: true });
      } catch (e) {
        return sendJson(res, 200, { success: false });
      }
    }

    if ((pathname === '/api/visits' || pathname === '/api/visits/stats') && req.method === 'GET') {
      try {
        const stats = db.getVisitStats ? await db.getVisitStats() : { totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, dailyHistory: [] };
        return sendJson(res, 200, stats);
      } catch (e) {
        return sendJson(res, 200, { totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, dailyHistory: [] });
      }
    }

    if ((pathname === '/api/visits/reset' && req.method === 'POST') || (pathname === '/api/visits' && req.method === 'DELETE')) {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول لتصفير الزيارات' });
        }
        const cleared = db.resetVisits ? await db.resetVisits() : { success: true, totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, dailyHistory: [] };
        return sendJson(res, 200, cleared);
      } catch (e) {
        return sendJson(res, 500, { success: false, error: e.message });
      }
    }

    // 7.6 Customer Reviews & Testimonials Endpoints
    if (pathname === '/api/reviews' && req.method === 'GET') {
      try {
        const productId = parsedUrl.searchParams.get('productId') || parsedUrl.searchParams.get('product_id') || '';
        const homepageOnly = parsedUrl.searchParams.get('homepage') === '1' || parsedUrl.searchParams.get('homepage') === 'true';
        const wantsPending = parsedUrl.searchParams.get('includePending') === '1' || parsedUrl.searchParams.get('includePending') === 'true' || parsedUrl.searchParams.get('all') === '1';
        let includePending = false;
        if (wantsPending) {
          const token = getBearerToken(req);
          const session = token ? await db.validateSession(token) : null;
          if (session) includePending = true;
        }
        const list = db.getReviews ? await db.getReviews({ productId, homepageOnly, includePending }) : [];
        return sendJson(res, 200, list);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    if (pathname === '/api/reviews' && req.method === 'POST') {
      try {
        const token = getBearerToken(req);
        const session = token ? await db.validateSession(token) : null;
        const body = await readBody(req);
        const isAdmin = Boolean(session);
        const reviewPayload = {
          ...body,
          isAdmin,
          status: isAdmin ? (body.status || 'approved') : 'pending'
        };
        const review = await db.createReview(reviewPayload);
        return sendJson(res, 201, {
          success: true,
          pendingApproval: review.status === 'pending',
          message: review.status === 'pending'
            ? 'تم استلام تقييمك بنجاح وسيتم نشره فور مراجعته واعتماده من إدارة المتجر'
            : 'تم إضافة ونشر التقييم بنجاح',
          review
        });
      } catch (e) {
        return sendJson(res, 400, { success: false, error: e.message });
      }
    }

    const revApproveMatch = pathname.match(/^\/api\/reviews\/([^\/]+)\/approve$/);
    if (revApproveMatch && (req.method === 'POST' || req.method === 'PUT')) {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول لاعتماد التقييم' });
        }
        const id = decodeURIComponent(revApproveMatch[1]);
        const review = db.approveReview ? await db.approveReview(id) : null;
        return sendJson(res, 200, { success: true, review });
      } catch (e) {
        return sendJson(res, 400, { success: false, error: e.message });
      }
    }

    const revToggleMatch = pathname.match(/^\/api\/reviews\/([^\/]+)\/toggle$/);
    if (revToggleMatch && (req.method === 'POST' || req.method === 'PUT')) {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول' });
        }
        const id = decodeURIComponent(revToggleMatch[1]);
        const updated = await db.toggleReviewHomepage(id);
        return sendJson(res, 200, updated);
      } catch (e) {
        return sendJson(res, 400, { success: false, error: e.message });
      }
    }

    const revMatch = pathname.match(/^\/api\/reviews\/([^\/]+)$/);
    if ((pathname === '/api/reviews' || revMatch) && req.method === 'DELETE') {
      try {
        const token = getBearerToken(req);
        const session = await db.validateSession(token);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول لحذف التقييم' });
        }
        const id = revMatch ? decodeURIComponent(revMatch[1]) : parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing review id' });
        await db.deleteReview(id);
        return sendJson(res, 200, { success: true, id });
      } catch (e) {
        return sendJson(res, 400, { success: false, error: e.message });
      }
    }

    // 8. GET /api/stats (Database Health & Counts)
    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        const stats = await db.getStats();
        if (db.getVisitStats) {
          stats.visits = await db.getVisitStats();
        }
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

    // 13. Discounts: GET /api/discounts
    if (pathname === '/api/discounts' && req.method === 'GET') {
      try {
        const discounts = await db.getDiscounts();
        return sendJson(res, 200, discounts);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 14. Discounts: POST /api/discounts
    if (pathname === '/api/discounts' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const created = await db.createDiscount(body);
        return sendJson(res, 201, { success: true, discount: created });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    // 15. Discounts: POST /api/discounts/validate (Public Validation)
    if (pathname === '/api/discounts/validate' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const result = await db.validateDiscount(body.code, body.subtotal);
        if (!result.valid) {
          return sendJson(res, 400, result);
        }
        return sendJson(res, 200, result);
      } catch (e) {
        return sendJson(res, 500, { valid: false, error: e.message });
      }
    }

    // 16. Discounts: DELETE /api/discounts/:id or /api/discounts?id=...
    const discMatch = pathname.match(/^\/api\/discounts\/([^\/]+)$/);
    if ((pathname === '/api/discounts' || discMatch) && req.method === 'DELETE') {
      try {
        const id = discMatch ? discMatch[1] : parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing discount id' });
        await db.deleteDiscount(id);
        return sendJson(res, 200, { success: true, message: 'Discount deleted successfully' });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // 17. Discounts: PUT /api/discounts/:id/toggle or POST /api/discounts/toggle
    const discToggleMatch = pathname.match(/^\/api\/discounts\/([^\/]+)\/toggle$/);
    if ((discToggleMatch || pathname === '/api/discounts/toggle') && (req.method === 'PUT' || req.method === 'POST')) {
      try {
        const body = await readBody(req);
        const id = discToggleMatch ? discToggleMatch[1] : body.id;
        if (!id) return sendJson(res, 400, { error: 'Missing discount id' });
        const resObj = await db.toggleDiscount(id);
        return sendJson(res, 200, { success: true, ...resObj });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    // 17.5 Discounts: PUT /api/discounts/:id/reset or POST /api/discounts/reset
    const discResetMatch = pathname.match(/^\/api\/discounts\/([^\/]+)\/reset$/);
    if ((discResetMatch || pathname === '/api/discounts/reset') && (req.method === 'PUT' || req.method === 'POST')) {
      try {
        const body = await readBody(req);
        const id = discResetMatch ? discResetMatch[1] : body.id;
        if (!id) return sendJson(res, 400, { error: 'Missing discount id' });
        const resObj = await db.resetDiscountUsage(id);
        return sendJson(res, 200, { success: true, ...resObj });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    // 5. POST /api/upload-image
    if (pathname === '/api/upload-image' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const filename = body.filename || 'upload';
        const base64 = body.base64 || body.image || body.dataUrl || body.imageBase64;
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

        const rawBaseName = path.basename(filename, path.extname(filename))
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .toLowerCase() || 'img';
        const randSuffix = Math.random().toString(36).substring(2, 8);
        const safeName = `sokhm_${rawBaseName}_${Date.now()}_${randSuffix}${ext}`;
        if (!fs.existsSync(PERSISTENT_UPLOADS_DIR)) {
          fs.mkdirSync(PERSISTENT_UPLOADS_DIR, { recursive: true });
        }
        const destPath = path.join(PERSISTENT_UPLOADS_DIR, safeName);

        try {
          fs.writeFileSync(destPath, buffer);
          console.log(`Image uploaded successfully: ${safeName} (${buffer.length} bytes)`);
          return sendJson(res, 200, {
            success: true,
            url: `assets/uploads/${safeName}`,
            path: `assets/uploads/${safeName}`,
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

    return sendJson(res, 404, { error: 'API route not found: ' + pathname });
  }

  // ================= STATIC FILE SERVING =================
  let reqPath = decodeURIComponent(pathname || '/');
  const lowerPathOnly = reqPath.toLowerCase();

  // Friendly Admin & Auth URL routing (supports /admin, /admin-sokhm, /dashboard, /login, etc.)
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (
    lowerPathOnly === '/admin' ||
    lowerPathOnly === '/admin/' ||
    lowerPathOnly === '/admin.html' ||
    lowerPathOnly === '/admin-sokhm' ||
    lowerPathOnly === '/dashboard' ||
    lowerPathOnly === '/dashboard/'
  ) {
    res.writeHead(302, { Location: '/admin-sokhm/' });
    return res.end();
  } else if (
    lowerPathOnly === '/login' ||
    lowerPathOnly === '/login/' ||
    lowerPathOnly === '/login.html' ||
    lowerPathOnly === '/admin/login' ||
    lowerPathOnly === '/admin/login/' ||
    lowerPathOnly === '/admin/login.html' ||
    lowerPathOnly === '/admin-sokhm/login' ||
    lowerPathOnly === '/admin-sokhm/login/'
  ) {
    res.writeHead(302, { Location: '/admin-sokhm/login.html' });
    return res.end();
  } else if (lowerPathOnly === '/admin-sokhm/' || lowerPathOnly === '/admin-sokhm/index') {
    reqPath = '/admin-sokhm/index.html';
  } else if (lowerPathOnly.startsWith('/admin/')) {
    reqPath = '/admin-sokhm/' + reqPath.slice('/admin/'.length);
  }

  // Block sensitive server/database files from direct static access
  const lowerReq = reqPath.toLowerCase();
  if (
    lowerReq.startsWith('/database/') ||
    lowerReq.startsWith('/storage/') ||
    lowerReq.startsWith('/.env') ||
    lowerReq.startsWith('/.git') ||
    lowerReq === '/server.js' ||
    lowerReq.endsWith('.db') ||
    lowerReq.endsWith('.db-wal') ||
    lowerReq.endsWith('.db-shm')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end('403 Forbidden');
  }

  let filePath = path.resolve(__dirname, '.' + reqPath);

  // Serve persistent uploaded images from STORAGE_DIR/uploads when mapped to /assets/uploads/*
  if (reqPath.startsWith('/assets/uploads/')) {
    const uploadBase = path.basename(reqPath);
    const persistentCandidate = path.join(PERSISTENT_UPLOADS_DIR, uploadBase);
    if (fs.existsSync(persistentCandidate)) {
      filePath = persistentCandidate;
    }
  } else if (!filePath.startsWith(path.resolve(__dirname))) {
    // Path traversal guard
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end('403 Forbidden');
  }

  // Support clean extensionless URLs (e.g. /product -> /product.html) and directory index.html fallback
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const idxCandidate = path.join(filePath, 'index.html');
      if (fs.existsSync(idxCandidate)) {
        filePath = idxCandidate;
      }
    } else if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  } catch (_) {}

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isImageOrFont = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.ico', '.woff', '.woff2'].includes(ext);

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      return res.end('404 Not Found: ' + reqPath);
    }

    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    if (isImageOrFont && req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'ETag': etag,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400'
      });
      return res.end();
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        return res.end('500 Server Error: ' + err.code);
      }

      const headers = { 'Content-Type': contentType, 'ETag': etag };
      if (isImageOrFont) {
        headers['Cache-Control'] = 'public, max-age=604800, stale-while-revalidate=86400';
      } else if (ext === '.html') {
        headers['Cache-Control'] = 'no-cache';
      } else if (ext === '.css' || ext === '.js') {
        headers['Cache-Control'] = 'public, max-age=3600, stale-while-revalidate=86400';
      }

      const acceptEnc = String(req.headers['accept-encoding'] || '');
      const isCompressible = ['.html', '.css', '.js', '.json', '.svg'].includes(ext) && content.length > 1024;
      if (isCompressible && acceptEnc.includes('gzip')) {
        zlib.gzip(content, (gzErr, compressed) => {
          if (!gzErr && compressed) {
            headers['Content-Encoding'] = 'gzip';
            headers['Vary'] = 'Accept-Encoding';
            res.writeHead(200, headers);
            return res.end(compressed);
          }
          res.writeHead(200, headers);
          res.end(content);
        });
        return;
      }

      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, HOST, () => {
  console.log(`✦ SOKHM STORE Server is live at http://${HOST}:${PORT}`);
  console.log(`✦ Storefront: http://localhost:${PORT}/index.html`);
  console.log(`✦ Admin Portal: http://localhost:${PORT}/admin-sokhm/`);
  console.log(`✦ Healthcheck: http://localhost:${PORT}/api/health`);
});
