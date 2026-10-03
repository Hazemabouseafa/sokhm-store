/**
 * ✦ SOKHM — BUILT DIFFERENT Controller
 * Dark Noir luxury streetwear storefront engine.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let products = [];
  let selectedModalSize = 'M';
  let activeModalProduct = null;
  let cart = [];

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
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }

  function saveCart() {
    try {
      localStorage.setItem('sokhm_noir_cart_v1', JSON.stringify(cart));
    } catch (e) {}
  }

  // ================= 1. FETCH SOKHM PRODUCTS =================
  async function loadProducts() {
    try {
      // 1. Fetch live database products first
      const apiRes = await fetch(`/api/products?_t=${Date.now()}`, { cache: 'no-cache' });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (Array.isArray(data)) {
          products = data;
          renderBestSellers();
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
    renderBestSellers();
  }

  // ================= 2. RENDER BEST SELLERS (DARK NOIR) =================
  function renderBestSellers() {
    if (!noirBestSellersGrid) return;
    noirBestSellersGrid.innerHTML = '';

    products.forEach((prod) => {
      const card = document.createElement('div');
      card.className = 'sokhm-card flex flex-col group cursor-pointer';

      const mainImg = prod.image || (Array.isArray(prod.images) && prod.images[0]) || 'assets/sokhm-card-1.jpg';
      const priceNum = typeof prod.price === 'number' ? prod.price : (parseFloat(prod.price) || 0);

      // Build swatches
      const colorsList = Array.isArray(prod.colors) ? prod.colors : [];
      const hasExplicitMain = colorsList.some(c => (typeof c === 'object' && c.isMain) || (typeof c === 'object' && c.image === mainImg));
      const swatchesHtml = colorsList.map((col, idx) => {
        const hex = typeof col === 'object' ? (col.hex || '#111') : '#111';
        const name = typeof col === 'object' ? (col.name || 'Color') : col;
        const img = (typeof col === 'object' && col.image) ? col.image : mainImg;
        const isActive = hasExplicitMain
          ? ((typeof col === 'object' && col.isMain) || (typeof col === 'object' && col.image === mainImg))
          : (idx === 0);
        return `
        <button 
          type="button"
          class="swatch-dot-dark ${isActive ? 'active' : ''}" 
          style="background-color: ${hex}" 
          title="${name}"
          data-image="${img}"
        ></button>
      `;
      }).join('');

      card.innerHTML = `
        <div class="sokhm-card-media relative">
          <img src="${mainImg}" alt="${prod.name}" class="card-product-img" loading="lazy">
          
          <button type="button" class="wishlist-btn-dark" title="Add to Wishlist">
            <i data-lucide="heart" class="w-3.5 h-3.5 stroke-[1.8]"></i>
          </button>

          <button type="button" class="quick-view-btn absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-black/80 hover:bg-white text-white hover:text-black border border-white/40 hover:border-white text-[10px] font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer z-10" title="Quick View">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>QUICK VIEW</span>
          </button>
        </div>

        <div class="pt-2.5 px-1 flex flex-col space-y-1 font-mono">
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

      // Quick View click
      const quickViewBtn = card.querySelector('.quick-view-btn');
      if (quickViewBtn) {
        quickViewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openProductModal(prod);
        });
      }

      // Swatch click
      const swatchBtns = card.querySelectorAll('.swatch-dot-dark');
      const cardImg = card.querySelector('.card-product-img');
      swatchBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          swatchBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const newImg = btn.dataset.image;
          if (newImg && cardImg) {
            cardImg.style.opacity = '0.35';
            setTimeout(() => {
              cardImg.src = newImg;
              cardImg.style.opacity = '1';
            }, 100);
          }
        });
      });

      // Navigate to dedicated product page
      card.addEventListener('click', () => {
        window.location.href = `product.html?id=${prod.id}`;
      });

      noirBestSellersGrid.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ================= 3. PRODUCT MODAL =================
  function openProductModal(prod) {
    activeModalProduct = prod;
    selectedModalSize = 'M';

    if (modalImg) modalImg.src = prod.image || (Array.isArray(prod.images) && prod.images[0]) || 'assets/sokhm-card-1.jpg';
    if (modalKicker) modalKicker.textContent = prod.categoryLabel || prod.category || '✦ SOKHM ATELIER';
    if (modalTitle) modalTitle.textContent = prod.name;
    const pNum = typeof prod.price === 'number' ? prod.price : (parseFloat(prod.price) || 0);
    if (modalPrice) modalPrice.textContent = prod.formattedPrice || `${pNum.toLocaleString('en-US')} EGP`;
    if (modalDesc) modalDesc.textContent = prod.description || '500 GSM architectural heavyweight combed cotton fleece. Built different.';

    // Size buttons
    if (modalSizePicker) {
      const sizeBtns = modalSizePicker.querySelectorAll('button');
      sizeBtns.forEach(b => {
        if (b.dataset.size === 'M') {
          b.className = 'px-3.5 py-2 rounded-lg border border-white bg-white text-black font-bold';
        } else {
          b.className = 'px-3.5 py-2 rounded-lg border border-[#222] hover:border-white text-neutral-400 font-medium';
        }
        b.onclick = () => {
          sizeBtns.forEach(sb => sb.className = 'px-3.5 py-2 rounded-lg border border-[#222] hover:border-white text-neutral-400 font-medium');
          b.className = 'px-3.5 py-2 rounded-lg border border-white bg-white text-black font-bold';
          selectedModalSize = b.dataset.size;
        };
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
      addToBag(activeModalProduct, selectedModalSize);
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

  function addToBag(product, size = 'M', colorName = null) {
    const pMainImage = product.image || (Array.isArray(product.images) && product.images[0]) || 'assets/sokhm-card-1.jpg';
    const cName = colorName || (Array.isArray(product.colors) && product.colors[0] ? (typeof product.colors[0] === 'object' ? product.colors[0].name : product.colors[0]) : 'Standard');
    const itemId = `${product.id}-${size}-${cName}`;
    const existing = cart.find(i => i.id === itemId);
    const priceNum = typeof product.price === 'number' ? product.price : (parseFloat(product.price) || 0);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: itemId,
        productId: product.id,
        name: product.name,
        price: priceNum,
        formattedPrice: product.formattedPrice || `${priceNum.toLocaleString()} EGP`,
        image: pMainImage,
        size: size,
        color: cName,
        quantity: 1
      });
    }

    saveCart();
    showToast(`Added ${product.name} [${size}] to Bag`);
    renderCart();
  }

  function renderCart() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (navCartBadge) navCartBadge.textContent = totalCount;
    if (drawerCount) drawerCount.textContent = totalCount;
    if (cartSubtotal) cartSubtotal.textContent = `${subtotal.toLocaleString()} EGP`;

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
              <span class="px-2 font-bold text-white">${item.quantity}</span>
              <button class="qty-plus px-1 font-bold text-neutral-400 hover:text-white">+</button>
            </div>
            <span class="text-xs font-bold text-white">${(item.price * item.quantity).toLocaleString()} EGP</span>
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
        item.className = 'p-2 rounded-lg hover:bg-neutral-900 border border-transparent hover:border-[#222] flex items-center justify-between cursor-pointer';
        item.innerHTML = `
          <div class="flex items-center gap-2.5">
            <img src="${p.images[0]}" class="w-9 h-9 object-cover rounded border border-[#222]">
            <span class="text-xs font-bold text-white uppercase">${p.name}</span>
          </div>
          <span class="text-xs font-bold text-white">${p.formattedPrice || (p.price.toLocaleString() + ' EGP')}</span>
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

  // Cross-tab / Cross-page Cart Sync
  window.addEventListener('storage', (e) => {
    if (e.key === 'sokhm_noir_cart_v1') {
      try {
        cart = e.newValue ? JSON.parse(e.newValue) : [];
        renderCart();
      } catch (err) {}
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

  // ================= 9. INITIALIZE =================
  await loadProducts();
  renderCart();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});
