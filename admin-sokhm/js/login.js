/**
 * ✦ SOKHM ATELIER - Admin Login Controller
 */
(function() {
  const form = document.getElementById('adminLoginForm');
  const userInput = document.getElementById('usernameInput');
  const passInput = document.getElementById('passwordInput');
  const errorAlert = document.getElementById('loginErrorAlert');
  const errorText = document.getElementById('loginErrorText');
  const successAlert = document.getElementById('loginSuccessAlert');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const submitBtnText = document.getElementById('loginSubmitBtnText');
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const togglePassIcon = document.getElementById('togglePasswordIcon');

  if (window.lucide) window.lucide.createIcons();

  // If already logged in, check session and redirect to index.html
  const existingToken = localStorage.getItem('sokhm_admin_token');
  if (existingToken) {
    fetch('/api/admin/verify', {
      headers: { 'Authorization': 'Bearer ' + existingToken }
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Not ok');
    })
    .then(data => {
      if (data && data.authenticated) {
        window.location.href = 'index.html';
      }
    })
    .catch(() => {
      if (existingToken && existingToken.length > 5) {
        window.location.href = 'index.html';
      }
    });
  }

  // Toggle password visibility
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassIcon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Quick fill buttons
  const fillBtn = document.getElementById('fillCredentialsBtn');
  if (fillBtn && userInput && passInput) {
    fillBtn.addEventListener('click', () => {
      userInput.value = 'websiteadmin';
      const storedPass = localStorage.getItem('sokhm_admin_password') || 'websiteadmin';
      passInput.value = storedPass;
      userInput.focus();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (userInput.value || '').trim().toLowerCase();
      const password = (passInput.value || '').trim();

      if (!username || !password) return;

      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');

      submitBtn.disabled = true;
      submitBtnText.textContent = 'جاري التحقق من الهوية...';

      let authenticated = false;
      let sessionToken = null;

      // 1. First attempt: Call backend API if running
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            authenticated = true;
            sessionToken = data.token;
          }
        }
      } catch (networkErr) {
        console.warn('Backend API unavailable, using local authentication:', networkErr.message);
      }

      // 2. Fallback attempt: Local validation
      if (!authenticated) {
        const storedPass = localStorage.getItem('sokhm_admin_password') || 'websiteadmin';
        if (username === 'websiteadmin' && (password === storedPass || password === 'websiteadmin')) {
          authenticated = true;
          sessionToken = 'sokhm_sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        }
      }

      if (authenticated && sessionToken) {
        localStorage.setItem('sokhm_admin_token', sessionToken);
        localStorage.setItem('sokhm_admin_user', 'websiteadmin');
        document.cookie = 'sokhm_admin_token=' + sessionToken + '; path=/; max-age=604800; SameSite=Lax';

        successAlert.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 400);
      } else {
        errorText.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى كتابة: websiteadmin';
        errorAlert.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtnText.textContent = 'دخول إلى لوحة التحكم';
      }
    });
  }
})();
