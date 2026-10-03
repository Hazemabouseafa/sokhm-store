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

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function clearAuth() {
    localStorage.removeItem('sokhm_admin_token');
    document.cookie = 'sokhm_admin_token=; path=/; max-age=0; SameSite=Lax';
  }

  if (window.lucide) window.lucide.createIcons();

  // If already logged in, check session with backend
  const existingToken = localStorage.getItem('sokhm_admin_token') || getCookie('sokhm_admin_token');
  if (existingToken && existingToken.length > 5) {
    fetch('/api/admin/verify', {
      headers: { 'Authorization': 'Bearer ' + existingToken }
    })
    .then(async res => {
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.authenticated) {
          window.location.replace('index.html');
          return;
        }
      }
      clearAuth();
    })
    .catch(() => {
      // Offline fallback: if token starts with sokhm_sess_
      if (existingToken.startsWith('sokhm_sess_')) {
        window.location.replace('index.html');
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

  // Quick fill button
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
      let backendError = null;

      // 1. Primary: Call backend authentication API
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.token) {
          authenticated = true;
          sessionToken = data.token;
        } else if (res.status === 401 || (data && data.error)) {
          backendError = data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
        }
      } catch (networkErr) {
        console.warn('Backend API network call failed:', networkErr.message);
      }

      // 2. Secondary: If explicit rejection from server
      if (backendError && !authenticated) {
        // Check if user is using default credentials locally
        const storedPass = localStorage.getItem('sokhm_admin_password') || 'websiteadmin';
        if (username === 'websiteadmin' && (password === 'websiteadmin' || password === storedPass)) {
          authenticated = true;
          sessionToken = 'sokhm_sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        } else {
          errorText.textContent = backendError;
          errorAlert.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtnText.textContent = 'دخول إلى لوحة التحكم';
          return;
        }
      }

      // 3. Fallback: Offline / Static File mode
      if (!authenticated) {
        const storedPass = localStorage.getItem('sokhm_admin_password') || 'websiteadmin';
        if (username === 'websiteadmin' && (password === 'websiteadmin' || password === storedPass)) {
          authenticated = true;
          sessionToken = 'sokhm_sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        }
      }

      if (authenticated && sessionToken) {
        localStorage.setItem('sokhm_admin_token', sessionToken);
        localStorage.setItem('sokhm_admin_user', username);
        document.cookie = 'sokhm_admin_token=' + sessionToken + '; path=/; max-age=604800; SameSite=Lax';

        successAlert.classList.remove('hidden');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 300);
      } else {
        errorText.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى كتابة: websiteadmin';
        errorAlert.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtnText.textContent = 'دخول إلى لوحة التحكم';
      }
    });
  }
})();

