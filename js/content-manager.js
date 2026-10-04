/**
 * SOKHM CMS Content Manager
 * Loads, caches, and binds dynamic text content across the website.
 */
(function() {
  const STORAGE_KEY = 'sokhm_site_content_v1';
  let siteContent = null;

  function getNested(obj, path, fallback = null) {
    if (!obj || !path) return fallback;
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr && Object.prototype.hasOwnProperty.call(curr, p)) {
        curr = curr[p];
      } else {
        return fallback;
      }
    }
    return curr !== undefined && curr !== null ? curr : fallback;
  }

  function setNested(obj, path, value) {
    const parts = path.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') {
        curr[p] = {};
      }
      curr = curr[p];
    }
    curr[parts[parts.length - 1]] = value;
  }

  async function loadContent() {
    // 1. Try local storage cache for instant paint
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        siteContent = JSON.parse(cached);
        applyToDOM();
      }
    } catch (e) {}

    // 2. Fetch fresh from server
    try {
      const res = await fetch('/api/site-content');
      if (res.ok) {
        siteContent = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(siteContent));
        applyToDOM();
        window.dispatchEvent(new CustomEvent('sokhm:content-updated', { detail: siteContent }));
      }
    } catch (e) {
      // Fallback to static JSON file if API not available
      try {
        const fileRes = await fetch('data/site-content.json');
        if (fileRes.ok) {
          siteContent = await fileRes.json();
          applyToDOM();
        }
      } catch (err) {}
    }
    return siteContent;
  }

  function applyToDOM() {
    if (!siteContent) return;
    const visibility = siteContent.visibility || {};

    // 1. Apply text content and visibility to [data-cms] elements
    const elements = document.querySelectorAll('[data-cms]');
    elements.forEach(el => {
      const key = el.getAttribute('data-cms');
      const val = getNested(siteContent, key, null);

      // Check visibility flag (explicitly false to hide)
      const isVisible = visibility[key] !== false;
      if (!isVisible) {
        el.style.display = 'none';
        el.setAttribute('data-cms-hidden', 'true');
      } else {
        el.style.display = '';
        el.removeAttribute('data-cms-hidden');
      }

      // Only overwrite DOM if there is actual non-empty text from CMS
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // 2. Apply visibility to container elements [data-cms-vis]
    const visContainers = document.querySelectorAll('[data-cms-vis]');
    visContainers.forEach(container => {
      const visKey = container.getAttribute('data-cms-vis');
      const isVisible = visibility[visKey] !== false;
      if (!isVisible) {
        container.style.display = 'none';
        container.setAttribute('data-cms-hidden', 'true');
      } else {
        container.style.display = '';
        container.removeAttribute('data-cms-hidden');
      }
    });
  }

  async function saveContent(updatedContent) {
    siteContent = updatedContent;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(siteContent));
    applyToDOM();
    window.dispatchEvent(new CustomEvent('sokhm:content-updated', { detail: siteContent }));

    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteContent)
      });
      return await res.json();
    } catch (err) {
      console.warn('Saved to localStorage only:', err);
      return { success: true, localOnly: true };
    }
  }

  // Export to window
  window.sokhmContent = {
    load: loadContent,
    get: (path, fallback) => getNested(siteContent, path, fallback),
    set: (path, val) => setNested(siteContent, path, val),
    getAll: () => siteContent,
    applyToDOM: applyToDOM,
    save: saveContent,
    isVisible: (key) => {
      if (!siteContent || !siteContent.visibility) return true;
      return siteContent.visibility[key] !== false;
    },
    getCheckout: () => (siteContent && siteContent.checkout) || {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
