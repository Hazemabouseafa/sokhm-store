/**
 * ✦ SOKHM ATELIER - Database Access Layer & Infrastructure
 * Built on native Node.js SQLite (DatabaseSync)
 * Provides relational persistence, transactions, auto-migrations, and seeding.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');

// Ensure database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'sokhm.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrent reads and foreign keys
db.exec('PRAGMA foreign_keys = ON;');

/**
 * 1. Initialize Schema & Tables
 */
function initSchema() {
  db.exec(`
    -- Site Content Key-Value / Section Storage
    CREATE TABLE IF NOT EXISTS site_content (
      section_key TEXT PRIMARY KEY,
      content_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Garments & Products Table
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      category_id TEXT,
      price REAL NOT NULL,
      badge TEXT,
      images_json TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      short_desc TEXT,
      description TEXT,
      fabric TEXT,
      fit_advice TEXT,
      care_advice TEXT,
      colors_json TEXT,
      model_info TEXT,
      stock_status TEXT DEFAULT 'in_stock',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders Table (E-commerce Order Infrastructure)
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_notes TEXT,
      items_json TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Admin Users Table (Credentials & Authentication)
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Admin Sessions Table (Persistent Auth Tokens)
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
  `);

  try {
    db.exec('ALTER TABLE orders ADD COLUMN customer_notes TEXT;');
  } catch (e) {
    // Column already exists
  }
}

/**
 * 2. Automated Seed Migration from legacy JSON files
 */
