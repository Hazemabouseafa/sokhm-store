# ? SOKHM — Dark Noir Streetwear E-Commerce Storefront

A modern, high-fashion Dark Noir streetwear e-commerce storefront inspired by avant-garde contemporary editorial streetwear and engineered for high-performance browsing and seamless shopping.

---

## ? Features & Highlights

- **Aesthetic**: Dark Noir palette (#070707, #0E0E0E, #1A1A1A) with metallic silver 4-pointed star emblems (?) and ultra-clean typography.
- **Dedicated Product Detail Pages (product.html?id=...)**:
  - Independent route for every garment in the collection (SIGNATURE, ESSENTIAL, COMBAT, CORE).
  - Interactive multi-angle studio gallery (front, back on hanger, macro fabric weave, editorial model).
  - Live colorway swatches with real-time image swapping.
  - Sizing selector (XS to XXL) and modal Size Guide chart.
  - Dynamic quantity stepper and integrated Add-to-Bag CTA.
  - Technical garment accordions (Fit, 500 GSM Egyptian Cotton Fabric & Care, Logistics).
- **Studio-Grade 2K/2.5K Photography**:
  - Zero noise, razor-sharp commercial lookbook assets.
  - Calibrated 3:4 portrait aspect ratios preventing artificial over-zooming.
  - High-DPI contrast optimization for Retina & mobile displays.
- **Egyptian Pound (EGP) Currency**:
  - Direct local pricing (1,850 EGP base luxury price point).
  - Dynamic cart subtotal calculations and free courier delivery over 2,500 EGP.
- **Slide-Out Shopping Bag Drawer**:
  - Shared cart state synchronized via localStorage across all pages.
  - Real-time quantity adjustments, badge counters, and checkout integration.

---

## ? Getting Started

### Run Locally:
`ash
node server.js
`

### Preview URLs:
- **Homepage**: [http://localhost:3000](http://localhost:3000)
- **Signature Hoodie Detail**: [http://localhost:3000/product.html?id=sokhm-noir-01](http://localhost:3000/product.html?id=sokhm-noir-01)
- **Admin Console**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## ? Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (CDN), Custom Dark Noir CSS Tokens.
- **Icons**: Lucide Icons.
- **Server**: Lightweight zero-dependency Node.js HTTP static server (server.js).
