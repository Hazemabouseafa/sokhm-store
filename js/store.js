/**
 * SOKHM STORE - Central Data Layer & Showcase Engine
 * Curated luxury fashion showcase and persistent e-commerce catalog.
 */

const STORAGE_KEYS = {
  CATEGORIES: 'sokhm_showcase_categories_v5',
  PRODUCTS: 'sokhm_showcase_products_v5',
  CART: 'sokhm_showcase_cart_v5'
};

// Showcase Garments (Matching the reference layout)
const SHOWCASE_SLIDES = [
  {
    id: 'showcase-1',
    title: 'Oversized Heavy\nHoodie In Black',
    shortTitle: 'Oversized Heavy Hoodie In Black',
    price: 2650,
    formattedPrice: '2,650 EGP',
    image: 'assets/black-hoodie-front.jpg',
    backImage: 'assets/black-hoodie-back.jpg',
    hoodImage: 'assets/black-hoodie-hood.jpg',
    lining: '500 GSM French Terry Cotton',
    wearing: 'Size Large',
    height: "6'2\" / 188 cm",
    category: 'hoodies',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Architectural oversized silhouette in ultra-dense 500 GSM jet-black combed cotton. Sculpted drop shoulder, double-layered hood, and signature tonal SOKHM embroidery.',
    badge: 'SIGNATURE HOODIE',
    hotspots: [
      { id: 'hs-1', x: 50, y: 14, title: 'Double 500 GSM Hood', desc: 'Dense architectural drape that stays structured without collapsing.' },
      { id: 'hs-2', x: 50, y: 27, title: 'Tonal 4-Star Stitch', desc: 'Precision metallic chest embroidery of the SOKHM emblem.' },
      { id: 'hs-3', x: 32, y: 56, title: 'Heavy 2x2 Ribbing', desc: 'Articulated cuffs engineered to retain boxy silhouette shape.' }
    ]
  },
  {
    id: 'showcase-2',
    title: 'Borg Bomber\nJacket In Black',
    shortTitle: 'Borg Bomber Jacket In Black',
    price: 2850,
    formattedPrice: '2,850 EGP',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=85',
    lining: '100% Polyester & Quilted Silk',
    wearing: 'Size Medium',
    height: "6'3\" / 191 cm",
    category: 'jackets',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Heavyweight burgundy-black velvet bomber jacket featuring bespoke golden dragon & eye embroidery across the back with custom antique hardware.',
    badge: 'NEW SHOWCASE'
  },
  {
    id: 'showcase-3',
    title: 'Washed Distressed\nBalaclava Jacket',
    shortTitle: 'Washed Distressed Balaclava Jacket',
    price: 2450,
    formattedPrice: '2,450 EGP',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85',
    lining: '100% French Terry Cotton',
    wearing: 'Size Large',
    height: "6'1\" / 185 cm",
    category: 'jackets',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Signature SOKHM oversized faded work jacket with heavy raw-edge distressing, double-way antique zipper, and integrated balaclava hood.',
    badge: 'SIGNATURE PIECE'
  },
  {
    id: 'showcase-4',
    title: 'Red Skeleton\nTechnical Puffer',
    shortTitle: 'Red Skeleton Technical Puffer',
    price: 2900,
    formattedPrice: '2,900 EGP',
    image: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=1200&q=85',
    lining: 'Thermal Goose Down Fill',
    wearing: 'Size Medium',
    height: "6'2\" / 188 cm",
    category: 'jackets',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Water-repellent ripstop nylon shell with blood red anatomical skeleton artwork, cropped architectural drape, and internal storm cuffs.',
    badge: 'COLLECTION 2026'
  }
];

const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'All Pieces', slug: 'all' },
  { id: 'hoodies', name: 'Heavy Hoodies', slug: 'hoodies' },
  { id: 'jackets', name: 'Jackets & Outerwear', slug: 'jackets' },
  { id: 'tees', name: 'Boxy Tees', slug: 'tees' },
  { id: 'pants', name: 'Pants & Cargo', slug: 'pants' },
  { id: 'accessories', name: 'Accessories', slug: 'accessories' }
];