function autoSeed() {
  // Check if categories are empty
  const catCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
  const prodCount = db.prepare('SELECT COUNT(*) AS count FROM products').get();
  const contentCount = db.prepare('SELECT COUNT(*) AS count FROM site_content').get();

  const siteContentFile = path.join(__dirname, '..', 'data', 'site-content.json');
  const productsFile = path.join(__dirname, '..', 'data', 'products.json');

  if (contentCount.count === 0 && fs.existsSync(siteContentFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));
      if (data.homepage) {
        db.prepare('INSERT OR REPLACE INTO site_content (section_key, content_json) VALUES (?, ?)').run('homepage', JSON.stringify(data.homepage));
      }
      if (data.productPage) {
        db.prepare('INSERT OR REPLACE INTO site_content (section_key, content_json) VALUES (?, ?)').run('productPage', JSON.stringify(data.productPage));
      }
      if (Array.isArray(data.categories) && catCount.count === 0) {
        const insertCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, slug) VALUES (?, ?, ?)');
        for (const cat of data.categories) {
          insertCat.run(cat.id || cat.slug, cat.name, cat.slug || cat.id);
        }
      }
      console.log('✓ Database site_content & categories successfully seeded from site-content.json');
    } catch (err) {
      console.error('Failed to seed site_content:', err);
    }
  }

  if (prodCount.count === 0 && fs.existsSync(productsFile)) {
    try {
      const prods = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
      if (Array.isArray(prods)) {
        const insertProd = db.prepare(`
          INSERT OR REPLACE INTO products (
            id, name, subtitle, category_id, price, badge,
            images_json, sizes_json, short_desc, description,
            fabric, fit_advice, care_advice, colors_json, model_info, stock_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of prods) {
          insertProd.run(
            p.id,
            p.name,
            p.subtitle || '',
            p.category || 'hoodies',
            typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
            p.badge || '',
            JSON.stringify(p.images || []),
            JSON.stringify(p.sizes || []),
            p.shortDesc || '',
            p.description || '',
            p.fabric || '',
            p.fitAdvice || '',
            p.careAdvice || '',
            JSON.stringify(p.colors || []),
            p.modelInfo || '',
            'in_stock'
          );
        }
        console.log(`✓ Database products successfully seeded (${prods.length} garments) from products.json`);
      }
    } catch (err) {
      console.error('Failed to seed products:', err);
    }
  }

  // Check if orders are empty and seed sample initial orders
  const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get();
  if (orderCount.count === 0) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, customer_name, customer_phone, customer_city, customer_address, customer_notes, items_json, total_price, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    insertOrder.run(
      'SKM-8491',
      'أحمد حسن الشريف',
      '01098765432',
      'القاهرة',
      'شارع مصدق، عمارة 14، الدور الخامس، الدقي',
      'يرجى الاتصال قبل الوصول بنصف ساعة',
      JSON.stringify([
        {
          id: 'sokhm-noir-01',
          name: 'SIGNATURE HOODIE',
          size: 'L',
          color: 'Onyx Black',
          quantity: 1,
          price: 1850,
          image: 'assets/sokhm-card-1.jpg'
        }
      ]),
      1850,
      'pending',
      '-2 hours'
    );

    insertOrder.run(
      'SKM-8492',
      'عمر مصطفى عبد العزيز',
      '01123456789',
      'الإسكندرية',
      'طريق الحرية، برج النصر، الدور الثالث، سموحة',
      'التسليم في المساء بعد الساعة 5',
      JSON.stringify([
        {
          id: 'sokhm-noir-02',
          name: 'ESSENTIAL HOODIE',
          size: 'XL',
          color: 'Sand Cream',
          quantity: 1,
          price: 1850,
          image: 'assets/sokhm-card-2.jpg'
        },
        {
          id: 'sokhm-noir-03',
          name: 'COMBAT HOODIE',
          size: 'XL',
          color: 'Tactical Olive',
          quantity: 1,
          price: 1850,
          image: 'assets/sokhm-card-3.jpg'
        }
      ]),
      3700,
      'confirmed',
      '-5 hours'
    );

    console.log('✓ Initial sample orders seeded successfully');
  }

  // Check if admin user exists, seed default websiteadmin / websiteadmin
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get();
  if (userCount.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('websiteadmin', salt, 64).toString('hex');
    db.prepare(`
      INSERT INTO admin_users (username, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run('websiteadmin', hash, salt);
    console.log('✓ Admin user "websiteadmin" initialized successfully with default credentials.');
  }

  // Check default checkout content
  const checkoutCount = db.prepare("SELECT COUNT(*) AS count FROM site_content WHERE section_key = 'checkout'").get();
  if (checkoutCount.count === 0) {
    const defaultCheckout = {
      title: "إتمام الطلب والشحن الفاخر",
      subtitle: "يرجى استيفاء بيانات التوصيل بدقة لضمان سرعة وصول الشحنة",
      codTitle: "الدفع نقدياً عند الاستلام (COD)",
      codSubtitle: "معاينة القطع قبل الدفع متاحة مع مندوب التوصيل.",
      shippingRuleText: "شحن سريع مجاني لجميع الطلبات بقيمة 2,500 ج.م أو أكثر",
      freeShippingThreshold: 2500,
      standardShippingFee: 75,
      submitButtonText: "تأكيد الطلب الآن",
      trustHighlights: [
        "500 GSM قطن مصري فاخر فائق الكثافة",
        "شحن سريع لجميع المحافظات خلال 24-48 ساعة",
        "سياسة استبدال واسترجاع سلسة لمدة 30 يوم"
      ],
      successTitle: "تم استلام وتأكيد طلبك بنجاح!",
      successSubtitle: "شكراً لاختيارك ✦ SOKHM ATELIER. تم تسجيل طلبك في نظامنا وسيقوم مندوب الشحن بالتواصل معك هاتفياً قبل التوصيل.",
      whatsappPhone: "01098765432",
      whatsappButtonText: "متابعة الطلب عبر WhatsApp"
    };
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('checkout', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(defaultCheckout));
    console.log('✓ Default checkout configurations initialized');
  }

  const visCount = db.prepare("SELECT COUNT(*) AS count FROM site_content WHERE section_key = 'visibility'").get();
  if (visCount.count === 0) {
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('visibility', '{}', CURRENT_TIMESTAMP)").run();
  }
}

// Execute initial setup
initSchema();
autoSeed();

// Backup file sync helper
function syncJsonBackups(siteContent, productsList) {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (siteContent) {
      fs.writeFileSync(path.join(dataDir, 'site-content.json'), JSON.stringify(siteContent, null, 2), 'utf8');
    }
    if (productsList) {
      fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(productsList, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('Backup file sync warning:', e.message);
  }
}

// ================= CRUD REPOSITORY METHODS =================

/**
 * Get unified site content object (homepage, productPage, checkout, visibility, categories)
 */
function getSiteContent() {
  const hpRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'homepage'").get();
  const ppRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'productPage'").get();
  const chkRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'checkout'").get();
  const visRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'visibility'").get();
  const catRows = db.prepare("SELECT id, name, slug FROM categories ORDER BY created_at ASC").all();

  const defaultCheckout = {
    title: "إتمام الطلب والشحن الفاخر",
    subtitle: "يرجى استيفاء بيانات التوصيل بدقة لضمان سرعة وصول الشحنة",
    codTitle: "الدفع نقدياً عند الاستلام (COD)",
    codSubtitle: "معاينة القطع قبل الدفع متاحة مع مندوب التوصيل.",
    shippingRuleText: "شحن سريع مجاني لجميع الطلبات بقيمة 2,500 ج.م أو أكثر",
    freeShippingThreshold: 2500,
    standardShippingFee: 75,
    submitButtonText: "تأكيد الطلب الآن",
    trustHighlights: [
      "500 GSM قطن مصري فاخر فائق الكثافة",
      "شحن سريع لجميع المحافظات خلال 24-48 ساعة",
      "سياسة استبدال واسترجاع سلسة لمدة 30 يوم"
    ],
    successTitle: "تم استلام وتأكيد طلبك بنجاح!",
    successSubtitle: "شكراً لاختيارك ✦ SOKHM ATELIER. تم تسجيل طلبك في نظامنا وسيقوم مندوب الشحن بالتواصل معك هاتفياً قبل التوصيل.",
    whatsappPhone: "01098765432",
    whatsappButtonText: "متابعة الطلب عبر WhatsApp"
  };

  return {
    homepage: hpRow ? JSON.parse(hpRow.content_json) : {},
    productPage: ppRow ? JSON.parse(ppRow.content_json) : {},
    checkout: chkRow ? JSON.parse(chkRow.content_json) : defaultCheckout,
    visibility: visRow ? JSON.parse(visRow.content_json) : {},
    categories: catRows.map(c => ({ id: c.id, name: c.name, slug: c.slug }))
  };
}

/**
 * Save site content updates
 */
function saveSiteContent(content) {
  if (content.homepage) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('homepage', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.homepage));
  }

  if (content.productPage) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('productPage', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.productPage));
  }

  if (content.checkout) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('checkout', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.checkout));
  }

  if (content.visibility) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('visibility', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.visibility));
  }

  if (Array.isArray(content.categories)) {
    // Upsert categories
    const upsertCat = db.prepare(`
      INSERT INTO categories (id, name, slug)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug
    `);
    for (const c of content.categories) {
      const slug = c.slug || c.id;
      upsertCat.run(slug, c.name, slug);
    }
  }

  const updated = getSiteContent();
  syncJsonBackups(updated, null);
  return updated;
}

