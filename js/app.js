/**
 * ✦ SOKHM — BUILT DIFFERENT Controller
 * Dark Noir luxury streetwear storefront engine.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let products = [];
  let selectedModalSize = 'M';
  let selectedModalColor = null;
  let selectedModalColorIdx = 0;
  let activeModalProduct = null;
  let cart = [];
  let categories = [];
  let activeCategory = 'all';

  // Read URL category query param if present
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('category');
    if (catParam) activeCategory = catParam;
  } catch (e) {}

  // --- DOM REFERENCES ---
  const noirBestSellersGrid = document.getElementById('noirBestSellersGrid');
  const navCartBadge = document.getElementById('navCartBadge');
  const cartBtn = document.getElementById('cartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartEmptyPlaceholder = document.getElementById('cartEmptyPlaceholder');
  const cartFooter = document.getElementById('cartFooter');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const drawerCount = document.getElementById('drawerCount');
  const checkoutBtn = document.getElementById('checkoutBtn');

  // Product Modal
  const productModal = document.getElementById('productModal');
  const closeProductModalBtn = document.getElementById('closeProductModalBtn');
  const modalImg = document.getElementById('modalImg');
  const modalKicker = document.getElementById('modalKicker');
  const modalTitle = document.getElementById('modalTitle');
  const modalPrice = document.getElementById('modalPrice');
  const modalDesc = document.getElementById('modalDesc');
  const modalColorSection = document.getElementById('modalColorSection');
  const modalColorPicker = document.getElementById('modalColorPicker');
  const modalSelectedColorLabel = document.getElementById('modalSelectedColorLabel');
  const modalSizePicker = document.getElementById('modalSizePicker');
  const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');

  // Search Modal
  const searchBtn = document.getElementById('searchBtn');
  const searchDialog = document.getElementById('searchDialog');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const accountBtn = document.getElementById('accountBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Policy Modal
  const policyModal = document.getElementById('policyModal');
  const closePolicyModalBtn = document.getElementById('closePolicyModalBtn');
  const policyTriggers = document.querySelectorAll('.policy-trigger');
  const policyTabBtns = document.querySelectorAll('.policy-tab-btn');

  // Load persisted cart from localStorage
  try {
    const saved = localStorage.getItem('sokhm_noir_cart_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        cart = parsed.map(item => ({
          ...item,
          price: typeof item.price === 'number' ? item.price : (parseFloat(String(item.price || 0).replace(/[^0-9.]/g, '')) || 0),
          quantity: parseInt(item.quantity, 10) || 1
        }));
      }
    }
  } catch (e) {
    cart = [];
  }

  function saveCart() {
    try {
      localStorage.setItem('sokhm_noir_cart_v1', JSON.stringify(cart));
    } catch (e) {}
  }

  // 0. Instant paint from local cache (Stale-While-Revalidate)
  try {
    const cachedProds = localStorage.getItem('sokhm_products_cache_v1');
    if (cachedProds) {
      const parsed = JSON.parse(cachedProds);
      if (Array.isArray(parsed) && parsed.length > 0) {
        products = parsed;
        renderBestSellers();
      }
    }
  } catch (_) {}

  // ================= 1. FETCH SOKHM PRODUCTS =================
  async function loadProducts() {
    try {
      // 1. Parallel fetch for products and categories (always fresh, no stale cache)
      const ts = Date.now();
      const [apiRes, catRes] = await Promise.all([
        fetch(`/api/products?_t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/categories?_t=${ts}`, { cache: 'no-store' }).catch(() => null)
      ]);

      if (catRes && catRes.ok) {
        try {
          const catsData = await catRes.json();
          if (Array.isArray(catsData)) {
            categories = catsData;
            renderCategoryFilters();
          }
        } catch (_) {}
      }

      if (apiRes && apiRes.ok) {
        const data = await apiRes.json();
        if (Array.isArray(data)) {
          products = data;
          renderBestSellers();

          // Store clean compact catalog in localStorage (fits cleanly under browser quota)
          try {
            const compact = data.map(p => ({
              id: p.id,
              name: p.name,
              subtitle: p.subtitle,
              category: p.category,
              category_id: p.category_id,
              price: p.price,
              formattedPrice: p.formattedPrice,
              image: p.image,
              rating: p.rating || 0,
              reviewsCount: p.reviewsCount || p.reviews_count || 0,
              reviews_count: p.reviewsCount || p.reviews_count || 0,
              show_on_homepage: p.show_on_homepage,
              showOnHomepage: p.showOnHomepage,
              slug: p.slug,
              colors: (p.colors || []).map(c => {
                const cObj = typeof c === 'object' && c !== null ? c : { name: c, hex: '#111' };
                const urlImgs = Array.isArray(cObj.images)
                  ? cObj.images.filter(im => typeof im === 'string' && !im.startsWith('data:image/'))
                  : [];
                return {
                  name: cObj.name || 'Standard',
                  hex: cObj.hex || '#111',
                  image: cObj.image || p.image,
                  images: urlImgs.length > 0 ? urlImgs : (cObj.image && !String(cObj.image).startsWith('data:image/') ? [cObj.image] : []),
                  isMain: Boolean(cObj.isMain)
                };
              }),
              sizes: p.sizes
            }));
            localStorage.setItem('sokhm_products_cache_v1', JSON.stringify(compact));
          } catch (_) {}
          return;
        }
      }
    } catch (apiErr) {
      console.warn('API fetch products failed, falling back to static data:', apiErr.message);
    }

    try {
      // 2. Fallback to static JSON file
      const res = await fetch(`data/products.json?_t=${Date.now()}`, { cache: 'no-cache' });
      if (res.ok) {
        products = await res.json();
      } else {
        throw new Error('Failed to load products.json');
      }
    } catch (e) {
      console.warn('Fallback products loaded:', e);
      products = [
        {
          id: 'sokhm-noir-01',
          name: 'SIGNATURE HOODIE',
          subtitle: 'HOODIE',
          price: 1850,
          formattedPrice: '1,850 EGP',
          image: 'assets/sokhm-card-1.jpg',
          images: ['assets/sokhm-card-1.jpg'],
          colors: [
            { name: 'Onyx Black', hex: '#0E0E0E', image: 'assets/sokhm-card-1.jpg' },
            { name: 'Slate Grey', hex: '#5C5A56', image: 'assets/sokhm-card-4.jpg' }
          ]
        },
        {
          id: 'sokhm-noir-02',
          name: 'ESSENTIAL HOODIE',
          subtitle: 'HOODIE',
          price: 1850,
          formattedPrice: '1,850 EGP',
          image: 'assets/sokhm-card-2.jpg',
          images: ['assets/sokhm-card-2.jpg'],
          colors: [
            { name: 'Sand Cream', hex: '#D6D1C4', image: 'assets/sokhm-card-2.jpg' },
            { name: 'Onyx Black', hex: '#0E0E0E', image: 'assets/sokhm-card-1.jpg' },
            { name: 'Heather Dust', hex: '#8A877E', image: 'assets/sokhm-card-3.jpg' }
          ]
        },
        {
          id: 'sokhm-noir-03',
          name: 'COMBAT HOODIE',
          subtitle: 'HOODIE',
          price: 1850,
          formattedPrice: '1,850 EGP',
          image: 'assets/sokhm-card-3.jpg',
          images: ['assets/sokhm-card-3.jpg'],
          colors: [
            { name: 'Tactical Olive', hex: '#2E362A', image: 'assets/sokhm-card-3.jpg' },
            { name: 'Onyx Black', hex: '#0E0E0E', image: 'assets/sokhm-card-1.jpg' }
          ]
        },
        {
          id: 'sokhm-noir-04',
          name: 'CORE HOODIE',
          subtitle: 'HOODIE',
          price: 1850,
          formattedPrice: '1,850 EGP',
          image: 'assets/sokhm-card-4.jpg',
          images: ['assets/sokhm-card-4.jpg'],
          colors: [
            { name: 'Pitch Black', hex: '#0E0E0E', image: 'assets/sokhm-card-4.jpg' },
            { name: 'Charcoal', hex: '#2A2A2A', image: 'assets/sokhm-card-1.jpg' },
            { name: 'Concrete Grey', hex: '#5C5A56', image: 'assets/sokhm-card-3.jpg' }
          ]
        }
      ];
    }
    await loadCategories();
    renderBestSellers();
  }

  // ================= 1.5 CATEGORY FILTERS & PRODUCTS DROPDOWN =================
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories?_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          categories = data;
        }
      }
    } catch (e) {
      categories = [
        { id: 'hoodies', name: 'Hoodies', slug: 'hoodies' },
        { id: 'jackets', name: 'Jackets', slug: 'jackets' },
        { id: 'tees', name: 'Tees', slug: 'tees' },
        { id: 'pants', name: 'Pants', slug: 'pants' },
        { id: 'accessories', name: 'Accessories', slug: 'accessories' }
      ];
    }
    renderCategoryFilters();
  }

  function closeAllNavDropdowns() {
    const navCategoriesDropdown = document.getElementById('navCategoriesDropdown');
    if (navCategoriesDropdown) navCategoriesDropdown.classList.remove('show-dropdown');

    const mobileQuickDropdown = document.getElementById('mobileQuickProductsDropdown');
    const mobileQuickChevron = document.getElementById('mobileQuickProductsChevron');
    if (mobileQuickDropdown) mobileQuickDropdown.classList.add('hidden');
    if (mobileQuickChevron) mobileQuickChevron.classList.remove('rotate-180');

    const mobileNavDrawer = document.getElementById('mobileNavDrawer');
    const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
    if (mobileNavDrawer) mobileNavDrawer.classList.remove('open');
    if (mobileNavBackdrop) mobileNavBackdrop.classList.remove('open');
    document.body.classList.remove('overflow-hidden');
  }

  function renderCategoryFilters() {
    const navList = document.getElementById('navCategoriesList');
    const mobileQuickList = document.getElementById('mobileQuickCategoriesList');
    const mobileDrawerList = document.getElementById('mobileDrawerCategoriesList');
    const filterBar = document.getElementById('categoryFilterBar');

    const isAll = activeCategory === 'all';

    function generateCategoryHtml(c) {
      const slug = (c.slug || c.id || '').toLowerCase();
      const isActive = activeCategory.toLowerCase() === slug;
      return `
        <a href="#collection" data-nav-category="${slug}" class="nav-category-link flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all ${isActive ? 'bg-white text-black font-bold' : 'text-neutral-300 hover:text-white hover:bg-neutral-900'}">
          <span>✦ ${c.name.toUpperCase()}</span>
          <i data-lucide="chevron-right" class="w-3 h-3 ${isActive ? 'text-black' : 'text-neutral-500'}"></i>
        </a>
      `;
    }

    const itemsHtml = categories.map(c => generateCategoryHtml(c)).join('');

    // 1. Desktop Dropdown List
    if (navList) {
      navList.innerHTML = itemsHtml;
    }

    // 2. Mobile Quick Header Dropdown List
    if (mobileQuickList) {
      mobileQuickList.innerHTML = itemsHtml;
    }

    // 3. Mobile Navigation Drawer Droplist
    if (mobileDrawerList) {
      mobileDrawerList.innerHTML = itemsHtml;
    }

    // Bind click events on all category links (desktop, mobile quick, mobile drawer)
    document.querySelectorAll('[data-nav-category]').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const cat = link.getAttribute('data-nav-category');
        selectCategory(cat);
        closeAllNavDropdowns();
        const col = document.getElementById('collection');
        if (col) col.scrollIntoView({ behavior: 'smooth' });
      };
    });

    // 4. Collection Section Filter Bar
    if (filterBar) {
      filterBar.innerHTML = `
        <button type="button" class="cat-pill ${isAll ? 'active px-4 py-2 rounded-full border border-white bg-white text-black font-bold uppercase transition-all whitespace-nowrap cursor-pointer shadow-sm' : 'px-4 py-2 rounded-full border border-[#222] bg-[#0E0E0E] text-neutral-400 hover:text-white hover:border-neutral-600 font-bold uppercase transition-all whitespace-nowrap cursor-pointer'}" data-category="all">
          <span>ALL</span>
        </button>
      ` + categories.map(c => {
        const slug = (c.slug || c.id || '').toLowerCase();
        const isActive = activeCategory.toLowerCase() === slug;
        return `
          <button type="button" class="cat-pill ${isActive ? 'active px-4 py-2 rounded-full border border-white bg-white text-black font-bold uppercase transition-all whitespace-nowrap cursor-pointer shadow-sm' : 'px-4 py-2 rounded-full border border-[#222] bg-[#0E0E0E] text-neutral-400 hover:text-white hover:border-neutral-600 font-bold uppercase transition-all whitespace-nowrap cursor-pointer'}" data-category="${slug}">
            <span>${c.name}</span>
          </button>
        `;
      }).join('');

      filterBar.querySelectorAll('.cat-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-category');
          selectCategory(cat);
        });
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function setupNavigationEvents() {
    // 1. Desktop PRODUCTS Dropdown Toggle on Click
    const navProductsBtn = document.getElementById('navProductsBtn');
    const navCategoriesDropdown = document.getElementById('navCategoriesDropdown');
    if (navProductsBtn && navCategoriesDropdown) {
      navProductsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navCategoriesDropdown.classList.toggle('show-dropdown');
      });

      document.addEventListener('click', (e) => {
        if (!navProductsBtn.contains(e.target) && !navCategoriesDropdown.contains(e.target)) {
          navCategoriesDropdown.classList.remove('show-dropdown');
        }
      });
    }

    // 2. Mobile Quick PRODUCTS Dropdown Toggle
    const mobileQuickBtn = document.getElementById('mobileQuickProductsBtn');
    const mobileQuickDropdown = document.getElementById('mobileQuickProductsDropdown');
    const mobileQuickChevron = document.getElementById('mobileQuickProductsChevron');
    if (mobileQuickBtn && mobileQuickDropdown) {
      mobileQuickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = mobileQuickDropdown.classList.contains('hidden');
        if (isHidden) {
          mobileQuickDropdown.classList.remove('hidden');
          if (mobileQuickChevron) mobileQuickChevron.classList.add('rotate-180');
        } else {
          mobileQuickDropdown.classList.add('hidden');
          if (mobileQuickChevron) mobileQuickChevron.classList.remove('rotate-180');
        }
      });

      document.addEventListener('click', (e) => {
        if (!mobileQuickBtn.contains(e.target) && !mobileQuickDropdown.contains(e.target)) {
          mobileQuickDropdown.classList.add('hidden');
          if (mobileQuickChevron) mobileQuickChevron.classList.remove('rotate-180');
        }
      });
    }

    // 3. Mobile Navigation Drawer
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMobileNavBtn = document.getElementById('closeMobileNavBtn');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');
    const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');

    function openDrawer() {
      if (mobileNavDrawer) mobileNavDrawer.classList.add('open');
      if (mobileNavBackdrop) mobileNavBackdrop.classList.add('open');
      document.body.classList.add('overflow-hidden');
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openDrawer);
    if (closeMobileNavBtn) closeMobileNavBtn.addEventListener('click', closeAllNavDropdowns);
    if (mobileNavBackdrop) mobileNavBackdrop.addEventListener('click', closeAllNavDropdowns);

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeAllNavDropdowns();
      });
    });

    // 4. Mobile Drawer PRODUCTS Accordion Toggle
    const drawerProductsBtn = document.getElementById('mobileDrawerProductsBtn');
    const drawerAccordion = document.getElementById('mobileDrawerCategoriesAccordion');
    const drawerChevron = document.getElementById('mobileDrawerProductsChevron');
    if (drawerProductsBtn && drawerAccordion) {
      drawerProductsBtn.addEventListener('click', () => {
        drawerAccordion.classList.toggle('hidden');
        if (drawerChevron) drawerChevron.classList.toggle('rotate-180');
      });
    }
  }

  // Initialize navigation events immediately
  setupNavigationEvents();

  function selectCategory(catSlug) {
    activeCategory = (catSlug || 'all').toLowerCase();
    renderCategoryFilters();
    renderBestSellers();
  }

  // ================= 2. RENDER BEST SELLERS (DARK NOIR) =================
  function renderBestSellers() {
    if (!noirBestSellersGrid) return;
    noirBestSellersGrid.innerHTML = '';

    // Filter logic:
    // 1. If activeCategory === 'all', only display products that are marked for homepage (show_on_homepage !== false)
    // 2. If activeCategory is specific, show all products in that category (including those marked category-only)
    let displayedProducts = products;
    if (activeCategory === 'all') {
      displayedProducts = products.filter(p => p.show_on_homepage !== false && p.show_on_homepage !== 0 && p.show_on_homepage !== '0' && p.showOnHomepage !== false);
    } else {
      displayedProducts = products.filter(p => {
        const pCat = (p.category || p.category_id || '').toLowerCase();
        return pCat === activeCategory;
      });
    }

    if (displayedProducts.length === 0) {
      noirBestSellersGrid.innerHTML = `
        <div class="col-span-full py-16 text-center text-neutral-500 font-mono text-xs">
          <p class="text-sm text-neutral-400 font-bold uppercase tracking-wider mb-2">لا توجد قطع معروضة في هذا القسم حالياً</p>
          <p>يرجى اختيار قسم آخر أو الضغط على ALL لعرض باقي التشكيلة.</p>
        </div>
      `;
      return;
    }

    const preloadedUrlSet = new Set();
    displayedProducts.forEach((prod, cardIdx) => {
      const card = document.createElement('div');
      card.className = 'sokhm-card flex flex-col group cursor-pointer';

      const mainImg = prod.image || (Array.isArray(prod.images) && prod.images[0]) || 'assets/sokhm-card-1.jpg';
      const priceNum = typeof prod.price === 'number' ? prod.price : (parseFloat(prod.price) || 0);

      // Build swatches (ensure strictly ONE active swatch matching main color)
      const colorsList = Array.isArray(prod.colors) ? prod.colors : [];
      let initialColorIdx = colorsList.findIndex(c => typeof c === 'object' && c && c.isMain);
      if (initialColorIdx < 0) {
        initialColorIdx = colorsList.findIndex(c => typeof c === 'object' && c && c.image === mainImg);
      }
      if (initialColorIdx < 0) initialColorIdx = 0;

      let activeCardColorIdx = initialColorIdx;
      const initialActiveCol = colorsList[initialColorIdx];
      const initialCardImg = (initialActiveCol && typeof initialActiveCol === 'object' && initialActiveCol.image)
        ? initialActiveCol.image
        : mainImg;

      const swatchesHtml = colorsList.map((col, idx) => {
        const hex = typeof col === 'object' ? (col.hex || '#111') : '#111';
        const name = typeof col === 'object' ? (col.name || 'Color') : col;
        const img = (typeof col === 'object' && col.image) ? col.image : mainImg;
        if (img && img !== initialCardImg) preloadedUrlSet.add(img);
        const isActive = (idx === initialColorIdx);
        return `
        <button 
          type="button"
          class="swatch-dot-dark ${isActive ? 'active' : ''}" 
          style="background-color: ${hex}" 
          title="${name}"
          data-image="${img}"
          data-color-idx="${idx}"
          data-color-name="${name.replace(/"/g, '&quot;')}"
        ></button>
      `;
      }).join('');

      const revCount = Number(prod.reviewsCount || prod.reviews_count || 0);
      const ratingVal = revCount > 0 ? Math.min(5, Math.max(1, Number(prod.rating) || 0)) : 0;
      const roundedStars = revCount > 0 ? Math.round(ratingVal) : 0;
      const starsIcons = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);
      const cardRatingHtml = revCount > 0
        ? `<div class="flex items-center gap-1.5 text-[10px] font-mono" title="${ratingVal.toFixed(1)} من 5 (${revCount} تقييم معتمد)">
             <span class="text-amber-400 tracking-wider">${starsIcons}</span>
             <span class="text-white font-bold">${ratingVal.toFixed(1)}</span>
             <span class="text-neutral-400">(${revCount})</span>
           </div>`
        : `<div class="flex items-center gap-1.5 text-[10px] font-mono" title="لا توجد تقييمات معتمدة بعد">
             <span class="text-neutral-600 tracking-wider">☆☆☆☆☆</span>
             <span class="text-neutral-500">(0 تقييم)</span>
           </div>`;

      card.innerHTML = `
        <div class="sokhm-card-media relative">
          <img src="${initialCardImg}" alt="${prod.name}" class="card-product-img" loading="${cardIdx < 4 ? 'eager' : 'lazy'}" fetchpriority="${cardIdx < 2 ? 'high' : 'auto'}" decoding="async">
          
          <button type="button" class="wishlist-btn-dark" title="Add to Wishlist">
            <i data-lucide="heart" class="w-3.5 h-3.5 stroke-[1.8]"></i>
          </button>

          <button type="button" class="quick-view-btn absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-black/80 hover:bg-white text-white hover:text-black border border-white/40 hover:border-white text-[10px] font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer z-10" title="Quick View">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>QUICK VIEW</span>
          </button>
        </div>

        <div class="pt-2.5 px-1 flex flex-col space-y-1 font-mono">
          ${cardRatingHtml}
          <h3 class="text-xs font-bold text-white group-hover:text-neutral-300 transition-colors uppercase tracking-wider">
            ${prod.name}
          </h3>

          <span class="text-[9px] text-neutral-400 uppercase tracking-widest">
            ${prod.subtitle || prod.category || 'HOODIE'}
          </span>

          <!-- Swatches -->
          <div class="flex items-center gap-1.5 pt-1 swatches-wrap">
            ${swatchesHtml}
          </div>

          <p class="text-xs font-semibold text-neutral-300 pt-0.5">
            ${prod.formattedPrice || (priceNum.toLocaleString('en-US') + ' EGP')}
          </p>
        </div>
      `;

      // Wishlist toggle
      const heartBtn = card.querySelector('.wishlist-btn-dark');
      heartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        heartBtn.classList.toggle('active');
        const icon = heartBtn.querySelector('i');
        if (heartBtn.classList.contains('active')) {
          showToast(`Added ${prod.name} to Wishlist`);
          icon.setAttribute('fill', '#E50000');
        } else {
          icon.removeAttribute('fill');
        }
      });

      // Quick View click (preserves the exact color swatch clicked on the card)
      const quickViewBtn = card.querySelector('.quick-view-btn');
      if (quickViewBtn) {
        quickViewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openProductModal(prod, activeCardColorIdx);
        });
      }

      // Swatch click
      const swatchBtns = card.querySelectorAll('.swatch-dot-dark');
      const cardImg = card.querySelector('.card-product-img');
      swatchBtns.forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          activeCardColorIdx = idx;
          swatchBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const newImg = btn.dataset.image;
          if (newImg && cardImg && cardImg.getAttribute('src') !== newImg) {
            cardImg.src = newImg;
          }
        });
      });

      // Navigate to dedicated product page with selected color
      card.addEventListener('click', () => {
        const pickedCol = colorsList[activeCardColorIdx];
        const pickedName = pickedCol ? (typeof pickedCol === 'object' ? pickedCol.name : pickedCol) : '';
        const colorQuery = pickedName ? `&color=${encodeURIComponent(pickedName)}&colorIdx=${activeCardColorIdx}` : '';
        window.location.href = `product.html?id=${encodeURIComponent(prod.id)}${colorQuery}`;
      });

      noirBestSellersGrid.appendChild(card);
    });

    // Preload variant images in idle time so color swatch clicks switch in 0ms
    if (preloadedUrlSet.size > 0) {
      const preloadFn = () => {
        preloadedUrlSet.forEach(url => {
          const im = new Image();
          im.decoding = 'async';
          im.src = url;
        });
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(preloadFn, { timeout: 1200 });
      } else {
        setTimeout(preloadFn, 200);
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ================= 3. PRODUCT MODAL =================
  function openProductModal(prod, initialColorIndex = null) {
    activeModalProduct = prod;
    selectedModalSize = 'M';

    if (window.sokhmPixel && typeof window.sokhmPixel.trackViewContent === 'function') {
      window.sokhmPixel.trackViewContent(prod);
    }

    const pMainImg = prod.image || (Array.isArray(prod.images) && prod.images[0]) || 'assets/sokhm-card-1.jpg';
    const normalizedColors = (Array.isArray(prod.colors) && prod.colors.length > 0)
      ? prod.colors.map(c => ({
          name: typeof c === 'object' ? (c.name || 'Standard') : c,
          hex: typeof c === 'object' ? (c.hex || '#111111') : '#111111',
          image: (typeof c === 'object' && c.image) ? c.image : pMainImg,
          isMain: typeof c === 'object' ? Boolean(c.isMain) : false
        }))
      : [{ name: 'Standard', hex: '#111111', image: pMainImg, isMain: true }];

    let startIdx = (typeof initialColorIndex === 'number' && initialColorIndex >= 0 && initialColorIndex < normalizedColors.length)
      ? initialColorIndex
      : normalizedColors.findIndex(c => c.isMain);
    if (startIdx < 0) startIdx = normalizedColors.findIndex(c => c.image === pMainImg);
    if (startIdx < 0) startIdx = 0;

    selectedModalColorIdx = startIdx;
    selectedModalColor = normalizedColors[startIdx];

    if (modalImg) modalImg.src = (selectedModalColor && selectedModalColor.image) || pMainImg;
    if (modalKicker) modalKicker.textContent = prod.categoryLabel || prod.category || '✦ SOKHM ATELIER';
    if (modalTitle) modalTitle.textContent = prod.name;
    const modalRatingRow = document.getElementById('modalRatingRow');
    if (modalRatingRow) {
      const mRevCount = Number(prod.reviewsCount || prod.reviews_count || 0);
      const mRating = mRevCount > 0 ? Math.min(5, Math.max(1, Number(prod.rating) || 0)) : 0;
      const mRounded = mRevCount > 0 ? Math.round(mRating) : 0;
      const mStars = '★'.repeat(mRounded) + '☆'.repeat(5 - mRounded);
      modalRatingRow.innerHTML = mRevCount > 0
        ? `<span class="text-amber-400 tracking-wider">${mStars}</span><span class="text-white font-bold">${mRating.toFixed(1)}</span><span class="text-neutral-400">(${mRevCount} تقييم معتمد)</span>`
        : `<span class="text-neutral-600 tracking-wider">☆☆☆☆☆</span><span class="text-neutral-500">(بدون تقييمات بعد)</span>`;
    }
    const pNum = typeof prod.price === 'number' ? prod.price : (parseFloat(prod.price) || 0);
    if (modalPrice) modalPrice.textContent = prod.formattedPrice || `${pNum.toLocaleString('en-US')} EGP`;
    if (modalDesc) modalDesc.textContent = prod.description || '500 GSM architectural heavyweight combed cotton fleece. Built different.';

    // Render Color Picker inside Quick View Modal
    if (modalColorPicker) {
      modalColorPicker.innerHTML = '';
      if (modalSelectedColorLabel) {
        modalSelectedColorLabel.textContent = selectedModalColor ? selectedModalColor.name : 'Standard';
      }
      normalizedColors.forEach((col, cIdx) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = `product-swatch-dot ${cIdx === selectedModalColorIdx ? 'active' : ''}`;
        sw.style.backgroundColor = col.hex || '#111111';
        sw.title = col.name;
        sw.setAttribute('aria-label', col.name);
        sw.onclick = () => {
          selectedModalColorIdx = cIdx;
          selectedModalColor = col;
          modalColorPicker.querySelectorAll('.product-swatch-dot').forEach(b => b.classList.remove('active'));
          sw.classList.add('active');
          if (modalSelectedColorLabel) modalSelectedColorLabel.textContent = col.name;
          if (modalImg && col.image) modalImg.src = col.image;
        };
        modalColorPicker.appendChild(sw);
      });
    }

    // Size buttons (strictly dynamic for selected product)
    if (modalSizePicker) {
      modalSizePicker.innerHTML = '';
      let prodSizes = [];
      if (Array.isArray(prod.sizes)) {
        prodSizes = prod.sizes.filter(Boolean);
      } else if (typeof prod.sizes === 'string') {
        try {
          const parsed = JSON.parse(prod.sizes);
          prodSizes = Array.isArray(parsed) ? parsed.filter(Boolean) : prod.sizes.split(',').map(s => s.trim()).filter(Boolean);
        } catch (_) {
          prodSizes = prod.sizes.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (prodSizes.length === 0) {
        prodSizes = ['S', 'M', 'L', 'XL'];
      }

      if (!prodSizes.includes(selectedModalSize)) {
        selectedModalSize = prodSizes.includes('M') ? 'M' : (prodSizes.includes('32') ? '32' : prodSizes[0]);
      }

      prodSizes.forEach(size => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.size = size;
        const isActive = size === selectedModalSize;
        btn.className = isActive
          ? 'size-btn px-3.5 py-2 rounded-lg border border-white bg-white text-black font-bold cursor-pointer transition-colors'
          : 'size-btn px-3.5 py-2 rounded-lg border border-[#222] hover:border-white text-neutral-400 font-medium cursor-pointer transition-colors';
        btn.textContent = size;

        btn.onclick = () => {
          modalSizePicker.querySelectorAll('.size-btn').forEach(sb => {
            sb.className = 'size-btn px-3.5 py-2 rounded-lg border border-[#222] hover:border-white text-neutral-400 font-medium cursor-pointer transition-colors';
          });
          btn.className = 'size-btn px-3.5 py-2 rounded-lg border border-white bg-white text-black font-bold cursor-pointer transition-colors';
          selectedModalSize = btn.dataset.size;
        };

        modalSizePicker.appendChild(btn);
      });
    }

    if (productModal) productModal.showModal();
    if (window.lucide) window.lucide.createIcons();
  }

  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener('click', () => productModal.close());
  }

  if (modalAddToCartBtn) {
    modalAddToCartBtn.addEventListener('click', () => {
      if (!activeModalProduct) return;
      addToBag(
        activeModalProduct,
        selectedModalSize,
        selectedModalColor ? selectedModalColor.name : null,
        selectedModalColor ? selectedModalColor.image : null
      );
      productModal.close();
      openCart();
    });
  }

  // ================= 4. SHOPPING BAG & CART DRAWER =================
  function openCart() {
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.add('open');
      cartBackdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart() {
    if (cartDrawer && cartBackdrop) {
      cartDrawer.classList.remove('open');
      cartBackdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

  function addToBag(product, size = 'M', colorName = null, colorImage = null) {
    const fallbackColor = Array.isArray(product.colors)
      ? (product.colors.find(c => typeof c === 'object' && c.isMain) || product.colors[0])
      : null;
    const cName = colorName || (fallbackColor ? (typeof fallbackColor === 'object' ? fallbackColor.name : fallbackColor) : 'Standard');
    const matchedColObj = Array.isArray(product.colors)
      ? product.colors.find(c => typeof c === 'object' && c.name === cName)
      : null;
    const pMainImage = colorImage
      || (matchedColObj && matchedColObj.image)
      || product.image
      || (Array.isArray(product.images) && product.images[0])
      || 'assets/sokhm-card-1.jpg';
    const itemId = `${product.id}-${size}-${cName}`;
    const existing = cart.find(i => i.id === itemId);
    const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || 0);

    if (existing) {
      existing.quantity = (parseInt(existing.quantity, 10) || 0) + 1;
    } else {
      cart.push({
        id: itemId,
        productId: product.id,
        name: product.name,
        price: priceNum,
        formattedPrice: product.formattedPrice || `${priceNum.toLocaleString('en-US')} EGP`,
        image: pMainImage,
        size: size,
        color: cName,
        quantity: 1
      });
    }

    saveCart();
    showToast(`Added ${product.name} [${size}] to Bag`);
    renderCart();

    if (window.sokhmPixel && typeof window.sokhmPixel.trackAddToCart === 'function') {
      window.sokhmPixel.trackAddToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        price: priceNum,
        quantity: 1
      });
    }
  }

  function renderCart() {
    const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
    const subtotal = cart.reduce((sum, item) => {
      const p = typeof item.price === 'number' ? item.price : (parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0);
      const q = parseInt(item.quantity, 10) || 1;
      return sum + (p * q);
    }, 0);

    if (navCartBadge) navCartBadge.textContent = totalCount;
    if (drawerCount) drawerCount.textContent = totalCount;
    if (cartSubtotal) cartSubtotal.textContent = `${subtotal.toLocaleString('en-US')} EGP`;

    if (!cartItemsList) return;

    if (cart.length === 0) {
      cartEmptyPlaceholder.classList.remove('hidden');
      cartEmptyPlaceholder.classList.add('flex');
      cartItemsList.innerHTML = '';
      if (cartFooter) cartFooter.style.display = 'none';
      return;
    }

    cartEmptyPlaceholder.classList.add('hidden');
    cartEmptyPlaceholder.classList.remove('flex');
    if (cartFooter) cartFooter.style.display = 'block';

    cartItemsList.innerHTML = '';
    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'flex gap-3 pb-3 border-b border-[#1A1A1A] items-center font-mono';
      const itemPrice = typeof item.price === 'number' ? item.price : (parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0);
      const itemQty = parseInt(item.quantity, 10) || 1;

      itemEl.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="w-14 h-14 object-cover rounded-lg bg-neutral-900 border border-[#222] flex-shrink-0">
        <div class="flex-grow min-w-0">
          <div class="flex justify-between items-start">
            <h4 class="text-xs font-bold text-white uppercase truncate">${item.name}</h4>
            <button class="remove-btn text-neutral-500 hover:text-white p-1 cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <p class="text-[10px] text-neutral-400 font-medium">SIZE: ${item.size} ${item.color ? '• ' + item.color : ''}</p>
          <div class="flex justify-between items-center mt-1.5">
            <div class="flex items-center border border-[#222] bg-[#111] rounded px-1.5 py-0.5 text-xs">
              <button class="qty-min px-1 font-bold text-neutral-400 hover:text-white">-</button>
              <span class="px-2 font-bold text-white">${itemQty}</span>
              <button class="qty-plus px-1 font-bold text-neutral-400 hover:text-white">+</button>
            </div>
            <span class="text-xs font-bold text-white">${(itemPrice * itemQty).toLocaleString('en-US')} EGP</span>
          </div>
        </div>
      `;

      itemEl.querySelector('.remove-btn').addEventListener('click', () => {
        cart = cart.filter(i => i.id !== item.id);
        saveCart();
        renderCart();
      });

      itemEl.querySelector('.qty-min').addEventListener('click', () => {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          cart = cart.filter(i => i.id !== item.id);
        }
        saveCart();
        renderCart();
      });

      itemEl.querySelector('.qty-plus').addEventListener('click', () => {
        item.quantity += 1;
        saveCart();
        renderCart();
      });

      cartItemsList.appendChild(itemEl);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (cart.length === 0) {
        showToast('سلة المشتريات فارغة');
        return;
      }
      closeCart();
      if (typeof window.openCheckoutModal === 'function') {
        window.openCheckoutModal(cart);
      }
    });
  }

  window.addEventListener('sokhm:cart-cleared', () => {
    cart = [];
    saveCart();
    renderCart();
  });

  // ================= 5. SEARCH =================
  if (searchBtn && searchDialog && closeSearchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      searchDialog.showModal();
      searchInput.value = '';
      renderSearch('');
      setTimeout(() => searchInput.focus(), 50);
    });

    closeSearchBtn.addEventListener('click', () => searchDialog.close());

    searchInput.addEventListener('input', (e) => {
      renderSearch(e.target.value.trim());
    });

    function renderSearch(q) {
      if (!searchResults) return;
      searchResults.innerHTML = '';
      const matched = q.length === 0
        ? products
        : products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));

      matched.forEach(p => {
        const item = document.createElement('div');
        const pThumb = p.image || (Array.isArray(p.images) && p.images[0]) || 'assets/sokhm-card-1.jpg';
        const pPriceNum = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);
        item.className = 'p-2 rounded-lg hover:bg-neutral-900 border border-transparent hover:border-[#222] flex items-center justify-between cursor-pointer';
        item.innerHTML = `
          <div class="flex items-center gap-2.5">
            <img src="${pThumb}" class="w-9 h-9 object-cover rounded border border-[#222]">
            <span class="text-xs font-bold text-white uppercase">${p.name}</span>
          </div>
          <span class="text-xs font-bold text-white">${p.formattedPrice || (pPriceNum.toLocaleString('en-US') + ' EGP')}</span>
        `;
        item.addEventListener('click', () => {
          searchDialog.close();
          window.location.href = `product.html?id=${p.id}`;
        });
        searchResults.appendChild(item);
      });
    }
  }

  // Account button
  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      showToast('✦ SOKHM Atelier Membership Active');
    });
  }

  // ================= 6. BRAND POLICIES MODAL =================
  if (policyModal) {
    if (closePolicyModalBtn) {
      closePolicyModalBtn.addEventListener('click', () => policyModal.close());
    }

    policyTriggers.forEach(btn => {
      btn.addEventListener('click', () => {
        const policyType = btn.getAttribute('data-policy') || 'privacy';
        openPolicyTab(policyType);
        policyModal.showModal();
        if (window.lucide) window.lucide.createIcons();
      });
    });

    policyTabBtns.forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const targetId = tabBtn.getAttribute('data-target');
        const policyType = targetId ? targetId.replace('policy-', '') : 'privacy';
        openPolicyTab(policyType);
      });
    });

    function openPolicyTab(policyType) {
      const targetId = `policy-${policyType}`;
      policyTabBtns.forEach(btn => {
        if (btn.getAttribute('data-target') === targetId) {
          btn.className = 'policy-tab-btn active px-3 py-1.5 rounded-lg bg-white text-black transition-colors cursor-pointer whitespace-nowrap font-bold';
        } else {
          btn.className = 'policy-tab-btn px-3 py-1.5 rounded-lg bg-[#141414] text-neutral-400 hover:text-white border border-[#222] transition-colors cursor-pointer whitespace-nowrap font-bold';
        }
      });

      document.querySelectorAll('#policyModalContent .policy-section').forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.remove('hidden');
        } else {
          sec.classList.add('hidden');
        }
      });
    }
  }

  // ================= 7. BACKDROP DISMISS FOR DIALOGS =================
  [searchDialog, productModal, policyModal].forEach(dlg => {
    if (!dlg) return;
    dlg.addEventListener('click', (e) => {
      const rect = dlg.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        dlg.close();
      }
    });
  });

  // Cross-tab / Cross-page Cart & Admin Live Updates Sync
  window.addEventListener('storage', (e) => {
    if (e.key === 'sokhm_noir_cart_v1') {
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) {
          cart = parsed.map(item => ({
            ...item,
            price: typeof item.price === 'number' ? item.price : (parseFloat(String(item.price || 0).replace(/[^0-9.]/g, '')) || 0),
            quantity: parseInt(item.quantity, 10) || 1
          }));
        } else {
          cart = [];
        }
        renderCart();
      } catch (err) {}
    } else if (e.key === 'sokhm_last_admin_update' || e.key === 'sokhm_products_cache_v1' || e.key === 'sokhm_reviews_cache_v1') {
      loadProducts();
      loadHomepageReviews();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadProducts();
      loadHomepageReviews();
      if (window.sokhmContent && typeof window.sokhmContent.load === 'function') {
        window.sokhmContent.load();
      }
    }
  });

  // ================= 8. TOAST =================
  function showToast(msg) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'bg-white text-black text-xs font-mono font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 transition-all duration-300 transform translate-y-2 opacity-0';
    toast.innerHTML = `<span>✦ ${msg}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  // ================= 8.5 DYNAMIC WHATSAPP LINKS SYNC =================
  function syncWhatsAppLinks() {
    try {
      let content = null;
      if (window.sokhmContent) {
        if (typeof window.sokhmContent.getAll === 'function') content = window.sokhmContent.getAll();
        else if (typeof window.sokhmContent.getContent === 'function') content = window.sokhmContent.getContent();
      }
      if (!content) {
        try {
          const cached = localStorage.getItem('sokhm_site_content_v1');
          if (cached) content = JSON.parse(cached);
        } catch (_) {}
      }
      const supp = (content && content.support) ? content.support : {};
      const cfg = (content && content.checkout) ? content.checkout : {};
      let rawWaPhone = (supp.whatsappPhone || cfg.whatsappPhone || '01274994509').replace(/[^0-9]/g, '');
      if (rawWaPhone.startsWith('0020')) rawWaPhone = rawWaPhone.slice(4);
      else if (rawWaPhone.startsWith('002')) rawWaPhone = rawWaPhone.slice(3);
      const intlWaPhone = rawWaPhone.startsWith('20') ? rawWaPhone : (rawWaPhone.startsWith('0') ? ('2' + rawWaPhone) : ('20' + rawWaPhone));
      const waMsgText = supp.whatsappMessage || 'مرحباً SOKHM، أود الاستفسار والتواصل مع فريق الدعم الفني';
      const waMsg = encodeURIComponent(waMsgText);
      const targetUrl = `https://wa.me/${intlWaPhone}?text=${waMsg}`;

      ['floatingWhatsappBtn', 'navSupportBtn', 'drawerSupportBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.href = targetUrl;
      });

      // Visibility controls
      const vis = (content && content.visibility) ? content.visibility : {};
      const isFloatingHidden = vis['support.floatingBtn'] === false || supp.showFloatingButton === false;
      const floatingEl = document.getElementById('floatingWhatsappBtn');
      if (floatingEl) {
        if (isFloatingHidden) floatingEl.classList.add('hidden');
        else floatingEl.classList.remove('hidden');
      }

      const isNavHidden = vis['support.navBtn'] === false || supp.showNavSupport === false;
      const navEl = document.getElementById('navSupportBtn');
      if (navEl) {
        if (isNavHidden) navEl.classList.add('hidden');
        else navEl.classList.remove('hidden');
      }

      const drawerEl = document.getElementById('drawerSupportBtn');
      if (drawerEl) {
        if (isNavHidden) drawerEl.classList.add('hidden');
        else drawerEl.classList.remove('hidden');
      }
    } catch (_) {}
  }

  window.addEventListener('sokhm:content-updated', syncWhatsAppLinks);

  // ================= 8.5. CUSTOMER REVIEWS SECTION (ABOVE PRODUCTS) =================
  function renderHomepageReviews(reviewsList) {
    const reviewsSection = document.getElementById('reviewsSection');
    const reviewsGrid = document.getElementById('homepageReviewsGrid');
    const starsEl = document.getElementById('homeReviewsStars');
    const avgEl = document.getElementById('homeReviewsAvgRating');
    const countEl = document.getElementById('homeReviewsTotalCount');
    if (!reviewsGrid || !reviewsSection) return;

    const list = (Array.isArray(reviewsList) ? reviewsList : []).filter(r => (r.status || 'approved') === 'approved');
    if (list.length === 0) {
      reviewsSection.classList.add('hidden');
      if (starsEl) starsEl.textContent = '☆☆☆☆☆';
      if (avgEl) avgEl.textContent = '0.0';
      if (countEl) countEl.textContent = '0 تقييم معتمد';
      reviewsGrid.innerHTML = '';
      return;
    }
    reviewsSection.classList.remove('hidden');

    const totalRating = list.reduce((sum, r) => sum + Math.min(5, Math.max(1, Number(r.rating) || 5)), 0);
    const avgNum = totalRating / list.length;
    const avg = avgNum.toFixed(1);
    const roundedAvg = Math.min(5, Math.max(1, Math.round(avgNum)));
    if (starsEl) starsEl.textContent = '★'.repeat(roundedAvg) + '☆'.repeat(5 - roundedAvg);
    if (avgEl) avgEl.textContent = avg;
    if (countEl) countEl.textContent = `${list.length} تقييم معتمد`;

    reviewsGrid.innerHTML = list.map((rev) => {
      const rating = Math.min(5, Math.max(1, Number(rev.rating) || 5));
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const name = String(rev.customerName || rev.customer_name || 'عميل SOKHM').replace(/</g, '&lt;');
      const loc = String(rev.customerLocation || rev.customer_location || 'مصر').replace(/</g, '&lt;');
      const comment = String(rev.comment || '').replace(/</g, '&lt;');
      const prodBadge = String(rev.productName || rev.product_name || 'SOKHM Collection').replace(/</g, '&lt;');
      const initial = name.trim().charAt(0) || 'S';

      return `
        <article class="sokhm-review-card">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-amber-400 text-sm tracking-widest font-mono" aria-label="${rating} من 5 نجوم">${stars}</span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-bold">
                <span>✓</span>
                <span>تقييم معتمد</span>
              </span>
            </div>
            <p class="text-xs sm:text-[13px] text-neutral-200 leading-relaxed font-sans mb-4">"${comment}"</p>
          </div>
          <div class="pt-3 border-t border-[#1D1D1D] flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0">
                ${initial}
              </div>
              <div class="min-w-0">
                <h4 class="text-xs font-bold text-white truncate">${name}</h4>
                <span class="text-[10px] text-neutral-400 block truncate">${loc}</span>
              </div>
            </div>
            <span class="text-[9px] font-mono text-neutral-400 bg-[#161616] border border-[#262626] px-2 py-1 rounded truncate max-w-[120px]" title="${prodBadge}">
              ${prodBadge}
            </span>
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadHomepageReviews() {
    try {
      const res = await fetch('/api/reviews?homepage=1&_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          renderHomepageReviews(data);
          try {
            localStorage.setItem('sokhm_reviews_cache_v1', JSON.stringify(data));
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // ================= 9. INITIALIZE =================
  await Promise.all([
    loadProducts(),
    loadHomepageReviews()
  ]);
  renderCart();
  syncWhatsAppLinks();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});
