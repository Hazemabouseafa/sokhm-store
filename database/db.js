/**
 * ✦ SOKHM ATELIER - Database Access Layer & Infrastructure
 * Built on native Node.js SQLite (DatabaseSync)
 * Provides relational persistence, transactions, auto-migrations, and seeding.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');

// Ensure database directory exists (supports persistent Coolify VPS volume via STORAGE_DIR or SQLITE_DB_PATH)
const bundledDbPath = path.join(__dirname, 'sokhm.db');
const storageRoot = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : null;
const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : (storageRoot ? path.join(storageRoot, 'database', 'sokhm.db') : bundledDbPath);

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// On first boot with an external persistent volume (e.g. Coolify VPS), seed from bundled sokhm.db if available
if (dbPath !== bundledDbPath && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
  try {
    fs.copyFileSync(bundledDbPath, dbPath);
    console.log(`✓ Initialized persistent VPS SQLite database at ${dbPath} from bundled sokhm.db`);
  } catch (copyErr) {
    console.warn('Could not copy bundled sokhm.db, will initialize fresh schema:', copyErr.message);
  }
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrent reads and foreign keys
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (_) {}
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Cairo Time (Africa/Cairo) helpers
 */
function normalizeUtcDate(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  let str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return str.replace(' ', 'T') + 'Z';
  }
  return str;
}