const DEFAULT_PRODUCTS = [
  ...SHOWCASE_SLIDES.map(s => ({
    id: s.id,
    name: s.shortTitle,
    category: s.category,
    price: s.price,
    image: s.image,
    sizes: s.sizes,
    description: s.description,
    badge: s.badge,
    lining: s.lining,
    wearing: s.wearing,
    height: s.height,
    inStock: true
  })),
  {
    id: 'prod-04b',
    name: 'Tactical Wide-Leg Carpenter Cargo',
    category: 'pants',
    price: 1950,
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1200&q=85',
    sizes: ['28', '30', '32', '34', '36'],
    description: 'Japanese heavyweight cotton-twill featuring 3D gusseted cargo pockets, articulated knee darts, and adjustable ankle cinch bungees.',
    badge: 'CORE ESSENTIAL',
    lining: 'Reinforced Pocket Bags',
    wearing: 'Size 32',
    height: "6'3\" / 191 cm",
    inStock: true
  },
  {
    id: 'prod-05b',
    name: 'Cathedral Embroidered Black Hoodie (Back Edition)',
    category: 'hoodies',
    price: 2750,
    image: 'assets/black-hoodie-back.jpg',
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Bespoke back edition featuring metallic thread gothic cathedral embroidery on 500 GSM jet black cotton.',
    badge: 'EXCLUSIVE',
    lining: '500 GSM French Terry',
    wearing: 'Size Large',
    height: "6'2\" / 188 cm",
    inStock: true
  },
  {
    id: 'prod-05',
    name: 'Raw-Edge 480 GSM Thermal Hoodie',
    category: 'hoodies',
    price: 1850,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
    sizes: ['S', 'M', 'L', 'XL'],
    description: '480 GSM ultra-heavy Egyptian cotton with dropped shoulders, raw-edge cuffs, double-lined hood, and subtle tonal embroidery.',
    badge: 'NEW',
    lining: 'Brushed Fleece',
    wearing: 'Size Large',
    height: "6'2\" / 188 cm",
    inStock: true
  },
  {
    id: 'prod-06',
    name: 'Mineral Acid Wash Heavyweight Tee',
    category: 'tees',
    price: 950,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    description: 'Hand-treated vintage acid wash with ultra-heavy 260 GSM single jersey cotton. Signature boxy streetwear drape.',
    badge: 'ESSENTIAL',
    lining: '100% Combed Cotton',
    wearing: 'Size Medium',
    height: "6'1\" / 185 cm",
    inStock: true
  },
  {
    id: 'prod-07',
    name: 'SOKHM 4-Star Knit Beanie',
    category: 'accessories',
    price: 650,
    image: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=800&q=80',
    sizes: ['ONE SIZE'],
    description: 'Chunky ribbed knit acrylic-wool blend featuring the iconic SOKHM 4-pointed star silver embroidery.',
    badge: 'ICONIC',
    lining: 'Unlined Knit',
    wearing: 'One Size',
    height: 'Universal',
    inStock: true
  },
  {
    id: 'prod-08',
    name: 'Modular Waterproof Crossbody Bag',
    category: 'accessories',
    price: 1250,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    sizes: ['ONE SIZE'],
    description: 'High-tenacity Cordura fabric with magnetic quick-release buckle, waterproof seam seals, and modular strap attachments.',
    badge: 'POPULAR',
    lining: 'Ripstop Nylon',
    wearing: 'One Size',
    height: 'Adjustable',
    inStock: true
  }
];

