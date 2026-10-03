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

  // If already logged in, check session and redirect
  const existingToken = localStorage.getItem('sokhm_admin_token');
  if (existingToken) {
    fetch('/api/admin/verify', {
      headers: { 'Authorization': 'Bearer ' + existingToken }
    })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        window.location.href = '/admin-sokhm/';
      }
    })
    .catch(() => {});
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

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = userInput.value.trim();
      const password = passInput.value.trim();

      if (!username || !password) return;

      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');

      submitBtn.disabled = true;
      submitBtnText.textContent = 'جاري التحقق من الهوية...';

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        }

        // Store token in localStorage and cookie
        localStorage.setItem('sokhm_admin_token', data.token);
        localStorage.setItem('sokhm_admin_user', data.user.username);
        document.cookie = 'sokhm_admin_token=' + data.token + '; path=/; max-age=604800; SameSite=Lax';

        successAlert.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = '/admin-sokhm/';
        }, 600);

      } catch (err) {
        errorText.textContent = err.message || 'فشل تسجيل الدخول';
        errorAlert.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtnText.textContent = 'دخول إلى لوحة التحكم';
      }
    });
  }
})();