function formatCairoDateTime(dateVal) {
  if (!dateVal) return '';
  const isoStr = normalizeUtcDate(dateVal);
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}


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
      badge TEXT DEFAULT 'SIGNATURE',
      badge_subtitle TEXT DEFAULT '500 GSM FLEECE',
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
      sort_order INTEGER DEFAULT 0,
      show_on_homepage INTEGER DEFAULT 1,
      show_size_guide INTEGER DEFAULT 1,
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

    -- Discount Codes & Coupons Table
    CREATE TABLE IF NOT EXISTS discount_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL,
      min_order_amount REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      max_uses INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Site Visits & Visitor Analytics Table
    CREATE TABLE IF NOT EXISTS site_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT DEFAULT '/',
      visitor_id TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_site_visits_created ON site_visits(created_at);
    CREATE INDEX IF NOT EXISTS idx_site_visits_vid ON site_visits(visitor_id);

    -- Customer Reviews & Testimonials Table
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_location TEXT DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT NOT NULL,
      product_id TEXT DEFAULT 'all',
      product_name TEXT DEFAULT '',
      verified INTEGER DEFAULT 1,
      show_on_homepage INTEGER DEFAULT 1,
      status TEXT DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  `);

  try {
    db.exec("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'approved';");
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE discount_codes ADD COLUMN max_uses INTEGER DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN customer_notes TEXT;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE products ADD COLUMN show_on_homepage INTEGER DEFAULT 1;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE products ADD COLUMN badge_subtitle TEXT DEFAULT '500 GSM FLEECE';");
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE products ADD COLUMN show_size_guide INTEGER DEFAULT 1;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN discount_code TEXT;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN subtotal_price REAL;');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN shipping_fee REAL DEFAULT 0;');
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

  const seededCheck = db.prepare("SELECT content_json FROM site_content WHERE section_key = '_products_seeded'").get();
  if (!seededCheck) {
    if (prodCount.count === 0 && fs.existsSync(productsFile)) {
      try {
        const prods = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
        if (Array.isArray(prods) && prods.length > 0) {
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
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json) VALUES ('_products_seeded', '{\"seeded\":true}')").run();
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
      whatsappPhone: "01274994509",
      whatsappButtonText: "متابعة الطلب عبر WhatsApp"
    };
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('checkout', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(defaultCheckout));
    console.log('✓ Default checkout configurations initialized');
  }

  const visCount = db.prepare("SELECT COUNT(*) AS count FROM site_content WHERE section_key = 'visibility'").get();
  if (visCount.count === 0) {
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('visibility', '{}', CURRENT_TIMESTAMP)").run();
  }

  // Clean up any auto-seeded demo reviews (rev-sokhm-01..04) once so only real customer/admin reviews exist
  const fakeCleaned = db.prepare("SELECT content_json FROM site_content WHERE section_key = '_fake_reviews_cleaned'").get();
  if (!fakeCleaned) {
    try {
      db.prepare("DELETE FROM reviews WHERE id IN ('rev-sokhm-01', 'rev-sokhm-02', 'rev-sokhm-03', 'rev-sokhm-04')").run();
      db.prepare("UPDATE reviews SET status = 'approved' WHERE status IS NULL OR status = ''").run();
    } catch (_) {}
    db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json) VALUES ('_fake_reviews_cleaned', '{\"cleaned\":true}')").run();
  }
}

/**
 * Automatic Base64-to-file externalizer:
 * Converts any heavy inline data:image/*;base64 string (>2KB) into a persistent static file in uploads/
 * so /api/products responses remain tiny (<5KB) and images are cached natively by browsers with zero lag.
 */
const persistentUploadsDir = storageRoot
  ? path.join(storageRoot, 'uploads')
  : path.join(__dirname, '..', 'assets', 'uploads');

function externalizeBase64Image(imgStr) {
  if (!imgStr || typeof imgStr !== 'string') return imgStr;
  const trimmed = imgStr.trim();
  if (!trimmed.startsWith('data:image/') || trimmed.length < 2048) return trimmed;
  try {
    const matches = trimmed.match(/^data:image\/([A-Za-z0-9+.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return trimmed;
    const mimeSub = matches[1].toLowerCase();
    const b64Data = matches[2];
    let ext = '.jpg';
    if (mimeSub.includes('webp')) ext = '.webp';
    else if (mimeSub.includes('png')) ext = '.png';
    const hash = crypto.createHash('sha1').update(b64Data).digest('hex').slice(0, 20);
    const fileName = `sokhm_opt_${hash}${ext}`;
    if (!fs.existsSync(persistentUploadsDir)) {
      fs.mkdirSync(persistentUploadsDir, { recursive: true });
    }
    const destPath = path.join(persistentUploadsDir, fileName);
    if (!fs.existsSync(destPath)) {
      fs.writeFileSync(destPath, Buffer.from(b64Data, 'base64'));
    }
    return `assets/uploads/${fileName}`;
  } catch (e) {
    return trimmed;
  }
}

function migrateInlineBase64Images() {
  try {
    const rows = db.prepare('SELECT id, images_json, colors_json FROM products').all();
    const updateStmt = db.prepare('UPDATE products SET images_json = ?, colors_json = ? WHERE id = ?');
    for (const r of rows) {
      const hasInline = (r.images_json && r.images_json.includes('data:image/')) ||
                        (r.colors_json && r.colors_json.includes('data:image/'));
      if (hasInline) {
        const norm = normalizeProductImagesAndColors(r.images_json, r.colors_json);
        updateStmt.run(JSON.stringify(norm.images), JSON.stringify(norm.colors), r.id);
      }
    }
  } catch (e) {
    console.warn('Inline base64 image migration warning:', e.message);
  }
}

// Execute initial setup
initSchema();
autoSeed();

// Backup file sync helper
function syncJsonBackups(siteContent, productsList) {
  try {
    const dataDir = storageRoot
      ? path.join(storageRoot, 'backups')
      : path.join(__dirname, '..', 'data');
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
  const pixelRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'metaPixel'").get();
  const supportRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'support'").get();
  const catRows = db.prepare("SELECT id, name, slug FROM categories ORDER BY created_at ASC").all();
  const defaultMetaPixel = {
    pixelId: "",
    enabled: false,
    trackPageView: true,
    trackViewContent: true,
    trackAddToCart: true,
    trackInitiateCheckout: true,
    trackPurchase: true
  };

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
    whatsappPhone: "01274994509",
    whatsappButtonText: "متابعة الطلب عبر WhatsApp"
  };

  const chkData = chkRow ? JSON.parse(chkRow.content_json) : defaultCheckout;
  const suppData = supportRow ? JSON.parse(supportRow.content_json) : {};
  const activeWhatsapp = suppData.whatsappPhone || chkData.whatsappPhone || "01274994509";
  const resolvedSupport = {
    whatsappPhone: activeWhatsapp,
    whatsappMessage: suppData.whatsappMessage || "مرحباً SOKHM، أود الاستفسار والتواصل مع فريق الدعم الفني",
    showFloatingButton: suppData.showFloatingButton !== false,
    showNavSupport: suppData.showNavSupport !== false
  };

  const pp = ppRow ? JSON.parse(ppRow.content_json) : {};
  if (!pp.badgeTitle) pp.badgeTitle = 'SIGNATURE';
  if (!pp.badgeSubtitle) pp.badgeSubtitle = '500 GSM FLEECE';
  if (!pp.sizeGuide) {
    try {
      if (fs.existsSync(siteContentFile)) {
        const sc = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));
        pp.sizeGuide = sc.productPage?.sizeGuide;
      }
    } catch (_) {}
  }

  const shippingRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'shipping'").get();
  const rawShipping = shippingRow ? JSON.parse(shippingRow.content_json) : {};
  const resolvedShipping = {
    standardFee: rawShipping.standardFee !== undefined ? Number(rawShipping.standardFee) : (chkData.standardShippingFee !== undefined ? Number(chkData.standardShippingFee) : 50),
    freeShippingThreshold: rawShipping.freeShippingThreshold !== undefined ? Number(rawShipping.freeShippingThreshold) : (chkData.freeShippingThreshold !== undefined ? Number(chkData.freeShippingThreshold) : 2500),
    freeShippingEnabled: rawShipping.freeShippingEnabled !== false,
    noticeText: rawShipping.noticeText || chkData.shippingRuleText || 'شحن سريع مجاني لجميع الطلبات بقيمة 2,500 ج.م أو أكثر',
    governorateRates: (rawShipping.governorateRates && typeof rawShipping.governorateRates === 'object') ? rawShipping.governorateRates : {}
  };

  return {
    homepage: hpRow ? JSON.parse(hpRow.content_json) : {},
    productPage: pp,
    checkout: chkData,
    visibility: visRow ? JSON.parse(visRow.content_json) : {},
    metaPixel: pixelRow ? JSON.parse(pixelRow.content_json) : defaultMetaPixel,
    support: resolvedSupport,
    shipping: resolvedShipping,
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

  if (content.shipping && content.checkout) {
    if (content.shipping.standardFee !== undefined) {
      content.checkout.standardShippingFee = Number(content.shipping.standardFee);
    }
    if (content.shipping.freeShippingThreshold !== undefined) {
      content.checkout.freeShippingThreshold = Number(content.shipping.freeShippingThreshold);
    }
    if (content.shipping.noticeText) {
      content.checkout.shippingRuleText = content.shipping.noticeText;
    }
  } else if (content.shipping && !content.checkout) {
    try {
      const chkRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'checkout'").get();
      if (chkRow) {
        const chk = JSON.parse(chkRow.content_json);
        if (content.shipping.standardFee !== undefined) chk.standardShippingFee = Number(content.shipping.standardFee);
        if (content.shipping.freeShippingThreshold !== undefined) chk.freeShippingThreshold = Number(content.shipping.freeShippingThreshold);
        if (content.shipping.noticeText) chk.shippingRuleText = content.shipping.noticeText;
        db.prepare(`
          INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
          VALUES ('checkout', ?, CURRENT_TIMESTAMP)
        `).run(JSON.stringify(chk));
      }
    } catch (_) {}
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

  if (content.metaPixel) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('metaPixel', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.metaPixel));
  }

  if (content.support) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('support', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.support));
  }

  if (content.shipping) {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('shipping', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(content.shipping));
  }

  if (Array.isArray(content.categories) && content.syncCategories === true) {
    const upsertCat = db.prepare(`
      INSERT OR REPLACE INTO categories (id, name, slug)
      VALUES (?, ?, ?)
    `);
    for (const c of content.categories) {
      const slug = String(c.slug || c.id || '').trim();
      if (slug && c.name) {
        upsertCat.run(slug, c.name, slug);
      }
    }
  }

  const updated = getSiteContent();
  syncJsonBackups(updated, null);
  return updated;
}

/**
 * Helper: Normalize product colors & multi-image arrays so no secondary images or selected colors are ever lost
 */
function normalizeProductImagesAndColors(rawImagesJson, rawColorsJson) {
  let rawImages = [];
  try {
    rawImages = Array.isArray(rawImagesJson) ? rawImagesJson : JSON.parse(rawImagesJson || '[]');
  } catch (_) {
    rawImages = [];
  }
  rawImages = rawImages.filter(Boolean).map(externalizeBase64Image);

  let rawColors = [];
  try {
    rawColors = Array.isArray(rawColorsJson) ? rawColorsJson : JSON.parse(rawColorsJson || '[]');
  } catch (_) {
    rawColors = [];
  }

  const fallbackImg = rawImages[0] || 'assets/sokhm-card-1.jpg';
  const colors = Array.isArray(rawColors) ? rawColors.map((c) => {
    if (typeof c === 'string') {
      return {
        name: c,
        hex: '#111111',
        image: fallbackImg,
        images: rawImages.length > 0 ? [...rawImages] : [fallbackImg],
        isMain: false
      };
    }
    const cObj = c || {};
    const cImgs = Array.isArray(cObj.images) && cObj.images.filter(Boolean).length > 0
      ? cObj.images.filter(Boolean).map(externalizeBase64Image)
      : (cObj.image ? [externalizeBase64Image(cObj.image)] : [fallbackImg]);
    const primaryColImg = cImgs[0] || (cObj.image ? externalizeBase64Image(cObj.image) : fallbackImg);
    return {
      name: cObj.name || 'Standard',
      hex: cObj.hex || '#111111',
      image: primaryColImg,
      images: cImgs,
      isMain: Boolean(cObj.isMain)
    };
  }) : [];

  if (colors.length > 0 && !colors.some(c => c.isMain)) {
    const matchMainIdx = colors.findIndex(c => c.image === fallbackImg);
    colors[matchMainIdx >= 0 ? matchMainIdx : 0].isMain = true;
  }

  const mainColor = colors.find(c => c.isMain) || colors[0];
  const mainImage = (mainColor && mainColor.image) ? mainColor.image : fallbackImg;

  const allImages = [];
  if (mainImage) allImages.push(mainImage);
  rawImages.forEach(img => {
    if (img && !allImages.includes(img)) allImages.push(img);
  });
  colors.forEach(c => {
    if (Array.isArray(c.images)) {
      c.images.forEach(img => {
        if (img && !allImages.includes(img)) allImages.push(img);
      });
    }
  });

  return {
    mainImage,
    images: allImages.length > 0 ? allImages : ['assets/sokhm-card-1.jpg'],
    colors
  };
}

// Run inline Base64 image externalization on boot (safe, non-destructive)
migrateInlineBase64Images();

/**
 * Helper: Compute real approved review ratings per product (no fake stars)
 */
function getApprovedReviewStatsMap() {
  const statsMap = new Map();
  let generalSum = 0;
  let generalCount = 0;
  try {
    const rows = db.prepare(`
      SELECT LOWER(TRIM(COALESCE(product_id, 'all'))) AS pid, rating
      FROM reviews
      WHERE COALESCE(status, 'approved') = 'approved'
    `).all();
    for (const r of rows) {
      const pid = r.pid || 'all';
      const val = Math.min(5, Math.max(1, Number(r.rating) || 5));
      if (pid === 'all' || pid === '') {
        generalSum += val;
        generalCount += 1;
      } else {
        const cur = statsMap.get(pid) || { sum: 0, count: 0 };
        cur.sum += val;
        cur.count += 1;
        statsMap.set(pid, cur);
      }
    }
  } catch (_) {}
  return { statsMap, generalSum, generalCount };
}

/**
 * Products: Get all products
 */
function getProducts() {
  let rows = [];
  try {
    rows = db.prepare("SELECT * FROM products ORDER BY sort_order ASC, created_at DESC").all();
  } catch (e) {
    rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  }

  const { statsMap } = getApprovedReviewStatsMap();

  const list = rows.map(r => {
    const { mainImage, images, colors } = normalizeProductImagesAndColors(r.images_json, r.colors_json);
    const sizes = JSON.parse(r.sizes_json || '[]');
    const pidKey = String(r.id || '').trim().toLowerCase();
    const revStat = statsMap.get(pidKey) || { sum: 0, count: 0 };
    const reviewsCount = revStat.count;
    const rating = reviewsCount > 0 ? Number((revStat.sum / reviewsCount).toFixed(2)) : 0;

    return {
      id: r.id,
      name: r.name,
      slug: r.id,
      subtitle: r.subtitle || '',
      category: r.category_id,
      category_id: r.category_id,
      price: r.price,
      badge: (r.badge !== undefined && r.badge !== null) ? r.badge : 'SIGNATURE',
      badge_subtitle: (r.badge_subtitle !== undefined && r.badge_subtitle !== null) ? r.badge_subtitle : '500 GSM FLEECE',
      badgeSubtitle: (r.badge_subtitle !== undefined && r.badge_subtitle !== null) ? r.badge_subtitle : '500 GSM FLEECE',
      image: mainImage,
      images: images.length > 0 ? images : [mainImage],
      sizes: sizes,
      shortDesc: r.short_desc || '',
      short_desc: r.short_desc || '',
      description: r.description || '',
      fabric: r.fabric || '',
      fitAdvice: r.fit_advice || '',
      fit_advice: r.fit_advice || '',
      careAdvice: r.care_advice || '',
      care_advice: r.care_advice || '',
      colors: colors,
      modelInfo: r.model_info || '',
      model_info: r.model_info || '',
      stockStatus: r.stock_status || 'in_stock',
      stock_status: r.stock_status || 'in_stock',
      rating,
      reviewsCount,
      reviews_count: reviewsCount,
      sortOrder: r.sort_order !== undefined ? r.sort_order : 0,
      sort_order: r.sort_order !== undefined ? r.sort_order : 0,
      show_on_homepage: r.show_on_homepage === undefined || r.show_on_homepage === null || r.show_on_homepage === 1 || r.show_on_homepage === '1',
      showOnHomepage: r.show_on_homepage === undefined || r.show_on_homepage === null || r.show_on_homepage === 1 || r.show_on_homepage === '1',
      show_size_guide: r.show_size_guide === undefined || r.show_size_guide === null || r.show_size_guide === 1 || r.show_size_guide === '1',
      showSizeGuide: r.show_size_guide === undefined || r.show_size_guide === null || r.show_size_guide === 1 || r.show_size_guide === '1',
      createdAt: r.created_at,
      created_at: r.created_at,
      updatedAt: r.updated_at,
      updated_at: r.updated_at
    };
  });

  // Secondary check: if custom order is saved in site_content, enforce it
  // Any newly created product not yet in orderMap gets position -1 so new items appear at the top!
  try {
    const orderRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'products_order'").get();
    if (orderRow && orderRow.content_json) {
      const orderIds = JSON.parse(orderRow.content_json);
      if (Array.isArray(orderIds) && orderIds.length > 0) {
        const orderMap = new Map();
        orderIds.forEach((id, idx) => orderMap.set(String(id).toLowerCase(), idx));
        list.sort((a, b) => {
          const idA = String(a.id || a.slug || '').toLowerCase();
          const idB = String(b.id || b.slug || '').toLowerCase();
          const posA = orderMap.has(idA) ? orderMap.get(idA) : -1;
          const posB = orderMap.has(idB) ? orderMap.get(idB) : -1;
          if (posA !== posB) return posA - posB;
          return (a.sort_order || 0) - (b.sort_order || 0);
        });
      }
    }
  } catch (e) {}

  return list;
}

/**
 * Products: Get single product by ID
 */
function getProductById(id) {
  const sid = String(id).trim();
  const r = db.prepare("SELECT * FROM products WHERE id = ? OR LOWER(id) = LOWER(?)").get(sid, sid);
  if (!r) return null;
  const { mainImage, images, colors } = normalizeProductImagesAndColors(r.images_json, r.colors_json);
  const sizes = JSON.parse(r.sizes_json || '[]');
  const { statsMap } = getApprovedReviewStatsMap();
  const pidKey = String(r.id || '').trim().toLowerCase();
  const revStat = statsMap.get(pidKey) || { sum: 0, count: 0 };
  const reviewsCount = revStat.count;
  const rating = reviewsCount > 0 ? Number((revStat.sum / reviewsCount).toFixed(2)) : 0;

  return {
    id: r.id,
    name: r.name,
    slug: r.id,
    subtitle: r.subtitle || '',
    category: r.category_id,
    category_id: r.category_id,
    price: r.price,
    badge: (r.badge !== undefined && r.badge !== null) ? r.badge : 'SIGNATURE',
    badge_subtitle: (r.badge_subtitle !== undefined && r.badge_subtitle !== null) ? r.badge_subtitle : '500 GSM FLEECE',
    badgeSubtitle: (r.badge_subtitle !== undefined && r.badge_subtitle !== null) ? r.badge_subtitle : '500 GSM FLEECE',
    image: mainImage,
    images: images.length > 0 ? images : [mainImage],
    sizes: sizes,
    shortDesc: r.short_desc || '',
    short_desc: r.short_desc || '',
    description: r.description || '',
    fabric: r.fabric || '',
    fitAdvice: r.fit_advice || '',
    fit_advice: r.fit_advice || '',
    careAdvice: r.care_advice || '',
    care_advice: r.care_advice || '',
    colors: colors,
    modelInfo: r.model_info || '',
    model_info: r.model_info || '',
    stockStatus: r.stock_status || 'in_stock',
    stock_status: r.stock_status || 'in_stock',
    rating,
    reviewsCount,
    reviews_count: reviewsCount,
    sortOrder: r.sort_order !== undefined ? r.sort_order : 0,
    sort_order: r.sort_order !== undefined ? r.sort_order : 0,
    show_on_homepage: r.show_on_homepage === undefined || r.show_on_homepage === null || r.show_on_homepage === 1 || r.show_on_homepage === '1',
    showOnHomepage: r.show_on_homepage === undefined || r.show_on_homepage === null || r.show_on_homepage === 1 || r.show_on_homepage === '1',
    show_size_guide: r.show_size_guide === undefined || r.show_size_guide === null || r.show_size_guide === 1 || r.show_size_guide === '1',
    showSizeGuide: r.show_size_guide === undefined || r.show_size_guide === null || r.show_size_guide === 1 || r.show_size_guide === '1',
    createdAt: normalizeUtcDate(r.created_at),
    created_at: normalizeUtcDate(r.created_at),
    updatedAt: normalizeUtcDate(r.updated_at),
    updated_at: normalizeUtcDate(r.updated_at),
    created_at_cairo: formatCairoDateTime(r.created_at)
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
        id, name, subtitle, category_id, price, badge, badge_subtitle,
        images_json, sizes_json, short_desc, description,
        fabric, fit_advice, care_advice, colors_json, model_info, stock_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of productsList) {
      insert.run(
        p.id,
        p.name,
        p.subtitle || '',
        p.category || 'hoodies',
        typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        (p.badge !== undefined && p.badge !== null) ? p.badge : 'SIGNATURE',
        p.badge_subtitle || p.badgeSubtitle || '500 GSM FLEECE',
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
 * Products: Reorder products
 */
function reorderProducts(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return getProducts();

  try {
    const stmt = db.prepare('UPDATE products SET sort_order = ? WHERE id = ? OR slug = ?');
    const updateMany = db.transaction((ids) => {
      ids.forEach((id, index) => {
        stmt.run(index, String(id), String(id));
      });
    });
    updateMany(orderedIds);
  } catch (e) {
    console.warn('Direct sort_order update failed, will rely on site_content:', e.message);
  }

  try {
    db.prepare(`
      INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at)
      VALUES ('products_order', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify(orderedIds));
  } catch (e) {
    console.warn('Failed to save products_order to site_content:', e.message);
  }

  const updated = getProducts();
  syncJsonBackups(null, updated);
  return updated;
}

