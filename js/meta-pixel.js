/**
 * ✦ SOKHM ATELIER — Meta Pixel Engine
 * Dynamically binds and executes Meta / Facebook Pixel events based on CMS settings.
 * Supports standard e-commerce events:
 * - PageView
 * - ViewContent
 * - AddToCart
 * - InitiateCheckout
 * - Purchase
 */
(function() {
  let isInitialized = false;
  let activePixelId = null;

  function getPixelConfig() {
    try {
      const content = (window.sokhmContent && window.sokhmContent.getAll) ? window.sokhmContent.getAll() : null;
      if (content && content.metaPixel) {
        return content.metaPixel;
      }
      // Check cached localStorage as fallback
      const cached = localStorage.getItem('sokhm_site_content_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.metaPixel) return parsed.metaPixel;
      }
    } catch (_) {}
    return {
      pixelId: '',
      enabled: false,
      trackPageView: true,
      trackViewContent: true,
      trackAddToCart: true,
      trackInitiateCheckout: true,
      trackPurchase: true
    };
  }

  function initPixel(pixelId) {
    if (!pixelId) return;
    const cleanId = String(pixelId).trim().replace(/[^0-9]/g, '');
    if (!cleanId) return;

    if (isInitialized && activePixelId === cleanId) return;

    // Standard Meta Pixel base snippet
    if (!window.fbq) {
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    }

    try {
      window.fbq('init', cleanId);
      isInitialized = true;
      activePixelId = cleanId;

      const cfg = getPixelConfig();
      if (cfg.trackPageView !== false) {
        window.fbq('track', 'PageView');
      }

      console.log(`[SOKHM Pixel] ✓ Meta Pixel active (${cleanId})`);
      window.dispatchEvent(new CustomEvent('sokhm:pixel-ready', { detail: { pixelId: cleanId } }));
    } catch (err) {
      console.warn('[SOKHM Pixel] Error initializing Meta Pixel:', err);
    }
  }

  function trackEvent(eventName, params = {}) {
    const cfg = getPixelConfig();
    if (!cfg || !cfg.enabled) return;

    // Check event-level toggle
    if (eventName === 'PageView' && cfg.trackPageView === false) return;
    if (eventName === 'ViewContent' && cfg.trackViewContent === false) return;
    if (eventName === 'AddToCart' && cfg.trackAddToCart === false) return;
    if (eventName === 'InitiateCheckout' && cfg.trackInitiateCheckout === false) return;
    if (eventName === 'Purchase' && cfg.trackPurchase === false) return;

    if (!isInitialized && cfg.pixelId) {
      initPixel(cfg.pixelId);
    }

    if (window.fbq && typeof window.fbq === 'function') {
      try {
        window.fbq('track', eventName, params);
        console.log(`[SOKHM Pixel] ✦ Event tracked: ${eventName}`, params);
      } catch (err) {
        console.warn(`[SOKHM Pixel] Failed to track ${eventName}:`, err);
      }
    }
  }

  function syncFromCMS() {
    const cfg = getPixelConfig();
    if (cfg && cfg.enabled && cfg.pixelId) {
      initPixel(cfg.pixelId);
    }
  }

  window.sokhmPixel = {
    init: initPixel,
    track: trackEvent,
    trackPageView: () => trackEvent('PageView'),
    trackViewContent: (product) => {
      if (!product) return;
      const price = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
      trackEvent('ViewContent', {
        content_name: product.name || 'SOKHM Streetwear',
        content_category: product.category || 'Apparel',
        content_ids: [String(product.id || 'prod')],
        content_type: 'product',
        value: price,
        currency: 'EGP'
      });
    },
    trackAddToCart: (item, qty = 1) => {
      if (!item) return;
      const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
      const quantity = item.quantity || qty || 1;
      const itemId = String(item.id || item.productId || 'item');
      trackEvent('AddToCart', {
        content_name: item.name || 'SOKHM Item',
        content_ids: [itemId],
        content_type: 'product',
        value: price * quantity,
        currency: 'EGP',
        contents: [{
          id: itemId,
          quantity: quantity,
          item_price: price
        }]
      });
    },
    trackInitiateCheckout: (cartItems, total) => {
      const items = Array.isArray(cartItems) ? cartItems : [];
      const numItems = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
      trackEvent('InitiateCheckout', {
        num_items: numItems || 1,
        value: total || 0,
        currency: 'EGP',
        content_ids: items.map(i => String(i.id || i.productId || 'item'))
      });
    },
    trackPurchase: (order) => {
      if (!order) return;
      const items = Array.isArray(order.items) ? order.items : [];
      const total = order.totalPrice || order.total || 0;
      trackEvent('Purchase', {
        content_ids: items.map(i => String(i.id || i.productId || 'item')),
        content_type: 'product',
        value: total,
        currency: 'EGP',
        num_items: items.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1,
        order_id: String(order.id || order.orderId || '')
      });
    },
    testEvent: (customData = {}) => {
      const cfg = getPixelConfig();
      if (!isInitialized && cfg.pixelId) {
        initPixel(cfg.pixelId);
      }
      if (window.fbq && typeof window.fbq === 'function') {
        const payload = Object.assign({
          test: true,
          store: 'SOKHM ATELIER',
          timestamp: new Date().toISOString()
        }, customData);
        window.fbq('trackCustom', 'SOKHM_Test_Event', payload);
        console.log('[SOKHM Pixel] ✦ Test event sent:', payload);
        return true;
      }
      return false;
    },
    getStatus: () => ({
      initialized: isInitialized,
      pixelId: activePixelId,
      enabled: Boolean(getPixelConfig().enabled)
    })
  };

  // Sync when content loads or updates
  window.addEventListener('sokhm:content-updated', syncFromCMS);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromCMS);
  } else {
    syncFromCMS();
  }
})();