/**
 * Products: Get all products
 */
function getProducts() {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    category: r.category_id,
    price: r.price,
    badge: r.badge,
    images: JSON.parse(r.images_json || '[]'),
    sizes: JSON.parse(r.sizes_json || '[]'),
    shortDesc: r.short_desc,
    description: r.description,
    fabric: r.fabric,
    fitAdvice: r.fit_advice,
    careAdvice: r.care_advice,
    colors: JSON.parse(r.colors_json || '[]'),
    modelInfo: r.model_info,
    stockStatus: r.stock_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Products: Get single product by ID
 */
function getProductById(id) {
  const r = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    category: r.category_id,
    price: r.price,
    badge: r.badge,
    images: JSON.parse(r.images_json || '[]'),
    sizes: JSON.parse(r.sizes_json || '[]'),
    shortDesc: r.short_desc,
    description: r.description,
    fabric: r.fabric,
    fitAdvice: r.fit_advice,
    careAdvice: r.care_advice,
    colors: JSON.parse(r.colors_json || '[]'),
    modelInfo: r.model_info,
    stockStatus: r.stock_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

/**
 * Products: Save / Replace Full List
 */
function saveProducts(productsList) {
  if (!Array.isArray(productsList)) return getProducts();

  // Clear and re-populate inside a transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec('DELETE FROM products;');
    const insert = db.prepare(`
      INSERT INTO products (
        id, name, subtitle, category_id, price, badge,
        images_json, sizes_json, short_desc, description,
        fabric, fit_advice, care_advice, colors_json, model_info, stock_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of productsList) {
      insert.run(
        p.id,
        p.name,
        p.subtitle || '',
        p.category || 'hoodies',
        typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        p.badge || '',
        JSON.stringify(p.images || []),
        JSON.stringify(p.sizes || []),
        p.shortDesc || '',
        p.description || '',
        p.fabric || '',
        p.fitAdvice || '',
        p.careAdvice || '',
        JSON.stringify(p.colors || []),
        p.modelInfo || '',
        p.stockStatus || 'in_stock'
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  const updated = getProducts();
  syncJsonBackups(null, updated);
  return updated;
}

/**
 * Products: Add or Update single product
 */
function upsertProduct(p) {
  const insert = db.prepare(`
    INSERT INTO products (
      id, name, subtitle, category_id, price, badge,
      images_json, sizes_json, short_desc, description,
      fabric, fit_advice, care_advice, colors_json, model_info, stock_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      subtitle=excluded.subtitle,
      category_id=excluded.category_id,
      price=excluded.price,
      badge=excluded.badge,
      images_json=excluded.images_json,
      sizes_json=excluded.sizes_json,
      short_desc=excluded.short_desc,
      description=excluded.description,
      fabric=excluded.fabric,
      fit_advice=excluded.fit_advice,
      care_advice=excluded.care_advice,
      colors_json=excluded.colors_json,
      model_info=excluded.model_info,
      stock_status=excluded.stock_status,
      updated_at=CURRENT_TIMESTAMP
  `);

  insert.run(
    p.id,
    p.name,
    p.subtitle || '',
    p.category || 'hoodies',
    typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
    p.badge || '',
    JSON.stringify(p.images || []),
    JSON.stringify(p.sizes || []),
    p.shortDesc || '',
    p.description || '',
    p.fabric || '',
    p.fitAdvice || '',
    p.careAdvice || '',
    JSON.stringify(p.colors || []),
    p.modelInfo || '',
    p.stockStatus || 'in_stock'
  );

  const updated = getProducts();
  syncJsonBackups(null, updated);
  return getProductById(p.id);
}

/**
 * Products: Delete product
 */
function deleteProduct(id) {
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  const updated = getProducts();
  syncJsonBackups(null, updated);
  return true;
}

/**
 * Categories: Get all
 */
function getCategories() {
  return db.prepare("SELECT id, name, slug FROM categories ORDER BY created_at ASC").all();
}

/**
 * Categories: Add single
 */
function addCategory(cat) {
  const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  db.prepare("INSERT OR REPLACE INTO categories (id, name, slug) VALUES (?, ?, ?)").run(slug, cat.name, slug);
  const updated = getSiteContent();
  syncJsonBackups(updated, null);
  return getCategories();
}

/**
 * Categories: Delete
 */
function deleteCategory(slug) {
  db.prepare("DELETE FROM categories WHERE slug = ? OR id = ?").run(slug, slug);
  const updated = getSiteContent();
  syncJsonBackups(updated, null);
  return getCategories();
}

/**
 * Orders: Create Order
 */
function createOrder(order) {
  const id = order.id || 'SKM-' + Math.floor(10000 + Math.random() * 90000);
  const status = order.status || 'pending';
  
  db.prepare(`
    INSERT INTO orders (id, customer_name, customer_phone, customer_city, customer_address, customer_notes, items_json, total_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    order.customerName || 'عميل المتجر',
    order.customerPhone || '',
    order.customerCity || order.governorate || 'القاهرة',
    order.customerAddress || '',
    order.customerNotes || order.notes || '',
    JSON.stringify(order.items || []),
    typeof order.totalPrice === 'number' ? order.totalPrice : (parseFloat(order.totalPrice) || parseFloat(order.total) || 0),
    status
  );

  return getOrderById(id);
}

/**
 * Orders: Get single order by ID
 */
function getOrderById(id) {
  const r = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!r) return null;
  return {
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerCity: r.customer_city,
    customerAddress: r.customer_address,
    customerNotes: r.customer_notes || '',
    items: JSON.parse(r.items_json || '[]'),
    totalPrice: r.total_price,
    status: r.status,
    createdAt: r.created_at
  };
}

/**
 * Orders: Get all orders (with optional status filter)
 */
function getOrders(statusFilter = 'all') {
  let rows;
  if (statusFilter && statusFilter !== 'all') {
    rows = db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC").all(statusFilter);
  } else {
    rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  }

  return rows.map(r => ({
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerCity: r.customer_city,
    customerAddress: r.customer_address,
    customerNotes: r.customer_notes || '',
    items: JSON.parse(r.items_json || '[]'),
    totalPrice: r.total_price,
    status: r.status,
    createdAt: r.created_at
  }));
}

/**
 * Orders: Update Status
 */
function updateOrderStatus(id, newStatus) {
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(newStatus, id);
  return getOrderById(id);
}

/**
 * Orders: Delete
 */
function deleteOrder(id) {
  db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  return true;
}

/**
 * Orders: Summary Metrics
 */
function getOrderStats() {
  const totalOrders = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const pendingOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'").get().count;
  const inDeliveryOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('confirmed', 'shipped')").get().count;
  const deliveredOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered'").get().count;
  
  const revenueRow = db.prepare("SELECT SUM(total_price) AS sum FROM orders WHERE status != 'cancelled'").get();
  const totalRevenue = revenueRow && revenueRow.sum ? revenueRow.sum : 0;

  return {
    totalOrders,
    pendingOrders,
    inDeliveryOrders,
    deliveredOrders,
    totalRevenue,
    totalRevenueFormatted: totalRevenue.toLocaleString('en-US') + ' ج.م'
  };
}

/**
 * System Stats
 */
function getStats() {
  const catCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get().count;
  const prodCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const orderCount = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const orderStats = getOrderStats();
  
  let dbSizeBytes = 0;
  if (fs.existsSync(dbPath)) {
    dbSizeBytes = fs.statSync(dbPath).size;
  }

  return {
    engine: 'SQLite 3 (node:sqlite)',
    dbPath: 'database/sokhm.db',
    dbSizeBytes,
    dbSizeFormatted: (dbSizeBytes / 1024).toFixed(1) + ' KB',
    counts: {
      categories: catCount,
      products: prodCount,
      orders: orderCount
    },
    orderStats,
    status: 'online',
    timestamp: new Date().toISOString()
  };
}

// ================= AUTHENTICATION & SECURITY =================

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Verify admin login credentials
 */
function verifyAdminCredentials(username, password) {
  if (!username || !password) return null;
  const cleanUser = username.toString().trim().toLowerCase();
  const cleanPass = password.toString().trim();

  const user = db.prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(username)) = ?').get(cleanUser);
  if (!user) return null;

  try {
    const testHash = hashPassword(cleanPass, user.salt);
    if (crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
      return { id: user.id, username: user.username };
    }
  } catch (e) {
    console.error('Password verification error:', e);
  }
  return null;
}

/**
 * Update admin password
 */
function updateAdminPassword(username, currentPassword, newPassword) {
  const cleanUser = username.toString().trim().toLowerCase();
  const cleanCur = currentPassword.toString().trim();
  const cleanNew = newPassword.toString().trim();

  const verified = verifyAdminCredentials(cleanUser, cleanCur);
  if (!verified) {
    throw new Error('كلمة المرور الحالية غير صحيحة');
  }

  if (!cleanNew || cleanNew.length < 4) {
    throw new Error('كلمة المرور الجديدة يجب أن تحتوي على 4 خانات على الأقل');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashPassword(cleanNew, newSalt);

  db.prepare(`
    UPDATE admin_users 
    SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE LOWER(TRIM(username)) = ?
  `).run(newHash, newSalt, cleanUser);

  return true;
}

/**
 * Create a new admin session token (valid for 7 days)
 */
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO admin_sessions (token, username, expires_at)
    VALUES (?, ?, ?)
  `).run(token, username, expiresAt);

  return { token, username, expiresAt };
}

/**
 * Validate an admin session token
 */
function validateSession(token) {
  if (!token) return null;
  const session = db.prepare(`
    SELECT * FROM admin_sessions 
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token);

  if (!session) return null;
  return { token: session.token, username: session.username };
}

/**
 * Revoke/delete an admin session
 */
function revokeSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

module.exports = {
  db,
  getSiteContent,
  saveSiteContent,
  getProducts,
  getProductById,
  saveProducts,
  upsertProduct,
  deleteProduct,
  getCategories,
  addCategory,
  deleteCategory,
  createOrder,
  getOrderById,
  getOrders,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
  getStats,
  verifyAdminCredentials,
  updateAdminPassword,
  createSession,
  validateSession,
  revokeSession
};