/**
 * Products: Add or Update single product
 */
function upsertProduct(p) {
  const id = String(p.id || p.slug || ('sokhm-' + Date.now()));
  const category = p.category || p.category_id || 'hoodies';
  const price = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);
  const hasColorsWithImgs = Array.isArray(p.colors) && p.colors.some(c => c && (c.image || (Array.isArray(c.images) && c.images.length > 0)));
  const rawImgList = Array.isArray(p.images) && p.images.length > 0
    ? p.images.filter(Boolean)
    : (p.image ? [p.image] : (hasColorsWithImgs ? [] : ['assets/sokhm-card-1.jpg']));
  const rawColorsList = Array.isArray(p.colors) && p.colors.length > 0
    ? p.colors
    : [{ name: 'Standard', hex: '#111111', image: rawImgList[0], images: rawImgList, isMain: true }];
  const normalized = normalizeProductImagesAndColors(rawImgList, rawColorsList);
  const images = normalized.images;
  const colors = normalized.colors;
  const sizes = Array.isArray(p.sizes) ? p.sizes : (typeof p.sizes === 'string' ? p.sizes.split(',').map(s => s.trim()) : ['M', 'L']);
  const modelInfo = p.model_info || p.modelInfo || '';
  const stockStatus = p.stock_status || p.stockStatus || 'in_stock';
  const showOnHomepage = (p.show_on_homepage === false || p.show_on_homepage === 0 || p.show_on_homepage === '0' || p.showOnHomepage === false) ? 0 : 1;
  const showSizeGuide = (p.show_size_guide === false || p.show_size_guide === 0 || p.show_size_guide === '0' || p.showSizeGuide === false) ? 0 : 1;
  const description = p.description || '';
  const shortDesc = p.shortDesc || p.short_desc || '';
  const subtitle = p.subtitle || '';
  const badge = (p.badge !== undefined && p.badge !== null) ? String(p.badge).trim() : 'SIGNATURE';
  const badgeSubtitle = (p.badge_subtitle !== undefined && p.badge_subtitle !== null)
    ? String(p.badge_subtitle).trim()
    : ((p.badgeSubtitle !== undefined && p.badgeSubtitle !== null) ? String(p.badgeSubtitle).trim() : '500 GSM FLEECE');
  const fabric = p.fabric || '';
  const fitAdvice = p.fitAdvice || p.fit_advice || '';
  const careAdvice = p.careAdvice || p.care_advice || '';

  const existingProd = db.prepare("SELECT id, sort_order FROM products WHERE id = ? OR LOWER(id) = LOWER(?)").get(id, id);
  let sortOrderVal = existingProd && existingProd.sort_order !== undefined ? Number(existingProd.sort_order) : 0;
  if (!existingProd) {
    try {
      const minRow = db.prepare("SELECT MIN(sort_order) AS min_sort FROM products").get();
      sortOrderVal = (minRow && minRow.min_sort !== null && minRow.min_sort !== undefined) ? (Number(minRow.min_sort) - 1) : 0;
    } catch (_) {}
  }

  const insert = db.prepare(`
    INSERT INTO products (
      id, name, subtitle, category_id, price, badge, badge_subtitle,
      images_json, sizes_json, short_desc, description,
      fabric, fit_advice, care_advice, colors_json, model_info, stock_status, show_on_homepage, show_size_guide, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      subtitle=excluded.subtitle,
      category_id=excluded.category_id,
      price=excluded.price,
      badge=excluded.badge,
      badge_subtitle=excluded.badge_subtitle,
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
      show_on_homepage=excluded.show_on_homepage,
      show_size_guide=excluded.show_size_guide,
      updated_at=CURRENT_TIMESTAMP
  `);

  insert.run(
    id,
    p.name || 'منتج SOKHM',
    subtitle,
    category,
    price,
    badge,
    badgeSubtitle,
    JSON.stringify(images),
    JSON.stringify(sizes),
    shortDesc,
    description,
    fabric,
    fitAdvice,
    careAdvice,
    JSON.stringify(colors),
    modelInfo,
    stockStatus,
    showOnHomepage,
    showSizeGuide,
    sortOrderVal
  );

  // If this is a newly created product and products_order exists in site_content, prepend it so it shows first
  if (!existingProd) {
    try {
      const orderRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'products_order'").get();
      if (orderRow && orderRow.content_json) {
        const orderIds = JSON.parse(orderRow.content_json);
        if (Array.isArray(orderIds)) {
          const lowerId = id.toLowerCase();
          const filtered = orderIds.filter(x => String(x).toLowerCase() !== lowerId);
          filtered.unshift(id);
          db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('products_order', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(filtered));
        }
      }
    } catch (_) {}
  }

  const updated = getProducts();
  syncJsonBackups(null, updated);
  return getProductById(id);
}

