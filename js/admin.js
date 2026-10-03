/**
 * SOKHM STORE - Admin Management Console Controller
 * Supports luxury garment specifications (lining, wearing, height),
 * real-time catalog analytics, and live store synchronization.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Metrics
  const metricTotalProducts = document.getElementById('metricTotalProducts');
  const metricTotalCategories = document.getElementById('metricTotalCategories');
  const metricCatalogValue = document.getElementById('metricCatalogValue');
  const metricAvgPrice = document.getElementById('metricAvgPrice');

  // Categories
  const addCategoryForm = document.getElementById('addCategoryForm');
  const catNameInput = document.getElementById('catNameInput');
  const catSlugInput = document.getElementById('catSlugInput');
  const adminCategoryList = document.getElementById('adminCategoryList');

  // Product Form
  const addProductForm = document.getElementById('addProductForm');
  const prodNameInput = document.getElementById('prodNameInput');
  const prodCategorySelect = document.getElementById('prodCategorySelect');
  const prodPriceInput = document.getElementById('prodPriceInput');
  const prodBadgeInput = document.getElementById('prodBadgeInput');
  const prodLiningInput = document.getElementById('prodLiningInput');
  const prodWearingInput = document.getElementById('prodWearingInput');
  const prodHeightInput = document.getElementById('prodHeightInput');
  const prodImageInput = document.getElementById('prodImageInput');
  const prodDescriptionInput = document.getElementById('prodDescriptionInput');
  const liveImgPreview = document.getElementById('liveImgPreview');
  const liveImgPlaceholderIcon = document.getElementById('liveImgPlaceholderIcon');
  const liveImgStatus = document.getElementById('liveImgStatus');
  const presetImgButtons = document.querySelectorAll('.preset-img-btn');

  // Inventory Table
  const inventoryTableBody = document.getElementById('inventoryTableBody');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const adminToastContainer = document.getElementById('adminToastContainer');

  let tableSearchFilter = '';

  /* -------------------------------------------------------------
     INIT
  ------------------------------------------------------------- */
  function init() {
    refreshMetrics();
    populateCategoryDropdown();
    renderCategoryList();
    renderInventoryTable();
    setupEventListeners();
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function setupEventListeners() {
    addCategoryForm?.addEventListener('submit', handleAddCategory);
    addProductForm?.addEventListener('submit', handleAddProduct);

    prodImageInput?.addEventListener('input', (e) => {
      updateLiveImagePreview(e.target.value.trim());
    });

    presetImgButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        prodImageInput.value = url;
        updateLiveImagePreview(url);
      });
    });

    adminSearchInput?.addEventListener('input', (e) => {
      tableSearchFilter = e.target.value.trim().toLowerCase();
      renderInventoryTable();
    });

    resetDefaultsBtn?.addEventListener('click', () => {
      if (confirm('Reset catalog to default SOKHM showcase collection? Any custom items will be restored.')) {
        window.sokhmStore.resetToDefaults();
        init();
        showToast('Catalog restored to default SOKHM collection', 'info');
      }
    });

    window.addEventListener('sokhm:store-updated', () => {
      refreshMetrics();
      populateCategoryDropdown();
      renderCategoryList();
      renderInventoryTable();
    });
  }

  /* -------------------------------------------------------------
     METRICS
  ------------------------------------------------------------- */
  function refreshMetrics() {
    const products = window.sokhmStore.getProducts();
    const categories = window.sokhmStore.getCategories();

    metricTotalProducts.textContent = products.length;
    metricTotalCategories.textContent = categories.length;

    const totalValue = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
    metricCatalogValue.textContent = window.sokhmStore.formatEGP(totalValue);

    const avgPrice = products.length > 0 ? Math.round(totalValue / products.length) : 0;
    metricAvgPrice.textContent = window.sokhmStore.formatEGP(avgPrice);
  }

  /* -------------------------------------------------------------
     CATEGORY MANAGEMENT
  ------------------------------------------------------------- */
  function populateCategoryDropdown() {
    const categories = window.sokhmStore.getCategories();
    prodCategorySelect.innerHTML = '';

    categories.forEach(cat => {
      if (cat.slug === 'all') return;
      const option = document.createElement('option');
      option.value = cat.slug;
      option.textContent = cat.name;
      prodCategorySelect.appendChild(option);
    });
  }

  function renderCategoryList() {
    const categories = window.sokhmStore.getCategories();
    const products = window.sokhmStore.getProducts();

    adminCategoryList.innerHTML = '';

    categories.forEach(cat => {
      const count = cat.slug === 'all' 
        ? products.length 
        : products.filter(p => p.category === cat.slug).length;

      const isProtected = cat.slug === 'all';

      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-xs font-mono';
      item.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-medium text-black">${escapeHtml(cat.name)}</span>
          <span class="text-[10px] text-neutral-400">(${escapeHtml(cat.slug)})</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">${count}</span>
        </div>
        ${!isProtected ? `
          <button type="button" data-cat-id="${cat.id}" class="delete-cat-btn text-neutral-400 hover:text-rose-600 p-1 transition-colors" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        ` : `
          <span class="text-[10px] uppercase text-neutral-400">Core</span>
        `}
      `;

      if (!isProtected) {
        item.querySelector('.delete-cat-btn').addEventListener('click', () => {
          if (confirm(`Delete category "${cat.name}"?`)) {
            window.sokhmStore.deleteCategory(cat.id);
            populateCategoryDropdown();
            renderCategoryList();
            renderInventoryTable();
            refreshMetrics();
            showToast(`Deleted category "${cat.name}"`);
          }
        });
      }

      adminCategoryList.appendChild(item);
    });

    refreshIcons();
  }

  function handleAddCategory(e) {
    e.preventDefault();
    const name = catNameInput.value.trim();
    const slug = catSlugInput.value.trim();

    if (!name) return;

    try {
      const newCat = window.sokhmStore.addCategory(name, slug);
      catNameInput.value = '';
      catSlugInput.value = '';
      populateCategoryDropdown();
      renderCategoryList();
      refreshMetrics();
      showToast(`Category "${newCat.name}" created`);
    } catch (err) {
      showToast(err.message, 'warning');
    }
  }

  /* -------------------------------------------------------------
     PRODUCT MANAGEMENT
  ------------------------------------------------------------- */
  function updateLiveImagePreview(url) {
    if (!url) {
      liveImgPreview.classList.add('hidden');
      liveImgPlaceholderIcon.classList.remove('hidden');
      liveImgStatus.textContent = 'No preview loaded';
      return;
    }

    liveImgStatus.textContent = 'Loading preview...';
    liveImgPreview.src = url;
    
    liveImgPreview.onload = () => {
      liveImgPreview.classList.remove('hidden');
      liveImgPlaceholderIcon.classList.add('hidden');
      liveImgStatus.textContent = 'Ready';
    };

    liveImgPreview.onerror = () => {
      liveImgPreview.classList.add('hidden');
      liveImgPlaceholderIcon.classList.remove('hidden');
      liveImgStatus.textContent = 'Invalid URL';
    };
  }

  function handleAddProduct(e) {
    e.preventDefault();

    const name = prodNameInput.value.trim();
    const category = prodCategorySelect.value;
    const price = Number(prodPriceInput.value);
    const badge = prodBadgeInput.value.trim() || 'NEW';
    const lining = prodLiningInput ? prodLiningInput.value.trim() : '100% Cotton Twill';
    const wearing = prodWearingInput ? prodWearingInput.value.trim() : 'Size Medium';
    const height = prodHeightInput ? prodHeightInput.value.trim() : "6'2\" / 188 cm";
    const image = prodImageInput.value.trim();
    const description = prodDescriptionInput.value.trim();

    const checkedSizes = [];
    document.querySelectorAll('#sizeCheckboxesContainer input[name="sizes"]:checked').forEach(cb => {
      checkedSizes.push(cb.value);
    });

    if (!name) {
      showToast('Please enter a garment name', 'warning');
      return;
    }

    if (isNaN(price) || price <= 0) {
      showToast('Please enter a valid price in EGP', 'warning');
      return;
    }

    if (checkedSizes.length === 0) {
      showToast('Select at least one available size', 'warning');
      return;
    }

    const newProduct = window.sokhmStore.addProduct({
      name,
      category,
      price,
      badge,
      lining,
      wearing,
      height,
      image,
      sizes: checkedSizes,
      description
    });

    addProductForm.reset();
    updateLiveImagePreview('');
    document.querySelectorAll('#sizeCheckboxesContainer input[name="sizes"]').forEach(cb => {
      cb.checked = ['S', 'M', 'L', 'XL'].includes(cb.value);
    });

    refreshMetrics();
    renderInventoryTable();
    showToast(`Published "${newProduct.name}" (${window.sokhmStore.formatEGP(newProduct.price)})!`);
  }

  /* -------------------------------------------------------------
     INVENTORY TABLE
  ------------------------------------------------------------- */
  function renderInventoryTable() {
    const products = window.sokhmStore.getProducts();
    const categories = window.sokhmStore.getCategories();

    let filtered = products;
    if (tableSearchFilter) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(tableSearchFilter) ||
        p.category.toLowerCase().includes(tableSearchFilter) ||
        String(p.price).includes(tableSearchFilter)
      );
    }

    if (filtered.length === 0) {
      inventoryTableBody.innerHTML = '';
      adminEmptyState.classList.remove('hidden');
      return;
    }

    adminEmptyState.classList.add('hidden');
    inventoryTableBody.innerHTML = '';

    filtered.forEach(product => {
      const catObj = categories.find(c => c.slug === product.category);
      const catName = catObj ? catObj.name : product.category;

      const sizesMarkup = (product.sizes || []).map(s => 
        `<span class="px-1 py-0.5 rounded bg-neutral-100 text-[10px] text-neutral-700 font-mono">${escapeHtml(s)}</span>`
      ).join(' ');

      const row = document.createElement('tr');
      row.className = 'hover:bg-neutral-50 transition-colors font-mono';
      row.innerHTML = `
        <td class="py-3 px-6">
          <div class="flex items-center gap-3">
            <img 
              src="${escapeHtml(product.image)}" 
              alt="${escapeHtml(product.name)}" 
              class="w-10 h-12 rounded object-cover bg-neutral-100 flex-shrink-0"
              onerror="this.src='https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=200&q=80'"
            >
            <div>
              <p class="font-title font-bold text-xs text-black uppercase">${escapeHtml(product.name)}</p>
              <p class="text-[10px] text-neutral-400">ID: ${product.id}</p>
            </div>
          </div>
        </td>

        <td class="py-3 px-4 text-neutral-700 text-xs">
          ${escapeHtml(catName)}
        </td>

        <td class="py-3 px-4 font-bold text-black text-xs font-mono">
          ${window.sokhmStore.formatEGP(product.price)}
        </td>

        <td class="py-3 px-4">
          <div class="flex flex-wrap gap-1">
            ${sizesMarkup || '<span class="text-neutral-400">None</span>'}
          </div>
        </td>

        <td class="py-3 px-6 text-right">
          <div class="flex items-center justify-end gap-2">
            <a 
              href="index.html#catalog" 
              class="p-1 text-neutral-500 hover:text-black transition-colors"
              title="View in store"
            >
              <i data-lucide="external-link" class="w-4 h-4"></i>
            </a>
            <button 
              type="button" 
              data-delete-id="${product.id}"
              class="delete-prod-btn p-1 text-neutral-400 hover:text-rose-600 transition-colors"
              title="Delete garment"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;

      row.querySelector('.delete-prod-btn').addEventListener('click', () => {
        if (confirm(`Remove "${product.name}" from catalog?`)) {
          window.sokhmStore.deleteProduct(product.id);
          refreshMetrics();
          renderCategoryList();
          renderInventoryTable();
          showToast(`Removed "${product.name}"`);
        }
      });

      inventoryTableBody.appendChild(row);
    });

    refreshIcons();
  }

  /* -------------------------------------------------------------
     TOAST
  ------------------------------------------------------------- */
  function showToast(message, type = 'success') {
    if (!adminToastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'bg-white px-4 py-3 rounded-xl border border-neutral-300 shadow-xl flex items-center gap-2 text-xs font-mono text-neutral-900 max-w-sm pointer-events-auto transform translate-y-3 opacity-0 transition-all duration-200';
    
    let iconName = 'check';
    let iconColor = 'text-black';

    if (type === 'warning') {
      iconName = 'alert-circle';
      iconColor = 'text-amber-500';
    } else if (type === 'info') {
      iconName = 'info';
      iconColor = 'text-blue-500';
    }

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} flex-shrink-0"></i>
      <span class="flex-grow font-medium">${escapeHtml(message)}</span>
    `;

    adminToastContainer.appendChild(toast);
    refreshIcons();

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-3', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
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

  init();
});
