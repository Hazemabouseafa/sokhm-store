/**
 * ✦ SOKHM ATELIER - المركز الرئيسي للوحة التحكم وإدارة المتجر (Admin Controller)
 * متصل مباشرة بقاعدة بيانات SQLite ونظام المصادقة المشفر
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ================= 0. التحقق من الهوية والأمان (AUTH GUARD) =================
  const token = localStorage.getItem('sokhm_admin_token') || getCookie('sokhm_admin_token');
  if (!token) {
    window.location.replace('login.html');
    return;
  }

  try {
    const authRes = await fetch('/api/admin/verify', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      if (authData.authenticated) {
        const adminUserEl = document.getElementById('currentAdminUsername');
        if (adminUserEl && authData.user) {
          adminUserEl.textContent = authData.user.username || 'websiteadmin';
        }
      }
    } else if (authRes.status === 401) {
      // Only redirect if this is not a valid client-side fallback token
      if (!token.startsWith('sokhm_sess_')) {
        localStorage.removeItem('sokhm_admin_token');
        document.cookie = 'sokhm_admin_token=; path=/; max-age=0;';
        window.location.replace('login.html');
        return;
      }
    }
  } catch (err) {
    // Backend offline / static mode (GitHub Pages / file://): allow session from localStorage
    console.log('Running in static/local admin session mode');
  }

  // ================= حالة التطبيق (STATE) =================
  let orders = [];
  let siteContent = {
    homepage: {},
    productPage: {},
    checkout: {},
    visibility: {},
    categories: []
  };
  let products = [];
  let categories = [];
  let editingProductId = null;
  let productSearchTerm = '';
  let productCategoryFilterValue = 'all';
  let orderSearchTerm = '';
  let orderStatusFilterValue = 'all';
  let modalColorsList = [];
  let discounts = [];
  let pendingNewColorImages = [];

  // عناصر النوافذ المنبثقة
  const productModal = document.getElementById('productEditModal');
  const invoiceModal = document.getElementById('orderInvoiceModal');

  // ================= توقيت القاهرة (AFRICA/CAIRO TIMEZONE) =================
  function formatCairoDate(dateVal, options = {}) {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateVal);
    try {
      return d.toLocaleString('ar-EG-u-nu-latn', {
        timeZone: 'Africa/Cairo',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options
      });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  function startCairoClock() {
    const clockText = document.getElementById('cairoClockText');
    if (!clockText) return;

    function tick() {
      try {
        const now = new Date();
        clockText.textContent = now.toLocaleTimeString('ar-EG-u-nu-latn', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (e) {
        clockText.textContent = new Date().toLocaleTimeString();
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  // ================= 1. التهيئة الأولية (INIT) =================
  async function init() {
    // 1. تشغيل الساعة وعناصر المصادقة والأيقونات فوراً
    startCairoClock();
    setupTabNavigation();
    setupAuthControls();
    setupLucide();

    // 2. تفعيل جميع معالجات الأحداث للأزرار والنوافذ فوراً وبشكل متزامن
    // لضمان استجابة كافة الأزرار بنسبة 100% حتى قبل اكتمال تحميل البيانات أو في حال حدوث أي خطأ في الشبكة
    setupOrdersHandlers();
    setupHomepageFormHandlers();
    setupProductPageFormHandlers();
    setupCheckoutFormHandlers();
    setupCategoriesHandlers();
    setupProductsHandlers();
    setupDiscountsHandlers();
    setupModalHandlers();
    setupInvoiceHandlers();
    setupSecurityHandlers();

    // 3. تحميل البيانات بشكل متوازي مع عزل الأخطاء (Isolated Error Boundaries)
    try {
      await Promise.allSettled([
        loadOrders().then(() => {
          renderOrdersTable();
          renderOrderStats();
        }).catch(e => console.warn('Orders render error:', e)),

        loadSiteContent().then(() => {
          populateHomepageForm();
          populateProductPageForm();
          populateCheckoutForm();
          populateCategoryDropdowns();
          renderCategoriesList();
        }).catch(e => console.warn('Site content render error:', e)),

        loadProducts().then(() => {
          renderProductsTable();
          populateCategoryDropdowns();
        }).catch(e => console.warn('Products render error:', e)),

        loadDiscounts().then(() => {
          renderDiscounts();
        }).catch(e => console.warn('Discounts render error:', e)),

        loadDbStats().catch(e => console.warn('Db stats error:', e))
      ]);
    } catch (err) {
      console.error('خطأ غير متوقع في تحميل بيانات لوحة التحكم:', err);
    }

    // 4. تحديث الإحصائيات والأيقونات في النهاية
    try {
      renderOrderStats();
      loadDbStats();
      setupLucide();
    } catch (e) {
      console.warn('Final UI sync error:', e);
    }
  }

  function setupLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function showToast(msg) {
    const toast = document.getElementById('adminToast');
    const msgEl = document.getElementById('toastMessage');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 2800);
  }

  // ================= 2. عناصر المصادقة والتنقل =================
  function setupAuthControls() {
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (!confirm('هل تود تسجيل الخروج من لوحة التحكم؟')) return;
        try {
          await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
          });
        } catch (e) {}
        localStorage.removeItem('sokhm_admin_token');
        document.cookie = 'sokhm_admin_token=; path=/; max-age=0;';
        window.location.href = 'login.html';
      });
    }

    const quickChangeBtn = document.getElementById('quickChangePasswordBtn');
    if (quickChangeBtn) {
      quickChangeBtn.addEventListener('click', () => {
        switchToTab('tab-security');
        const passIn = document.getElementById('currentPasswordInput');
        if (passIn) passIn.focus();
      });
    }
  }

  function switchToTab(targetTabId) {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === targetTabId) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    if (targetTabId === 'tab-discounts') {
      loadDiscounts().then(() => renderDiscounts());
    } else if (targetTabId === 'tab-products') {
      loadProducts().then(() => {
        renderProductsTable();
        populateCategoryDropdowns();
      });
    } else if (targetTabId === 'tab-orders') {
      loadOrders().then(() => {
        renderOrdersTable();
        renderOrderStats();
      });
    } else if (targetTabId === 'tab-categories') {
      loadSiteContent().then(() => {
        renderCategoriesList();
        populateCategoryDropdowns();
      });
    } else if (targetTabId === 'tab-settings') {
      loadDbStats();
    }

    setupLucide();
  }

  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');
        switchToTab(targetTabId);
      });
    });
  }

  // ================= 3. إدارة الاوردرات (ORDERS) =================
  async function loadOrders() {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        orders = Array.isArray(data) ? data : (Array.isArray(data?.orders) ? data.orders : []);
      } else {
        console.warn('Orders API returned status:', res.status);
        if (!Array.isArray(orders)) orders = [];
      }
    } catch (e) {
      console.warn('تعذر جلب الطلبات من السيرفر:', e);
      if (!Array.isArray(orders)) orders = [];
    }
    if (!Array.isArray(orders)) orders = [];
    updateOrdersBadge();
  }

  function updateOrdersBadge() {
    const badge = document.getElementById('ordersHeaderCountBadge');
    if (!badge) return;
    const safeOrders = Array.isArray(orders) ? orders : [];
    const pendingCount = safeOrders.filter(o => o && o.status === 'pending').length;
    badge.textContent = pendingCount > 0 ? pendingCount : safeOrders.length;
    badge.className = pendingCount > 0 
      ? 'px-2 py-0.5 rounded-full bg-emerald-500 text-black font-extrabold text-[10px]' 
      : 'px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-extrabold text-[10px]';
  }

  function renderOrderStats() {
    const totalEl = document.getElementById('metricTotalOrders');
    const pendingEl = document.getElementById('metricPendingOrders');
    const shippedEl = document.getElementById('metricShippedOrders');
    const revenueEl = document.getElementById('metricTotalRevenue');

    if (!totalEl) return;

    const safeOrders = Array.isArray(orders) ? orders : [];
    const total = safeOrders.length;
    const pending = safeOrders.filter(o => o && o.status === 'pending').length;
    const shipped = safeOrders.filter(o => o && o.status === 'shipped').length;
    const revenue = safeOrders
      .filter(o => o && o.status !== 'cancelled')
      .reduce((sum, o) => sum + (parseFloat(o.total_price || o.totalPrice) || 0), 0);

    totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (shippedEl) shippedEl.textContent = shipped;
    if (revenueEl) revenueEl.textContent = revenue.toLocaleString('en-US') + ' ج.م';
  }

  function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    let filtered = Array.isArray(orders) ? [...orders] : [];
    if (orderStatusFilterValue !== 'all') {
      filtered = filtered.filter(o => o.status === orderStatusFilterValue);
    }
    if (orderSearchTerm) {
      const term = orderSearchTerm.toLowerCase();
      filtered = filtered.filter(o => 
        (o.id || '').toLowerCase().includes(term) ||
        (o.customer_name || o.customerName || '').toLowerCase().includes(term) ||
        (o.customer_phone || o.customerPhone || '').toLowerCase().includes(term) ||
        (o.customer_city || o.customerCity || '').toLowerCase().includes(term) ||
        (o.customer_address || o.customerAddress || '').toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-neutral-500 text-xs">
            لا توجد طلبات تطابق الفلتر أو البحث حالياً.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(order => {
      const orderId = order.id || 'N/A';
      const customerName = order.customer_name || order.customerName || 'غير محدد';
      const customerPhone = order.customer_phone || order.customerPhone || '';
      const customerCity = order.customer_city || order.customerCity || '';
      const customerAddress = order.customer_address || order.customerAddress || '';
      const customerNotes = order.customer_notes || order.customerNotes || '';
      const totalPrice = parseFloat(order.total_price || order.totalPrice) || 0;
      const status = order.status || 'pending';
      const createdAt = order.created_at || order.createdAt || new Date().toISOString();

      let items = [];
      try {
        items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items || []);
      } catch (e) {
        items = [];
      }

      const itemsSummary = items.map(i => `${i.name || 'قطعة'} (${i.size || 'M'}${i.color ? ' - ' + i.color : ''}) × ${i.quantity || 1}`).join('، ');

      const statusMap = {
        pending: { text: 'قيد الانتظار', class: 'bg-amber-950/60 text-amber-400 border-amber-800/60' },
        confirmed: { text: 'مؤكد', class: 'bg-blue-950/60 text-blue-400 border-blue-800/60' },
        shipped: { text: 'تم الشحن', class: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60' },
        delivered: { text: 'تم التوصيل', class: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' },
        cancelled: { text: 'ملغي', class: 'bg-red-950/60 text-red-400 border-red-800/60' }
      };
      const st = statusMap[status] || statusMap.pending;

      const rawPhone = customerPhone.replace(/[^0-9]/g, '');
      const intlPhone = rawPhone.startsWith('0') ? ('2' + rawPhone) : (rawPhone.startsWith('2') ? rawPhone : ('20' + rawPhone));
      const waMessage = encodeURIComponent(`مرحباً ${customerName}، بخصوص طلبك من SOKHM ATELIER رقم: #${orderId}`);
      const waUrl = `https://wa.me/${intlPhone}?text=${waMessage}`;

      return `
        <tr class="hover:bg-white/[0.02] transition-colors">
          <td class="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
            #${orderId}
          </td>
          <td class="py-3 px-4 text-neutral-400 text-[11px] whitespace-nowrap">
            <div class="font-medium text-white">${formatCairoDate(createdAt)}</div>
            <div class="text-[10px] text-neutral-500 font-mono">توقيت القاهرة</div>
          </td>
          <td class="py-3 px-4">
            <div class="font-bold text-white">${customerName}</div>
            <div class="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-neutral-400">
              <span>${customerPhone}</span>
              ${customerPhone ? `
                <a href="${waUrl}" target="_blank" class="text-emerald-400 hover:text-emerald-300 transition-colors" title="محادثة واتساب سريعة">
                  <i data-lucide="message-circle" class="w-3.5 h-3.5 inline"></i>
                </a>
              ` : ''}
            </div>
          </td>
          <td class="py-3 px-4 max-w-[200px]">
            <div class="text-white font-medium truncate">${customerCity}</div>
            <div class="text-neutral-400 text-[11px] truncate" title="${customerAddress}">${customerAddress}</div>
            ${customerNotes ? `<div class="text-amber-400/90 text-[10px] mt-0.5 truncate" title="${customerNotes}">ملاحظة: ${customerNotes}</div>` : ''}
          </td>
          <td class="py-3 px-4 max-w-[220px]">
            <div class="text-neutral-300 truncate text-[11px]" title="${itemsSummary}">
              ${itemsSummary || 'تفاصيل القطع غير متوفرة'}
            </div>
            <span class="text-[10px] text-neutral-500 font-mono">${items.length} قطع مختلفة</span>
          </td>
          <td class="py-3 px-4 font-mono font-extrabold text-emerald-400 whitespace-nowrap">
            <div>${totalPrice.toLocaleString('en-US')} ج.م</div>
            ${(order.discount_code || (order.discount_amount && parseFloat(order.discount_amount) > 0)) ? `
              <div class="text-[10px] text-amber-400 font-sans font-bold flex items-center gap-1 mt-0.5">
                <i data-lucide="tag" class="w-2.5 h-2.5"></i>
                <span>كود: ${order.discount_code || ''} (-${(parseFloat(order.discount_amount) || 0).toLocaleString('en-US')} ج.م)</span>
              </div>
            ` : ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <select class="order-status-select bg-[#080808] border rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer transition-colors ${st.class}" data-order-id="${orderId}">
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
              <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>مؤكد</option>
              <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
              <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>تم التوصيل</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>ملغي</option>
            </select>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <button class="view-invoice-btn p-1.5 rounded-lg bg-[#141414] hover:bg-white hover:text-black text-neutral-300 transition-colors cursor-pointer" data-order-id="${orderId}" title="طباعة بوليصة الشحن">
                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              </button>
              <button class="delete-order-btn p-1.5 rounded-lg bg-[#141414] hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer" data-order-id="${orderId}" title="حذف الطلب">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setupLucide();
    attachOrderRowEvents();
  }

  function attachOrderRowEvents() {
    document.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const orderId = select.getAttribute('data-order-id');
        const newStatus = select.value;
        try {
          const res = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
            const target = orders.find(o => o.id === orderId);
            if (target) target.status = newStatus;
            renderOrderStats();
            updateOrdersBadge();
            showToast(`تم تحديث حالة الطلب #${orderId} إلى ${select.options[select.selectedIndex].text}`);
          }
        } catch (err) {
          alert('تعذر تحديث حالة الطلب');
        }
      });
    });

    document.querySelectorAll('.view-invoice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        const order = orders.find(o => o.id === orderId);
        if (order) openInvoiceModal(order);
      });
    });

    document.querySelectorAll('.delete-order-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.getAttribute('data-order-id');
        if (!confirm(`هل أنت متأكد من حذف الطلب #${orderId} نهائياً؟`)) return;
        try {
          const res = await fetch(`/api/orders/${orderId}`, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (res.ok) {
            orders = orders.filter(o => o.id !== orderId);
            renderOrdersTable();
            renderOrderStats();
            updateOrdersBadge();
            loadDbStats();
            showToast('تم حذف الطلب بنجاح');
          }
        } catch (err) {
          alert('تعذر حذف الطلب');
        }
      });
    });
  }

  function setupOrdersHandlers() {
    const refreshBtn = document.getElementById('refreshOrdersBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('animate-spin');
        await loadOrders();
        renderOrdersTable();
        renderOrderStats();
        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 400);
        showToast('تم تحديث قائمة الطلبات بنجاح');
      });
    }

    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        orderSearchTerm = e.target.value.trim();
        renderOrdersTable();
      });
    }

    const filterBtns = document.querySelectorAll('.order-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.className = 'order-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#141414] text-neutral-400 hover:text-white border border-[#222] cursor-pointer';
        });
        btn.className = 'order-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-black cursor-pointer';
        orderStatusFilterValue = btn.getAttribute('data-filter');
        renderOrdersTable();
      });
    });
  }

  function openInvoiceModal(order) {
    if (!invoiceModal) return;
    const content = document.getElementById('invoiceModalContent');
    if (!content) return;

    const orderId = order.id || 'N/A';
    const customerName = order.customer_name || order.customerName || '';
    const customerPhone = order.customer_phone || order.customerPhone || '';
    const customerCity = order.customer_city || order.customerCity || '';
    const customerAddress = order.customer_address || order.customerAddress || '';
    const customerNotes = order.customer_notes || order.customerNotes || '';
    const totalPrice = parseFloat(order.total_price || order.totalPrice) || 0;
    const createdAt = order.created_at || order.createdAt || new Date().toISOString();

    let items = [];
    try {
      items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items || []);
    } catch (e) {
      items = [];
    }

    content.innerHTML = `
      <div id="printArea" class="bg-black text-white p-6 border border-[#222] rounded-xl space-y-4 font-sans text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-[#222]">
          <div class="flex items-center gap-2">
            <svg viewBox="0 0 100 120" class="w-5 h-6 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M50 0 C50 36 68 54 100 60 C68 66 50 84 50 120 C50 84 32 66 0 60 C32 54 50 36 50 0 Z M50 46 L58 60 L50 74 L42 60 Z" />
            </svg>
            <span class="font-gothic font-bold text-base tracking-widest uppercase">✦ SOKHM ATELIER</span>
          </div>
          <div class="text-left font-mono">
            <span class="text-neutral-400 block text-[10px]">بوليصة شحن وتوصيل</span>
            <span class="font-bold text-white text-sm">#${orderId}</span>
            <span class="text-neutral-400 block text-[10px] mt-0.5">${formatCairoDate(createdAt, { year: 'numeric', second: '2-digit' })} (بتوقيت القاهرة)</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 py-2 border-b border-[#1A1A1A]">
          <div>
            <span class="text-neutral-500 block text-[10px] mb-0.5">بيانات المستلم:</span>
            <div class="font-bold text-white">${customerName}</div>
            <div class="font-mono text-neutral-300 mt-0.5">${customerPhone}</div>
          </div>
          <div>
            <span class="text-neutral-500 block text-[10px] mb-0.5">عنوان التوصيل:</span>
            <div class="font-bold text-white">${customerCity}</div>
            <div class="text-neutral-300 text-[11px] leading-relaxed">${customerAddress}</div>
            ${customerNotes ? `<div class="text-amber-400 text-[10px] mt-1">ملاحظات: ${customerNotes}</div>` : ''}
          </div>
        </div>

        <div>
          <span class="text-neutral-500 block text-[10px] mb-2">محتويات الشحنة:</span>
          <table class="w-full text-right text-xs">
            <thead class="border-b border-[#222] text-neutral-400 font-bold">
              <tr>
                <th class="py-1">القطعة</th>
                <th class="py-1">المقاس واللون</th>
                <th class="py-1 text-center">الكمية</th>
                <th class="py-1 font-mono text-left">السعر</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#161616]">
              ${items.map(item => `
                <tr>
                  <td class="py-2 text-white font-bold">${item.name}</td>
                  <td class="py-2 text-neutral-300 font-mono">${item.size || 'M'} ${item.color ? ' | ' + item.color : ''}</td>
                  <td class="py-2 text-center text-white font-bold">${item.quantity || 1}</td>
                  <td class="py-2 font-mono text-white text-left">${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-US')} ج.م</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${(order.discount_code || (order.discount_amount && parseFloat(order.discount_amount) > 0)) ? `
          <div class="pt-2 border-t border-[#1A1A1A] space-y-1 text-xs">
            <div class="flex items-center justify-between text-neutral-400">
              <span>المجموع الفرعي (Subtotal):</span>
              <span class="font-mono text-neutral-200">${((parseFloat(order.subtotal_price) || (totalPrice + (parseFloat(order.discount_amount) || 0)))).toLocaleString('en-US')} ج.م</span>
            </div>
            <div class="flex items-center justify-between text-amber-400 font-bold">
              <span class="flex items-center gap-1">
                <i data-lucide="tag" class="w-3 h-3"></i>
                <span>خصم الكوبون (${order.discount_code}):</span>
              </span>
              <span class="font-mono">-${((parseFloat(order.discount_amount) || 0)).toLocaleString('en-US')} ج.م</span>
            </div>
          </div>
        ` : ''}

        <div class="pt-3 border-t border-[#222] flex items-center justify-between text-sm font-bold">
          <span>المبلغ المطلوب تحصيله (COD):</span>
          <span class="text-base font-mono font-extrabold text-emerald-400">${totalPrice.toLocaleString('en-US')} ج.م</span>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-3">
        <button id="printInvoiceBtn" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer shadow-md">
          <i data-lucide="printer" class="w-4 h-4"></i>
          <span>طباعة البوليصة</span>
        </button>
      </div>
    `;

    setupLucide();

    const printBtn = document.getElementById('printInvoiceBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    invoiceModal.showModal();
  }

  function setupInvoiceHandlers() {
    const closeBtn = document.getElementById('closeInvoiceModalBtn');
    if (closeBtn && invoiceModal) {
      closeBtn.addEventListener('click', () => invoiceModal.close());
    }

    if (invoiceModal) {
      invoiceModal.addEventListener('click', (e) => {
        const rect = invoiceModal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
          invoiceModal.close();
        }
      });
    }
  }

  // ================= 4. إدارة المحتوى (SITE CONTENT) =================
  async function loadSiteContent() {
    try {
      const res = await fetch('/api/site-content');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          siteContent = data;
        }
      }
    } catch (e) {
      console.warn('تعذر جلب المحتوى:', e);
    }
    if (!siteContent || typeof siteContent !== 'object') siteContent = {};
    if (!siteContent.homepage || typeof siteContent.homepage !== 'object') siteContent.homepage = {};
    if (!siteContent.productPage || typeof siteContent.productPage !== 'object') siteContent.productPage = {};
    if (!siteContent.checkout || typeof siteContent.checkout !== 'object') siteContent.checkout = {};
    if (!siteContent.visibility || typeof siteContent.visibility !== 'object') siteContent.visibility = {};
    if (!Array.isArray(siteContent.categories)) siteContent.categories = [];
  }

  async function saveSiteContent() {
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(siteContent)
      });
      loadDbStats();
      return res.ok;
    } catch (err) {
      console.warn('خطأ حفظ المحتوى بالسيرفر:', err);
      return false;
    }
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  // Helper for visibility toggles
  function bindVisCheckbox(id, key) {
    const cb = document.getElementById(id);
    if (!cb) return;
    if (!siteContent.visibility || typeof siteContent.visibility !== 'object') {
      siteContent.visibility = {};
    }
    const isVis = siteContent.visibility[key] !== false;
    cb.checked = isVis;
    updateVisText(cb);

    cb.onchange = () => {
      if (!siteContent.visibility) siteContent.visibility = {};
      siteContent.visibility[key] = cb.checked;
      updateVisText(cb);
    };
  }

  function updateVisText(cb) {
    const parent = cb.closest('label');
    if (!parent) return;
    const textSpan = parent.querySelector('.vis-text');
    if (textSpan) {
      if (cb.checked) {
        textSpan.textContent = 'ظهور';
        textSpan.className = 'vis-text text-[10px] font-bold text-emerald-400';
      } else {
        textSpan.textContent = 'مخفي';
        textSpan.className = 'vis-text text-[10px] font-normal text-neutral-500';
      }
    }
    // Dim input if hidden
    const container = cb.closest('div.cms-card, div.p-3, div') || parent.parentElement;
    const input = container ? container.querySelector('input[type="text"], input[type="number"], textarea') : null;
    if (input) {
      input.style.opacity = cb.checked ? '1' : '0.4';
    }
  }

  // ================= 5. نصوص الرئيسية (HOMEPAGE) =================
  function populateHomepageForm() {
    const hp = siteContent.homepage || {};

    // 1. الهيرو
    setVal('hp_hero_kicker', hp.hero?.kicker);
    setVal('hp_hero_title', hp.hero?.title);
    setVal('hp_hero_subtitle', hp.hero?.subtitle);
    setVal('hp_hero_cta', hp.hero?.ctaText || hp.hero?.cta);
    setVal('hp_hero_desc', hp.hero?.description || hp.hero?.narrative);
    setVal('hp_hero_scroll', hp.hero?.scrollLabel || hp.hero?.scroll);

    bindVisCheckbox('vis_hp_hero_kicker', 'homepage.hero.kicker');
    bindVisCheckbox('vis_hp_hero_title', 'homepage.hero.title');
    bindVisCheckbox('vis_hp_hero_subtitle', 'homepage.hero.subtitle');
    bindVisCheckbox('vis_hp_hero_cta', 'homepage.hero.ctaText');
    bindVisCheckbox('vis_hp_hero_desc', 'homepage.hero.description');
    bindVisCheckbox('vis_hp_hero_scroll', 'homepage.hero.scrollLabel');

    // 2. شريط المزايا (4 عناصر)
    if (Array.isArray(hp.valueBar)) {
      hp.valueBar.forEach((vb, idx) => {
        setVal(`hp_val_${idx}_title`, vb.title);
        setVal(`hp_val_${idx}_sub`, vb.subtitle || vb.desc);
      });
    }
    bindVisCheckbox('vis_hp_val_0', 'homepage.valueBar.0.title');
    bindVisCheckbox('vis_hp_val_1', 'homepage.valueBar.1.title');
    bindVisCheckbox('vis_hp_val_2', 'homepage.valueBar.2.title');
    bindVisCheckbox('vis_hp_val_3', 'homepage.valueBar.3.title');

    // 3. التشكيلة
    setVal('hp_col_kicker', hp.collection?.kicker);
    setVal('hp_col_title', hp.collection?.title);
    setVal('hp_col_viewall', hp.collection?.viewAllText || hp.collection?.viewAll);
    bindVisCheckbox('vis_hp_col_kicker', 'homepage.collection.kicker');
    bindVisCheckbox('vis_hp_col_title', 'homepage.collection.title');
    bindVisCheckbox('vis_hp_col_viewall', 'homepage.collection.viewAllText');

    // 4. البانر
    const banner = hp.bottomBanner || hp.banner || {};
    setVal('hp_banner_brand', banner.brandTag || banner.brand);
    setVal('hp_banner_head', banner.headline || banner.heading);
    setVal('hp_banner_cta', banner.ctaText || banner.cta);
    bindVisCheckbox('vis_hp_banner_brand', 'homepage.bottomBanner.brandTag');
    bindVisCheckbox('vis_hp_banner_head', 'homepage.bottomBanner.headline');
    bindVisCheckbox('vis_hp_banner_cta', 'homepage.bottomBanner.ctaText');

    // 5. الفوتر
    setVal('hp_foot_brand', hp.footer?.brandTag || hp.footer?.brand);
    setVal('hp_foot_slogan', hp.footer?.slogan);
    setVal('hp_foot_copy', hp.footer?.copyright || hp.footer?.copy);
    bindVisCheckbox('vis_hp_foot_brand', 'homepage.footer.brandTag');
    bindVisCheckbox('vis_hp_foot_slogan', 'homepage.footer.slogan');
    bindVisCheckbox('vis_hp_foot_copy', 'homepage.footer.copyright');
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

      // Update checkboxes in visibility map
      const visCheckboxes = document.querySelectorAll('#tab-homepage input[data-vis-key]');
      visCheckboxes.forEach(cb => {
        const k = cb.getAttribute('data-vis-key');
        siteContent.visibility[k] = cb.checked;
      });

      const ok = await saveSiteContent();
      if (ok) {
        showToast('تم حفظ وتحديث نصوص الصفحة الرئيسية في قاعدة البيانات بنجاح!');
      } else {
        alert('تعذر حفظ المحتوى في السيرفر');
      }
    });
  }

  // ================= 6. نصوص صفحة المنتج (PRODUCT PAGE) =================
  function populateProductPageForm() {
    const pp = siteContent.productPage || {};

    // 1. الشارات
    if (Array.isArray(pp.highlights)) {
      setVal('pp_high_0', pp.highlights[0]?.text || pp.highlights[0]);
      setVal('pp_high_1', pp.highlights[1]?.text || pp.highlights[1]);
      setVal('pp_high_2', pp.highlights[2]?.text || pp.highlights[2]);
    }
    bindVisCheckbox('vis_pp_high_0', 'productPage.highlights.0.text');
    bindVisCheckbox('vis_pp_high_1', 'productPage.highlights.1.text');
    bindVisCheckbox('vis_pp_high_2', 'productPage.highlights.2.text');

    // 2. الأزرار
    setVal('pp_btn_sizeguide', pp.sizeGuideButtonText || pp.sizeGuide);
    setVal('pp_btn_express', pp.expressCheckoutText || pp.expressText);
    bindVisCheckbox('vis_pp_btn_sizeguide', 'productPage.sizeGuideButtonText');
    bindVisCheckbox('vis_pp_btn_express', 'productPage.expressCheckoutText');

    // 3. القوائم المطوية
    if (Array.isArray(pp.accordions)) {
      setVal('pp_acc_0_title', pp.accordions[0]?.title);
      setVal('pp_acc_1_title', pp.accordions[1]?.title);
      setVal('pp_acc_2_title', pp.accordions[2]?.title);
    }
    bindVisCheckbox('vis_pp_acc_0_title', 'productPage.accordions.0.title');
    bindVisCheckbox('vis_pp_acc_1_title', 'productPage.accordions.1.title');
    bindVisCheckbox('vis_pp_acc_2_title', 'productPage.accordions.2.title');

    // 4. المقترحات والسلة
    setVal('pp_related_title', pp.relatedTitle);
    setVal('pp_cart_title', pp.cartDrawer?.title);
    setVal('pp_cart_empty_title', pp.cartDrawer?.emptyTitle);
    bindVisCheckbox('vis_pp_related_title', 'productPage.relatedTitle');
    bindVisCheckbox('vis_pp_cart_title', 'productPage.cartDrawer.title');
    bindVisCheckbox('vis_pp_cart_empty_title', 'productPage.cartDrawer.emptyTitle');
  }

  function setupProductPageFormHandlers() {
    const saveBtn = document.getElementById('saveProductPageBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      if (!siteContent.productPage) siteContent.productPage = {};
      const pp = siteContent.productPage;

      // 1. الشارات
      pp.highlights = [
        { icon: 'shield-check', text: getVal('pp_high_0') },
        { icon: 'truck', text: getVal('pp_high_1') },
        { icon: 'rotate-ccw', text: getVal('pp_high_2') }
      ];

      // 2. الأزرار
      pp.sizeGuideButtonText = getVal('pp_btn_sizeguide');
      pp.expressCheckoutText = getVal('pp_btn_express');

      // 3. القوائم المطوية
      pp.accordions = pp.accordions || [];
      if (!pp.accordions[0]) pp.accordions[0] = {};
      if (!pp.accordions[1]) pp.accordions[1] = {};
      if (!pp.accordions[2]) pp.accordions[2] = {};
      pp.accordions[0].title = getVal('pp_acc_0_title');
      pp.accordions[1].title = getVal('pp_acc_1_title');
      pp.accordions[2].title = getVal('pp_acc_2_title');

      // 4. المقترحات والسلة
      pp.relatedTitle = getVal('pp_related_title');
      pp.cartDrawer = pp.cartDrawer || {};
      pp.cartDrawer.title = getVal('pp_cart_title');
      pp.cartDrawer.emptyTitle = getVal('pp_cart_empty_title');

      // Update checkboxes in visibility map
      const visCheckboxes = document.querySelectorAll('#tab-product-page input[data-vis-key]');
      visCheckboxes.forEach(cb => {
        const k = cb.getAttribute('data-vis-key');
        siteContent.visibility[k] = cb.checked;
      });

      const ok = await saveSiteContent();
      if (ok) {
        showToast('تم حفظ وتحديث نصوص صفحة تفاصيل المنتج بنجاح!');
      } else {
        alert('تعذر حفظ المحتوى في السيرفر');
      }
    });
  }

  // ================= 7. تخصيص الشراء (CHECKOUT CUSTOMIZER) =================
  function populateCheckoutForm() {
    const chk = siteContent.checkout || {};

    setVal('chk_title', chk.title || '✦ SOKHM ATELIER // إتمام الشراء');
    setVal('chk_subtitle', chk.subtitle || 'يرجى كتابة البيانات بدقة لضمان سرعة تواصل مندوب الشحن وتوصيل الطلب.');
    setVal('chk_submitBtn', chk.submitButtonText || 'تأكيد الطلب الآن');

    setVal('chk_codTitle', chk.codTitle || 'الدفع نقدياً عند الاستلام (COD)');
    setVal('chk_codSubtitle', chk.codSubtitle || 'معاينة القطع قبل الدفع متاحة مع مندوب التوصيل.');

    setVal('chk_freeThreshold', chk.freeShippingThreshold !== undefined ? chk.freeShippingThreshold : 2500);
    setVal('chk_standardFee', chk.standardShippingFee !== undefined ? chk.standardShippingFee : 75);
    setVal('chk_shippingRuleText', chk.shippingRuleText || 'شحن سريع مجاني لجميع الطلبات بقيمة 2,500 ج.م أو أكثر');

    if (Array.isArray(chk.trustHighlights)) {
      setVal('chk_trust1', chk.trustHighlights[0] || '500 GSM قطن مصري فاخر فائق الكثافة');
      setVal('chk_trust2', chk.trustHighlights[1] || 'شحن سريع لجميع المحافظات خلال 24-48 ساعة');
      setVal('chk_trust3', chk.trustHighlights[2] || 'سياسة استبدال واسترجاع سلسة لمدة 30 يوم');
    }

    setVal('chk_successTitle', chk.successTitle || 'تم استلام وتأكيد طلبك بنجاح!');
    setVal('chk_successSubtitle', chk.successSubtitle || 'شكراً لاختيارك ✦ SOKHM ATELIER. تم تسجيل طلبك في نظامنا وسيقوم مندوب الشحن بالتواصل معك هاتفياً قبل التوصيل.');
    setVal('chk_whatsappPhone', chk.whatsappPhone || '01098765432');
    setVal('chk_whatsappButtonText', chk.whatsappButtonText || 'متابعة الطلب عبر WhatsApp');

    // Bind checkmarks
    bindVisCheckbox('vis_chk_title', 'checkout.title');
    bindVisCheckbox('vis_chk_subtitle', 'checkout.subtitle');
    bindVisCheckbox('vis_chk_submitBtn', 'checkout.submitButtonText');
    bindVisCheckbox('vis_chk_notes', 'checkout.notesContainer');
    bindVisCheckbox('vis_chk_codBox', 'checkout.codBox');
    bindVisCheckbox('vis_chk_codTitle', 'checkout.codTitle');
    bindVisCheckbox('vis_chk_codSubtitle', 'checkout.codSubtitle');
    bindVisCheckbox('vis_chk_shippingRuleText', 'checkout.shippingRuleText');
    bindVisCheckbox('vis_chk_trustContainer', 'checkout.trustHighlightsContainer');
    bindVisCheckbox('vis_chk_trust1', 'checkout.trustHighlight1');
    bindVisCheckbox('vis_chk_trust2', 'checkout.trustHighlight2');
    bindVisCheckbox('vis_chk_trust3', 'checkout.trustHighlight3');
    bindVisCheckbox('vis_chk_successTitle', 'checkout.successTitle');
    bindVisCheckbox('vis_chk_successSubtitle', 'checkout.successSubtitle');
    bindVisCheckbox('vis_chk_whatsappButtonText', 'checkout.whatsappButtonText');
  }

  function setupCheckoutFormHandlers() {
    const saveBtn = document.getElementById('saveCheckoutBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      if (!siteContent.checkout) siteContent.checkout = {};
      const chk = siteContent.checkout;

      chk.title = getVal('chk_title');
      chk.subtitle = getVal('chk_subtitle');
      chk.submitButtonText = getVal('chk_submitBtn');

      chk.codTitle = getVal('chk_codTitle');
      chk.codSubtitle = getVal('chk_codSubtitle');

      chk.freeShippingThreshold = parseFloat(getVal('chk_freeThreshold')) || 2500;
      chk.standardShippingFee = parseFloat(getVal('chk_standardFee')) || 75;
      chk.shippingRuleText = getVal('chk_shippingRuleText');

      chk.trustHighlights = [
        getVal('chk_trust1'),
        getVal('chk_trust2'),
        getVal('chk_trust3')
      ];

      chk.successTitle = getVal('chk_successTitle');
      chk.successSubtitle = getVal('chk_successSubtitle');
      chk.whatsappPhone = getVal('chk_whatsappPhone');
      chk.whatsappButtonText = getVal('chk_whatsappButtonText');

      // Update checkboxes in visibility map
      const visCheckboxes = document.querySelectorAll('#tab-checkout input[data-vis-key]');
      visCheckboxes.forEach(cb => {
        const k = cb.getAttribute('data-vis-key');
        siteContent.visibility[k] = cb.checked;
      });

      const ok = await saveSiteContent();
      if (ok) {
        showToast('تم حفظ وتحديث إعدادات وتخصيصات الشراء بنجاح!');
      } else {
        alert('تعذر حفظ إعدادات الشراء في السيرفر');
      }
    });
  }

  // ================= 8. إدارة الحماية وكلمة المرور (SECURITY TAB) =================
  function setupSecurityHandlers() {
    const form = document.getElementById('changePasswordForm');
    const alertBox = document.getElementById('passwordAlert');
    const submitBtn = document.getElementById('changePasswordSubmitBtn');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPasswordInput').value.trim();
      const newPassword = document.getElementById('newPasswordInput').value.trim();
      const confirmPassword = document.getElementById('confirmPasswordInput').value.trim();

      if (alertBox) alertBox.classList.add('hidden');

      if (newPassword.length < 6) {
        showPasswordAlert('يجب أن تكون كلمة المرور الجديدة 6 خانات على الأقل.', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showPasswordAlert('كلمة المرور الجديدة وتأكيدها غير متطابقين.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">✦</span> جاري التشفير وتحديث كلمة المرور...';

      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'تعذر تغيير كلمة المرور');
        }

        localStorage.setItem('sokhm_admin_password', newPassword);
        showPasswordAlert('✓ تم تحديث كلمة المرور بنجاح في قاعدة البيانات!', 'success');
        form.reset();
        showToast('تم تغيير كلمة المرور بنجاح');

      } catch (err) {
        // If offline / static fallback
        if (err.message && (err.message.includes('fetch') || err.message.includes('Failed'))) {
          localStorage.setItem('sokhm_admin_password', newPassword);
          showPasswordAlert('✓ تم تحديث كلمة المرور محلياً بنجاح!', 'success');
          form.reset();
          showToast('تم تحديث كلمة المرور');
        } else {
          showPasswordAlert(err.message, 'error');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>تحديث وحفظ كلمة المرور الجديدة</span>';
        setupLucide();
      }
    });

    function showPasswordAlert(msg, type) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className = type === 'success' 
        ? 'p-3.5 rounded-xl text-xs flex items-center gap-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300'
        : 'p-3.5 rounded-xl text-xs flex items-center gap-3 bg-red-950/50 border border-red-800 text-red-300';
      alertBox.classList.remove('hidden');
    }
  }

  // ================= 9. كتالوج المنتجات (PRODUCTS) =================
  async function loadProducts() {
    try {
      const res = await fetch(`/api/products?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        products = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      } else {
        console.warn('Products API returned status:', res.status);
        if (!Array.isArray(products)) products = [];
      }
    } catch (e) {
      console.warn('تعذر جلب المنتجات:', e);
      if (!Array.isArray(products)) products = [];
    }
    if (!Array.isArray(products)) products = [];
  }

  let draggedRowId = null;
  let isSavingOrder = false;

  async function saveProductsOrder() {
    if (isSavingOrder) return;
    isSavingOrder = true;

    const statusBadge = document.getElementById('reorderSaveStatus');
    if (statusBadge) {
      statusBadge.innerHTML = '<span class="inline-block animate-spin mr-1">✦</span> جاري حفظ الترتيب...';
      statusBadge.classList.remove('hidden', 'text-emerald-400', 'text-red-400');
      statusBadge.classList.add('flex', 'text-amber-400');
    }

    const safeProds = Array.isArray(products) ? products : [];
    const orderedIds = safeProds.map(p => p.id);
    try {
      const res = await fetch('/api/products/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'x-admin-token': token
        },
        body: JSON.stringify({ orderedIds })
      });

      if (!res.ok) {
        throw new Error('فشل حفظ الترتيب في السيرفر');
      }

      if (statusBadge) {
        statusBadge.innerHTML = '<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span>تم حفظ ترتيب المنتجات بنجاح</span>';
        statusBadge.classList.remove('text-amber-400', 'text-red-400');
        statusBadge.classList.add('text-emerald-400');
        setupLucide();
        setTimeout(() => {
          if (statusBadge) statusBadge.classList.add('hidden');
        }, 3000);
      }

      const topProd = safeProds[0];
      showToast(`تم حفظ الترتيب بنجاح! القطعة "${topProd ? topProd.name : ''}" في مقدمة المتجر ★`);
    } catch (err) {
      console.error('Save order error:', err);
      if (statusBadge) {
        statusBadge.innerHTML = '<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i><span>تعذر حفظ الترتيب</span>';
        statusBadge.classList.remove('text-amber-400', 'text-emerald-400');
        statusBadge.classList.add('text-red-400');
        setupLucide();
      }
      showToast('تعذر حفظ الترتيب في السيرفر', 'error');
    } finally {
      isSavingOrder = false;
    }
  }

  function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    let filtered = Array.isArray(products) ? [...products] : [];
    if (productCategoryFilterValue !== 'all') {
      filtered = filtered.filter(p => p.category === productCategoryFilterValue);
    }
    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(term) ||
        (p.id || '').toLowerCase().includes(term) ||
        (p.price || '').toString().includes(term)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-neutral-500 text-xs">
            لا توجد منتجات تطابق البحث أو الفلتر المختار.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((prod, idx) => {
      const pPrice = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;
      const sizes = Array.isArray(prod.sizes) ? prod.sizes : (typeof prod.sizes === 'string' ? prod.sizes.split(',') : ['M', 'L']);
      const colors = Array.isArray(prod.colors) ? prod.colors : [];
      const catObj = categories.find(c => c.id === prod.category || c.slug === prod.category);
      const catName = catObj ? catObj.name : (prod.category || 'عام');
      const isFirst = (idx === 0);
      const isLast = (idx === filtered.length - 1);

      return `
        <tr class="product-draggable-row group hover:bg-white/[0.03] transition-all cursor-default" draggable="true" data-id="${prod.id}" data-index="${idx}">
          <td class="py-3 px-3 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <span class="drag-handle-btn p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors" title="اضغط واسحب لتغيير ترتيب ظهور المنتج في واجهة المتجر">
                <i data-lucide="grip-vertical" class="w-4 h-4"></i>
              </span>
              <span class="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full ${isFirst ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-[#141414] text-neutral-300 border border-[#222]'}" title="${isFirst ? 'المنتج الأول في مقدمة واجهة المتجر' : `الترتيب رقم ${idx + 1}`}">
                ${isFirst ? '★ #1' : `#${idx + 1}`}
              </span>
              <div class="flex flex-col gap-0.5">
                <button type="button" class="move-prod-btn move-prod-up p-0.5 rounded text-neutral-500 hover:text-white hover:bg-white/10 transition-colors ${isFirst ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}" data-id="${prod.id}" data-dir="up" title="تقديم للأعلى (يظهر قبل المنتج السابق)">
                  <i data-lucide="chevron-up" class="w-3 h-3"></i>
                </button>
                <button type="button" class="move-prod-btn move-prod-down p-0.5 rounded text-neutral-500 hover:text-white hover:bg-white/10 transition-colors ${isLast ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}" data-id="${prod.id}" data-dir="down" title="تأخير للأسفل (يظهر بعد المنتج التالي)">
                  <i data-lucide="chevron-down" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-14 rounded-lg bg-[#070707] border border-[#222] overflow-hidden flex-shrink-0">
                <img src="${prod.image ? '../' + prod.image.replace(/^\.\.\//, '') : '../assets/sokhm-card-1.jpg'}" alt="${prod.name}" class="w-full h-full object-cover">
              </div>
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="font-bold text-white text-xs truncate max-w-[180px]">${prod.name}</h4>
                  ${isFirst ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">في المقدمة</span>' : ''}
                  ${(prod.show_on_homepage === 0 || prod.show_on_homepage === false) 
                    ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30" title="يظهر فقط داخل قسم التصنيف (مخفي من الرئيسية)">📁 قسم فقط</span>' 
                    : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold" title="يظهر في الصفحة الرئيسية وقسم التصنيف">🌐 الرئيسية</span>'}
                </div>
                <span class="text-[10px] text-neutral-500 font-mono block mt-0.5">#${prod.id}</span>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-neutral-300 font-medium whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full bg-[#141414] border border-[#222] text-[11px]">${catName}</span>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-white text-xs whitespace-nowrap">
            ${pPrice.toLocaleString('en-US')} ج.م
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="flex items-center gap-1 font-mono text-[10px]">
              ${sizes.map(s => `<span class="px-1.5 py-0.5 rounded bg-[#161616] text-neutral-300 border border-[#262626]">${s.trim()}</span>`).join('')}
            </div>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 flex-wrap max-w-[160px]">
              ${colors.map(c => {
                const hex = typeof c === 'object' ? c.hex : '#111';
                const name = typeof c === 'object' ? c.name : c;
                const imgCount = (typeof c === 'object' && Array.isArray(c.images) && c.images.length > 1) ? ` (${c.images.length} صور)` : '';
                return `<span class="w-3.5 h-3.5 rounded-full border border-[#333] shadow-sm flex-shrink-0" style="background-color: ${hex}" title="${name}${imgCount}"></span>`;
              }).join('')}
              ${colors.length === 0 ? '<span class="text-neutral-500 text-[10px]">-</span>' : ''}
            </div>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-900/60 text-[10px] font-bold text-emerald-400">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              متوفر للطلب
            </span>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <button class="edit-product-btn p-1.5 rounded-lg bg-[#141414] hover:bg-white hover:text-black text-neutral-300 transition-colors cursor-pointer" data-id="${prod.id}" title="تعديل المنتج">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button class="delete-product-btn p-1.5 rounded-lg bg-[#141414] hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer" data-id="${prod.id}" title="حذف المنتج">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setupLucide();
    attachProductRowEvents();
  }

  function attachProductRowEvents() {
    // 1. Edit buttons
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prod = products.find(p => p.id === id);
        if (prod) openProductModal(prod);
      });
    });

    // 2. Delete buttons
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm(`هل أنت متأكد من حذف القطعة ${id} من قاعدة البيانات؟`)) return;
        try {
          let res = await fetch(`/api/products/${encodeURIComponent(id)}`, { 
            method: 'DELETE',
            headers: { 
              'Authorization': 'Bearer ' + token,
              'x-admin-token': token
            }
          });
          if (!res.ok && res.status === 404) {
            res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { 
                'Authorization': 'Bearer ' + token,
                'x-admin-token': token
              }
            });
          }
          if (res.ok) {
            products = products.filter(p => String(p.id).trim() !== String(id).trim() && String(p.slug || '').trim() !== String(id).trim());
            renderProductsTable();
            loadDbStats();
            showToast('تم حذف المنتج بنجاح من قاعدة البيانات');
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(errData.error || errData.message || 'تعذر حذف المنتج من السيرفر');
          }
        } catch (err) {
          alert('تعذر الاتصال بالسيرفر لحذف المنتج: ' + err.message);
        }
      });
    });

    // 3. Move Up / Down Arrow buttons
    document.querySelectorAll('.move-prod-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const dir = btn.getAttribute('data-dir');
        const currentIdx = products.findIndex(p => p.id === id);
        if (currentIdx === -1) return;

        if (dir === 'up' && currentIdx > 0) {
          const item = products.splice(currentIdx, 1)[0];
          products.splice(currentIdx - 1, 0, item);
          renderProductsTable();
          await saveProductsOrder();
        } else if (dir === 'down' && currentIdx < products.length - 1) {
          const item = products.splice(currentIdx, 1)[0];
          products.splice(currentIdx + 1, 0, item);
          renderProductsTable();
          await saveProductsOrder();
        }
      });
    });

    // 4. HTML5 Drag & Drop on Rows
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('.product-draggable-row');
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedRowId = row.getAttribute('data-id');
        row.classList.add('opacity-40', 'bg-amber-500/10');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedRowId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('opacity-40', 'bg-amber-500/10');
        rows.forEach(r => r.classList.remove('border-t-2', 'border-b-2', 'border-amber-400', 'bg-white/[0.04]'));
        draggedRowId = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetId = row.getAttribute('data-id');
        if (targetId === draggedRowId) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('border-t-2', 'border-amber-400');
          row.classList.remove('border-b-2');
        } else {
          row.classList.add('border-b-2', 'border-amber-400');
          row.classList.remove('border-t-2');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('border-t-2', 'border-b-2', 'border-amber-400', 'bg-white/[0.04]');
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('border-t-2', 'border-b-2', 'border-amber-400', 'bg-white/[0.04]');
        const targetId = row.getAttribute('data-id');
        if (!draggedRowId || draggedRowId === targetId) return;

        const fromIdx = products.findIndex(p => p.id === draggedRowId);
        let toIdx = products.findIndex(p => p.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY >= midY && toIdx < products.length - 1) {
          toIdx++;
        }

        const [movedProd] = products.splice(fromIdx, 1);
        products.splice(toIdx, 0, movedProd);

        renderProductsTable();
        await saveProductsOrder();
      });
    });
  }

  function setupProductsHandlers() {
    const addBtn = document.getElementById('addNewProductBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => openProductModal(null));
    }

    const searchInput = document.getElementById('productSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        productSearchTerm = e.target.value.trim();
        renderProductsTable();
      });
    }

    const catFilter = document.getElementById('productCategoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        productCategoryFilterValue = e.target.value;
        renderProductsTable();
      });
    }
  }

  // ================= 10. نافذة إضافة وتعديل المنتج (PRODUCT MODAL) =================
  function openProductModal(prod) {
    if (!productModal) return;
    editingProductId = prod ? prod.id : null;

    const modalTitle = document.getElementById('productModalTitle');
    const form = document.getElementById('productEditForm');
    if (modalTitle) {
      modalTitle.innerHTML = prod 
        ? `<i data-lucide="edit-3" class="w-4 h-4 text-emerald-400"></i><span>تعديل القطعة: ${prod.name}</span>`
        : `<i data-lucide="plus" class="w-4 h-4 text-emerald-400"></i><span>إضافة قطعة جديدة للكتالوج</span>`;
    }

    // Populate category dropdown
    const activeCats = (categories && categories.length > 0)
      ? categories
      : [
          { id: 'hoodies', name: 'Hoodies // هوديز فاخر', slug: 'hoodies' },
          { id: 't-shirts', name: 'T-Shirts // تيشيرتات أوفر سايز', slug: 't-shirts' },
          { id: 'pants', name: 'Pants // بناطيل كارجو وسويت بانتس', slug: 'pants' },
          { id: 'jackets', name: 'Jackets // جواكت فاخرة', slug: 'jackets' },
          { id: 'caps', name: 'Caps & Accessories // كابات وإكسسوارات', slug: 'caps' }
        ];
    const catSelect = document.getElementById('pm_category');
    if (catSelect) {
      catSelect.innerHTML = activeCats.map(c => `<option value="${c.slug || c.id}">${c.name}</option>`).join('');
    }

    if (prod) {
      setVal('pm_id', prod.id);
      setVal('pm_name', prod.name);
      setVal('pm_slug', prod.slug || prod.id);
      setVal('pm_price', prod.price);
      if (catSelect) catSelect.value = prod.category || (activeCats[0] && (activeCats[0].slug || activeCats[0].id));
      setVal('pm_image', prod.image);
      setVal('pm_description', prod.description);

      // Display scope
      const showOnHomepageSelect = document.getElementById('pm_show_on_homepage');
      if (showOnHomepageSelect) {
        showOnHomepageSelect.value = (prod.show_on_homepage === 0 || prod.show_on_homepage === false) ? '0' : '1';
      }

      // Reset pending images for new color
      pendingNewColorImages = [];
      renderPendingNewColorImages();

      // Sizes checkboxes
      const sizes = Array.isArray(prod.sizes) ? prod.sizes : (typeof prod.sizes === 'string' ? prod.sizes.split(',') : []);
      document.querySelectorAll('input[name="pm_sizes"]').forEach(cb => {
        cb.checked = sizes.includes(cb.value);
        updateSizeCheckboxStyle(cb);
      });

      // Colors
      const rawColors = Array.isArray(prod.colors) ? prod.colors : [];
      let matchedMain = false;
      modalColorsList = rawColors.map(c => {
        const name = typeof c === 'object' ? (c.name || 'Standard') : c;
        const hex = typeof c === 'object' ? (c.hex || '#111111') : '#111111';
        let images = [];
        if (typeof c === 'object' && Array.isArray(c.images) && c.images.length > 0) {
          images = c.images.filter(Boolean);
        } else if (typeof c === 'object' && c.image) {
          images = [c.image];
        } else if (prod.image) {
          images = [prod.image];
        } else {
          images = ['assets/sokhm-card-1.jpg'];
        }
        const image = images[0] || 'assets/sokhm-card-1.jpg';
        const isMain = (!matchedMain && (image === prod.image || (typeof c === 'object' && c.isMain)));
        if (isMain) matchedMain = true;
        return { name, hex, image, images, isMain };
      });

      if (modalColorsList.length === 0) {
        modalColorsList = [{ name: 'اللون الرئيسي', hex: '#111111', image: prod.image || 'assets/sokhm-card-1.jpg', images: [prod.image || 'assets/sokhm-card-1.jpg'], isMain: true }];
        matchedMain = true;
      } else if (!matchedMain) {
        modalColorsList[0].isMain = true;
      }
      renderModalColors();

    } else {
      if (form) form.reset();
      setVal('pm_id', '');
      setVal('pm_name', '');
      setVal('pm_slug', 'sokhm-garment-' + Math.floor(100 + Math.random() * 900));
      setVal('pm_price', '1850');
      setVal('pm_image', 'assets/sokhm-card-1.jpg');
      setVal('pm_description', 'تصميم فاخر من قطن مصري 500 GSM عالي الكثافة مع قصة معمارية عصرية.');
      if (catSelect && activeCats.length > 0) catSelect.value = activeCats[0].slug || activeCats[0].id;
      
      const showOnHomepageSelect = document.getElementById('pm_show_on_homepage');
      if (showOnHomepageSelect) showOnHomepageSelect.value = '1';

      pendingNewColorImages = [];
      renderPendingNewColorImages();

      modalColorsList = [
        { name: 'أسود فحمي / Onyx Black', hex: '#0B0B0B', image: 'assets/sokhm-card-1.jpg', images: ['assets/sokhm-card-1.jpg'], isMain: true },
        { name: 'بيج رملي / Sand Cream', hex: '#D6CDBF', image: 'assets/sokhm-card-2.jpg', images: ['assets/sokhm-card-2.jpg'], isMain: false }
      ];
      renderModalColors();

      document.querySelectorAll('input[name="pm_sizes"]').forEach(cb => {
        cb.checked = ['M', 'L', 'XL'].includes(cb.value);
        updateSizeCheckboxStyle(cb);
      });
    }

    setupLucide();
    productModal.showModal();
  }

  function updateSizeCheckboxStyle(cb) {
    const parent = cb.closest('label');
    if (!parent) return;
    if (cb.checked) {
      parent.className = 'size-checkbox-label px-3 py-1.5 rounded-lg border border-white bg-white text-black font-mono font-bold cursor-pointer transition-all';
    } else {
      parent.className = 'size-checkbox-label px-3 py-1.5 rounded-lg border border-[#222] bg-[#080808] text-neutral-400 font-mono font-bold cursor-pointer hover:border-white transition-all';
    }
  }

  function renderPendingNewColorImages() {
    const box = document.getElementById('newColorPendingImagesBox');
    const list = document.getElementById('newColorPendingImagesList');
    const countEl = document.getElementById('newColorPendingCount');
    if (!box || !list || !countEl) return;

    if (pendingNewColorImages.length === 0) {
      box.classList.add('hidden');
      list.innerHTML = '';
      countEl.textContent = '0';
      return;
    }

    box.classList.remove('hidden');
    countEl.textContent = pendingNewColorImages.length;
    list.innerHTML = pendingNewColorImages.map((img, idx) => {
      const src = img.startsWith('http') || img.startsWith('data:') ? img : '../' + img.replace(/^\.\.\//, '');
      return `
        <div class="relative w-10 h-12 rounded-lg overflow-hidden border border-[#333] bg-black flex-shrink-0">
          <img src="${src}" class="w-full h-full object-cover">
          <button type="button" class="remove-pending-color-img absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[8px] cursor-pointer" data-idx="${idx}">✕</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.remove-pending-color-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        pendingNewColorImages.splice(idx, 1);
        renderPendingNewColorImages();
      });
    });
  }

  function renderModalColors() {
    const list = document.getElementById('modalColorsBadgesList');
    if (!list) return;

    const imgInput = document.getElementById('pm_image');
    const previewImg = document.getElementById('pm_image_preview');
    const mainColorBadge = document.getElementById('pm_main_color_name_badge');
    const mainColorIndicator = document.getElementById('pm_main_color_indicator');

    if (modalColorsList.length === 0) {
      if (imgInput) imgInput.value = '';
      if (previewImg) previewImg.src = '../assets/sokhm-card-1.jpg';
      if (mainColorBadge) mainColorBadge.textContent = 'لم يتم تحديد لون بعد';
      if (mainColorIndicator) mainColorIndicator.textContent = '(لا توجد ألوان مضافة)';

      list.innerHTML = `
        <div class="w-full py-4 px-3 text-center border border-dashed border-[#222] rounded-xl text-neutral-500 text-xs">
          لم تقم بإضافة ألوان بعد. اختر اسم اللون وكوده وصوره واضغط <strong class="text-white">+ إضافة اللون</strong>.
        </div>
      `;
      setupLucide();
      return;
    }

    // Ensure exactly one color is marked isMain
    const hasMain = modalColorsList.some(c => c.isMain);
    if (!hasMain) {
      modalColorsList[0].isMain = true;
    } else {
      let foundFirst = false;
      modalColorsList.forEach(c => {
        if (c.isMain) {
          if (!foundFirst) foundFirst = true;
          else c.isMain = false;
        }
      });
    }

    const mainColor = modalColorsList.find(c => c.isMain) || modalColorsList[0];
    const mainImgUrl = (mainColor && mainColor.image) ? mainColor.image : 'assets/sokhm-card-1.jpg';

    if (imgInput) imgInput.value = mainImgUrl;
    if (previewImg) {
      previewImg.src = mainImgUrl.startsWith('http') || mainImgUrl.startsWith('data:')
        ? mainImgUrl
        : '../' + mainImgUrl.replace(/^\.\.\//, '');
    }
    if (mainColorBadge) mainColorBadge.textContent = mainColor ? `اللون: ${mainColor.name}` : '';
    if (mainColorIndicator) mainColorIndicator.textContent = mainColor ? `(اللون المعتمد: ${mainColor.name})` : '';

    list.innerHTML = modalColorsList.map((c, idx) => {
      const hex = typeof c === 'object' ? (c.hex || '#111') : '#111';
      const name = typeof c === 'object' ? (c.name || 'Color') : c;
      const images = (typeof c === 'object' && Array.isArray(c.images) && c.images.length > 0)
        ? c.images
        : (c.image ? [c.image] : ['assets/sokhm-card-1.jpg']);
      const isMain = Boolean(c.isMain);

      return `
        <div class="p-3 rounded-xl ${isMain ? 'bg-[#141414] border-amber-500/60 ring-1 ring-amber-500/20' : 'bg-[#101010] border-[#1E1E1E]'} border text-xs text-white space-y-2.5 transition-all shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full border border-white/20 shadow-inner flex-shrink-0" style="background-color: ${hex}"></span>
              <span class="font-bold text-xs">${name}</span>
              <span class="text-[10px] text-neutral-400 font-mono">(${images.length} ${images.length === 1 ? 'صورة' : 'صور'})</span>
            </div>
            
            <div class="flex items-center gap-2">
              ${isMain ? `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  <i data-lucide="star" class="w-2.5 h-2.5 fill-amber-300"></i>
                  صورة الواجهة
                </span>
              ` : `
                <button type="button" class="set-main-color-btn text-[10px] text-neutral-400 hover:text-white bg-[#1A1A1A] hover:bg-[#252525] px-2.5 py-1 rounded-full border border-[#2D2D2D] hover:border-amber-500/40 transition-colors cursor-pointer flex items-center gap-1" data-idx="${idx}" title="تعيين أول صورة لهذا اللون كصورة رئيسية للواجهة">
                  <i data-lucide="star" class="w-2.5 h-2.5"></i>
                  <span>تعيين كرئيسية</span>
                </button>
              `}
              <button type="button" class="remove-modal-color-btn text-neutral-500 hover:text-red-400 p-1 cursor-pointer transition-colors" data-idx="${idx}" title="حذف هذا اللون بالكامل">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- Color Images Thumbnails -->
          <div class="flex items-center gap-2 flex-wrap pt-0.5">
            ${images.map((img, imgIdx) => {
              const src = img.startsWith('http') || img.startsWith('data:') ? img : '../' + img.replace(/^\.\.\//, '');
              return `
                <div class="relative group w-12 h-14 rounded-lg overflow-hidden border ${imgIdx === 0 ? 'border-amber-500/50' : 'border-[#2A2A2A]'} bg-black flex-shrink-0 shadow-sm" title="${imgIdx === 0 ? 'الصورة الأساسية للون' : `صورة ${imgIdx + 1}`}">
                  <img src="${src}" class="w-full h-full object-cover" onerror="this.src='../assets/sokhm-card-1.jpg'">
                  ${imgIdx === 0 ? `
                    <span class="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-amber-300 text-center font-bold py-0.5">أساسية</span>
                  ` : ''}
                  ${images.length > 1 ? `
                    <button type="button" class="delete-color-img-btn absolute top-0.5 right-0.5 w-4 h-4 bg-black/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] cursor-pointer transition-colors" data-color-idx="${idx}" data-img-idx="${imgIdx}" title="حذف هذه الصورة من هذا اللون">
                      ✕
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}

            <!-- Add more images directly to this color -->
            <label class="w-12 h-14 rounded-lg border border-dashed border-[#333] hover:border-white hover:bg-[#1A1A1A] flex flex-col items-center justify-center text-neutral-400 hover:text-white cursor-pointer transition-colors flex-shrink-0" title="رفع صور إضافية لهذا اللون">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span class="text-[9px] mt-0.5 font-bold">+صورة</span>
              <input type="file" multiple accept="image/*" class="hidden color-extra-file-input" data-color-idx="${idx}">
            </label>
          </div>
        </div>
      `;
    }).join('');

    setupLucide();

    // Attach Set Main Color Events
    list.querySelectorAll('.set-main-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        modalColorsList.forEach((col, i) => {
          col.isMain = (i === idx);
        });
        renderModalColors();
        showToast(`تم تعيين صورة "${modalColorsList[idx].name}" كصورة رئيسية للمنتج ★`);
      });
    });

    // Attach Remove Entire Color Events
    list.querySelectorAll('.remove-modal-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const wasMain = modalColorsList[idx] && modalColorsList[idx].isMain;
        modalColorsList.splice(idx, 1);
        if (wasMain && modalColorsList.length > 0) {
          modalColorsList[0].isMain = true;
        }
        renderModalColors();
      });
    });

    // Attach Delete Specific Image from Color
    list.querySelectorAll('.delete-color-img-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const colorIdx = parseInt(btn.getAttribute('data-color-idx'), 10);
        const imgIdx = parseInt(btn.getAttribute('data-img-idx'), 10);
        if (modalColorsList[colorIdx] && Array.isArray(modalColorsList[colorIdx].images)) {
          modalColorsList[colorIdx].images.splice(imgIdx, 1);
          if (modalColorsList[colorIdx].images.length > 0) {
            modalColorsList[colorIdx].image = modalColorsList[colorIdx].images[0];
          }
          renderModalColors();
        }
      });
    });

    // Attach Upload Extra Images to Color
    list.querySelectorAll('.color-extra-file-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const colorIdx = parseInt(input.getAttribute('data-color-idx'), 10);
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !modalColorsList[colorIdx]) return;

        showToast(`جاري رفع ${files.length} صور للون ${modalColorsList[colorIdx].name}...`);
        for (const file of files) {
          try {
            const uploadedUrl = await uploadImageFile(file);
            if (uploadedUrl) {
              if (!Array.isArray(modalColorsList[colorIdx].images)) {
                modalColorsList[colorIdx].images = [modalColorsList[colorIdx].image || uploadedUrl];
              }
              modalColorsList[colorIdx].images.push(uploadedUrl);
              modalColorsList[colorIdx].image = modalColorsList[colorIdx].images[0];
            }
          } catch (err) {
            console.error('Error uploading extra image:', err);
          }
        }
        renderModalColors();
        showToast(`تمت إضافة الصور الجديدة للون بنجاح`);
      });
    });
  }

  // Helper to convert File to optimized Base64 and upload to /api/upload-image
  async function uploadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target.result;
        const img = new Image();
        img.onload = async () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let optimizedDataUrl = rawDataUrl;
          try {
            optimizedDataUrl = canvas.toDataURL('image/webp', 0.88);
          } catch (canvasErr) {
            optimizedDataUrl = rawDataUrl;
          }

          try {
            const res = await fetch('/api/upload-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token,
                'x-admin-token': token
              },
              body: JSON.stringify({
                image: optimizedDataUrl,
                dataUrl: optimizedDataUrl,
                filename: file.name
              })
            });

            if (res.ok) {
              const data = await res.json();
              if (data && data.url) {
                return resolve(data.url);
              }
            }
          } catch (netErr) {
            console.warn('Server upload-image route offline, using dataUrl fallback:', netErr.message);
          }

          resolve(optimizedDataUrl);
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setupModalHandlers() {
    const closeBtn = document.getElementById('closeProductModalBtn');
    const cancelBtn = document.getElementById('cancelProductModalBtn');
    if (closeBtn && productModal) closeBtn.addEventListener('click', () => productModal.close());
    if (cancelBtn && productModal) cancelBtn.addEventListener('click', () => productModal.close());

    if (productModal) {
      productModal.addEventListener('click', (e) => {
        const rect = productModal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
          productModal.close();
        }
      });
    }

    // Size checkbox click styling
    document.querySelectorAll('input[name="pm_sizes"]').forEach(cb => {
      cb.addEventListener('change', () => updateSizeCheckboxStyle(cb));
    });

    // Color hex input listener
    const colorHexIn = document.getElementById('newColorHexInput');
    const colorHexValText = document.getElementById('newColorHexValueText');
    if (colorHexIn && colorHexValText) {
      colorHexIn.addEventListener('input', () => {
        colorHexValText.textContent = colorHexIn.value.toUpperCase();
      });
    }

    // Color image file input listener
    const colorImgFileInput = document.getElementById('newColorImgFileInput');
    const colorImgIn = document.getElementById('newColorImgInput');
    const colorPreviewThumb = document.getElementById('newColorPreviewThumb');

    if (colorImgFileInput) {
      colorImgFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        try {
          showToast(`جاري معالجة ورفع ${files.length} صور للون...`);
          for (const file of files) {
            const uploadedUrl = await uploadImageFile(file);
            if (uploadedUrl) {
              pendingNewColorImages.push(uploadedUrl);
              if (colorImgIn) colorImgIn.value = uploadedUrl;
              if (colorPreviewThumb) {
                colorPreviewThumb.src = uploadedUrl.startsWith('http') || uploadedUrl.startsWith('data:')
                  ? uploadedUrl
                  : '../' + uploadedUrl.replace(/^\.\.\//, '');
              }
            }
          }
          renderPendingNewColorImages();
          showToast(`تم رفع وتجهيز ${files.length} صور للون بنجاح!`);
        } catch (err) {
          alert('تعذر قراءة ملفات الصور');
        }
      });
    }

    const clearPendingBtn = document.getElementById('clearPendingColorImagesBtn');
    if (clearPendingBtn) {
      clearPendingBtn.addEventListener('click', () => {
        pendingNewColorImages = [];
        renderPendingNewColorImages();
      });
    }

    if (colorImgIn && colorPreviewThumb) {
      colorImgIn.addEventListener('input', () => {
        const val = colorImgIn.value.trim();
        if (val) {
          colorPreviewThumb.src = val.startsWith('http') || val.startsWith('data:')
            ? val
            : '../' + val.replace(/^\.\.\//, '');
        }
      });
    }

    // Add color button
    const addColorBtn = document.getElementById('addColorToModalBtn');
    const colorNameIn = document.getElementById('newColorNameInput');

    if (addColorBtn && colorNameIn && colorHexIn) {
      addColorBtn.addEventListener('click', () => {
        const name = colorNameIn.value.trim();
        const hex = colorHexIn.value || '#111111';
        const singleImg = (colorImgIn ? colorImgIn.value.trim() : '');

        if (!name) {
          alert('يرجى كتابة اسم اللون أولاً (مثال: أسود فحمي / Onyx Black)');
          colorNameIn.focus();
          return;
        }

        let colorImages = [];
        if (pendingNewColorImages.length > 0) {
          colorImages = [...pendingNewColorImages];
        } else if (singleImg) {
          colorImages = [singleImg];
        } else {
          colorImages = ['assets/sokhm-card-1.jpg'];
        }

        const isMain = modalColorsList.length === 0;
        const primaryImg = colorImages[0];
        modalColorsList.push({ name, hex, image: primaryImg, images: colorImages, isMain });
        renderModalColors();

        colorNameIn.value = '';
        if (colorImgIn) colorImgIn.value = '';
        if (colorPreviewThumb) colorPreviewThumb.src = '../assets/sokhm-card-1.jpg';
        pendingNewColorImages = [];
        renderPendingNewColorImages();
        showToast(`تمت إضافة اللون "${name}" ومعه ${colorImages.length} صور بنجاح`);
      });
    }

    // Product Form Submit (Add or Update)
    const form = document.getElementById('productEditForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formId = getVal('pm_id');
        const formSlug = getVal('pm_slug');
        const id = editingProductId || formId || formSlug || ('sokhm-' + Date.now());
        const slug = formSlug || id;
        const name = getVal('pm_name') || 'قطعة جديدة';
        const rawPrice = getVal('pm_price').toString().replace(/[^0-9.]/g, '');
        const price = parseFloat(rawPrice) || 0;
        const category = getVal('pm_category') || 'hoodies';

        const checkedSizes = [];
        document.querySelectorAll('input[name="pm_sizes"]:checked').forEach(cb => checkedSizes.push(cb.value));

        if (checkedSizes.length === 0) {
          alert('يرجى اختيار مقاس واحد على الأقل متاح للطلب.');
          return;
        }

        if (modalColorsList.length === 0) {
          alert('يرجى إضافة لون واحد على الأقل مع صورته لتحديد الصورة الرئيسية للمنتج.');
          if (colorNameIn) colorNameIn.focus();
          return;
        }

        const mainColor = modalColorsList.find(c => c.isMain) || modalColorsList[0];
        const image = (mainColor && mainColor.image) ? mainColor.image : (getVal('pm_image') || 'assets/sokhm-card-1.jpg');
        const description = getVal('pm_description') || '';
        const show_on_homepage = (document.getElementById('pm_show_on_homepage')?.value === '0') ? 0 : 1;

        // Collect all images from all colors
        const allColorImages = [];
        modalColorsList.forEach(c => {
          if (Array.isArray(c.images)) {
            c.images.forEach(img => {
              if (img && !allColorImages.includes(img)) allColorImages.push(img);
            });
          } else if (c.image && !allColorImages.includes(c.image)) {
            allColorImages.push(c.image);
          }
        });
        if (image && !allColorImages.includes(image)) {
          allColorImages.unshift(image);
        }

        const payload = {
          id,
          name,
          slug,
          price,
          category,
          image,
          images: allColorImages.length > 0 ? allColorImages : [image],
          description,
          sizes: checkedSizes,
          colors: modalColorsList.map(c => ({
            name: c.name,
            hex: c.hex,
            image: (c.images && c.images.length > 0) ? c.images[0] : c.image,
            images: (c.images && c.images.length > 0) ? c.images : [c.image || image],
            isMain: Boolean(c.isMain)
          })),
          show_on_homepage,
          stock_status: 'in_stock'
        };

        const saveBtn = document.getElementById('saveProductModalSubmitBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<span class="inline-block animate-spin mr-2">✦</span> جاري الحفظ في قاعدة البيانات...';
        }

        try {
          const isEdit = Boolean(editingProductId);
          const url = isEdit ? `/api/products/${encodeURIComponent(editingProductId)}` : '/api/products';
          const method = isEdit ? 'PUT' : 'POST';

          const res = await fetch(url, {
            method,
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'x-admin-token': token
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || 'فشل حفظ المنتج في السيرفر');
          }

          let savedProd = payload;
          try {
            const resData = await res.json();
            if (resData && resData.product) savedProd = resData.product;
            else if (resData && resData.id) savedProd = resData;
          } catch (e) {}

          if (!savedProd.image && savedProd.images && savedProd.images[0]) {
            savedProd.image = savedProd.images[0];
          }

          if (isEdit) {
            const idx = products.findIndex(p => p.id === editingProductId || p.slug === editingProductId);
            if (idx !== -1) {
              products[idx] = { ...products[idx], ...savedProd };
            } else {
              products.unshift(savedProd);
            }
          } else {
            const existingIdx = products.findIndex(p => p.id === savedProd.id || p.slug === savedProd.slug);
            if (existingIdx !== -1) {
              products[existingIdx] = savedProd;
            } else {
              products.unshift(savedProd);
            }
          }

          renderProductsTable();
          loadDbStats();
          productModal.close();
          showToast(isEdit ? 'تم تحديث بيانات القطعة بنجاح' : 'تمت إضافة القطعة بنجاح إلى الكتالوج');

        } catch (err) {
          // If offline / static fallback
          if (err.message && (err.message.includes('fetch') || err.message.includes('Network') || err.message.includes('Failed'))) {
            if (editingProductId) {
              const idx = products.findIndex(p => p.id === editingProductId || p.slug === editingProductId);
              if (idx !== -1) products[idx] = payload;
            } else {
              products.unshift(payload);
            }
            renderProductsTable();
            productModal.close();
            showToast('تم حفظ المنتج محلياً');
          } else {
            alert('تعذر حفظ القطعة: ' + err.message);
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>حفظ القطعة في قاعدة البيانات</span>';
            setupLucide();
          }
        }
      });
    }
  }

  // ================= 11. الأقسام والتصنيفات (CATEGORIES) =================
  function populateCategoryDropdowns() {
    categories = (Array.isArray(siteContent?.categories) && siteContent.categories.length > 0)
      ? siteContent.categories 
      : (Array.isArray(categories) && categories.length > 0 ? categories : []);

    if (categories.length === 0) {
      categories = [
        { id: 'hoodies', name: 'Hoodies // هوديز فاخر', slug: 'hoodies' },
        { id: 't-shirts', name: 'T-Shirts // تيشيرتات أوفر سايز', slug: 't-shirts' },
        { id: 'pants', name: 'Pants // بناطيل كارجو وسويت بانتس', slug: 'pants' },
        { id: 'jackets', name: 'Jackets // جواكت فاخرة', slug: 'jackets' },
        { id: 'caps', name: 'Caps & Accessories // كابات وإكسسوارات', slug: 'caps' }
      ];
    }

    const filter = document.getElementById('productCategoryFilter');
    if (filter) {
      filter.innerHTML = '<option value="all">جميع التصنيفات</option>' + 
        categories.map(c => `<option value="${c.slug || c.id}">${c.name}</option>`).join('');
    }
    const pmCat = document.getElementById('pm_category');
    if (pmCat && categories.length > 0) {
      const prevVal = pmCat.value;
      pmCat.innerHTML = categories.map(c => `<option value="${c.slug || c.id}">${c.name}</option>`).join('');
      if (prevVal) pmCat.value = prevVal;
    }
  }

  function renderCategoriesList() {
    const container = document.getElementById('categoriesListContainer');
    if (!container) return;

    const safeCats = Array.isArray(categories) ? categories : [];
    const safeProds = Array.isArray(products) ? products : [];

    if (safeCats.length === 0) {
      container.innerHTML = '<div class="text-center py-6 text-neutral-500 text-xs">لا توجد تصنيفات حالياً.</div>';
      return;
    }

    container.innerHTML = safeCats.map((cat, idx) => {
      const prodCount = safeProds.filter(p => p && p.category === (cat.slug || cat.id)).length;
      return `
        <div class="py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-lg bg-[#141414] border border-[#222] flex items-center justify-center font-mono text-[10px] text-neutral-400">${idx + 1}</span>
            <div>
              <h5 class="font-bold text-white text-xs">${cat.name}</h5>
              <span class="text-[10px] font-mono text-neutral-500">slug: ${cat.slug || cat.id} • ${prodCount} قطع ملابس</span>
            </div>
          </div>
          <button class="delete-cat-btn text-neutral-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#141414] transition-colors cursor-pointer" data-id="${cat.id || cat.slug}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');

    setupLucide();

    container.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm(`هل تود حذف التصنيف ${id}؟`)) return;
        try {
          const res = await fetch(`/api/categories/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (res.ok) {
            categories = categories.filter(c => (c.id || c.slug) !== id);
            siteContent.categories = categories;
            renderCategoriesList();
            populateCategoryDropdowns();
            renderProductsTable();
            loadDbStats();
            showToast('تم حذف التصنيف بنجاح');
          }
        } catch (err) {
          alert('تعذر حذف التصنيف');
        }
      });
    });
  }

  function setupCategoriesHandlers() {
    const form = document.getElementById('addCategoryForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newCategoryName').value.trim();
      const slug = document.getElementById('newCategorySlug').value.trim().toLowerCase().replace(/\s+/g, '-');

      if (!name || !slug) return;

      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ id: slug, name, slug })
        });

        if (!res.ok) throw new Error('فشل إضافة التصنيف');

        categories.push({ id: slug, name, slug });
        siteContent.categories = categories;
        form.reset();
        renderCategoriesList();
        populateCategoryDropdowns();
        loadDbStats();
        showToast('تمت إضافة التصنيف الجديد بنجاح');
      } catch (err) {
        alert('تعذر إضافة التصنيف، قد يكون المعرف مستخدماً مسبقاً.');
      }
    });
  }

  // ================= 12. إدارة أكواد الخصم والكوبونات (DISCOUNTS) =================
  async function loadDiscounts() {
    try {
      const res = await fetch('/api/discounts', {
        headers: { 
          'Authorization': 'Bearer ' + token,
          'x-admin-token': token
        }
      });
      if (res.ok) {
        const data = await res.json();
        discounts = Array.isArray(data) ? data : (Array.isArray(data?.discounts) ? data.discounts : []);
      } else {
        console.warn('Discounts API returned status:', res.status);
        if (!Array.isArray(discounts)) discounts = [];
      }
    } catch (e) {
      console.warn('تعذر جلب أكواد الخصم:', e);
      if (!Array.isArray(discounts)) discounts = [];
    }
    if (!Array.isArray(discounts)) discounts = [];
    try { renderDiscounts(); } catch (err) { console.warn('Render discounts error:', err); }
  }

  function renderDiscounts() {
    const tbody = document.getElementById('discountsTableBody');
    const badge = document.getElementById('discountsCountBadge');
    const safeDiscounts = Array.isArray(discounts) ? discounts : [];
    if (badge) badge.textContent = `${safeDiscounts.length} كود`;
    if (!tbody) return;

    if (safeDiscounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-neutral-500 text-xs">
            لا توجد أكواد خصم حالياً. أنشئ كود خصم جديد من النموذج الجانبي.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = safeDiscounts.map(d => {
      const isPercent = d.discount_type === 'percentage';
      const valStr = isPercent ? `${d.discount_value}%` : `${d.discount_value.toLocaleString('en-US')} ج.م`;
      const minOrder = d.min_order_amount > 0 ? `${d.min_order_amount.toLocaleString('en-US')} ج.م` : 'بدون حد أدنى';
      const isActive = Boolean(d.is_active);

      return `
        <tr class="hover:bg-white/[0.02] transition-colors">
          <td class="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-lg bg-[#141414] border border-[#262626] text-amber-300 font-extrabold tracking-wider">
              ${d.code}
            </span>
          </td>
          <td class="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isPercent ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'} text-[11px]">
              ${valStr} (${isPercent ? 'نسبة' : 'مبلغ ثابت'})
            </span>
          </td>
          <td class="py-3 px-3 font-mono text-neutral-300 text-xs whitespace-nowrap">
            ${minOrder}
          </td>
          <td class="py-3 px-3 text-center font-mono font-bold text-white whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full bg-[#161616] border border-[#222] text-[11px]">
              ${d.usage_count || 0} مرات
            </span>
          </td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            <button type="button" class="toggle-discount-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${isActive ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60' : 'bg-neutral-900 text-neutral-500 border border-neutral-700 hover:bg-neutral-800'}" data-id="${d.id}" title="${isActive ? 'الكود مفعّل - اضغط لتعطيله' : 'الكود معطل - اضغط لتفعيله'}">
              <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-neutral-500'}"></span>
              <span>${isActive ? 'مفعل' : 'معطل'}</span>
            </button>
          </td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            <button type="button" class="delete-discount-btn p-1.5 rounded-lg bg-[#141414] hover:bg-red-950/60 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer border border-[#222]" data-id="${d.id}" data-code="${d.code}" title="حذف كود الخصم">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    setupLucide();

    // Toggle discount active state
    tbody.querySelectorAll('.toggle-discount-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(`/api/discounts/${id}/toggle`, {
            method: 'POST',
            headers: { 
              'Authorization': 'Bearer ' + token,
              'x-admin-token': token
            }
          });
          if (res.ok) {
            await loadDiscounts();
            showToast('تم تحديث حالة كود الخصم');
          } else {
            alert('تعذر تحديث حالة الكود');
          }
        } catch (e) {
          alert('خطأ في الاتصال بالسيرفر');
        }
      });
    });

    // Delete discount
    tbody.querySelectorAll('.delete-discount-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const code = btn.getAttribute('data-code');
        if (!confirm(`هل أنت متأكد من حذف كود الخصم "${code}"؟`)) return;

        try {
          const res = await fetch(`/api/discounts/${id}`, {
            method: 'DELETE',
            headers: { 
              'Authorization': 'Bearer ' + token,
              'x-admin-token': token
            }
          });
          if (res.ok) {
            await loadDiscounts();
            showToast(`تم حذف كود الخصم "${code}" بنجاح`);
          } else {
            alert('تعذر حذف كود الخصم');
          }
        } catch (e) {
          alert('خطأ في الاتصال بالسيرفر');
        }
      });
    });
  }

  function setupDiscountsHandlers() {
    const form = document.getElementById('createDiscountForm');
    const typeSelect = document.getElementById('newDiscountType');
    const unitLabel = document.getElementById('newDiscountUnitLabel');
    const refreshBtn = document.getElementById('refreshDiscountsBtn');

    if (typeSelect && unitLabel) {
      typeSelect.addEventListener('change', () => {
        unitLabel.textContent = typeSelect.value === 'percentage' ? '%' : 'ج.م';
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('animate-spin');
        await loadDiscounts();
        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);
        showToast('تم تحديث قائمة أكواد الخصم');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = (document.getElementById('newDiscountCode')?.value || '').trim().toUpperCase();
        const discount_type = document.getElementById('newDiscountType')?.value || 'percentage';
        const discount_value = parseFloat(document.getElementById('newDiscountValue')?.value) || 0;
        const min_order_amount = parseFloat(document.getElementById('newDiscountMinOrder')?.value) || 0;

        if (!code) {
          alert('يرجى كتابة كود الخصم');
          return;
        }
        if (discount_value <= 0) {
          alert('يرجى تحديد قيمة خصم صالحة');
          return;
        }
        if (discount_type === 'percentage' && discount_value > 100) {
          alert('نسبة الخصم لا يمكن أن تتجاوز 100%');
          return;
        }

        const submitBtn = document.getElementById('createDiscountSubmitBtn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">✦</span> جاري الإنشاء...';
        }

        try {
          const res = await fetch('/api/discounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'x-admin-token': token
            },
            body: JSON.stringify({
              code,
              discount_type,
              discount_value,
              min_order_amount
            })
          });

          if (res.ok) {
            form.reset();
            if (unitLabel) unitLabel.textContent = '%';
            await loadDiscounts();
            showToast(`تم إنشاء وتفعيل كود الخصم "${code}" بنجاح ✦`);
          } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'تعذر إنشاء كود الخصم');
          }
        } catch (err) {
          console.error('Error creating discount:', err);
          alert('خطأ في الاتصال بالسيرفر أثناء إنشاء الكود');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="plus-circle" class="w-4 h-4"></i><span>تفعيل وإنشاء الكود</span>';
            setupLucide();
          }
        }
      });
    }
  }

  // ================= 13. إحصائيات قاعدة البيانات (DATABASE STATS) =================
  async function loadDbStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const stats = await res.json();
        if (stats && typeof stats === 'object') {
          const safeProds = Array.isArray(products) ? products : [];
          const safeOrders = Array.isArray(orders) ? orders : [];
          const safeCats = Array.isArray(categories) ? categories : [];

          const pTotal = stats.productsCount ?? stats.counts?.products ?? safeProds.length;
          const oTotal = stats.ordersCount ?? stats.counts?.orders ?? safeOrders.length;
          const cTotal = stats.categoriesCount ?? stats.counts?.categories ?? safeCats.length;
          const sTotal = stats.sectionsCount ?? 4;

          const pCount = document.getElementById('statDbProductsCount');
          const oCount = document.getElementById('statDbOrdersCount');
          const cCount = document.getElementById('statDbCategoriesCount');
          const sCount = document.getElementById('statDbSectionsCount');

          if (pCount) pCount.textContent = pTotal;
          if (oCount) oCount.textContent = oTotal;
          if (cCount) cCount.textContent = cTotal;
          if (sCount) sCount.textContent = sTotal;

          const engineEl = document.getElementById('statDbEngineText');
          const pathEl = document.getElementById('statDbPathText');
          if (engineEl && stats.engine) engineEl.textContent = stats.engine;
          if (pathEl) pathEl.textContent = stats.dbPath || (stats.engine?.includes('Turso') ? 'Turso Cloud Serverless (libsql)' : 'database/sokhm.db');

          const dbBadgeText = document.getElementById('dbBadgeText');
          const dbHeaderBadge = document.getElementById('dbHeaderBadge');
          if (dbBadgeText && stats.engine) {
            dbBadgeText.textContent = stats.engine + ' • متصلة';
            if (stats.engine.includes('Fallback')) {
              dbBadgeText.textContent = '⚠️ ذاكرة محلية مؤقتة (Fallback - Turso غير متصل)';
              if (dbHeaderBadge) {
                dbHeaderBadge.className = 'hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/60 text-[11px] font-bold text-amber-300';
              }
            } else {
              if (dbHeaderBadge) {
                dbHeaderBadge.className = 'hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-[11px] font-bold text-emerald-300';
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('تعذر جلب إحصائيات قاعدة البيانات:', e);
    }
  }

  // Start initialization
  init();
});