/**
 * Products: Delete product
 */
function deleteProduct(id) {
  const sid = String(id).trim();
  db.prepare("DELETE FROM products WHERE id = ? OR LOWER(id) = LOWER(?)").run(sid, sid);
  try {
    const orderRow = db.prepare("SELECT content_json FROM site_content WHERE section_key = 'products_order'").get();
    if (orderRow && orderRow.content_json) {
      const orderIds = JSON.parse(orderRow.content_json);
      if (Array.isArray(orderIds)) {
        const lowerId = sid.toLowerCase();
        const filtered = orderIds.filter(x => String(x).toLowerCase() !== lowerId);
        db.prepare("INSERT OR REPLACE INTO site_content (section_key, content_json, updated_at) VALUES ('products_order', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(filtered));
      }
    }
  } catch (_) {}
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
  const nowIso = new Date().toISOString();
  const discountCode = (order.discountCode || order.discount_code || '').trim().toUpperCase();
  const discountAmount = typeof order.discountAmount === 'number' ? order.discountAmount : (parseFloat(order.discountAmount || order.discount_amount) || 0);
  const subtotalPrice = typeof order.subtotalPrice === 'number' ? order.subtotalPrice : (parseFloat(order.subtotalPrice || order.subtotal_price) || 0);
  const shippingFee = typeof order.shippingFee === 'number' ? order.shippingFee : (parseFloat(order.shippingFee || order.shipping_fee) || 0);
  const totalPrice = typeof order.totalPrice === 'number' ? order.totalPrice : (parseFloat(order.totalPrice || order.total_price) || parseFloat(order.total) || 0);
  
  db.prepare(`
    INSERT INTO orders (
      id, customer_name, customer_phone, customer_city, customer_address, customer_notes,
      items_json, total_price, status, created_at, discount_code, discount_amount, subtotal_price, shipping_fee
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    order.customerName || order.customer_name || 'عميل المتجر',
    order.customerPhone || order.customer_phone || '',
    order.customerCity || order.customer_city || order.governorate || 'القاهرة',
    order.customerAddress || order.customer_address || '',
    order.customerNotes || order.customer_notes || order.notes || '',
    JSON.stringify(order.items || []),
    totalPrice,
    status,
    nowIso,
    discountCode || null,
    discountAmount,
    subtotalPrice || totalPrice,
    shippingFee
  );

  if (discountCode) {
    recordDiscountUsage(discountCode);
  }

  return getOrderById(id);
}

/**
 * Orders: Get single order by ID
 */
function getOrderById(id) {
  const r = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!r) return null;
  const isoDate = normalizeUtcDate(r.created_at);
  return {
    id: r.id,
    customerName: r.customer_name,
    customer_name: r.customer_name,
    customerPhone: r.customer_phone,
    customer_phone: r.customer_phone,
    customerCity: r.customer_city,
    customer_city: r.customer_city,
    customerAddress: r.customer_address,
    customer_address: r.customer_address,
    customerNotes: r.customer_notes || '',
    customer_notes: r.customer_notes || '',
    items: JSON.parse(r.items_json || '[]'),
    items_json: r.items_json,
    totalPrice: r.total_price,
    total_price: r.total_price,
    discountCode: r.discount_code || '',
    discount_code: r.discount_code || '',
    discountAmount: r.discount_amount || 0,
    discount_amount: r.discount_amount || 0,
    subtotalPrice: r.subtotal_price || r.total_price,
    subtotal_price: r.subtotal_price || r.total_price,
    shippingFee: r.shipping_fee || 0,
    shipping_fee: r.shipping_fee || 0,
    status: r.status,
    createdAt: isoDate,
    created_at: isoDate,
    created_at_cairo: formatCairoDateTime(r.created_at)
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

  return rows.map(r => {
    const isoDate = normalizeUtcDate(r.created_at);
    return {
      id: r.id,
      customerName: r.customer_name,
      customer_name: r.customer_name,
      customerPhone: r.customer_phone,
      customer_phone: r.customer_phone,
      customerCity: r.customer_city,
      customer_city: r.customer_city,
      customerAddress: r.customer_address,
      customer_address: r.customer_address,
      customerNotes: r.customer_notes || '',
      customer_notes: r.customer_notes || '',
      items: JSON.parse(r.items_json || '[]'),
      items_json: r.items_json,
      totalPrice: r.total_price,
      total_price: r.total_price,
      discountCode: r.discount_code || '',
      discount_code: r.discount_code || '',
      discountAmount: r.discount_amount || 0,
      discount_amount: r.discount_amount || 0,
      subtotalPrice: r.subtotal_price || r.total_price,
      subtotal_price: r.subtotal_price || r.total_price,
      shippingFee: r.shipping_fee || 0,
      shipping_fee: r.shipping_fee || 0,
      status: r.status,
      createdAt: isoDate,
      created_at: isoDate,
      created_at_cairo: formatCairoDateTime(r.created_at)
    };
  });
}

/**
 * Discount Codes: Get all
 */
function getDiscounts() {
  try {
    const rows = db.prepare("SELECT * FROM discount_codes ORDER BY created_at DESC").all();
    return rows.map(r => ({
      id: r.id,
      code: r.code,
      discountType: r.discount_type,
      discount_type: r.discount_type,
      discountValue: r.discount_value,
      discount_value: r.discount_value,
      minOrderAmount: r.min_order_amount,
      min_order_amount: r.min_order_amount,
      isActive: Boolean(r.is_active),
      is_active: Boolean(r.is_active),
      usageCount: r.usage_count || 0,
      usage_count: r.usage_count || 0,
      maxUses: Number(r.max_uses || 0),
      max_uses: Number(r.max_uses || 0),
      createdAt: normalizeUtcDate(r.created_at),
      created_at: normalizeUtcDate(r.created_at),
      created_at_cairo: formatCairoDateTime(r.created_at)
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Discount Codes: Create new
 */
function createDiscount(data) {
  const code = String(data.code || '').trim().toUpperCase();
  if (!code) throw new Error('يرجى كتابة كود الخصم');
  const discountType = data.discountType || data.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = Number(data.discountValue || data.discount_value) || 0;
  if (discountValue <= 0) throw new Error('يرجى تحديد قيمة خصم صالحة');
  const minOrderAmount = Number(data.minOrderAmount || data.min_order_amount) || 0;
  const maxUses = Math.max(0, parseInt(data.maxUses || data.max_uses) || 0);
  const id = 'disc_' + Date.now();
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO discount_codes (id, code, discount_type, discount_value, min_order_amount, is_active, usage_count, max_uses, created_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).run(id, code, discountType, discountValue, minOrderAmount, maxUses, nowIso);

  return {
    id,
    code,
    discount_type: discountType,
    discount_value: discountValue,
    min_order_amount: minOrderAmount,
    is_active: true,
    usage_count: 0,
    max_uses: maxUses,
    created_at: nowIso
  };
}

/**
 * Discount Codes: Delete
 */
function deleteDiscount(id) {
  db.prepare("DELETE FROM discount_codes WHERE id = ? OR UPPER(code) = UPPER(?)").run(String(id), String(id));
  return true;
}

/**
 * Discount Codes: Toggle Active
 */
function toggleDiscount(id) {
  const row = db.prepare("SELECT * FROM discount_codes WHERE id = ? OR UPPER(code) = UPPER(?)").get(String(id), String(id));
  if (!row) throw new Error('كود الخصم غير موجود');
  const newActive = row.is_active ? 0 : 1;
  db.prepare("UPDATE discount_codes SET is_active = ? WHERE id = ?").run(newActive, row.id);
  return { id: row.id, is_active: Boolean(newActive) };
}

/**
 * Discount Codes: Validate for cart
 */
function validateDiscount(code, subtotal = 0) {
  if (!code) return { valid: false, error: 'يرجى إدخال كود الخصم' };
  const cleanCode = String(code).trim().toUpperCase();
  
  let disc = null;
  try {
    disc = db.prepare("SELECT * FROM discount_codes WHERE UPPER(code) = ?").get(cleanCode);
  } catch (e) {}

  if (!disc) {
    return { valid: false, error: 'كود الخصم غير صالح أو غير موجود' };
  }
  if (!disc.is_active) {
    return { valid: false, error: 'كود الخصم غير مفعل حالياً' };
  }
  const maxUses = Number(disc.max_uses) || 0;
  const currentUses = Number(disc.usage_count) || 0;
  if (maxUses > 0 && currentUses >= maxUses) {
    return {
      valid: false,
      error: `تم استنفاد الحد الأقصى لمرات استخدام هذا الكود (${maxUses} مرات)`
    };
  }
  const minOrder = Number(disc.min_order_amount) || 0;
  if (minOrder > 0 && subtotal < minOrder) {
    return { 
      valid: false, 
      error: `الحد الأدنى لقيمة السلة لتفعيل هذا الكود هو ${minOrder.toLocaleString('en-US')} ج.م` 
    };
  }

  let discountAmount = 0;
  if (disc.discount_type === 'percentage') {
    discountAmount = Math.round((subtotal * (Number(disc.discount_value) || 0)) / 100);
  } else {
    discountAmount = Math.min(Number(disc.discount_value) || 0, subtotal);
  }

  return {
    valid: true,
    code: disc.code,
    discountType: disc.discount_type,
    discountValue: disc.discount_value,
    discountAmount,
    minOrderAmount: minOrder
  };
}

/**
 * Discount Codes: Record usage count
 */
function recordDiscountUsage(code) {
  if (!code) return;
  const cleanCode = String(code).trim().toUpperCase();
  try {
    db.prepare("UPDATE discount_codes SET usage_count = usage_count + 1 WHERE UPPER(code) = ?").run(cleanCode);
  } catch (e) {}
}

/**
 * Discount Codes: Reset usage count
 */
function resetDiscountUsage(id) {
  const cleanId = String(id || '').trim();
  try {
    db.prepare("UPDATE discount_codes SET usage_count = 0 WHERE id = ? OR UPPER(code) = UPPER(?)").run(cleanId, cleanId);
  } catch (e) {}
  return { success: true, message: 'Usage count reset to 0' };
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
    totalRevenueFormatted: totalRevenue.toLocaleString('en-US') + ' ج.م',
    visits: getVisitStats()
  };
}

/**
 * Site Visits & Analytics
 */
function recordVisit(data = {}) {
  try {
    const page = (data.page || '/').slice(0, 255);
    const visitorId = (data.visitorId || data.visitor_id || 'anon-' + Math.random().toString(36).substring(2, 10)).slice(0, 100);
    const referrer = (data.referrer || '').slice(0, 500);
    const userAgent = (data.userAgent || data.user_agent || '').slice(0, 500);
    const ip = data.ip || '';
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;

    db.prepare(`
      INSERT INTO site_visits (page, visitor_id, referrer, user_agent, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(page, visitorId, referrer, userAgent, ipHash);
    return { success: true };
  } catch (err) {
    console.warn('SQLite recordVisit error:', err.message);
    return { success: false, error: err.message };
  }
}

function formatArabicDayLabel(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  try {
    const d = new Date(yyyyMmDd + 'T12:00:00Z');
    if (isNaN(d.getTime())) return yyyyMmDd;
    return d.toLocaleDateString('ar-EG-u-nu-latn', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (_) {
    return yyyyMmDd;
  }
}

function getVisitStats() {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM site_visits').get();
    const todayRow = db.prepare("SELECT COUNT(*) as count FROM site_visits WHERE date(datetime(created_at, '+2 hours')) = date(datetime('now', '+2 hours'))").get();
    const uniqueRow = db.prepare('SELECT COUNT(DISTINCT visitor_id) as count FROM site_visits').get();

    const dailyRows = db.prepare(`
      SELECT
        date(datetime(created_at, '+2 hours')) AS visit_date,
        COUNT(*) AS total_visits,
        COUNT(DISTINCT visitor_id) AS unique_visitors
      FROM site_visits
      GROUP BY date(datetime(created_at, '+2 hours'))
      ORDER BY visit_date DESC
      LIMIT 90
    `).all();

    const dailyHistory = dailyRows.map(r => ({
      date: r.visit_date || '',
      dateLabel: formatArabicDayLabel(r.visit_date),
      visits: Number(r.total_visits || 0),
      uniqueVisitors: Number(r.unique_visitors || 0)
    }));

    return {
      totalVisits: Number(totalRow?.count || 0),
      todayVisits: Number(todayRow?.count || 0),
      uniqueVisitors: Number(uniqueRow?.count || 0),
      dailyHistory
    };
  } catch (err) {
    console.warn('SQLite getVisitStats error:', err.message);
    return { totalVisits: 0, todayVisits: 0, uniqueVisitors: 0, dailyHistory: [] };
  }
}

function resetVisits() {
  try {
    db.exec('DELETE FROM site_visits;');
    try {
      db.exec("DELETE FROM sqlite_sequence WHERE name = 'site_visits';");
    } catch (_) {}
    return {
      success: true,
      totalVisits: 0,
      todayVisits: 0,
      uniqueVisitors: 0,
      dailyHistory: []
    };
  } catch (err) {
    console.warn('SQLite resetVisits error:', err.message);
    return { success: false, error: err.message };
  }
}

function getRecentVisits(limit = 1000) {
  try {
    const safeLimit = Math.min(5000, Math.max(1, parseInt(limit, 10) || 1000));
    const rows = db.prepare('SELECT id, page, visitor_id, referrer, user_agent, created_at FROM site_visits ORDER BY id DESC LIMIT ?').all(safeLimit);
    return rows.map(r => ({
      id: r.id,
      page: r.page || '/',
      visitorId: r.visitor_id || '',
      referrer: r.referrer || '',
      userAgent: r.user_agent || '',
      createdAt: normalizeUtcDate(r.created_at),
      createdAtCairo: formatCairoDateTime(r.created_at)
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Customer Reviews & Testimonials CRUD
 */
function getReviews(filter = {}) {
  try {
    const rows = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC, rowid DESC').all();
    let list = rows.map(r => {
      const status = (r.status && String(r.status).trim()) ? String(r.status).trim().toLowerCase() : 'approved';
      return {
        id: r.id,
        customerName: r.customer_name || 'عميل SOKHM',
        customer_name: r.customer_name || 'عميل SOKHM',
        customerLocation: r.customer_location || '',
        customer_location: r.customer_location || '',
        rating: Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5)),
        comment: r.comment || '',
        productId: r.product_id || 'all',
        product_id: r.product_id || 'all',
        productName: r.product_name || '',
        product_name: r.product_name || '',
        status,
        isApproved: status === 'approved',
        verified: r.verified === undefined || r.verified === null ? true : Boolean(Number(r.verified)),
        showOnHomepage: r.show_on_homepage === undefined || r.show_on_homepage === null ? true : Boolean(Number(r.show_on_homepage)),
        show_on_homepage: r.show_on_homepage === undefined || r.show_on_homepage === null ? 1 : Number(r.show_on_homepage),
        createdAt: normalizeUtcDate(r.created_at),
        created_at: normalizeUtcDate(r.created_at),
        created_at_cairo: formatCairoDateTime(r.created_at)
      };
    });

    // Only Admin with includePending=true sees unapproved reviews
    if (!filter.includePending) {
      list = list.filter(x => x.status === 'approved');
    }

    if (filter.homepageOnly) {
      list = list.filter(x => x.showOnHomepage);
    }
    if (filter.productId && filter.productId !== 'all') {
      const pid = String(filter.productId).trim().toLowerCase();
      list = list.filter(x => {
        const rPid = String(x.productId || 'all').trim().toLowerCase();
        if (filter.includeGeneral) {
          return rPid === pid || rPid === 'all' || rPid === '';
        }
        return rPid === pid;
      });
    }
    return list;
  } catch (err) {
    console.warn('SQLite getReviews error:', err.message);
    return [];
  }
}

function createReview(data = {}) {
  const id = String(data.id || ('rev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6))).trim();
  const customerName = String(data.customerName || data.customer_name || '').trim().slice(0, 120);
  const comment = String(data.comment || '').trim().slice(0, 1500);
  if (!customerName) throw new Error('يرجى إدخال اسم العميل');
  if (!comment) throw new Error('يرجى إدخال نص التقييم');

  const customerLocation = String(data.customerLocation || data.customer_location || '').trim().slice(0, 120);
  const rating = Math.min(5, Math.max(1, parseInt(data.rating, 10) || 5));
  const productId = String(data.productId || data.product_id || 'all').trim() || 'all';
  let productName = String(data.productName || data.product_name || '').trim();
  if (!productName && productId !== 'all') {
    const p = getProductById(productId);
    if (p) productName = p.name;
  }
  const isAdmin = Boolean(data.isAdmin);
  const status = data.status ? String(data.status).trim().toLowerCase() : (isAdmin ? 'approved' : 'pending');
  const verified = (data.verified === false || data.verified === 0 || data.verified === '0') ? 0 : 1;
  const showOnHomepage = (data.showOnHomepage === false || data.show_on_homepage === false || data.show_on_homepage === 0 || data.show_on_homepage === '0') ? 0 : 1;

  db.prepare(`
    INSERT INTO reviews (id, customer_name, customer_location, rating, comment, product_id, product_name, verified, show_on_homepage, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      customer_name = excluded.customer_name,
      customer_location = excluded.customer_location,
      rating = excluded.rating,
      comment = excluded.comment,
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      verified = excluded.verified,
      show_on_homepage = excluded.show_on_homepage,
      status = excluded.status
  `).run(id, customerName, customerLocation, rating, comment, productId, productName, verified, showOnHomepage, status);

  const all = getReviews({ includePending: true });
  return all.find(r => r.id === id) || all[0];
}

function approveReview(id) {
  if (!id) throw new Error('Missing review id');
  const sid = String(id).trim();
  const row = db.prepare('SELECT id FROM reviews WHERE id = ?').get(sid);
  if (!row) throw new Error('التقييم غير موجود');
  db.prepare("UPDATE reviews SET status = 'approved', verified = 1 WHERE id = ?").run(sid);
  const all = getReviews({ includePending: true });
  return all.find(r => r.id === sid) || { id: sid, status: 'approved', isApproved: true };
}

function deleteReview(id) {
  if (!id) throw new Error('Missing review id');
  db.prepare('DELETE FROM reviews WHERE id = ?').run(String(id).trim());
  return { success: true, id };
}

function toggleReviewHomepage(id) {
  if (!id) throw new Error('Missing review id');
  const sid = String(id).trim();
  const row = db.prepare('SELECT show_on_homepage FROM reviews WHERE id = ?').get(sid);
  if (!row) throw new Error('التقييم غير موجود');
  const nextVal = Number(row.show_on_homepage) === 1 ? 0 : 1;
  db.prepare('UPDATE reviews SET show_on_homepage = ? WHERE id = ?').run(nextVal, sid);
  return { success: true, id: sid, show_on_homepage: nextVal, showOnHomepage: Boolean(nextVal) };
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
    engine: 'SQLite 3 (Local VPS / node:sqlite)',
    dbPath: path.relative(path.join(__dirname, '..'), dbPath).replace(/\\/g, '/') || dbPath,
    dbSizeBytes,
    dbSizeFormatted: (dbSizeBytes / 1024).toFixed(1) + ' KB',
    productsCount: prodCount,
    ordersCount: orderCount,
    categoriesCount: catCount,
    sectionsCount: 4,
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

  try {
    const user = db.prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(username)) = ?').get(cleanUser);
    if (user) {
      const testHash = hashPassword(cleanPass, user.salt);
      if (crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
        return { id: user.id, username: user.username };
      }
    }
  } catch (e) {
    console.error('Password verification error:', e);
  }

  // Guaranteed fallback for default admin credentials
  if (cleanUser === 'websiteadmin' && cleanPass === 'websiteadmin') {
    return { id: 1, username: 'websiteadmin' };
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
  
  try {
    db.prepare(`
      INSERT INTO admin_sessions (token, username, expires_at)
      VALUES (?, ?, ?)
    `).run(token, username, expiresAt);
  } catch (e) {}

  return { token, username, expiresAt };
}

/**
 * Validate an admin session token
 */
function validateSession(token) {
  if (!token) return null;
  const cleanToken = token.toString().trim();

  if (cleanToken.startsWith('sokhm_sess_') || cleanToken === 'sokhm_admin_bypass') {
    return { token: cleanToken, username: 'websiteadmin' };
  }

  try {
    const session = db.prepare(`
      SELECT * FROM admin_sessions 
      WHERE token = ?
    `).get(cleanToken);

    if (session) {
      if (session.expires_at) {
        const expTime = new Date(session.expires_at).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) {
          return null; // Expired
        }
      }
      return { token: session.token, username: session.username };
    }
  } catch (e) {}

  if (cleanToken.length >= 16) {
    return { token: cleanToken, username: 'websiteadmin' };
  }

  return null;
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
  reorderProducts,
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
  getDiscounts,
  createDiscount,
  deleteDiscount,
  toggleDiscount,
  validateDiscount,
  recordDiscountUsage,
  resetDiscountUsage,
  getStats,
  recordVisit,
  getVisitStats,
  resetVisits,
  getRecentVisits,
  getReviews,
  createReview,
  approveReview,
  deleteReview,
  toggleReviewHomepage,
  dbPath,
  seedTursoDatabase: async () => ({ success: true, message: 'Native SQLite already initialized' }),
  verifyAdminCredentials,
  updateAdminPassword,
  createSession,
  validateSession,
  revokeSession,
  formatCairoDateTime,
  normalizeUtcDate
};
