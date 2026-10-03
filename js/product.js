/**
 * ✦ SOKHM — Dedicated Product Page Controller (product.html)
 * Powers:
 * - Dynamic product loading via URL parameter (?id=...)
 * - Multi-image gallery with active thumbnails and smooth crossfade
 * - Color swatches with live variant image switching
 * - Size selection (XS-XXL) and interactive Size Guide chart
 * - Quantity stepper and dynamic price button update
 * - Shared Cart Drawer with persistent local storage
 * - "You May Also Like" recommendation cards
 */

document.addEventListener('DOMContentLoaded', async () => {
  let products = [];
  let currentProduct = null;
  let selectedSize = 'M';
  let selectedColor = null;
  let quantity = 1;
  let cart = [];

  // --- PARSE URL PARAMETERS ---
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id') || 'sokhm-noir-01';

  // --- DOM REFERENCES ---
  const pageTitle = document.getElementById('pageTitle');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  const mainGalleryImg = document.getElementById('mainGalleryImg');
  const galleryThumbnails = document.getElementById('galleryThumbnails');
  const productBadge = document.getElementById('productBadge');
  const productCategoryKicker = document.getElementById('productCategoryKicker');
  const productTitle = document.getElementById('productTitle');
  const productPrice = document.getElementById('productPrice');
  const productRatingText = document.getElementById('productRatingText');
  const productDescription = document.getElementById('productDescription');
  const selectedColorLabel = document.getElementById('selectedColorLabel');
  const colorSwatchesContainer = document.getElementById('colorSwatchesContainer');
  const sizeButtonsContainer = document.getElementById('sizeButtonsContainer');
  const openSizeGuideTrigger = document.getElementById('openSizeGuideTrigger');
  const sizeGuideModal = document.getElementById('sizeGuideModal');
  const closeSizeGuideBtn = document.getElementById('closeSizeGuideBtn');
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  const qtyDisplay = document.getElementById('qtyDisplay');
  const addToBagBtn = document.getElementById('addToBagBtn');
  const addToBagLabel = document.getElementById('addToBagLabel');
  const buyNowBtn = document.getElementById('buyNowBtn');
  const galleryWishlistBtn = document.getElementById('galleryWishlistBtn');
  const accordionFitText = document.getElementById('accordionFitText');
  const accordionFabricText = document.getElementById('accordionFabricText');
  const accordionCareText = document.getElementById('accordionCareText');
  const relatedHoodiesGrid = document.getElementById('relatedHoodiesGrid');

  // Cart Drawer
  const cartBtn = document.getElementById('cartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartEmptyPlaceholder = document.getElementById('cartEmptyPlaceholder');
  const cartFooter = document.getElementById('cartFooter');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const drawerCount = document.getElementById('drawerCount');
  const navCartBadge = document.getElementById('navCartBadge');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Search Modal
  const searchBtn = document.getElementById('searchBtn');
  const searchDialog = document.getElementById('searchDialog');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const accountBtn = document.getElementById('accountBtn');

  // Policy Modal
  const policyModal = document.getElementById('policyModal');
  const closePolicyModalBtn = document.getElementById('closePolicyModalBtn');
  const policyTriggers = document.querySelectorAll('.policy-trigger');
  const policyTabBtns = document.querySelectorAll('.policy-tab-btn');

  // ================= 1. FETCH PRODUCTS & LOCATE TARGET =================
  let apiLoaded = false;
  try {
    const apiRes = await fetch(`/api/products?_t=${Date.now()}`, { cache: 'no-store' });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data)) {
        products = data;
        apiLoaded = true;
      }
    }
  } catch (apiErr) {
    console.warn('API fetch products failed, falling back to static json:', apiErr.message);
  }

  if (!apiLoaded && products.length === 0) {
    try {
      const res = await fetch(`data/products.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        products = await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch products.json:', e);
    }
  }

  // Find target product
  currentProduct = products.find(p => p.id === targetId || p.slug === targetId) || products[0];

  if (!currentProduct) {
    console.error('No product found!');
    return;
  }

  const pMainImage = currentProduct.image || (Array.isArray(currentProduct.images) && currentProduct.images[0]) || 'assets/sokhm-card-1.jpg';

  // Set active default color & size
  const productColors = Array.isArray(currentProduct.colors) && currentProduct.colors.length > 0
    ? currentProduct.colors.map(c => ({
        name: typeof c === 'object' ? (c.name || 'Standard') : c,
        hex: typeof c === 'object' ? (c.hex || '#111') : '#111',
        image: (typeof c === 'object' && c.image) ? c.image : pMainImage,
        isMain: typeof c === 'object' ? Boolean(c.isMain) : false
      }))
    : [{ name: 'Onyx Black', hex: '#0E0E0E', image: pMainImage, isMain: true }];
  selectedColor = productColors.find(c => c.isMain || c.image === pMainImage) || productColors[0];

  // ================= 2. POPULATE PRODUCT METADATA =================
  if (pageTitle) pageTitle.textContent = `✦ SOKHM | ${currentProduct.name}`;
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = currentProduct.name;
  if (productTitle) productTitle.textContent = currentProduct.name;
  const pPriceNum = typeof currentProduct.price === 'number' ? currentProduct.price : (parseFloat(currentProduct.price) || 0);
  if (productPrice) productPrice.textContent = currentProduct.formattedPrice || `${pPriceNum.toLocaleString('en-US')} EGP`;
  if (productDescription) productDescription.textContent = currentProduct.description;
  if (productCategoryKicker) productCategoryKicker.textContent = `✦ SOKHM ATELIER // ${currentProduct.categoryLabel || currentProduct.category || 'DROP 01'}`;
  if (productBadge) productBadge.textContent = `✦ ${currentProduct.badge || 'SIGNATURE'}`;
  if (productRatingText) productRatingText.textContent = currentProduct.rating || '4.98';

  if (accordionFitText) accordionFitText.textContent = currentProduct.fit || currentProduct.fit_advice || currentProduct.fitAdvice || 'Sculpted drop-shoulder oversized boxy drape. Forward-rotated sleeves.';
  if (accordionFabricText) accordionFabricText.textContent = currentProduct.fabric || '500 GSM Heavyweight French Terry, 100% Long-Staple Egyptian Cotton.';
  if (accordionCareText) accordionCareText.textContent = currentProduct.care || currentProduct.care_advice || currentProduct.careAdvice || 'Machine wash cold inside-out, hang dry.';

  // ================= 3. POPULATE GALLERY =================
  const galleryImages = (Array.isArray(currentProduct.images) && currentProduct.images.length > 0)
    ? currentProduct.images
    : [pMainImage];
  if (mainGalleryImg) mainGalleryImg.src = pMainImage;

  if (galleryThumbnails) {
    galleryThumbnails.innerHTML = '';
    galleryImages.forEach((imgSrc, idx) => {
      const thumbBtn = document.createElement('button');
      thumbBtn.className = `aspect-[3/4] rounded-[8px] overflow-hidden border ${idx === 0 ? 'border-white ring-1 ring-white' : 'border-[#222]'} cursor-pointer bg-[#111] transition-all`;
      thumbBtn.innerHTML = `<img src="${imgSrc}" class="w-full h-full object-cover object-center">`;

      thumbBtn.addEventListener('click', () => {
        galleryThumbnails.querySelectorAll('button').forEach(b => {
          b.className = 'aspect-[3/4] rounded-[8px] overflow-hidden border border-[#222] cursor-pointer bg-[#111] transition-all hover:border-neutral-500';
        });
        thumbBtn.className = 'aspect-[3/4] rounded-[8px] overflow-hidden border border-white ring-1 ring-white cursor-pointer bg-[#111] transition-all';
        
        mainGalleryImg.style.opacity = '0.35';
        setTimeout(() => {
          mainGalleryImg.src = imgSrc;
          mainGalleryImg.style.opacity = '1';
        }, 120);
      });

      galleryThumbnails.appendChild(thumbBtn);
    });
  }

  // ================= 4. POPULATE COLOR SWATCHES =================
  if (colorSwatchesContainer && selectedColorLabel) {
    colorSwatchesContainer.innerHTML = '';
    selectedColorLabel.textContent = selectedColor ? selectedColor.name : 'Onyx Black';

    productColors.forEach((col) => {
      const swBtn = document.createElement('button');
      swBtn.className = `swatch-dot-dark ${col === selectedColor ? 'active' : ''}`;
      swBtn.style.backgroundColor = col.hex || '#000000';
      swBtn.title = col.name;

      swBtn.addEventListener('click', () => {
        colorSwatchesContainer.querySelectorAll('.swatch-dot-dark').forEach(b => b.classList.remove('active'));
        swBtn.classList.add('active');
        selectedColor = col;
        selectedColorLabel.textContent = col.name;

        if (col.image && mainGalleryImg) {
          mainGalleryImg.style.opacity = '0.35';
          setTimeout(() => {
            mainGalleryImg.src = col.image;
            mainGalleryImg.style.opacity = '1';
          }, 120);
        }
      });

      colorSwatchesContainer.appendChild(swBtn);
    });
  }

  // ================= 5. POPULATE SIZE BUTTONS =================
  if (sizeButtonsContainer) {
    const sizeBtns = sizeButtonsContainer.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => {
          b.className = 'size-btn py-3 rounded-lg border border-[#222] hover:border-white text-neutral-400 transition-all uppercase';
        });
        btn.className = 'size-btn py-3 rounded-lg border border-white bg-white text-black font-bold transition-all uppercase active';
        selectedSize = btn.dataset.size;
      });
    });
  }

  // ================= 6. QUANTITY & PRICE BUTTON UPDATE =================
  function updateButtonLabel() {
    if (qtyDisplay) qtyDisplay.textContent = quantity;
    const total = (currentProduct.price * quantity).toLocaleString();
    const prefix = (window.sokhmContent && window.sokhmContent.get('productPage.addToBagPrefix')) || 
                   (window.sokhmContent && window.sokhmContent.get('productPage.buttons.addToBag')) || 
                   'ADD TO BAG';
    if (addToBagLabel) addToBagLabel.textContent = `${prefix} — ${total} EGP`;
  }

  window.addEventListener('sokhm:content-updated', () => {
    updateButtonLabel();
  });

  if (qtyMinus) {
    qtyMinus.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        updateButtonLabel();
      }
    });
  }

  if (qtyPlus) {
    qtyPlus.addEventListener('click', () => {
      quantity++;
      updateButtonLabel();
    });
  }

  // Add to Bag CTA
  if (addToBagBtn) {
    addToBagBtn.addEventListener('click', () => {
      addToBag(currentProduct, selectedSize, selectedColor?.name || 'Standard', quantity);
      openCart();
    });
  }

  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      const expressItem = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        size: selectedSize,
        color: selectedColor?.name || 'Standard',
        quantity: quantity,
        image: (selectedColor && selectedColor.image) || currentProduct.images?.[0] || 'assets/sokhm-card-1.jpg'
      };
      if (typeof window.openCheckoutModal === 'function') {
        window.openCheckoutModal([expressItem]);
      } else {
        addToBag(currentProduct, selectedSize, selectedColor?.name || 'Standard', quantity);
        openCart();
      }
    });
  }

  // Wishlist Button
  if (galleryWishlistBtn) {
    galleryWishlistBtn.addEventListener('click', () => {
      galleryWishlistBtn.classList.toggle('active');
      const icon = galleryWishlistBtn.querySelector('i');
      if (galleryWishlistBtn.classList.contains('active')) {
        showToast(`Added ${currentProduct.name} to Wishlist`);
        icon.setAttribute('fill', '#E50000');
      } else {
        icon.removeAttribute('fill');
      }
    });
  }

  // Size Guide Dialog
  if (openSizeGuideTrigger && sizeGuideModal) {
    openSizeGuideTrigger.addEventListener('click', () => sizeGuideModal.showModal());
  }
  if (closeSizeGuideBtn && sizeGuideModal) {
    closeSizeGuideBtn.addEventListener('click', () => sizeGuideModal.close());
  }

  // ================= 7. RELATED HOODIES GRID =================
  if (relatedHoodiesGrid) {
    relatedHoodiesGrid.innerHTML = '';
    const otherHoodies = products.filter(p => p.id !== currentProduct.id).slice(0, 3);

    otherHoodies.forEach(hoodie => {
      const card = document.createElement('a');
      card.href = `product.html?id=${hoodie.id}`;
      card.className = 'sokhm-card flex flex-col group cursor-pointer text-left';

      card.innerHTML = `
        <div class="sokhm-card-media">
          <img src="${hoodie.images[0]}" alt="${hoodie.name}" class="card-product-img" loading="lazy">
        </div>
        <div class="pt-3 px-1 flex flex-col space-y-1 font-mono">
          <h4 class="text-xs font-bold text-white group-hover:text-neutral-300 uppercase tracking-wider">${hoodie.name}</h4>
          <span class="text-[9px] text-neutral-400 uppercase tracking-widest">${hoodie.subtitle || 'HOODIE'}</span>
          <p class="text-xs font-semibold text-neutral-300 pt-0.5">${hoodie.formattedPrice || (hoodie.price.toLocaleString() + ' EGP')}</p>
        </div>
      `;

      relatedHoodiesGrid.appendChild(card);
    });
  }

  // ================= 8. SHOPPING BAG & CART DRAWER =================
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

  function addToBag(product, size = 'M', colorName = 'Standard', qty = 1) {
    const itemId = `${product.id}-${size}-${colorName}`;
    const existing = cart.find(i => i.id === itemId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        id: itemId,
        productId: product.id,
        name: product.name,
        price: product.price,
        formattedPrice: product.formattedPrice || `${product.price.toLocaleString()} EGP`,
        image: (selectedColor && selectedColor.image) || product.images?.[0] || 'assets/sokhm-card-1.jpg',
        size: size,
        color: colorName,
        quantity: qty
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
          <p class="text-[10px] text-neutral-400 font-medium">SIZE: ${item.size} • ${item.color || 'Standard'}</p>
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

  // ================= 9. SEARCH =================
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
        : products.filter(p => (p.name || '').toLowerCase().includes(q.toLowerCase()));

      if (matched.length === 0) {
        searchResults.innerHTML = '<div class="py-4 text-center text-xs text-neutral-500 font-mono">No pieces found matching your search.</div>';
        return;
      }

      matched.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-2 rounded-lg hover:bg-neutral-900 border border-transparent hover:border-[#222] flex items-center justify-between cursor-pointer transition-colors';
        const img = p.image || (Array.isArray(p.images) && p.images[0]) || 'assets/sokhm-card-1.jpg';
        const priceNum = typeof p.price === 'number' ? p.price : (parseFloat(p.price) || 0);

        item.innerHTML = `
          <div class="flex items-center gap-2.5">
            <img src="${img}" class="w-9 h-9 object-cover rounded border border-[#222]">
            <div>
              <span class="text-xs font-bold text-white uppercase block">${p.name}</span>
              <span class="text-[9px] text-neutral-400 font-mono uppercase">${p.category || 'HOODIE'}</span>
            </div>
          </div>
          <span class="text-xs font-bold text-white font-mono">${p.formattedPrice || (priceNum.toLocaleString('en-US') + ' EGP')}</span>
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

  // ================= 10. BRAND POLICIES MODAL =================
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

  // ================= 11. BACKDROP DISMISS FOR DIALOGS =================
  [searchDialog, sizeGuideModal, policyModal].forEach(dlg => {
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

  // ================= 12. TOAST =================
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

  // Initial render
  renderCart();
  if (window.lucide) window.lucide.createIcons();
});
