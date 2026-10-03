/**
 * ✦ SOKHM STORE - لوحة التحكم الإدارية ونظام إدارة المحتوى (CMS Controller)
 * تدير بالكامل:
 * ١. نصوص الصفحة الرئيسية (الهيرو، شريط المزايا، التشكيلات، البانر، والفوتر)
 * ٢. نصوص صفحة تفاصيل المنتج (مسار التصفح، الأزرار، شارات الثقة، القوائم المطوية، والسلة)
 * ٣. كتالوج المنتجات (إضافة، تعديل، حذف، رفع صور بدقة 2K، المقاسات، والأسعار بالجنيه المصري)
 * ٤. تصنيفات وأقسام المتجر (إضافة، عرض، حذف، وربط تلقائي)
 * ٥. البنية التحتية وقاعدة بيانات SQLite العلائقية والنسخ الاحتياطي
 */

document.addEventListener('DOMContentLoaded', async () => {
  // حالة التطبيق (Application State)
  let siteContent = null;
  let products = [];
  let editingProductId = null;
  let productSearchTerm = '';
  let productCategoryFilterValue = 'all';

  // عنصر النافذة المنبثقة
  const productModal = document.getElementById('productEditModal');

  // ================= 1. التهيئة الأولية (INITIALIZATION) =================
  async function init() {
    setupTabNavigation();
    setupLucide();

    // تحميل البيانات من قاعدة بيانات السيرفر
    await Promise.all([loadSiteContent(), loadProducts(), loadDbStats()]);

    // تعبئة النماذج والجداول
    populateHomepageForm();
    populateProductPageForm();
    populateCategoryDropdowns();
    renderCategoriesList();
    renderProductsTable();

    // تفعيل معالجات الأحداث
    setupHomepageFormHandlers();
    setupProductPageFormHandlers();
    setupCategoriesHandlers();
    setupProductsHandlers();
    setupModalHandlers();
    setupSettingsHandlers();
  }

  function setupLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // ================= 2. التنقل بين التبويبات (TAB NAVIGATION) =================
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabPanes.forEach(pane => {
          if (pane.id === targetTabId) {
            pane.classList.remove('hidden');
          } else {
            pane.classList.add('hidden');
          }
        });

        setupLucide();
      });
    });
  }

  // ================= 3. جلب وحفظ البيانات (DATA & SQLITE SYNC) =================
  async function loadSiteContent() {
    try {
      const res = await fetch('/api/site-content');
      if (res.ok) {
        siteContent = await res.json();
        localStorage.setItem('sokhm_site_content_v1', JSON.stringify(siteContent));
        return;
      }
    } catch (e) {
      console.warn('تعذر جلب النصوص من API قاعدة البيانات، محاولة التخزين المحلي...', e);
    }

    const cached = localStorage.getItem('sokhm_site_content_v1');
    if (cached) {
      try {
        siteContent = JSON.parse(cached);
        return;
      } catch (e) {}
    }

    try {
      const fallbackRes = await fetch('data/site-content.json');
      siteContent = await fallbackRes.json();
    } catch (err) {
      console.error('فشل في جلب ملف البيانات الاحتياطي', err);
      siteContent = { homepage: {}, productPage: {}, categories: [] };
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        products = await res.json();
        localStorage.setItem('sokhm_products_v1', JSON.stringify(products));
        return;
      }
    } catch (e) {
      console.warn('تعذر جلب المنتجات من السيرفر، استخدام الذاكرة المحلية...', e);
    }

    const cached = localStorage.getItem('sokhm_products_v1');
    if (cached) {
      try {
        products = JSON.parse(cached);
        return;
      } catch (e) {}
    }

    try {
      const fallbackRes = await fetch('data/products.json');
      products = await fallbackRes.json();
    } catch (err) {
      console.error('فشل في جلب المنتجات الاحتياطية', err);
      products = [];
    }
  }

  async function loadDbStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const stats = await res.json();
        const badgeEl = document.getElementById('dbBadgeText');
        const summaryEl = document.getElementById('dbStatsSummary');
        if (badgeEl) {
          badgeEl.textContent = `قاعدة بيانات SQLite • ${stats.dbSizeFormatted} • ${stats.counts?.products || 0} منتجات`;
        }
        if (summaryEl) {
          summaryEl.innerHTML = `المحرك: <strong>${stats.engine}</strong> • مسار الملف: <code>${stats.dbPath}</code> • الحجم: <strong>${stats.dbSizeFormatted}</strong> • إجمالي المنتجات: <strong>${stats.counts?.products}</strong> • الأقسام: <strong>${stats.counts?.categories}</strong>.`;
        }
      }
    } catch (e) {
      console.warn('تعذر جلب إحصائيات قاعدة البيانات:', e);
    }
  }

  async function saveSiteContent() {
    localStorage.setItem('sokhm_site_content_v1', JSON.stringify(siteContent));

    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteContent)
      });
      loadDbStats();
      return res.ok;
    } catch (err) {
      console.warn('تم الحفظ في المتصفح فقط بسبب خطأ اتصال بالسيرفر:', err);
      return true;
    }
  }

  async function saveProducts() {
    localStorage.setItem('sokhm_products_v1', JSON.stringify(products));

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products)
      });
      loadDbStats();
      return res.ok;
    } catch (err) {
      console.warn('تم حفظ المنتجات محلياً فقط:', err);
      return true;
    }
  }

  // ================= 4. تبويب الصفحة الرئيسية (HOMEPAGE) =================
  function populateHomepageForm() {
    if (!siteContent || !siteContent.homepage) return;
    const hp = siteContent.homepage;

    // 1. الهيرو
    setVal('hp_hero_kicker', hp.hero?.kicker);
    setVal('hp_hero_title', hp.hero?.title);
    setVal('hp_hero_subtitle', hp.hero?.subtitle);
    setVal('hp_hero_cta', hp.hero?.ctaText || hp.hero?.cta);
    setVal('hp_hero_desc', hp.hero?.description || hp.hero?.narrative);
    setVal('hp_hero_scroll', hp.hero?.scrollLabel || hp.hero?.scroll);

    // 2. شريط المزايا (4 عناصر)
    if (Array.isArray(hp.valueBar)) {
      hp.valueBar.forEach((vb, idx) => {
        setVal(`hp_val_${idx}_title`, vb.title);
        setVal(`hp_val_${idx}_sub`, vb.subtitle || vb.desc);
      });
    }

    // 3. التشكيلة المميزة
    setVal('hp_col_kicker', hp.collection?.kicker);
    setVal('hp_col_title', hp.collection?.title);
    setVal('hp_col_viewall', hp.collection?.viewAllText || hp.collection?.viewAll);

    // 4. البانر
    const banner = hp.bottomBanner || hp.banner || {};
    setVal('hp_banner_brand', banner.brandTag || banner.brand);
    setVal('hp_banner_head', banner.headline || banner.heading);
    setVal('hp_banner_cta', banner.ctaText || banner.cta);

    // 5. الفوتر
    setVal('hp_foot_brand', hp.footer?.brandTag || hp.footer?.brand);
    setVal('hp_foot_slogan', hp.footer?.slogan);
    setVal('hp_foot_copy', hp.footer?.copyright || hp.footer?.copy);
  }

  function setupHomepageFormHandlers() {
    const saveBtn = document.getElementById('saveHomepageBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      if (!siteContent.homepage) siteContent.homepage = {};
      const hp = siteContent.homepage;

      // 1. الهيرو
      hp.hero = hp.hero || {};
      hp.hero.kicker = getVal('hp_hero_kicker');
      hp.hero.title = getVal('hp_hero_title');
      hp.hero.subtitle = getVal('hp_hero_subtitle');
      hp.hero.cta = hp.hero.ctaText = getVal('hp_hero_cta');
      hp.hero.narrative = hp.hero.description = getVal('hp_hero_desc');
      hp.hero.scroll = hp.hero.scrollLabel = getVal('hp_hero_scroll');

      // 2. شريط المزايا
      hp.valueBar = hp.valueBar || [];
      const iconList = ['sparkle', 'truck', 'shield-check', 'leaf'];
      for (let i = 0; i < 4; i++) {
        hp.valueBar[i] = {
          id: `val-${i+1}`,
          title: getVal(`hp_val_${i}_title`),
          desc: getVal(`hp_val_${i}_sub`),
          subtitle: getVal(`hp_val_${i}_sub`),
          icon: iconList[i] || 'sparkle'
        };
      }

      // 3. التشكيلة
      hp.collection = hp.collection || {};
      hp.collection.kicker = getVal('hp_col_kicker');
      hp.collection.title = getVal('hp_col_title');
      hp.collection.viewAll = hp.collection.viewAllText = getVal('hp_col_viewall');

      // 4. البانر
      hp.banner = hp.banner || {};
      hp.bottomBanner = hp.bottomBanner || {};
      const bBrand = getVal('hp_banner_brand');
      const bHead = getVal('hp_banner_head');
      const bCta = getVal('hp_banner_cta');
      hp.banner.brand = hp.bottomBanner.brandTag = bBrand;
      hp.banner.heading = hp.bottomBanner.headline = bHead;
      hp.banner.cta = hp.bottomBanner.ctaText = bCta;

      // 5. الفوتر
      hp.footer = hp.footer || {};
      const fBrand = getVal('hp_foot_brand');
      const fSlogan = getVal('hp_foot_slogan');
      const fCopy = getVal('hp_foot_copy');
      hp.footer.brand = hp.footer.brandTag = fBrand;
      hp.footer.slogan = fSlogan;
      hp.footer.copy = hp.footer.copyright = fCopy;

      const ok = await saveSiteContent();
      if (ok) {
        showToast('تم حفظ وتحديث نصوص الصفحة الرئيسية في قاعدة البيانات بنجاح!');
      } else {
        showToast('تم الحفظ في التخزين المؤقت، جاري المزامنة...', 'error');
      }
    });
  }

  // ================= 5. تبويب صفحة المنتج (PRODUCT PAGE) =================
  function populateProductPageForm() {
    if (!siteContent || !siteContent.productPage) return;
    const pp = siteContent.productPage;

    // 1. مسار التصفح
    setVal('pp_bc_home', pp.breadcrumbs?.home);
    setVal('pp_bc_col', pp.breadcrumbs?.collection);
    setVal('pp_bc_back', pp.breadcrumbs?.backLink || pp.breadcrumbs?.back);
    setVal('pp_kicker_prefix', pp.kickerPrefix);

    // 2. الأزرار
    setVal('pp_btn_sizeguide', pp.sizeGuideButtonText || pp.buttons?.sizeGuide);
    setVal('pp_btn_addtobag', pp.addToBagPrefix || pp.buttons?.addToBag);
    setVal('pp_btn_express', pp.expressCheckoutText || pp.buttons?.expressCheckout);

    // 3. شارات الثقة
    if (Array.isArray(pp.highlights)) {
      setVal('pp_hl_0', pp.highlights[0]?.text || pp.highlights[0]);
      setVal('pp_hl_1', pp.highlights[1]?.text || pp.highlights[1]);
      setVal('pp_hl_2', pp.highlights[2]?.text || pp.highlights[2]);
    }

    // 4. القوائم المطوية
    if (Array.isArray(pp.accordions)) {
      setVal('pp_acc_0_title', pp.accordions[0]?.title);
      setVal('pp_acc_1_title', pp.accordions[1]?.title);
      setVal('pp_acc_2_title', pp.accordions[2]?.title);
      setVal('pp_acc_2_content', pp.accordions[2]?.content);
    }

    // 5. المقترحات وسلة التسوق
    setVal('pp_related_title', pp.relatedTitle);
    const cart = pp.cartDrawer || pp.cart || {};
    setVal('pp_cart_title', cart.title);
    setVal('pp_cart_empty_title', cart.emptyTitle);
    setVal('pp_cart_subtotal', cart.subtotalLabel || cart.subtotal);
    setVal('pp_cart_checkout', cart.checkoutButton || cart.checkout);
  }

  function setupProductPageFormHandlers() {
    const saveBtn = document.getElementById('saveProductPageBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      if (!siteContent.productPage) siteContent.productPage = {};
      const pp = siteContent.productPage;

      // 1. مسار التصفح
      pp.breadcrumbs = pp.breadcrumbs || {};
      const bcHome = getVal('pp_bc_home');
      const bcCol = getVal('pp_bc_col');
      const bcBack = getVal('pp_bc_back');
      pp.breadcrumbs.home = bcHome;
      pp.breadcrumbs.collection = bcCol;
      pp.breadcrumbs.back = pp.breadcrumbs.backLink = bcBack;
      pp.kickerPrefix = getVal('pp_kicker_prefix');

      // 2. الأزرار
      pp.buttons = pp.buttons || {};
      const sizeGuideTxt = getVal('pp_btn_sizeguide');
      const addToBagTxt = getVal('pp_btn_addtobag');
      const expressTxt = getVal('pp_btn_express');
      pp.sizeGuideButtonText = pp.buttons.sizeGuide = sizeGuideTxt;
      pp.addToBagPrefix = pp.buttons.addToBag = addToBagTxt;
      pp.expressCheckoutText = pp.buttons.expressCheckout = expressTxt;

      // 3. نقاط الثقة
      const icons = ['check', 'truck', 'rotate-ccw'];
      pp.highlights = [
        { id: 'hl-1', text: getVal('pp_hl_0'), icon: icons[0] },
        { id: 'hl-2', text: getVal('pp_hl_1'), icon: icons[1] },
        { id: 'hl-3', text: getVal('pp_hl_2'), icon: icons[2] }
      ];

      // 4. القوائم المطوية
      pp.accordions = pp.accordions || [];
      pp.accordions[0] = { id: 'acc-1', title: getVal('pp_acc_0_title') };
      pp.accordions[1] = { id: 'acc-2', title: getVal('pp_acc_1_title') };
      pp.accordions[2] = {
        id: 'acc-3',
        title: getVal('pp_acc_2_title'),
        content: getVal('pp_acc_2_content')
      };

      // 5. المقترحات والسلة
      pp.relatedTitle = getVal('pp_related_title');
      pp.cart = pp.cart || {};
      pp.cartDrawer = pp.cartDrawer || {};
      const cTitle = getVal('pp_cart_title');
      const cEmpty = getVal('pp_cart_empty_title');
      const cSub = getVal('pp_cart_subtotal');
      const cCheckout = getVal('pp_cart_checkout');

      pp.cart.title = pp.cartDrawer.title = cTitle;
      pp.cart.emptyTitle = pp.cartDrawer.emptyTitle = cEmpty;
      pp.cart.subtotal = pp.cartDrawer.subtotalLabel = cSub;
      pp.cart.checkout = pp.cartDrawer.checkoutButton = cCheckout;

      const ok = await saveSiteContent();
      if (ok) {
        showToast('تم تحديث نصوص صفحة تفاصيل المنتج وحفظها في قاعدة البيانات بنجاح!');
      } else {
        showToast('تم الحفظ في التخزين المؤقت، جاري المزامنة...', 'error');
      }
    });
  }

  // ================= 6. تبويب الأقسام (CATEGORIES) =================
  function populateCategoryDropdowns() {
    const filterSelect = document.getElementById('productCategoryFilter');
    const modalSelect = document.getElementById('modalProdCategory');
    const categories = siteContent?.categories || [];

    if (filterSelect) {
      const currentVal = filterSelect.value || 'all';
      filterSelect.innerHTML = '<option value="all">جميع الأقسام</option>';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.slug || cat.id;
        opt.textContent = cat.name;
        filterSelect.appendChild(opt);
      });
      filterSelect.value = currentVal;
    }

    if (modalSelect) {
      modalSelect.innerHTML = '';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.slug || cat.id;
        opt.textContent = cat.name;
        modalSelect.appendChild(opt);
      });
    }
  }

  function renderCategoriesList() {
    const container = document.getElementById('categoryCardsList');
    const totalBadge = document.getElementById('catTotalBadge');
    if (!container) return;

    const categories = siteContent?.categories || [];
    if (totalBadge) {
      totalBadge.textContent = `${categories.length} أقسام`;
    }

    container.innerHTML = '';

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-xs text-neutral-500 font-sans">
          لا توجد أقسام مسجلة. يمكنك إنشاء قسم جديد عبر النموذج المقابل.
        </div>
      `;
      return;
    }

    categories.forEach(cat => {
      const slug = cat.slug || cat.id;
      const count = products.filter(p => p.category === slug || p.category === cat.name).length;

      const item = document.createElement('div');
      item.className = 'p-3.5 bg-[#080808] rounded-xl border border-[#1A1A1A] flex items-center justify-between hover:border-[#2A2A2A] transition-colors';
      item.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center text-white">
            <i data-lucide="tag" class="w-4 h-4"></i>
          </div>
          <div>
            <h4 class="font-bold text-xs text-white">${escapeHtml(cat.name)}</h4>
            <div class="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
              <span>المعرف: <code class="text-neutral-300 font-mono">${escapeHtml(slug)}</code></span>
              <span>•</span>
              <span class="font-bold text-neutral-300">${count} ${count === 1 ? 'قطعة ملابس' : 'قطع ملابس'}</span>
            </div>
          </div>
        </div>

        <button 
          data-delete-slug="${escapeHtml(slug)}" 
          class="delete-category-btn p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
          title="حذف هذا القسم"
        >
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;
      container.appendChild(item);
    });

    // أحداث الحذف
    container.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-delete-slug');
        if (!slug) return;

        if (!confirm(`هل أنت متأكد من رغبتك في حذف القسم "${slug}"؟`)) return;

        siteContent.categories = siteContent.categories.filter(c => (c.slug || c.id) !== slug);
        await saveSiteContent();
        populateCategoryDropdowns();
        renderCategoriesList();
        renderProductsTable();
        showToast(`تم حذف القسم "${slug}" بنجاح.`);
      });
    });

    setupLucide();
  }

  function setupCategoriesHandlers() {
    const form = document.getElementById('addCategoryForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('catNameInput');
      const slugInput = document.getElementById('catSlugInput');

      const name = nameInput.value.trim();
      let slug = slugInput.value.trim();

      if (!name) return;

      if (!slug) {
        slug = name.toLowerCase().replace(/[^a-z0-9\u0621-\u064A]+/g, '-').replace(/(^-|-$)/g, '');
        if (!slug) slug = 'cat-' + Date.now();
      }

      siteContent.categories = siteContent.categories || [];
      const exists = siteContent.categories.some(c => (c.slug || c.id) === slug);
      if (exists) {
        showToast('يوجد قسم آخر بنفس هذا المعرف مسبقاً!', 'error');
        return;
      }

      siteContent.categories.push({ id: slug, name: name, slug: slug });
      await saveSiteContent();

      nameInput.value = '';
      slugInput.value = '';

      populateCategoryDropdowns();
      renderCategoriesList();
      renderProductsTable();
      showToast(`تم إنشاء القسم "${name}" بنجاح في قاعدة البيانات!`);
    });
  }

  // ================= 7. جدول كتالوج المنتجات (PRODUCTS TABLE) =================
  function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('productsEmptyState');
    if (!tbody) return;

    // فلترة المنتجات
    const term = productSearchTerm.toLowerCase();
    const filtered = products.filter(p => {
      const matchTerm = !term || 
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.id && p.id.toLowerCase().includes(term));

      const matchCat = productCategoryFilterValue === 'all' || 
        p.category === productCategoryFilterValue;

      return matchTerm && matchCat;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    filtered.forEach(prod => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-[#101010] transition-colors border-b border-[#141414] group';

      const priceEgp = typeof prod.price === 'number' 
        ? prod.price.toLocaleString('en-US') 
        : prod.price;

      const mainImg = Array.isArray(prod.images) && prod.images.length > 0 
        ? prod.images[0] 
        : 'assets/sokhm-card-1.jpg';

      const sizesList = Array.isArray(prod.sizes) && prod.sizes.length > 0
        ? prod.sizes.join(' • ')
        : 'كافة المقاسات';

      tr.innerHTML = `
        <!-- قطعة الملابس -->
        <td class="py-4 px-6">
          <div class="flex items-center gap-3">
            <div class="w-11 h-14 rounded-lg bg-[#070707] border border-[#222] overflow-hidden flex-shrink-0">
              <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(prod.name)}" class="w-full h-full object-cover">
            </div>
            <div>
              <div class="font-bold text-white text-xs tracking-wide">${escapeHtml(prod.name)}</div>
              <div class="text-[10px] text-neutral-400 mt-0.5">${escapeHtml(prod.subtitle || prod.id)}</div>
            </div>
          </div>
        </td>

        <!-- القسم -->
        <td class="py-4 px-4">
          <span class="inline-block px-2.5 py-1 rounded bg-[#161616] border border-[#222] text-[10px] text-neutral-300 font-bold">
            ${escapeHtml(prod.category || 'ملابس')}
          </span>
        </td>

        <!-- السعر (ج.م) -->
        <td class="py-4 px-4 font-bold text-white text-xs">
          ${priceEgp} <span class="text-[10px] text-neutral-400 font-normal">ج.م</span>
        </td>

        <!-- الشارة -->
        <td class="py-4 px-4">
          ${prod.badge ? `
            <span class="inline-block px-2 py-0.5 rounded bg-white text-black font-extrabold text-[9px]">
              ${escapeHtml(prod.badge)}
            </span>
          ` : '<span class="text-neutral-600 text-[11px]">—</span>'}
        </td>

        <!-- المقاسات -->
        <td class="py-4 px-4 text-[11px] text-neutral-400 font-mono">
          ${escapeHtml(sizesList)}
        </td>

        <!-- الإجراءات -->
        <td class="py-4 px-6 text-left">
          <div class="flex items-center justify-start gap-2">
            <a 
              href="product.html?id=${encodeURIComponent(prod.id)}" 
              target="_blank" 
              class="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
              title="معاينة على المتجر الحي"
            >
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>

            <button 
              data-edit-id="${escapeHtml(prod.id)}" 
              class="edit-prod-btn p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer"
              title="تعديل بيانات القطعة"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>

            <button 
              data-delete-id="${escapeHtml(prod.id)}" 
              class="delete-prod-btn p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
              title="حذف القطعة"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // ربط أحداث الإجراءات
    tbody.querySelectorAll('.edit-prod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-id');
        openProductModalForEdit(id);
      });
    });

    tbody.querySelectorAll('.delete-prod-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-id');
        const prod = products.find(p => p.id === id);
        const name = prod ? prod.name : id;

        if (!confirm(`هل أنت متأكد من حذف القطعة "${name}" نهائياً من قاعدة البيانات؟`)) return;

        products = products.filter(p => p.id !== id);
        await saveProducts();
        renderProductsTable();
        renderCategoriesList();
        showToast(`تم حذف القطعة "${name}" من قاعدة البيانات.`);
      });
    });

    setupLucide();
  }

  function setupProductsHandlers() {
    const searchInput = document.getElementById('productSearchInput');
    const filterSelect = document.getElementById('productCategoryFilter');
    const openAddBtn = document.getElementById('openAddProductModalBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        productSearchTerm = e.target.value;
        renderProductsTable();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        productCategoryFilterValue = e.target.value;
        renderProductsTable();
      });
    }

    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        openProductModalForAdd();
      });
    }
  }

  // ================= 8. نافذة إضافة / تعديل قطعة ملابس (MODAL) =================
  function setupModalHandlers() {
    const closeBtn = document.getElementById('closeProductModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const form = document.getElementById('productEditForm');
    const fileInput = document.getElementById('modalPhotoFileInput');
    const imgUrlInput = document.getElementById('modalProdImage');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => productModal.close());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => productModal.close());
    }

    // المعاينة الحية عند كتابة رابط
    if (imgUrlInput) {
      imgUrlInput.addEventListener('input', () => {
        updateModalImagePreview(imgUrlInput.value.trim());
      });
    }

    // رفع الصور المباشر من جهاز المستخدم
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const statusEl = document.getElementById('modalImgStatus');
        if (statusEl) statusEl.textContent = 'جاري معالجة ورفع الصورة عالية الدقة...';

        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Data = event.target.result;
            
            // الرفع المباشر لسيرفر قاعدة البيانات
            try {
              const res = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  image: base64Data,
                  base64: base64Data,
                  filename: file.name
                })
              });

              if (res.ok) {
                const data = await res.json();
                const uploadedPath = data.url || data.path;
                if (uploadedPath) {
                  imgUrlInput.value = uploadedPath;
                  updateModalImagePreview(uploadedPath);
                  showToast('تم رفع الصورة وحفظها في مجلد assets بنجاح!');
                  return;
                }
              }
            } catch (netErr) {
              console.warn('استخدام data URI كحل بديل مؤقت:', netErr);
            }

            // حل بديل
            imgUrlInput.value = base64Data;
            updateModalImagePreview(base64Data);
            showToast('تم تحميل الصورة بنجاح!');
          };
          reader.readAsDataURL(file);
        } catch (uploadErr) {
          console.error('فشل في قراءة الملف:', uploadErr);
          showToast('فشل في معالجة ملف الصورة', 'error');
        }
      });
    }

    // أزرار النماذج الجاهزة
    document.querySelectorAll('.preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const img = pill.getAttribute('data-img');
        if (img && imgUrlInput) {
          imgUrlInput.value = img;
          updateModalImagePreview(img);
        }
      });
    });

    // إرسال وحفظ النموذج
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('modalProdName').value.trim();
        const subtitle = document.getElementById('modalProdSubtitle').value.trim();
        const category = document.getElementById('modalProdCategory').value;
        const price = parseFloat(document.getElementById('modalProdPrice').value) || 0;
        const badge = document.getElementById('modalProdBadge').value.trim();
        const image = document.getElementById('modalProdImage').value.trim();
        const desc = document.getElementById('modalProdDesc').value.trim();
        const fabric = document.getElementById('modalProdFabric').value.trim();
        const fit = document.getElementById('modalProdFit').value.trim();
        const care = document.getElementById('modalProdCare').value.trim();

        // المقاسات المحددة
        const selectedSizes = [];
        document.querySelectorAll('#modalSizesCheckboxes input[name="sizes"]:checked').forEach(cb => {
          selectedSizes.push(cb.value);
        });

        if (editingProductId) {
          // تعديل قطعة قائمة
          const index = products.findIndex(p => p.id === editingProductId);
          if (index !== -1) {
            const current = products[index];
            products[index] = {
              ...current,
              name,
              subtitle,
              category,
              price,
              badge,
              images: [image, ...(current.images?.slice(1) || [])],
              sizes: selectedSizes.length > 0 ? selectedSizes : ['S', 'M', 'L', 'XL'],
              shortDesc: desc || current.shortDesc || '',
              description: desc || current.description || '',
              fabric: fabric || current.fabric || '500 GSM French Terry',
              fitAdvice: fit || current.fitAdvice || 'Oversized boxy drape',
              careAdvice: care || current.careAdvice || 'Cold machine wash'
            };
          }
        } else {
          // إضافة قطعة جديدة
          const newId = 'sokhm-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 1000);
          const newProduct = {
            id: newId,
            name,
            subtitle: subtitle || 'HEAVYWEIGHT GARMENT',
            category: category || 'hoodies',
            price,
            badge: badge || 'NEW',
            images: [image],
            sizes: selectedSizes.length > 0 ? selectedSizes : ['S', 'M', 'L', 'XL'],
            shortDesc: desc || 'Architectural luxury garment crafted from premium combed cotton.',
            description: desc || 'Architectural luxury garment crafted from premium combed cotton.',
            fabric: fabric || '500 GSM Ultra-Dense French Terry',
            fitAdvice: fit || 'Relaxed dropped-shoulder boxy drape',
            careAdvice: care || 'Cold hand or machine wash inside out',
            colors: [
              { name: 'Onyx Noir', hex: '#0B0B0B' },
              { name: 'Smoke Grey', hex: '#525252' }
            ],
            modelInfo: 'Model is 186cm wearing size L.'
          };
          products.unshift(newProduct);
        }

        await saveProducts();
        productModal.close();
        renderProductsTable();
        renderCategoriesList();
        showToast(editingProductId ? `تم تحديث بيانات "${name}" في قاعدة البيانات!` : `تمت إضافة القطعة "${name}" بنجاح!`);
      });
    }
  }

  function updateModalImagePreview(url) {
    const preview = document.getElementById('modalImgPreview');
    const placeholder = document.getElementById('modalImgPlaceholder');
    const status = document.getElementById('modalImgStatus');

    if (url) {
      if (preview) {
        preview.src = url;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (status) status.textContent = url.length > 30 ? url.substring(0, 27) + '...' : url;
    } else {
      if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (status) status.textContent = 'لم يتم اختيار صورة بعد';
    }
  }

  function openProductModalForAdd() {
    editingProductId = null;
    document.getElementById('modalProductHeading').textContent = 'إضافة قطعة ملابس جديدة';
    document.getElementById('modalProductId').value = '';
    document.getElementById('productEditForm').reset();

    // المقاسات الافتراضية
    document.querySelectorAll('#modalSizesCheckboxes input[name="sizes"]').forEach(cb => {
      cb.checked = ['S', 'M', 'L', 'XL'].includes(cb.value);
    });

    updateModalImagePreview('');
    populateCategoryDropdowns();
    productModal.showModal();
    setupLucide();
  }

  function openProductModalForEdit(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    editingProductId = productId;
    populateCategoryDropdowns();

    document.getElementById('modalProductHeading').textContent = `تعديل القطعة: ${prod.name}`;
    document.getElementById('modalProductId').value = prod.id;
    document.getElementById('modalProdName').value = prod.name || '';
    document.getElementById('modalProdSubtitle').value = prod.subtitle || '';
    document.getElementById('modalProdCategory').value = prod.category || '';
    document.getElementById('modalProdPrice').value = prod.price || '';
    document.getElementById('modalProdBadge').value = prod.badge || '';

    const mainImg = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : '';
    document.getElementById('modalProdImage').value = mainImg;
    updateModalImagePreview(mainImg);

    // المقاسات
    document.querySelectorAll('#modalSizesCheckboxes input[name="sizes"]').forEach(cb => {
      cb.checked = Array.isArray(prod.sizes) && prod.sizes.includes(cb.value);
    });

    document.getElementById('modalProdDesc').value = prod.shortDesc || prod.description || '';
    document.getElementById('modalProdFabric').value = prod.fabric || '';
    document.getElementById('modalProdFit').value = prod.fitAdvice || '';
    document.getElementById('modalProdCare').value = prod.careAdvice || '';

    productModal.showModal();
    setupLucide();
  }

  // ================= 9. تبويب قاعدة البيانات والنسخ الاحتياطي (SETTINGS & BACKUP) =================
  function setupSettingsHandlers() {
    const exportBtn = document.getElementById('exportBackupBtn');
    const importInput = document.getElementById('importBackupInput');
    const resetBtn = document.getElementById('resetFactoryBtn');
    const refreshDbBtn = document.getElementById('refreshDbStatsBtn');

    if (refreshDbBtn) {
      refreshDbBtn.addEventListener('click', async () => {
        await loadDbStats();
        showToast('تم تحديث حالة قاعدة بيانات SQLite بنجاح!');
      });
    }

    // تصدير نسخة احتياطية
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const payload = {
          exportTimestamp: new Date().toISOString(),
          brand: '✦ SOKHM ATELIER',
          databaseEngine: 'SQLite 3 (node:sqlite)',
          siteContent,
          products
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sokhm-database-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('تم تصدير وحفظ النسخة الاحتياطية (JSON) بنجاح!');
      });
    }

    // استيراد نسخة احتياطية
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data.siteContent) {
              siteContent = data.siteContent;
              await saveSiteContent();
            }
            if (Array.isArray(data.products)) {
              products = data.products;
              await saveProducts();
            }

            populateHomepageForm();
            populateProductPageForm();
            populateCategoryDropdowns();
            renderCategoriesList();
            renderProductsTable();
            await loadDbStats();

            showToast('تمت استعادة كافة البيانات وحفظها في قاعدة البيانات بنجاح!');
          } catch (err) {
            console.error('خطأ في معالجة ملف النسخة الاحتياطية', err);
            showToast('ملف النسخة الاحتياطية غير صالح.', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // استعادة ضبط المصنع
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm('هل أنت متأكد من رغبتك في استعادة ضبط المصنع؟ سيتم استرجاع النصوص والمنتجات الأصلية للبراند في قاعدة البيانات.')) {
          return;
        }

        try {
          const [contentRes, prodsRes] = await Promise.all([
            fetch('data/site-content.json'),
            fetch('data/products.json')
          ]);

          siteContent = await contentRes.json();
          products = await prodsRes.json();

          await Promise.all([saveSiteContent(), saveProducts()]);

          populateHomepageForm();
          populateProductPageForm();
          populateCategoryDropdowns();
          renderCategoriesList();
          renderProductsTable();
          await loadDbStats();

          showToast('تمت استعادة الإعدادات والمنتجات الأصلية للبراند بنجاح!');
        } catch (err) {
          console.error('فشل في استرجاع الإعدادات الأصلية', err);
          showToast('فشل في استعادة ضبط المصنع', 'error');
        }
      });
    }
  }

  // ================= 10. التنبيهات المنبثقة (TOAST NOTIFICATIONS) =================
  function showToast(message, type = 'success') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;

    const isError = type === 'error';
    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl border text-xs shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2.5 pointer-events-auto ${
      isError 
        ? 'bg-red-950/90 text-red-200 border-red-800' 
        : 'bg-[#121212]/95 text-white border-white/20'
    }`;

    toast.innerHTML = `
      <i data-lucide="${isError ? 'alert-triangle' : 'check'}" class="w-4 h-4 ${isError ? 'text-red-400' : 'text-emerald-400'}"></i>
      <span class="font-bold">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setupLucide();

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  }

  // ================= 11. دوال مساعدة (HELPERS) =================
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // انطلاق التشغيل
  init();
});
