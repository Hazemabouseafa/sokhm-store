/**
 * SOKHM CMS Content Manager
 * Loads, caches, and binds dynamic text content across the website.
 */
(function() {
  const STORAGE_KEY = 'sokhm_site_content_v1';
  let siteContent = null;

  function getNested(obj, path, fallback = '') {
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
    const elements = document.querySelectorAll('[data-cms]');
    elements.forEach(el => {
      const key = el.getAttribute('data-cms');
      const val = getNested(siteContent, key);
      if (val !== undefined && val !== null) {
        // If element has icon inside or children we only replace text node or content
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = val;
        } else {
          el.textContent = val;
        }
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
    save: saveContent
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
