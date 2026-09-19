// ─── Theme & Toast Helpers ────────────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('mm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => {
      const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('mm_theme', t);
    });
  });
})();

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(110%)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

// ─── DB Init ─────────────────────────────────────────────────────────────────
function initDB() {
  if (!localStorage.getItem('meal_users'))       localStorage.setItem('meal_users', JSON.stringify([]));
  if (!localStorage.getItem('meal_projects'))    localStorage.setItem('meal_projects', JSON.stringify([]));
  if (!localStorage.getItem('meal_enrollments')) localStorage.setItem('meal_enrollments', JSON.stringify([]));
  if (!localStorage.getItem('meal_records'))     localStorage.setItem('meal_records', JSON.stringify([]));
  if (!localStorage.getItem('meal_comments'))    localStorage.setItem('meal_comments', JSON.stringify([]));
}

function initAuthApp() {
  initDB();

  // Redirect if already logged in
  const cur = JSON.parse(localStorage.getItem('meal_currentUser'));
  if (cur) {
    window.location.href = cur.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
    return;
  }

  const loginDiv = document.getElementById('loginForm');
  const regDiv   = document.getElementById('registerForm');

  document.getElementById('showReg')?.addEventListener('click', e => {
    e.preventDefault();
    loginDiv.classList.add('hidden');
    regDiv.classList.remove('hidden');
  });
  document.getElementById('showLogin')?.addEventListener('click', e => {
    e.preventDefault();
    regDiv.classList.add('hidden');
    loginDiv.classList.remove('hidden');
  });

  // Register
  document.getElementById('regBtn')?.addEventListener('click', async () => {
    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const role     = document.getElementById('regRole').value;
    if (!name || !email || !password) return showToast('Please fill all fields', 'error');

    try {
      if (window.API) {
        const res = await window.API.post('auth.php', { action: 'register' }, { name, email, password, role });
        showToast(res.message || 'Registration successful! Please login.');
      } else {
        const users = JSON.parse(localStorage.getItem('meal_users'));
        if (users.find(u => u.email === email)) return showToast('Email already registered!', 'error');
        const newUser = { id: Date.now().toString(), name, email, password, role };
        users.push(newUser);
        localStorage.setItem('meal_users', JSON.stringify(users));
        showToast('Registration successful! Please login.');
      }
      document.getElementById('showLogin').click();
    } catch (err) {
      showToast(err.message || 'Registration failed!', 'error');
    }
  });

  // Login
  document.getElementById('loginBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return showToast('Please fill all fields', 'error');

    try {
      if (window.API) {
        const res = await window.API.post('auth.php', { action: 'login' }, { email, password });
        localStorage.setItem('meal_currentUser', JSON.stringify(res.user));
        showToast('Login successful!');
        setTimeout(() => {
          window.location.href = res.user.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
        }, 500);
      } else {
        const users = JSON.parse(localStorage.getItem('meal_users'));
        const user  = users.find(u => u.email === email && u.password === password);
        if (!user) return showToast('Invalid email or password', 'error');
        localStorage.setItem('meal_currentUser', JSON.stringify(user));
        showToast('Login successful!');
        setTimeout(() => {
          window.location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
        }, 500);
      }
    } catch (err) {
      showToast(err.message || 'Invalid email or password', 'error');
    }
  });

  // Allow Enter key to submit
  ['loginEmail','loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });
  });
  ['regName','regEmail','regPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('regBtn').click(); });
  });

  // Restore logic for login page
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreFile = document.getElementById('restoreFile');
  if(restoreBtn && restoreFile) {
    restoreBtn.addEventListener('click', () => restoreFile.click());
    restoreFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (window.API) {
            await window.API.post('backup.php', { action: 'restore' }, data);
          }
          if (data.meal_users) localStorage.setItem('meal_users', JSON.stringify(data.meal_users));
          if (data.meal_projects) localStorage.setItem('meal_projects', JSON.stringify(data.meal_projects));
          if (data.meal_enrollments) localStorage.setItem('meal_enrollments', JSON.stringify(data.meal_enrollments));
          if (data.meal_records) localStorage.setItem('meal_records', JSON.stringify(data.meal_records));
          if (data.meal_comments) localStorage.setItem('meal_comments', JSON.stringify(data.meal_comments));
          showToast('Data restored successfully!');
          setTimeout(() => window.location.reload(), 1500);
        } catch(err) {
          showToast('Invalid backup file!', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
}

// Run immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthApp);
} else {
  initAuthApp();
}
window.addEventListener('apiDataLoaded', initAuthApp);
