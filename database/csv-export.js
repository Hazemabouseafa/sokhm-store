/**
 * ✦ SOKHM ATELIER - CSV & JSON Data Export Engine
 * Generates UTF-8 with BOM (\uFEFF) RFC-4180 compliant CSV files
 * for seamless Arabic & Egyptian phone rendering in Excel / Google Sheets.
 */

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatSafePhoneForExcel(phone) {
  const clean = String(phone || '').trim();
  if (!clean) return '';
  // Prefix with tab or ="..." formula? Using ="010..." preserves leading zero in Excel without visible apostrophe!
  if (/^0\d+$/.test(clean)) {
    return `="${clean}"`;
  }
  return clean;
}

function toCsvString(headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map(row =>
    row.map(cell => {
      if (typeof cell === 'string' && cell.startsWith('="') && cell.endsWith('"')) {
        // Formula cell for preserving leading zeros in Excel
        return cell;
      }
      return escapeCsvCell(cell);
    }).join(',')
  );
  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel recognizes Arabic UTF-8 automatically
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

const STATUS_LABELS_AR = {
  pending: 'قيد الانتظار (Pending)',
  confirmed: 'مؤكد (Confirmed)',
  shipped: 'تم الشحن (Shipped)',
  delivered: 'تم التوصيل (Delivered)',
  cancelled: 'ملغي (Cancelled)'
};

const ALL_EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية',
  'الغربية', 'المنوفية', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
  'كفر الشيخ', 'البحيرة', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'مطروح',
  'الوادي الجديد', 'شمال سيناء', 'جنوب سيناء'
];

