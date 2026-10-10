/**
 * ✦ SOKHM ATELIER - Checkout Flow & Order Processing Module
 * Handles customer checkout modal, phone/address validation, and SQLite order creation.
 */

(function() {
  const GOVERNORATES = [
    'القاهرة (Cairo)',
    'الجيزة (Giza)',
    'الإسكندرية (Alexandria)',
    'القليوبية (Qalyubia)',
    'الشرقية (Sharqia)',
    'الدقهلية (Dakahlia)',
    'الغربية (Gharbia)',
    'المنوفية (Monufia)',
    'دمياط (Damietta)',
    'بورسعيد (Port Said)',
    'الإسماعيلية (Ismailia)',
    'السويس (Suez)',
    'كفر الشيخ (Kafr El Sheikh)',
    'البحيرة (Beheira)',
    'الفيوم (Fayoum)',
    'بني سويف (Beni Suef)',
    'المنيا (Minya)',
    'أسيوط (Asyut)',
    'سوهاج (Sohag)',
    'قنا (Qena)',
    'الأقصر (Luxor)',
    'أسوان (Aswan)',
    'البحر الأحمر (Red Sea)',
    'مطروح (Matrouh)',
    'الوادي الجديد (New Valley)',
    'شمال سيناء (North Sinai)',
    'جنوب سيناء (South Sinai)'
  ];

  let currentOrderItems = [];
  let modalInitialized = false;
  let appliedDiscount = null;

  function initCheckoutModal() {
    if (document.getElementById('checkoutModal')) {
      modalInitialized = true;
      return;
    }

    const modalHtml = `
      <dialog id="checkoutModal" class="bg-[#0B0B0B] text-white p-0 max-w-4xl w-[94%] border border-[#222] rounded-[20px] shadow-2xl overflow-hidden backdrop:bg-black/85 font-sans" dir="rtl">
        <!-- Top Bar -->
        <div class="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between bg-[#080808]">
          <div class="flex items-center gap-3">
            <svg viewBox="0 0 100 120" class="w-4 h-5 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M50 0 C50 36 68 54 100 60 C68 66 50 84 50 120 C50 84 32 66 0 60 C32 54 50 36 50 0 Z M50 46 L58 60 L50 74 L42 60 Z" />
            </svg>
            <div>
              <h3 class="font-bold text-sm text-white flex items-center gap-2">
                <span id="coModalHeaderTitle" data-cms="checkout.title">✦ SOKHM ATELIER // إتمام الشراء</span>
                <span id="coModalHeaderBadge" data-cms="checkout.codTitle" data-cms-vis="checkout.codTitle" class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161616] text-neutral-400 border border-[#262626]">الدفع عند الاستلام</span>
              </h3>
            </div>
          </div>
          <button id="closeCheckoutModalBtn" type="button" class="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1A1A1A] transition-colors cursor-pointer" aria-label="إغلاق">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Checkout Content / Form -->
        <div id="checkoutMainView" class="p-6 max-h-[85vh] overflow-y-auto">
          <form id="checkoutOrderForm" class="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
            
            <!-- Right Column: Customer Details (7 Cols) -->
            <div class="lg:col-span-7 space-y-4">
              <div class="pb-2 border-b border-[#1A1A1A]">
                <h4 class="font-bold text-sm text-white flex items-center gap-2">
                  <i data-lucide="user" class="w-4 h-4 text-neutral-300"></i>
                  <span id="coFormTitle" data-cms="checkout.title">بيانات العميل وعنوان الشحن</span>
                </h4>
                <p id="coFormSubtitle" data-cms="checkout.subtitle" class="text-[11px] text-neutral-400 mt-0.5">يرجى كتابة البيانات بدقة لضمان سرعة تواصل مندوب الشحن وتوصيل الطلب.</p>
              </div>

              <!-- Full Name -->
              <div>
                <label class="block text-[11px] font-bold text-neutral-300 mb-1.5">الاسم بالكامل *</label>
                <input 
                  type="text" 
                  id="coCustomerName" 
                  required 
                  placeholder="مثال: أحمد حسن الشريف" 
                  class="w-full bg-[#070707] border border-[#222] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white text-xs transition-colors"
                >
              </div>

              <!-- Phone Number -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-[11px] font-bold text-neutral-300">رقم الهاتف المحمول *</label>
                  <span class="text-[10px] text-neutral-500 font-mono">010 / 011 / 012 / 015</span>
                </div>
                <div class="relative">
                  <input 
                    type="tel" 
                    id="coCustomerPhone" 
                    required 
                    placeholder="مثال: 01012345678" 
                    pattern="^01[0125][0-9]{8}$"
                    class="w-full bg-[#070707] border border-[#222] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white text-xs font-mono transition-colors"
                  >
                  <i data-lucide="phone" class="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2"></i>
                </div>
              </div>

              <!-- Governorate -->
              <div>
                <label class="block text-[11px] font-bold text-neutral-300 mb-1.5">المحافظة *</label>
                <select 
                  id="coCustomerCity" 
                  required 
                  class="w-full bg-[#070707] border border-[#222] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-white text-xs cursor-pointer transition-colors"
                >
                  ${GOVERNORATES.map(gov => `<option value="${gov.split(' ')[0]}">${gov}</option>`).join('')}
                </select>
              </div>

              <!-- Detailed Address -->
              <div>
                <label class="block text-[11px] font-bold text-neutral-300 mb-1.5">العنوان بالتفصيل *</label>
                <textarea 
                  id="coCustomerAddress" 
                  required 
                  rows="2" 
                  placeholder="المنطقة أو الحي، اسم الشارع، رقم العمارة، رقم الشقة أو الطابق، وأقرب علامة مميزة..." 
                  class="w-full bg-[#070707] border border-[#222] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white text-xs leading-relaxed transition-colors"
                ></textarea>
              </div>

              <!-- Delivery Notes -->
              <div id="coNotesContainer" data-cms-vis="checkout.notesContainer">
                <label class="block text-[11px] font-bold text-neutral-300 mb-1.5">ملاحظات التوصيل (اختياري)</label>
                <input 
                  type="text" 
                  id="coCustomerNotes" 
                  placeholder="مثال: يرجى التوصيل بعد الساعة 4 مساءً أو التواصل واتساب..." 
                  class="w-full bg-[#070707] border border-[#222] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-white text-xs transition-colors"
                >
              </div>

              <!-- Payment Method Box -->
              <div id="coCodBox" data-cms-vis="checkout.codBox" class="p-3.5 rounded-xl bg-[#080808] border border-[#222] flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                    <i data-lucide="banknote" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h5 id="coCodTitle" data-cms="checkout.codTitle" class="font-bold text-xs text-white">الدفع نقدياً عند الاستلام (COD)</h5>
                    <p id="coCodSubtitle" data-cms="checkout.codSubtitle" class="text-[10px] text-neutral-400 mt-0.5">معاينة القطع قبل الدفع متاحة مع مندوب التوصيل.</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60">مفعل</span>
              </div>
            </div>

            <!-- Left Column: Order Summary & Review (5 Cols) -->
            <div class="lg:col-span-5 bg-[#080808] p-5 rounded-2xl border border-[#1A1A1A] flex flex-col justify-between space-y-4">
              <div>
                <div class="pb-3 border-b border-[#1A1A1A] flex items-center justify-between">
                  <h4 class="font-bold text-xs text-white flex items-center gap-2">
                    <i data-lucide="shopping-bag" class="w-4 h-4 text-neutral-300"></i>
                    <span>ملخص قطع الشحنة</span>
                  </h4>
                  <span id="coItemsCountBadge" class="text-[11px] text-neutral-400 font-mono">1 قطع</span>
                </div>

                <!-- Items Preview List -->
                <div id="coItemsList" class="divide-y divide-[#141414] max-h-48 overflow-y-auto py-2 space-y-2">
                  <!-- Dynamically populated -->
                </div>

                <!-- Promo / Discount Code Box -->
                <div class="py-2.5 border-t border-[#181818] my-1">
                  <label class="block text-[10px] font-bold text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <i data-lucide="tag" class="w-3 h-3 text-amber-400"></i>
                    <span>كود الخصم (Promo Code)</span>
                  </label>
                  <div class="flex items-center gap-2">
                    <input 
                      type="text" 
                      id="coDiscountInput" 
                      placeholder="أدخل الكود (مثال: SOKHM10)" 
                      class="flex-1 bg-[#070707] border border-[#222] rounded-xl px-3 py-2 text-white placeholder-neutral-600 focus:outline-none focus:border-white text-xs font-mono uppercase transition-colors"
                    >
                    <button 
                      type="button" 
                      id="coApplyDiscountBtn" 
                      class="px-4 py-2 rounded-xl bg-[#181818] hover:bg-white hover:text-black text-white border border-[#2A2A2A] hover:border-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm"
                    >
                      تطبيق
                    </button>
                  </div>
                  <div id="coDiscountMsg" class="hidden text-[10px] mt-1.5 font-medium"></div>
                </div>

                <!-- Financial Calculation -->
                <div class="pt-3 border-t border-[#1A1A1A] space-y-2 text-xs">
                  <div class="flex items-center justify-between text-neutral-400">
                    <span>المجموع الفرعي:</span>
                    <span id="coSubtotal" class="font-bold text-white font-mono">0 ج.م</span>
                  </div>

                  <!-- Discount Line (Hidden by default, shown when coupon applied) -->
                  <div id="coDiscountRow" class="hidden flex items-center justify-between text-emerald-400">
                    <span class="flex items-center gap-1.5">
                      <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                      <span>خصم الكود (<span id="coAppliedCodeLabel" class="font-mono font-bold"></span>):</span>
                    </span>
                    <div class="flex items-center gap-2 font-mono font-bold">
                      <span id="coDiscountVal">-0 ج.م</span>
                      <button type="button" id="coRemoveDiscountBtn" class="text-neutral-500 hover:text-red-400 text-[10px] underline cursor-pointer">إلغاء</button>
                    </div>
                  </div>

                  <div class="flex items-center justify-between text-neutral-400">
                    <span id="coShippingLabel">مصاريف الشحن:</span>
                    <span id="coShipping" class="font-bold text-emerald-400 font-mono">مجاناً</span>
                  </div>
                  <p id="coShippingRuleNotice" data-cms="checkout.shippingRuleText" class="text-[10px] text-neutral-400 text-left"></p>
                  <div class="pt-2 border-t border-[#1C1C1C] flex items-center justify-between text-sm font-bold text-white">
                    <span>الإجمالي المستحق:</span>
                    <span id="coTotal" class="text-base font-extrabold font-mono">0 ج.م</span>
                  </div>
                </div>
              </div>

              <!-- Trust Highlights -->
              <div id="coTrustHighlightsContainer" data-cms-vis="checkout.trustHighlightsContainer" class="space-y-1.5 pt-1 text-[10px] text-neutral-400">
                <div id="coTrustItem1" data-cms-vis="checkout.trustHighlight1" class="flex items-center gap-1.5 text-neutral-300">
                  <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i>
                  <span id="coTrustHighlight1" data-cms="checkout.trustHighlights.0">500 GSM قطن مصري فاخر فائق الكثافة</span>
                </div>
                <div id="coTrustItem2" data-cms-vis="checkout.trustHighlight2" class="flex items-center gap-1.5 text-neutral-300">
                  <i data-lucide="truck" class="w-3.5 h-3.5 text-emerald-400"></i>
                  <span id="coTrustHighlight2" data-cms="checkout.trustHighlights.1">شحن سريع لجميع المحافظات خلال 24-48 ساعة</span>
                </div>
                <div id="coTrustItem3" data-cms-vis="checkout.trustHighlight3" class="flex items-center gap-1.5 text-neutral-300">
                  <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-emerald-400"></i>
                  <span id="coTrustHighlight3" data-cms="checkout.trustHighlights.2">سياسة استبدال واسترجاع سلسة لمدة 30 يوم</span>
                </div>
              </div>

              <!-- Submit Button -->
              <button 
                type="submit" 
                id="coSubmitBtn" 
                class="w-full py-4 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
              >
                <i data-lucide="check" class="w-4 h-4"></i>
                <span id="coSubmitBtnText" data-cms="checkout.submitButtonText">تأكيد الطلب الآن</span>
              </button>
            </div>

          </form>
        </div>

        <!-- Success Screen View (Hidden by default) -->
        <div id="checkoutSuccessView" class="hidden p-8 sm:p-12 text-center space-y-6">
          <div class="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-800 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
            <i data-lucide="check" class="w-8 h-8"></i>
          </div>

          <div class="space-y-1">
            <span class="text-[11px] font-mono tracking-widest text-emerald-400 uppercase font-bold">ORDER CONFIRMED</span>
            <h3 id="coSuccessTitle" data-cms="checkout.successTitle" class="text-2xl font-extrabold text-white">تم استلام وتأكيد طلبك بنجاح!</h3>
            <p id="coSuccessSubtitle" data-cms="checkout.successSubtitle" class="text-xs text-neutral-400 max-w-md mx-auto">
              شكراً لاختيارك <strong class="text-white">✦ SOKHM ATELIER</strong>. تم تسجيل طلبك في نظامنا وسيقوم مندوب الشحن بالتواصل معك هاتفياً قبل التوصيل.
            </p>
          </div>

          <!-- Order Summary Card -->
          <div class="max-w-md mx-auto p-4 rounded-xl bg-[#080808] border border-[#222] text-xs space-y-2 text-right">
            <div class="flex items-center justify-between pb-2 border-b border-[#1A1A1A]">
              <span class="text-neutral-400">رقم الأوردر:</span>
              <span id="coSuccessOrderId" class="font-mono font-extrabold text-white text-sm">#SKM-00000</span>
            </div>
            <div class="flex items-center justify-between text-neutral-400">
              <span>تاريخ وتوقيت الطلب:</span>
              <span id="coSuccessDate" class="text-white text-[11px] font-medium">-</span>
            </div>
            <div class="flex items-center justify-between text-neutral-400">
              <span>اسم العميل:</span>
              <span id="coSuccessName" class="font-bold text-white">-</span>
            </div>
            <div class="flex items-center justify-between text-neutral-400">
              <span>رقم الهاتف:</span>
              <span id="coSuccessPhone" class="font-mono text-white">-</span>
            </div>
            <div class="flex items-center justify-between text-neutral-400">
              <span>عنوان التوصيل:</span>
              <span id="coSuccessAddress" class="text-white truncate max-w-[240px]">-</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-[#1A1A1A]">
              <span class="font-bold text-white">المبلغ المطلوب عند الاستلام:</span>
              <span id="coSuccessTotal" class="font-mono font-extrabold text-emerald-400 text-sm">0 ج.م</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button 
              id="coContinueShoppingBtn" 
              type="button" 
              class="w-full sm:w-auto px-8 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              متابعة التسوق
            </button>

            <a 
              id="coWhatsappBtn" 
              href="#" 
              target="_blank" 
              class="w-full sm:w-auto px-6 py-3 rounded-full border border-[#2A2A2A] hover:border-emerald-500 bg-[#111] hover:bg-emerald-950/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              <span id="coWhatsappBtnText" data-cms="checkout.whatsappButtonText">متابعة الطلب عبر WhatsApp</span>
            </a>
          </div>
        </div>

      </dialog>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modalInitialized = true;
    setupCheckoutEvents();
    if (window.lucide) window.lucide.createIcons();
  }

  function setupCheckoutEvents() {
    const modal = document.getElementById('checkoutModal');
    const closeBtn = document.getElementById('closeCheckoutModalBtn');
    const form = document.getElementById('checkoutOrderForm');
    const continueBtn = document.getElementById('coContinueShoppingBtn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.close());
    }

    if (continueBtn && modal) {
      continueBtn.addEventListener('click', () => {
        modal.close();
        if (window.location.pathname.includes('product.html')) {
          window.location.href = 'index.html#collection';
        } else {
          // If on index.html, scroll smoothly to collection
          const colSec = document.getElementById('collection');
          if (colSec) {
            colSec.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // Dismiss when clicking outside modal
    if (modal) {
      modal.addEventListener('click', (e) => {
        const rect = modal.getBoundingClientRect();
        const isInModal = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInModal) {
          modal.close();
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitCheckoutOrder();
      });
    }

    // Coupon discount application
    const applyDiscountBtn = document.getElementById('coApplyDiscountBtn');
    const discountInput = document.getElementById('coDiscountInput');
    const removeDiscountBtn = document.getElementById('coRemoveDiscountBtn');

    if (applyDiscountBtn && discountInput) {
      applyDiscountBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const code = discountInput.value.trim();
        const msgEl = document.getElementById('coDiscountMsg');
        if (!code) {
          if (msgEl) {
            msgEl.className = 'text-[10px] mt-1.5 font-bold text-red-400 block';
            msgEl.textContent = 'يرجى كتابة كود الخصم أولاً';
          }
          discountInput.focus();
          return;
        }

        let subtotal = 0;
        currentOrderItems.forEach(i => {
          const p = typeof i.price === 'number' ? i.price : parseFloat(i.price) || 0;
          subtotal += p * (i.quantity || 1);
        });

        applyDiscountBtn.disabled = true;
        applyDiscountBtn.innerHTML = '<span class="inline-block animate-spin mr-1">✦</span> تطبيق...';

        try {
          const res = await fetch('/api/discounts/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, subtotal })
          });
          const data = await res.json();
          if (res.ok && data.valid) {
            appliedDiscount = data;
            if (msgEl) {
              msgEl.className = 'text-[10px] mt-1.5 font-bold text-emerald-400 block';
              msgEl.textContent = `✓ تم تطبيق كود الخصم (${data.code}) بنجاح! وفّرت ${data.discountAmount.toLocaleString('en-US')} ج.م`;
            }
            renderOrderSummary();
          } else {
            if (msgEl) {
              msgEl.className = 'text-[10px] mt-1.5 font-bold text-red-400 block';
              msgEl.textContent = '✕ ' + (data.error || 'كود الخصم غير صحيح');
            }
          }
        } catch (err) {
          if (msgEl) {
            msgEl.className = 'text-[10px] mt-1.5 font-bold text-red-400 block';
            msgEl.textContent = '✕ تعذر التحقق من كود الخصم';
          }
        } finally {
          applyDiscountBtn.disabled = false;
          applyDiscountBtn.textContent = 'تطبيق';
          if (window.lucide) window.lucide.createIcons();
        }
      });

      discountInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyDiscountBtn.click();
        }
      });
    }

    if (removeDiscountBtn) {
      removeDiscountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        appliedDiscount = null;
        if (discountInput) discountInput.value = '';
        const msgEl = document.getElementById('coDiscountMsg');
        if (msgEl) {
          msgEl.className = 'hidden';
          msgEl.textContent = '';
        }
        renderOrderSummary();
      });
    }
  }

  function getCheckoutConfig() {
    if (window.sokhmContent && typeof window.sokhmContent.getCheckout === 'function') {
      return window.sokhmContent.getCheckout() || {};
    }
    return {};
  }

  function openCheckoutModal(items) {
    initCheckoutModal();
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    if (window.sokhmContent && typeof window.sokhmContent.applyToDOM === 'function') {
      window.sokhmContent.applyToDOM();
    }

    // Use passed items or read from localStorage cart
    if (Array.isArray(items) && items.length > 0) {
      currentOrderItems = items;
    } else {
      try {
        const stored = localStorage.getItem('sokhm_noir_cart_v1');
        currentOrderItems = stored ? JSON.parse(stored) : [];
      } catch (e) {
        currentOrderItems = [];
      }
    }

    if (currentOrderItems.length === 0) {
      alert('سلة المشتريات فارغة! يرجى اختيار قطعة ملابس أولاً.');
      return;
    }

    // Reset view
    const mainView = document.getElementById('checkoutMainView');
    const successView = document.getElementById('checkoutSuccessView');
    if (mainView) mainView.classList.remove('hidden');
    if (successView) successView.classList.add('hidden');

    renderOrderSummary();

    modal.showModal();

    // Meta Pixel InitiateCheckout event
    if (window.sokhmPixel && typeof window.sokhmPixel.trackInitiateCheckout === 'function') {
      const subtotal = currentOrderItems.reduce((acc, i) => acc + ((i.price || 0) * (i.quantity || 1)), 0);
      window.sokhmPixel.trackInitiateCheckout(currentOrderItems, subtotal);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function renderOrderSummary() {
    const listEl = document.getElementById('coItemsList');
    const badgeEl = document.getElementById('coItemsCountBadge');
    const subtotalEl = document.getElementById('coSubtotal');
    const shippingEl = document.getElementById('coShipping');
    const totalEl = document.getElementById('coTotal');
    const btnTextEl = document.getElementById('coSubmitBtnText');
    const shippingNoticeEl = document.getElementById('coShippingRuleNotice');
    const discountRow = document.getElementById('coDiscountRow');
    const appliedCodeLabel = document.getElementById('coAppliedCodeLabel');
    const discountVal = document.getElementById('coDiscountVal');

    if (!listEl) return;

    listEl.innerHTML = '';
    let subtotal = 0;
    let totalCount = 0;

    currentOrderItems.forEach(item => {
      const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
      const qty = item.quantity || 1;
      const itemTotal = price * qty;
      subtotal += itemTotal;
      totalCount += qty;

      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 py-1.5 text-xs';
      row.innerHTML = `
        <div class="w-10 h-12 rounded-lg bg-[#070707] border border-[#222] overflow-hidden flex-shrink-0">
          <img src="${item.image || 'assets/sokhm-card-1.jpg'}" alt="${item.name}" class="w-full h-full object-cover">
        </div>
        <div class="flex-grow min-w-0">
          <h5 class="font-bold text-white truncate text-[11px]">${item.name}</h5>
          <div class="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
            <span class="px-1.5 py-0.2 rounded bg-[#161616] text-white border border-[#222] font-mono">${item.size || 'M'}</span>
            ${item.color ? `<span class="px-1.5 py-0.2 rounded bg-[#161616] text-neutral-300 border border-[#222]">${item.color}</span>` : ''}
            <span>•</span>
            <span>الكمية: ${qty}</span>
          </div>
        </div>
        <div class="text-left font-mono font-bold text-white text-xs">
          ${itemTotal.toLocaleString('en-US')} <span class="text-[10px] text-neutral-400">ج.م</span>
        </div>
      `;
      listEl.appendChild(row);
    });

    const cfg = getCheckoutConfig();
    const threshold = typeof cfg.freeShippingThreshold === 'number' ? cfg.freeShippingThreshold : (parseFloat(cfg.freeShippingThreshold) || 2500);
    const standardFee = typeof cfg.standardShippingFee === 'number' ? cfg.standardShippingFee : (parseFloat(cfg.standardShippingFee) || 75);

    // Calculate discount if applied
    let discountAmount = 0;
    if (appliedDiscount) {
      const minReq = appliedDiscount.minOrderAmount || 0;
      if (subtotal >= minReq) {
        if (appliedDiscount.discountType === 'percentage') {
          discountAmount = Math.round((subtotal * appliedDiscount.discountValue) / 100);
        } else {
          discountAmount = Math.min(appliedDiscount.discountValue, subtotal);
        }
        if (discountRow) discountRow.classList.remove('hidden');
        if (appliedCodeLabel) appliedCodeLabel.textContent = appliedDiscount.code;
        if (discountVal) discountVal.textContent = `-${discountAmount.toLocaleString('en-US')} ج.م`;
      } else {
        discountAmount = 0;
        if (discountRow) discountRow.classList.add('hidden');
        const msgEl = document.getElementById('coDiscountMsg');
        if (msgEl) {
          msgEl.className = 'text-[10px] mt-1.5 font-bold text-amber-400 block';
          msgEl.textContent = `الحد الأدنى لتفعيل هذا الكود هو ${minReq.toLocaleString('en-US')} ج.م`;
        }
      }
    } else {
      if (discountRow) discountRow.classList.add('hidden');
    }

    // Shipping calculation
    const isFreeShipping = subtotal >= threshold;
    const shippingFee = isFreeShipping ? 0 : standardFee;
    const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

    if (badgeEl) badgeEl.textContent = `${totalCount} ${totalCount === 1 ? 'قطعة' : 'قطع'}`;
    if (subtotalEl) subtotalEl.textContent = `${subtotal.toLocaleString('en-US')} ج.م`;
    if (shippingEl) {
      shippingEl.textContent = isFreeShipping ? 'مجاناً' : `${shippingFee.toLocaleString('en-US')} ج.م`;
      shippingEl.className = isFreeShipping ? 'font-bold text-emerald-400 font-mono' : 'font-bold text-neutral-300 font-mono';
    }
    if (shippingNoticeEl) {
      if (cfg.shippingRuleText) {
        shippingNoticeEl.textContent = cfg.shippingRuleText;
      } else {
        shippingNoticeEl.textContent = `شحن سريع مجاني لجميع الطلبات بقيمة ${threshold.toLocaleString('en-US')} ج.م أو أكثر`;
      }
    }
    if (totalEl) totalEl.textContent = `${finalTotal.toLocaleString('en-US')} ج.م`;
    
    const baseBtnText = cfg.submitButtonText || 'تأكيد الطلب الآن';
    if (btnTextEl) btnTextEl.textContent = `${baseBtnText} — ${finalTotal.toLocaleString('en-US')} ج.م`;

    if (window.lucide) window.lucide.createIcons();
  }

  async function submitCheckoutOrder() {
    const nameInput = document.getElementById('coCustomerName');
    const phoneInput = document.getElementById('coCustomerPhone');
    const cityInput = document.getElementById('coCustomerCity');
    const addressInput = document.getElementById('coCustomerAddress');
    const notesInput = document.getElementById('coCustomerNotes');
    const submitBtn = document.getElementById('coSubmitBtn');

    const customerName = nameInput.value.trim();
    const customerPhone = phoneInput.value.trim();
    const customerCity = cityInput.value.trim();
    const customerAddress = addressInput.value.trim();
    const customerNotes = notesInput ? notesInput.value.trim() : '';

    if (!customerName || !customerPhone || !customerCity || !customerAddress) {
      alert('يرجى استيفاء جميع الحقول المطلوبة.');
      return;
    }

    // Phone validation for Egypt
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(customerPhone)) {
      alert('يرجى إدخال رقم هاتف محمول مصري صحيح (مثال: 01012345678)');
      phoneInput.focus();
      return;
    }

    const cfg = getCheckoutConfig();
    const threshold = typeof cfg.freeShippingThreshold === 'number' ? cfg.freeShippingThreshold : (parseFloat(cfg.freeShippingThreshold) || 2500);
    const standardFee = typeof cfg.standardShippingFee === 'number' ? cfg.standardShippingFee : (parseFloat(cfg.standardShippingFee) || 75);

    let subtotal = 0;
    currentOrderItems.forEach(i => {
      const p = typeof i.price === 'number' ? i.price : parseFloat(i.price) || 0;
      subtotal += p * (i.quantity || 1);
    });

    let discountAmount = 0;
    if (appliedDiscount && subtotal >= (appliedDiscount.minOrderAmount || 0)) {
      if (appliedDiscount.discountType === 'percentage') {
        discountAmount = Math.round((subtotal * appliedDiscount.discountValue) / 100);
      } else {
        discountAmount = Math.min(appliedDiscount.discountValue, subtotal);
      }
    }

    const shippingFee = subtotal >= threshold ? 0 : standardFee;
    const totalPrice = Math.max(0, subtotal - discountAmount + shippingFee);

    const payload = {
      customerName,
      customerPhone,
      customerCity,
      customerAddress,
      customerNotes,
      items: currentOrderItems,
      discountCode: appliedDiscount ? appliedDiscount.code : null,
      discount_code: appliedDiscount ? appliedDiscount.code : null,
      discountAmount,
      discount_amount: discountAmount,
      subtotalPrice: subtotal,
      subtotal_price: subtotal,
      totalPrice,
      status: 'pending'
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">✦</span> جاري تسجيل وتأكيد الطلب...';
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('فشل تسجيل الطلب في السيرفر');

      const data = await res.json();
      const createdOrder = data.order || payload;
      const orderId = createdOrder.id || ('SKM-' + Math.floor(10000 + Math.random() * 90000));

      // Clear local shopping cart
      localStorage.removeItem('sokhm_noir_cart_v1');
      window.dispatchEvent(new Event('sokhm:cart-cleared'));

      // Show Success Screen
      document.getElementById('checkoutMainView').classList.add('hidden');
      const successView = document.getElementById('checkoutSuccessView');
      successView.classList.remove('hidden');

      document.getElementById('coSuccessOrderId').textContent = '#' + orderId;
      
      const dateEl = document.getElementById('coSuccessDate');
      if (dateEl) {
        if (createdOrder.created_at_cairo) {
          dateEl.textContent = createdOrder.created_at_cairo + ' (توقيت القاهرة)';
        } else {
          try {
            const rawD = createdOrder.created_at || createdOrder.createdAt || new Date();
            let dStr = String(rawD).trim();
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dStr)) dStr = dStr.replace(' ', 'T') + 'Z';
            const cairoTime = new Date(dStr).toLocaleString('ar-EG-u-nu-latn', {
              timeZone: 'Africa/Cairo',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            dateEl.textContent = cairoTime + ' (توقيت القاهرة)';
          } catch (e) {
            dateEl.textContent = new Date().toLocaleString() + ' (توقيت القاهرة)';
          }
        }
      }

      document.getElementById('coSuccessName').textContent = customerName;
      document.getElementById('coSuccessPhone').textContent = customerPhone;
      document.getElementById('coSuccessAddress').textContent = `${customerCity} — ${customerAddress}`;
      document.getElementById('coSuccessTotal').textContent = `${totalPrice.toLocaleString('en-US')} ج.م`;

      // WhatsApp Button URL
      let suppPhone = null;
      try {
        const fullContent = (window.sokhmContent && window.sokhmContent.getContent) ? window.sokhmContent.getContent() : null;
        if (fullContent && fullContent.support && fullContent.support.whatsappPhone) suppPhone = fullContent.support.whatsappPhone;
      } catch (_) {}
      const rawWaPhone = (suppPhone || cfg.whatsappPhone || '01098765432').replace(/[^0-9]/g, '');
      const intlWaPhone = rawWaPhone.startsWith('0') ? ('2' + rawWaPhone) : (rawWaPhone.startsWith('2') ? rawWaPhone : ('20' + rawWaPhone));
      const waMsg = encodeURIComponent(
        `مرحباً SOKHM ATELIER، أود متابعة طلبي رقم: #${orderId}\nالاسم: ${customerName}\nالإجمالي: ${totalPrice.toLocaleString('en-US')} ج.م`
      );
      const waBtn = document.getElementById('coWhatsappBtn');
      if (waBtn) {
        waBtn.href = `https://wa.me/${intlWaPhone}?text=${waMsg}`;
      }

      // Meta Pixel Purchase Event
      if (window.sokhmPixel && typeof window.sokhmPixel.trackPurchase === 'function') {
        window.sokhmPixel.trackPurchase({
          id: orderId,
          orderId: orderId,
          items: currentOrderItems,
          totalPrice: totalPrice,
          total: totalPrice
        });
      }

      if (window.lucide) window.lucide.createIcons();

    } catch (err) {
      console.error('Checkout error:', err);
      alert('حدث خطأ أثناء حفظ الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>تأكيد الطلب الآن</span>';
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // Export to window
  window.openCheckoutModal = openCheckoutModal;

  document.addEventListener('DOMContentLoaded', () => {
    initCheckoutModal();
  });
})();