class SokhStore {
  constructor() {
    this.initStorage();
    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        this.notifyChange(e.key);
      }
    });
  }

  initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    }
  }

  notifyChange(key) {
    window.dispatchEvent(new CustomEvent('sokhm:store-updated', { detail: { key } }));
  }

  getShowcaseSlides() {
    return SHOWCASE_SLIDES;
  }

  getCategories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  }

  addCategory(name, slug) {
    const categories = this.getCategories();
    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    
    if (categories.some(c => c.slug === cleanSlug)) {
      throw new Error(`Category "${cleanSlug}" already exists.`);
    }

    const newCategory = {
      id: 'cat-' + Date.now(),
      name: name.trim(),
      slug: cleanSlug
    };

    categories.push(newCategory);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    this.notifyChange(STORAGE_KEYS.CATEGORIES);
    return newCategory;
  }

  deleteCategory(categoryId) {
    if (categoryId === 'all') {
      throw new Error('Default category cannot be deleted.');
    }
    let categories = this.getCategories();
    const categoryToDelete = categories.find(c => c.id === categoryId);
    if (!categoryToDelete) return false;

    categories = categories.filter(c => c.id !== categoryId);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

    let products = this.getProducts();
    let updatedProducts = false;
    products = products.map(p => {
      if (p.category === categoryToDelete.slug) {
        updatedProducts = true;
        return { ...p, category: 'all' };
      }
      return p;
    });

    if (updatedProducts) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      this.notifyChange(STORAGE_KEYS.PRODUCTS);
    }

    this.notifyChange(STORAGE_KEYS.CATEGORIES);
    return true;
  }

  getProducts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : DEFAULT_PRODUCTS;
    } catch {
      return DEFAULT_PRODUCTS;
    }
  }

  getProductById(id) {
    return this.getProducts().find(p => p.id === id) || null;
  }

  addProduct(productData) {
    const products = this.getProducts();
    const newProduct = {
      id: 'sokhm-' + Date.now(),
      name: productData.name.trim(),
      category: productData.category || 'jackets',
      price: Number(productData.price) || 0,
      image: productData.image || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
      sizes: Array.isArray(productData.sizes) && productData.sizes.length > 0 ? productData.sizes : ['S', 'M', 'L', 'XL'],
      description: productData.description ? productData.description.trim() : 'Garment crafted with high-density textile, modern tailored fit, and premium finish.',
      badge: productData.badge || 'NEW',
      lining: productData.lining || '100% Cotton Twill',
      wearing: productData.wearing || 'Size Medium',
      height: productData.height || "6'2\" / 188 cm",
      inStock: true
    };

    products.unshift(newProduct);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.notifyChange(STORAGE_KEYS.PRODUCTS);
    return newProduct;
  }

  deleteProduct(productId) {
    let products = this.getProducts();
    const originalLength = products.length;
    products = products.filter(p => p.id !== productId);
    
    if (products.length !== originalLength) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      this.notifyChange(STORAGE_KEYS.PRODUCTS);
      this.removeProductFromCart(productId);
      return true;
    }
    return false;
  }

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    this.notifyChange(STORAGE_KEYS.CATEGORIES);
    this.notifyChange(STORAGE_KEYS.PRODUCTS);
  }

  /* --- Cart --- */
  getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CART);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    this.notifyChange(STORAGE_KEYS.CART);
  }

  addToCart(productId, size = 'M', quantity = 1) {
    let product = this.getProductById(productId);
    if (!product) {
      const slide = SHOWCASE_SLIDES.find(s => s.id === productId);
      if (slide) {
        product = {
          id: slide.id,
          name: slide.shortTitle,
          price: slide.price,
          image: slide.image,
          category: slide.category,
          sizes: slide.sizes
        };
      }
    }
    if (!product) return null;

    const cart = this.getCart();
    const cartItemId = `${productId}-${size}`;
    const existingIndex = cart.findIndex(item => item.id === cartItemId);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        id: cartItemId,
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
        size: size,
        quantity: quantity
      });
    }

    this.saveCart(cart);
    return cart;
  }

  updateCartQty(cartItemId, delta) {
    let cart = this.getCart();
    const item = cart.find(i => i.id === cartItemId);
    if (!item) return cart;

    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== cartItemId);
    }

    this.saveCart(cart);
    return cart;
  }

  removeFromCart(cartItemId) {
    let cart = this.getCart();
    cart = cart.filter(item => item.id !== cartItemId);
    this.saveCart(cart);
    return cart;
  }

  removeProductFromCart(productId) {
    let cart = this.getCart();
    cart = cart.filter(item => item.productId !== productId);
    this.saveCart(cart);
  }

  clearCart() {
    this.saveCart([]);
  }

  getCartTotal() {
    return this.getCartTotals().subtotal;
  }

  getCartCount() {
    return this.getCartTotals().totalItems;
  }

  updateCartItemQuantity(cartItemId, quantity) {
    let cart = this.getCart();
    const item = cart.find(i => i.id === cartItemId);
    if (!item) return cart;
    if (quantity <= 0) {
      return this.removeFromCart(cartItemId);
    }
    item.quantity = quantity;
    this.saveCart(cart);
    return cart;
  }

  getCartTotals() {
    const cart = this.getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const freeShippingThreshold = 2500;
    const shipping = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : 75;
    const total = subtotal + shipping;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      shipping,
      total,
      totalItems,
      freeShippingThreshold,
      progressToFreeShipping: Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    };
  }

  formatEGP(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' EGP';
  }

  getGovernorates() {
    return [
      { id: 'cairo', name: 'Cairo (القاهرة)', fee: 65, eta: 'Next Day (24 hrs)' },
      { id: 'giza', name: 'Giza (الجيزة)', fee: 65, eta: 'Next Day (24 hrs)' },
      { id: 'alexandria', name: 'Alexandria (الإسكندرية)', fee: 75, eta: '2 Business Days' },
      { id: 'dakahlia', name: 'Dakahlia / Mansoura (الدقهلية)', fee: 85, eta: '2 - 3 Days' },
      { id: 'sharqia', name: 'Sharqia (الشرقية)', fee: 85, eta: '2 - 3 Days' },
      { id: 'gharbia', name: 'Gharbia / Tanta (الغربية)', fee: 85, eta: '2 - 3 Days' },
      { id: 'qalyubia', name: 'Qalyubia (القليوبية)', fee: 70, eta: '1 - 2 Days' },
      { id: 'port_said', name: 'Port Said (بورسعيد)', fee: 90, eta: '2 - 3 Days' },
      { id: 'suez', name: 'Suez (السويس)', fee: 90, eta: '2 - 3 Days' },
      { id: 'ismailia', name: 'Ismailia (الإسماعيلية)', fee: 90, eta: '2 - 3 Days' },
      { id: 'red_sea', name: 'Red Sea / Hurghada (البحر الأحمر)', fee: 110, eta: '3 - 4 Days' },
      { id: 'south_sinai', name: 'South Sinai / Sharm (جنوب سيناء)', fee: 120, eta: '3 - 4 Days' },
      { id: 'upper_egypt', name: 'Upper Egypt / Asyut (الصعيد)', fee: 115, eta: '3 - 4 Days' }
    ];
  }

  createOrder(orderData) {
    const ordersKey = 'sokhm_showcase_orders_v5';
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
    } catch {
      orders = [];
    }

    const orderNumber = 'SKM-' + Math.floor(1000 + Math.random() * 9000);
    const newOrder = {
      id: 'ord-' + Date.now(),
      orderNumber,
      createdAt: new Date().toISOString(),
      ...orderData
    };

    orders.unshift(newOrder);
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    this.clearCart();

    // Prepare WhatsApp Message Link
    const phoneConcierge = '+201000000000'; // SOKHM Concierge
    const itemsSummary = (newOrder.items || []).map(i => `• ${i.name} (${i.size}) x${i.quantity} - ${i.price * i.quantity} EGP`).join('%0A');
    const waText = encodeURIComponent(
      `Hello SOKHM Concierge,%0A%0AI would like to confirm my order #${orderNumber}:%0A${itemsSummary}%0A%0ATotal: ${newOrder.totalAmount} EGP%0APayment: ${newOrder.paymentMethod}%0AName: ${newOrder.customerName}%0APhone: ${newOrder.customerPhone}%0ACity: ${newOrder.governorate}%0AAddress: ${newOrder.address}`
    );

    return {
      order: newOrder,
      orderNumber,
      whatsAppUrl: `https://wa.me/201012345678?text=${waText}`
    };
  }
}

// Global instance
window.sokhmStore = new SokhStore();
window.sokhStore = window.sokhmStore;
window.vioraStore = window.sokhmStore;
