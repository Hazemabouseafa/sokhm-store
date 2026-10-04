const path = require('path');
const url = require('url');

// Determine database adapter: Neon PostgreSQL, Turso Cloud, or native SQLite
function getDb() {
  if (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL
  ) {
    return require('../database/neon.js');
  }
  if (process.env.TURSO_DATABASE_URL) {
    return require('../database/turso.js');
  }
  try {
    return require('../database/db.js');
  } catch (err) {
    console.warn('Native SQLite unavailable, falling back to Neon/Turso adapter:', err.message);
    return require('../database/neon.js');
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
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
  if (req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'sokhm_admin_token') return decodeURIComponent(v);
    }
  }
  return null;
}

module.exports = async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname || '';
  if (pathname.endsWith('/') && pathname.length > 1) {
    pathname = pathname.slice(0, -1);
  }

  const db = getDb();

  try {
    // 1. Admin Authentication Endpoints
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const { username, password } = body;
      if (!username || !password) {
        return sendJson(res, 400, { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
      }

      const user = await db.verifyAdminCredentials(username, password);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }

      const session = await db.createSession(user.username);
      return sendJson(res, 200, {
        success: true,
        token: session.token,
        user: { username: user.username }
      });
    }

    if (pathname === '/api/admin/verify' && req.method === 'GET') {
      const token = getBearerToken(req);
      if (!token) {
        return sendJson(res, 401, { authenticated: false, error: 'غير مسجل' });
      }
      const session = await db.validateSession(token);
      if (!session) {
        return sendJson(res, 401, { authenticated: false, error: 'انتهت صلاحية الجلسة' });
      }
      return sendJson(res, 200, {
        authenticated: true,
        username: session.username,
        user: { username: session.username }
      });
    }

    if (pathname === '/api/admin/change-password' && req.method === 'POST') {
      const token = getBearerToken(req);
      const session = await db.validateSession(token);
      if (!session) {
        return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول أولاً' });
      }
      const body = await parseBody(req);
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        return sendJson(res, 400, { success: false, error: 'يرجى تقديم كلمة المرور الحالية والجديدة' });
      }
      await db.updateAdminPassword(session.username, currentPassword, newPassword);
      return sendJson(res, 200, { success: true, message: 'تم تحديث كلمة المرور بنجاح' });
    }

    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      const token = getBearerToken(req);
      if (token) await db.revokeSession(token);
      return sendJson(res, 200, { success: true });
    }

    if ((pathname === '/api/admin/seed-turso' || pathname === '/api/admin/seed-neon' || pathname === '/api/admin/seed-database') && req.method === 'POST') {
      const token = getBearerToken(req);
      if (!token) {
        return sendJson(res, 401, { success: false, error: 'يجب تسجيل الدخول كمسؤول أولاً' });
      }
      const session = await db.validateSession(token);
      if (!session) {
        return sendJson(res, 401, { success: false, error: 'انتهت صلاحية الجلسة' });
      }
      if (db.seedNeonDatabase) {
        const result = await db.seedNeonDatabase(true);
        return sendJson(res, 200, result);
      }
      if (db.seedTursoDatabase) {
        const result = await db.seedTursoDatabase(true);
        return sendJson(res, 200, result);
      }
      return sendJson(res, 200, { success: true, message: 'قاعدة البيانات جاهزة ومحدثة' });
    }

    // 2. Site Content
    if (pathname === '/api/site-content') {
      if (req.method === 'GET') {
        const content = await db.getSiteContent();
        return sendJson(res, 200, content);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        await db.saveSiteContent(body);
        return sendJson(res, 200, { success: true });
      }
    }

    // 3. Products
    if (pathname === '/api/products/reorder' && (req.method === 'POST' || req.method === 'PUT')) {
      const body = await parseBody(req);
      const orderedIds = Array.isArray(body) ? body : (body.orderedIds || body.ids || []);
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return sendJson(res, 400, { error: 'Missing orderedIds array' });
      }
      const prods = await (db.reorderProducts ? db.reorderProducts(orderedIds) : db.getProducts());
      return sendJson(res, 200, { success: true, count: prods.length, products: prods });
    }

    if (pathname === '/api/products') {
      if (req.method === 'GET') {
        const prods = await db.getProducts();
        return sendJson(res, 200, prods);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (Array.isArray(body)) {
          const prods = await (db.saveProducts ? db.saveProducts(body) : db.getProducts());
          return sendJson(res, 200, { success: true, count: prods.length, data: prods });
        }
        const created = await db.upsertProduct(body);
        return sendJson(res, 201, { success: true, product: created });
      }
      if (req.method === 'DELETE') {
        const queryId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('slug');
        let idToDelete = queryId;
        if (!idToDelete) {
          const body = await parseBody(req);
          idToDelete = body.id || body.slug;
        }
        if (!idToDelete) return sendJson(res, 400, { error: 'Missing product id' });
        await db.deleteProduct(idToDelete);
        return sendJson(res, 200, { success: true, message: 'تم حذف المنتج بنجاح', id: idToDelete });
      }
    }

    const prodMatch = pathname.match(/^\/api\/products\/([^\/]+)$/);
    if (prodMatch) {
      const id = decodeURIComponent(prodMatch[1]);
      if (req.method === 'GET') {
        const prod = await db.getProductById(id);
        if (!prod) return sendJson(res, 404, { success: false, error: 'المنتج غير موجود' });
        return sendJson(res, 200, prod);
      }
      if (req.method === 'PUT') {
        const body = await parseBody(req);
        body.id = id;
        const updated = await db.upsertProduct(body);
        return sendJson(res, 200, { success: true, product: updated });
      }
      if (req.method === 'DELETE') {
        await db.deleteProduct(id);
        return sendJson(res, 200, { success: true, message: 'تم حذف المنتج بنجاح', id });
      }
    }

    // 4. Categories
    if (pathname === '/api/categories') {
      if (req.method === 'GET') {
        const cats = await db.getCategories();
        return sendJson(res, 200, cats);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const added = await db.addCategory(body);
        return sendJson(res, 201, added);
      }
      if (req.method === 'DELETE') {
        const slug = parsedUrl.searchParams.get('slug') || parsedUrl.searchParams.get('id');
        if (!slug) return sendJson(res, 400, { error: 'Missing slug parameter' });
        await db.deleteCategory(slug);
        return sendJson(res, 200, { success: true, id: slug });
      }
    }

    const catMatch = pathname.match(/^\/api\/categories\/([^\/]+)$/);
    if (catMatch && req.method === 'DELETE') {
      await db.deleteCategory(catMatch[1]);
      return sendJson(res, 200, { success: true, id: catMatch[1] });
    }

    // 5. Orders
    if (pathname === '/api/orders/stats' && req.method === 'GET') {
      const stats = await db.getOrderStats();
      return sendJson(res, 200, stats);
    }

    if (pathname === '/api/orders') {
      if (req.method === 'GET') {
        const statusFilter = parsedUrl.searchParams.get('status') || 'all';
        const orders = await db.getOrders(statusFilter);
        return sendJson(res, 200, orders);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const order = await db.createOrder(body);
        return sendJson(res, 201, { success: true, order });
      }
      if (req.method === 'DELETE') {
        const id = parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing order id' });
        await db.deleteOrder(id);
        return sendJson(res, 200, { success: true, id });
      }
    }

    if (pathname === '/api/orders/status' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.id || !body.status) return sendJson(res, 400, { error: 'Missing id or status' });
      const updated = await db.updateOrderStatus(body.id, body.status);
      return sendJson(res, 200, updated);
    }

    const orderMatch = pathname.match(/^\/api\/orders\/([^\/]+)$/);
    if (orderMatch) {
      const id = orderMatch[1];
      if (req.method === 'PATCH') {
        const body = await parseBody(req);
        const updated = await db.updateOrderStatus(id, body.status);
        return sendJson(res, 200, updated);
      }
      if (req.method === 'DELETE') {
        await db.deleteOrder(id);
        return sendJson(res, 200, { success: true, id });
      }
    }

    // 5.5 Discount Codes Endpoints
    if (pathname === '/api/discounts') {
      if (req.method === 'GET') {
        const discounts = await db.getDiscounts();
        return sendJson(res, 200, discounts);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        try {
          const created = await db.createDiscount(body);
          return sendJson(res, 201, { success: true, discount: created });
        } catch (e) {
          return sendJson(res, 400, { error: e.message });
        }
      }
      if (req.method === 'DELETE') {
        const id = parsedUrl.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing discount id' });
        await db.deleteDiscount(id);
        return sendJson(res, 200, { success: true, message: 'Discount deleted' });
      }
    }

    if (pathname === '/api/discounts/validate' && req.method === 'POST') {
      const body = await parseBody(req);
      try {
        const result = await db.validateDiscount(body.code, body.subtotal);
        if (!result.valid) {
          return sendJson(res, 400, result);
        }
        return sendJson(res, 200, result);
      } catch (e) {
        return sendJson(res, 500, { valid: false, error: e.message });
      }
    }

    const discMatch = pathname.match(/^\/api\/discounts\/([^\/]+)$/);
    if (discMatch && req.method === 'DELETE') {
      const id = discMatch[1];
      await db.deleteDiscount(id);
      return sendJson(res, 200, { success: true, message: 'Discount deleted' });
    }

    const discToggleMatch = pathname.match(/^\/api\/discounts\/([^\/]+)\/toggle$/);
    if ((discToggleMatch || pathname === '/api/discounts/toggle') && (req.method === 'PUT' || req.method === 'POST')) {
      const body = await parseBody(req);
      const id = discToggleMatch ? discToggleMatch[1] : body.id;
      if (!id) return sendJson(res, 400, { error: 'Missing discount id' });
      try {
        const resObj = await db.toggleDiscount(id);
        return sendJson(res, 200, { success: true, ...resObj });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    // 6. Stats
    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = await db.getStats();
      return sendJson(res, 200, stats);
    }

    // 7. Base64 Image Upload
    if (pathname === '/api/upload-image' && req.method === 'POST') {
      const body = await parseBody(req);
      const imgData = body.dataUrl || body.image || body.base64;
      if (imgData) {
        return sendJson(res, 200, { success: true, url: imgData });
      }
      return sendJson(res, 400, { success: false, error: 'لم يتم استلام بيانات الصورة' });
    }

    return sendJson(res, 404, { error: 'API route not found: ' + pathname });

  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: err.message });
  }
};
