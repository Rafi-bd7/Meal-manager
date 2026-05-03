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
  if(!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(110%)'; setTimeout(() => t.remove(), 300); }, 3000);
}

// Global toggle for HTML onclick
window.toggleMeal = function(type) {
  const chk = document.getElementById(type === 'breakfast' ? 'chkBreakfast' : type === 'lunch' ? 'chkLunch' : 'chkDinner');
  const card = document.getElementById(type === 'breakfast' ? 'cardBreakfast' : type === 'lunch' ? 'cardLunch' : 'cardDinner');
  const isActive = card.classList.contains('active');
  
  if (isActive) {
    card.classList.remove('active');
  } else {
    card.classList.add('active');
  }
  // Auto-save logic triggers after visual update
  if(window.autoSaveMeal) window.autoSaveMeal();
};

function initUserApp() {
  const cur = JSON.parse(localStorage.getItem('meal_currentUser'));
  if (!cur || cur.role !== 'user') {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('userNameDisplay').textContent = cur.name;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('meal_currentUser');
    window.location.href = 'login.html';
  });

  window.addEventListener('storage', e => {
    if(!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments'].includes(e.key)) initUser();
  });

  // Fallback for real-time sync on local files (file://) where storage events fail
  let lastStoreHash = JSON.stringify(localStorage);
  setInterval(() => {
    const currentHash = JSON.stringify(localStorage);
    if (currentHash !== lastStoreHash) {
      lastStoreHash = currentHash;
      window.dispatchEvent(new Event('storage')); // Trigger refresh
    }
  }, 1500);

  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  }));

  let curProj = null;
  let enroll = null;

  function initUser() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    
    enroll = enrolls.find(e => e.userId === cur.id);
    
    if (enroll) {
      curProj = projects.find(p => p.id === enroll.projectId);
      document.getElementById('joinSection').classList.add('hidden');
      
      if (enroll.status === 'pending') {
        document.getElementById('joinStatus').innerHTML = `
          <div class="glass-panel text-center" style="border-color:var(--warning);">
            <div style="font-size:3rem; margin-bottom:1rem;">⏳</div>
            <h3 style="color:var(--warning);">Request Pending</h3>
            <p class="text-muted">Waiting for admin to approve you into <strong>${curProj ? curProj.name : 'the project'}</strong>.</p>
          </div>
        `;
        document.getElementById('joinSection').classList.remove('hidden');
        document.getElementById('projectsSelect').parentElement.style.display = 'none';
        document.getElementById('joinSection').querySelector('h2').style.display = 'none';
        document.getElementById('joinSection').querySelector('p').style.display = 'none';
      } else if (enroll.status === 'approved') {
        document.getElementById('userWorkspace').classList.remove('hidden');
        if (curProj) {
          document.getElementById('projectTitle').innerHTML = curProj.name;
          loadMenu();
          loadMeals();
          calcFinances();
          loadMyComments();
        }
      }
    } else {
      document.getElementById('joinSection').classList.remove('hidden');
      const sel = document.getElementById('projectsSelect');
      sel.innerHTML = '<option value="">— Select Project —</option>';
      projects.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
    }
  }
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localDate = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  const mdInp = document.getElementById('mealDate');
  if(mdInp) { mdInp.value = localDate; mdInp.addEventListener('change', loadMeals); }

  initUser();

  document.getElementById('joinBtn')?.addEventListener('click', () => {
    const pid = document.getElementById('projectsSelect').value;
    if(!pid) return showToast('Please select a project','error');
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    enrolls.push({ projectId: pid, userId: cur.id, status: 'pending', moneyGiven: 0 });
    localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
    showToast('Request sent to admin!');
    initUser();
  });

  function loadMeals() {
    if(!curProj) return;
    const dStr = mdInp.value;
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    const r = records.find(x => x.projectId === curProj.id && x.userId === cur.id && x.date === dStr);
    
    document.getElementById('cardBreakfast').classList.toggle('active', r ? r.breakfast : false);
    document.getElementById('cardLunch').classList.toggle('active', r ? r.lunch : false);
    document.getElementById('cardDinner').classList.toggle('active', r ? r.dinner : false);
  }

  window.autoSaveMeal = function() {
    if(!curProj) return;
    const dStr = mdInp.value;
    if(!dStr) return;

    const b = document.getElementById('cardBreakfast').classList.contains('active');
    const l = document.getElementById('cardLunch').classList.contains('active');
    const d = document.getElementById('cardDinner').classList.contains('active');

    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    const idx = records.findIndex(x => x.projectId === curProj.id && x.userId === cur.id && x.date === dStr);

    if(idx > -1) {
      records[idx].breakfast = b; records[idx].lunch = l; records[idx].dinner = d;
    } else {
      records.push({ projectId: curProj.id, userId: cur.id, date: dStr, breakfast: b, lunch: l, dinner: d });
    }
    localStorage.setItem('meal_records', JSON.stringify(records));
    calcFinances();
  };

  document.getElementById('saveMealBtn')?.addEventListener('click', () => {
    window.autoSaveMeal();
    showToast('Meal saved! Admin can see it now.');
  });

  function calcFinances() {
    if(!curProj || !enroll) return;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => e.projectId === curProj.id && e.status === 'approved');
    let gMeals = 0, gMoney = 0;
    
    mems.forEach(en => {
      gMoney += (parseFloat(en.moneyGiven) || 0);
      records.filter(x => x.projectId === curProj.id && x.userId === en.userId).forEach(x => {
        if(x.breakfast) gMeals+=0.5; if(x.lunch) gMeals+=1; if(x.dinner) gMeals+=1;
      });
    });

    const mRate = gMeals > 0 ? (gMoney / gMeals) : 0;
    document.getElementById('showTotalMoney').textContent = gMoney + ' ৳';
    document.getElementById('showMealRate').textContent = mRate.toFixed(2) + ' ৳';

    let mMeals = 0;
    records.filter(x => x.projectId === curProj.id && x.userId === cur.id).forEach(x => {
      if(x.breakfast) mMeals+=0.5; if(x.lunch) mMeals+=1; if(x.dinner) mMeals+=1;
    });

    const mEn = enrolls.find(e => e.projectId === curProj.id && e.userId === cur.id);
    const mMoney = parseFloat(mEn.moneyGiven) || 0;
    const mCost = mMeals * mRate;
    const bal = mCost - mMoney;

    document.getElementById('myTotalMeals').textContent = mMeals;
    document.getElementById('myDeposit').textContent = mMoney + ' ৳';
    
    const bEl = document.getElementById('myBalance');
    const cEl = document.getElementById('balanceCard');
    
    if(bal > 0) {
      bEl.textContent = `${Math.abs(bal).toFixed(2)} ৳ (Due)`;
      bEl.style.color = 'var(--warning)'; cEl.style.borderColor = 'var(--warning)';
    } else if (bal < 0) {
      bEl.textContent = `${Math.abs(bal).toFixed(2)} ৳ (Refund)`;
      bEl.style.color = 'var(--accent)'; cEl.style.borderColor = 'var(--accent)';
    } else {
      bEl.textContent = '0.00 ৳';
      bEl.style.color = 'var(--primary)'; cEl.style.borderColor = 'var(--glass-border)';
    }
  }

  // Comments
  function loadMyComments() {
    const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    const myCom = comments.filter(c => c.projectId === curProj.id && c.userId === cur.id).sort((a,b) => b.time - a.time);
    const con = document.getElementById('myCommentsContainer');
    con.innerHTML = '';
    
    if(!myCom.length) { con.innerHTML = '<p class="text-center text-muted">No comments yet.</p>'; return; }
    
    myCom.forEach(c => {
      const d = new Date(c.time).toLocaleString();
      con.innerHTML += `
        <div class="comment-box">
          <div class="comment-header">
            <div class="comment-avatar" style="background:var(--primary);">${cur.name.charAt(0).toUpperCase()}</div>
            <div class="comment-author">Me</div>
            <div class="comment-time">${d}</div>
          </div>
          <div class="comment-text">${c.text}</div>
        </div>
      `;
    });
  }

  document.getElementById('sendCommentBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('commentInput');
    const txt = inp.value.trim();
    if(!txt) return showToast('Please write something', 'error');
    if(!curProj) return;

    const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    comments.push({ id: Date.now().toString(), projectId: curProj.id, userId: cur.id, text: txt, time: Date.now() });
    localStorage.setItem('meal_comments', JSON.stringify(comments));
    inp.value = '';
    showToast('Comment sent to admin!');
    loadMyComments();
  });
  
  document.getElementById('commentInput')?.addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('sendCommentBtn').click();
  });

  // Menu
  function loadMenu() {
    if(!curProj) return;
    const mb = document.getElementById('menuBody');
    mb.innerHTML = '';
    const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    days.forEach(d => {
      const m = curProj.menu[d];
      mb.innerHTML += `<tr>
        <td><strong class="text-gradient">${d}</strong></td>
        <td>${m.b || '—'}</td><td>${m.l || '—'}</td><td>${m.d || '—'}</td>
      </tr>`;
    });
  }
}

if (window.firebaseDataLoaded) initUserApp();
else window.addEventListener('firebaseDataLoaded', initUserApp);