async function generateCsvExport(db, type = 'orders', options = {}) {
  const exportType = String(type || 'orders').toLowerCase().trim();
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (exportType === 'orders') {
    const statusFilter = options.status || 'all';
    const orders = await db.getOrders(statusFilter);
    const headers = [
      'رقم الطلب (Order ID)',
      'تاريخ الطلب - القاهرة (Date)',
      'اسم العميل (Customer Name)',
      'رقم الهاتف (Phone)',
      'المحافظة (Governorate)',
      'العنوان بالتفصيل (Address)',
      'ملاحظات التوصيل (Notes)',
      'تفاصيل القطع (Items)',
      'إجمالي عدد القطع (Qty)',
      'المجموع الفرعي (Subtotal EGP)',
      'كود الخصم (Promo Code)',
      'قيمة الخصم (Discount EGP)',
      'مصاريف الشحن (Shipping EGP)',
      'الإجمالي المستحق (Total EGP)',
      'حالة الطلب (Status)'
    ];

    const rows = (Array.isArray(orders) ? orders : []).map(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      let totalQty = 0;
      const itemsSummary = items.map(it => {
        const q = Number(it.quantity) || 1;
        totalQty += q;
        const sizePart = it.size ? `المقاس: ${it.size}` : '';
        const colorPart = it.color ? `اللون: ${it.color}` : '';
        const meta = [sizePart, colorPart].filter(Boolean).join(' | ');
        return `${it.name || it.id || 'قطعة'}${meta ? ` [${meta}]` : ''} × ${q} (${Number(it.price || 0)} ج.م)`;
      }).join(' + ');

      const subtotal = Number(o.subtotalPrice ?? o.subtotal_price ?? o.totalPrice ?? o.total_price ?? 0);
      const discountAmt = Number(o.discountAmount ?? o.discount_amount ?? 0);
      const total = Number(o.totalPrice ?? o.total_price ?? 0);
      let shippingFee = Number(o.shippingFee ?? o.shipping_fee ?? 0);
      if (!shippingFee && total > (subtotal - discountAmt)) {
        shippingFee = Math.max(0, total - (subtotal - discountAmt));
      }

      return [
        o.id || '',
        o.created_at_cairo || o.createdAt || o.created_at || '',
        o.customerName || o.customer_name || '',
        formatSafePhoneForExcel(o.customerPhone || o.customer_phone || ''),
        o.customerCity || o.customer_city || '',
        o.customerAddress || o.customer_address || '',
        o.customerNotes || o.customer_notes || '',
        itemsSummary,
        totalQty,
        subtotal,
        o.discountCode || o.discount_code || '',
        discountAmt,
        shippingFee,
        total,
        STATUS_LABELS_AR[o.status] || o.status || 'pending'
      ];
    });

    return {
      filename: `sokhm-orders-${statusFilter !== 'all' ? statusFilter + '-' : ''}${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  if (exportType === 'customers') {
    const orders = await db.getOrders('all');
    const customerMap = new Map();
    for (const o of (Array.isArray(orders) ? orders : [])) {
      const phone = String(o.customerPhone || o.customer_phone || '').trim();
      const key = phone || (o.customerName || o.customer_name || o.id);
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: o.customerName || o.customer_name || '',
          phone,
          city: o.customerCity || o.customer_city || '',
          address: o.customerAddress || o.customer_address || '',
          ordersCount: 0,
          totalSpent: 0,
          lastOrderDate: o.created_at_cairo || o.createdAt || ''
        });
      }
      const entry = customerMap.get(key);
      entry.ordersCount += 1;
      if (o.status !== 'cancelled') {
        entry.totalSpent += Number(o.totalPrice ?? o.total_price ?? 0);
      }
    }

    const headers = [
      'اسم العميل (Customer Name)',
      'رقم الهاتف (Phone)',
      'المحافظة (Governorate)',
      'العنوان (Address)',
      'عدد الطلبات (Orders Count)',
      'إجمالي المشتريات (Total Spent EGP)',
      'تاريخ آخر طلب (Last Order Date)'
    ];
    const rows = Array.from(customerMap.values()).map(c => [
      c.name,
      formatSafePhoneForExcel(c.phone),
      c.city,
      c.address,
      c.ordersCount,
      c.totalSpent,
      c.lastOrderDate
    ]);

    return {
      filename: `sokhm-customers-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  if (exportType === 'products') {
    const prods = await db.getProducts();
    const headers = [
      'الترتيب (#)',
      'كود المنتج (Product ID)',
      'اسم القطعة (Product Name)',
      'التصنيف (Category)',
      'السعر (Price EGP)',
      'المقاسات (Sizes)',
      'الألوان المتوفرة (Colors & Hex)',
      'إجمالي الصور (Total Images)',
      'الصورة الرئيسية (Main Image)',
      'جميع الصور (All Images)',
      'الظهور بالرئيسية (Show on Homepage)',
      'حالة التوفر (Stock Status)',
      'الشارة (Badge)',
      'الوصف (Description)'
    ];

    const rows = (Array.isArray(prods) ? prods : []).map((p, idx) => {
      const sizes = Array.isArray(p.sizes) ? p.sizes.join(' | ') : String(p.sizes || '');
      const colorsArr = Array.isArray(p.colors) ? p.colors : [];
      const colorsText = colorsArr.map(c => {
        if (typeof c === 'string') return c;
        const imgLen = Array.isArray(c.images) ? c.images.length : (c.image ? 1 : 0);
        return `${c.name || 'Standard'} (${c.hex || '#111'})${c.isMain ? ' ★' : ''} [${imgLen} صور]`;
      }).join(' | ');
      const allImgs = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);

      return [
        idx + 1,
        p.id || '',
        p.name || '',
        p.category || p.category_id || '',
        Number(p.price || 0),
        sizes,
        colorsText,
        allImgs.length,
        p.image || '',
        allImgs.join(' | '),
        (p.show_on_homepage === false || p.show_on_homepage === 0) ? 'قسم التصنيف فقط' : 'الرئيسية + القسم',
        p.stockStatus || p.stock_status || 'in_stock',
        p.badge || '',
        p.description || ''
      ];
    });

    return {
      filename: `sokhm-products-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  if (exportType === 'discounts') {
    const discounts = await db.getDiscounts();
    const headers = [
      'كود الخصم (Promo Code)',
      'نوع الخصم (Discount Type)',
      'قيمة الخصم (Value)',
      'الحد الأدنى للطلب (Min Order EGP)',
      'مرات الاستخدام (Usage Count)',
      'الحد الأقصى للاستخدام (Max Uses)',
      'الحالة (Status)',
      'تاريخ الإنشاء (Created At)'
    ];

    const rows = (Array.isArray(discounts) ? discounts : []).map(d => {
      const isPercent = (d.discount_type || d.discountType) === 'percentage';
      const maxUses = Number(d.max_uses ?? d.maxUses ?? 0);
      return [
        d.code || '',
        isPercent ? 'نسبة مئوية (%)' : 'مبلغ ثابت (EGP)',
        isPercent ? `${d.discount_value || d.discountValue}%` : `${d.discount_value || d.discountValue} ج.م`,
        Number(d.min_order_amount ?? d.minOrderAmount ?? 0),
        Number(d.usage_count ?? d.usageCount ?? 0),
        maxUses > 0 ? maxUses : 'غير محدود (Unlimited)',
        (d.is_active || d.isActive) ? 'مفعل (Active)' : 'معطل (Inactive)',
        d.created_at_cairo || d.created_at || d.createdAt || ''
      ];
    });

    return {
      filename: `sokhm-discounts-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  if (exportType === 'shipping') {
    const content = await db.getSiteContent();
    const ship = (content && content.shipping) || {};
    const standardFee = Number(ship.standardFee ?? content?.checkout?.standardShippingFee ?? 50);
    const threshold = Number(ship.freeShippingThreshold ?? content?.checkout?.freeShippingThreshold ?? 2500);
    const freeEnabled = ship.freeShippingEnabled !== false;
    const govRates = (ship.governorateRates && typeof ship.governorateRates === 'object') ? ship.governorateRates : {};

    const headers = [
      'المحافظة (Governorate)',
      'سعر الشحن المعتمد (Effective Fee EGP)',
      'نوع السعر (Rate Mode)',
      'السعر الافتراضي العام (Default Fee EGP)',
      'حد الشحن المجاني (Free Threshold EGP)',
      'الشحن المجاني مفعل (Free Shipping Active)'
    ];

    const rows = ALL_EGYPT_GOVERNORATES.map(gov => {
      const customVal = govRates[gov];
      const hasCustom = customVal !== undefined && customVal !== null && customVal !== '' && !isNaN(Number(customVal));
      const fee = hasCustom ? Number(customVal) : standardFee;
      return [
        gov,
        fee,
        hasCustom ? 'سعر مخصص للمحافظة' : 'السعر الأساسي الافتراضي',
        standardFee,
        threshold,
        freeEnabled ? 'نعم' : 'لا'
      ];
    });

    return {
      filename: `sokhm-shipping-rates-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  if (exportType === 'visits') {
    const stats = db.getVisitStats ? await db.getVisitStats() : { totalVisits: 0, todayVisits: 0, uniqueVisitors: 0 };
    const recent = db.getRecentVisits ? await db.getRecentVisits(2000) : [];

    if (Array.isArray(recent) && recent.length > 0) {
      const headers = [
        'رقم الزيارة (Visit ID)',
        'التوقيت - القاهرة (Cairo Time)',
        'الصفحة (Page)',
        'معرف الزائر (Visitor ID)',
        'المصدر (Referrer)',
        'الجهاز / المتصفح (User Agent)'
      ];
      const rows = recent.map(v => [
        v.id,
        v.createdAtCairo || v.createdAt || '',
        v.page || '/',
        v.visitorId || '',
        v.referrer || 'مباشر (Direct)',
        v.userAgent || ''
      ]);
      return {
        filename: `sokhm-visits-log-${dateStamp}.csv`,
        csv: toCsvString(headers, rows),
        count: rows.length
      };
    }

    const headers = [
      'إجمالي الزيارات (Total Visits)',
      'زيارات اليوم (Today Visits)',
      'الزوار الفريدون (Unique Visitors)',
      'تاريخ التقرير (Export Date)'
    ];
    const rows = [[stats.totalVisits || 0, stats.todayVisits || 0, stats.uniqueVisitors || 0, dateStamp]];
    return {
      filename: `sokhm-visits-summary-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: 1
    };
  }

  if (exportType === 'reviews') {
    const reviews = db.getReviews ? await db.getReviews({ includePending: true }) : [];
    const headers = [
      'معرف التقييم (ID)',
      'اسم العميل (Customer Name)',
      'المحافظة / الوصف (Location)',
      'التقييم (Rating 1-5)',
      'نص الرأي (Review Comment)',
      'المنتج المرتبط (Product)',
      'الحالة (Approval Status)',
      'الظهور بالرئيسية (Show on Homepage)',
      'تاريخ الإضافة (Created Date)'
    ];
    const rows = (Array.isArray(reviews) ? reviews : []).map(r => [
      r.id || '',
      r.customerName || r.customer_name || '',
      r.customerLocation || r.customer_location || '',
      r.rating || 5,
      r.comment || '',
      r.productName || r.product_name || (r.productId === 'all' ? 'جميع المنتجات' : r.productId),
      (r.status === 'pending' || r.isApproved === false) ? 'بانتظار الموافقة (Pending)' : 'معتمد ومنشور (Approved)',
      r.showOnHomepage ? 'نعم' : 'لا',
      r.created_at_cairo || r.createdAt || ''
    ]);
    return {
      filename: `sokhm-reviews-${dateStamp}.csv`,
      csv: toCsvString(headers, rows),
      count: rows.length
    };
  }

  throw new Error('نوع التصدير غير مدعوم: ' + exportType);
}

async function generateFullJsonBackup(db) {
  const [siteContent, products, categories, orders, discounts, reviews, stats] = await Promise.all([
    db.getSiteContent(),
    db.getProducts(),
    db.getCategories(),
    db.getOrders('all'),
    db.getDiscounts(),
    db.getReviews ? db.getReviews() : Promise.resolve([]),
    db.getStats()
  ]);

  return {
    exportedAt: new Date().toISOString(),
    brand: '✦ SOKHM ATELIER',
    stats,
    categories,
    products,
    orders,
    discounts,
    reviews,
    siteContent
  };
}

module.exports = {
  generateCsvExport,
  generateFullJsonBackup
};
