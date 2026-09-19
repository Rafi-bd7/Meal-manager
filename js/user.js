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
  const card = document.getElementById(type === 'breakfast' ? 'cardBreakfast' : type === 'lunch' ? 'cardLunch' : 'cardDinner');
  if (!card) return;
  const isActive = card.classList.contains('active');
  if (isActive) {
    card.classList.remove('active');
  } else {
    card.classList.add('active');
  }
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

  let shownNotifs = new Set((JSON.parse(localStorage.getItem('meal_notifications')) || []).map(n => n.id));

  function triggerDeviceNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'meal-notice-' + Date.now()
          });
        }).catch(() => {
          try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch(e){}
        });
      } else {
        try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch(e){}
      }
    }
  }

  function refreshUserData() {
    initUser();
    loadUserBills();
  }

  window.addEventListener('storage', e => {
    if(!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments','meal_bills'].includes(e.key)) {
      refreshUserData();
    }
    
    if(!e.key || e.key === 'meal_notifications') {
      const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
      notifs.forEach(n => {
        if (!shownNotifs.has(n.id)) {
          shownNotifs.add(n.id);
          const toTarget = n.to || n.to_user;
          const projTarget = n.projectId || n.project_id;
          if (curProj && projTarget === curProj.id && (toTarget === cur.id || toTarget === 'all')) {
            showToast(n.message, 'info');
            triggerDeviceNotification('MealManager Notice', n.message);
          }
        }
      });
      loadUserNotices();
    }
  });

  window.addEventListener('appDataSynced', refreshUserData);
  window.addEventListener('apiDataLoaded', refreshUserData);

  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    if (target) target.classList.add('active');

    // Dynamic data reload on tab switch so member always sees newest updates
    if (btn.dataset.tab === 'bills') {
      loadUserBills();
    } else if (btn.dataset.tab === 'meals') {
      loadMeals();
    } else if (btn.dataset.tab === 'comments') {
      loadMyComments();
    } else if (btn.dataset.tab === 'menu') {
      loadMenu();
    } else if (btn.dataset.tab === 'notices') {
      loadUserNotices();
    } else if (btn.dataset.tab === 'profiles') {
      loadProfiles();
    }
  }));

  let curProj = null;
  let enroll = null;

  function initUser() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    
    const myEnrolls = enrolls.filter(e => (e.userId || e.user_id) === cur.id);
    const approvedEnrolls = myEnrolls.filter(e => e.status === 'approved');

    if (approvedEnrolls.length > 0) {
      // Pick last selected or most recent approved project
      const savedPid = localStorage.getItem('meal_userLastProj');
      enroll = approvedEnrolls.find(e => (e.projectId || e.project_id) === savedPid) || approvedEnrolls[approvedEnrolls.length - 1];
      curProj = projects.find(p => p.id === (enroll.projectId || enroll.project_id));
      
      document.getElementById('joinSection').classList.add('hidden');
      document.getElementById('userWorkspace').classList.remove('hidden');

      if (curProj) {
        document.getElementById('projectTitle').innerHTML = curProj.name;
        loadMenu();
        loadMeals();
        calcFinances();
        loadMyComments();
        loadProfiles();
        loadUserNotices();
        loadUserBills();
        window.dispatchEvent(new Event('refreshChat'));
      }
    } else if (myEnrolls.length > 0) {
      // Pending request
      enroll = myEnrolls[0];
      curProj = projects.find(p => p.id === (enroll.projectId || enroll.project_id));
      document.getElementById('userWorkspace').classList.add('hidden');
      document.getElementById('joinSection').classList.remove('hidden');
      document.getElementById('joinStatus').innerHTML = `
        <div class="glass-panel text-center" style="border-color:var(--warning);">
          <div style="font-size:3rem; margin-bottom:1rem;">⏳</div>
          <h3 style="color:var(--warning);">Request Pending</h3>
          <p class="text-muted">Waiting for admin to approve you into <strong>${curProj ? curProj.name : 'the project'}</strong>.</p>
        </div>
      `;
      const pSel = document.getElementById('projectsSelect');
      if (pSel && pSel.parentElement) pSel.parentElement.style.display = 'none';
      const h2 = document.getElementById('joinSection').querySelector('h2');
      const p = document.getElementById('joinSection').querySelector('p');
      if (h2) h2.style.display = 'none';
      if (p) p.style.display = 'none';
    } else {
      // No enrollments yet
      document.getElementById('userWorkspace').classList.add('hidden');
      document.getElementById('joinSection').classList.remove('hidden');
      const pSel = document.getElementById('projectsSelect');
      if (pSel && pSel.parentElement) pSel.parentElement.style.display = 'flex';
      const h2 = document.getElementById('joinSection').querySelector('h2');
      const p = document.getElementById('joinSection').querySelector('p');
      if (h2) h2.style.display = '';
      if (p) p.style.display = '';
      
      pSel.innerHTML = '<option value="">— Select Project —</option>';
      projects.forEach(pr => pSel.innerHTML += `<option value="${pr.id}">${pr.name}</option>`);
    }
  }

  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localDate = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  const mdInp = document.getElementById('mealDate');
  if(mdInp) { mdInp.value = localDate; mdInp.addEventListener('change', loadMeals); }

  if (window.initChat) window.initChat(cur, () => curProj ? curProj.id : null);
  initUser();

  document.getElementById('joinBtn')?.addEventListener('click', async () => {
    const pid = document.getElementById('projectsSelect').value;
    if(!pid) return showToast('Please select a project','error');

    try {
      if (window.API) {
        await window.API.post('enrollments.php', { action: 'request_join' }, { project_id: pid, user_id: cur.id });
        await window.API.syncState();
      } else {
        const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
        enrolls.push({ projectId: pid, userId: cur.id, status: 'pending', moneyGiven: 0 });
        localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
      }
      showToast('Request sent to admin!');
      initUser();
    } catch (err) {
      showToast(err.message || 'Request failed', 'error');
    }
  });

  function loadMeals() {
    if(!curProj) return;
    const dStr = mdInp.value;
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    const r = records.find(x => (x.projectId || x.project_id) === curProj.id && (x.userId || x.user_id) === cur.id && x.date === dStr);
    
    document.getElementById('cardBreakfast')?.classList.toggle('active', r ? r.breakfast : false);
    document.getElementById('cardLunch')?.classList.toggle('active', r ? r.lunch : false);
    document.getElementById('cardDinner')?.classList.toggle('active', r ? r.dinner : false);
  }

  window.autoSaveMeal = async function() {
    if(!curProj) return;
    const dStr = mdInp.value;
    if(!dStr) return;

    const b = document.getElementById('cardBreakfast').classList.contains('active');
    const l = document.getElementById('cardLunch').classList.contains('active');
    const d = document.getElementById('cardDinner').classList.contains('active');

    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    const idx = records.findIndex(x => (x.projectId || x.project_id) === curProj.id && (x.userId || x.user_id) === cur.id && x.date === dStr);

    const rObj = { projectId: curProj.id, userId: cur.id, date: dStr, breakfast: b, lunch: l, dinner: d };
    if(idx > -1) {
      records[idx] = rObj;
    } else {
      records.push(rObj);
    }
    localStorage.setItem('meal_records', JSON.stringify(records));

    try {
      if (window.API) {
        await window.API.post('meals.php', { action: 'save' }, {
          project_id: curProj.id,
          user_id: cur.id,
          date: dStr,
          breakfast: b,
          lunch: l,
          dinner: d,
          sender_name: cur.name
        });
      }
      calcFinances();
    } catch (err) {
      console.warn('Auto-save sync error:', err);
    }
  };

  document.getElementById('saveMealBtn')?.addEventListener('click', async () => {
    await window.autoSaveMeal();
    showToast('Meal saved! Admin can see it now.');
  });

  function calcFinances() {
    if(!curProj || !enroll) return;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => (e.projectId || e.project_id) === curProj.id && e.status === 'approved');
    let gMeals = 0, gMoney = 0;
    
    mems.forEach(en => {
      const uid = en.userId || en.user_id;
      gMoney += (parseFloat(en.moneyGiven || en.money_given) || 0);
      records.filter(x => (x.projectId || x.project_id) === curProj.id && (x.userId || x.user_id) === uid).forEach(x => {
        if(x.breakfast) gMeals+=0.5; if(x.lunch) gMeals+=1; if(x.dinner) gMeals+=1;
      });
    });

    const mRate = gMeals > 0 ? (gMoney / gMeals) : 0;
    document.getElementById('showTotalMoney').textContent = gMoney + ' ৳';
    document.getElementById('showMealRate').textContent = mRate.toFixed(2) + ' ৳';

    let mMeals = 0;
    records.filter(x => (x.projectId || x.project_id) === curProj.id && (x.userId || x.user_id) === cur.id).forEach(x => {
      if(x.breakfast) mMeals+=0.5; if(x.lunch) mMeals+=1; if(x.dinner) mMeals+=1;
    });

    const mEn = enrolls.find(e => (e.projectId || e.project_id) === curProj.id && (e.userId || e.user_id) === cur.id);
    const mMoney = parseFloat(mEn ? (mEn.moneyGiven || mEn.money_given) : 0) || 0;
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
    const myCom = comments.filter(c => (c.projectId || c.project_id) === (curProj ? curProj.id : '') && (c.userId || c.user_id) === cur.id).sort((a,b) => b.time - a.time);
    const con = document.getElementById('myCommentsContainer');
    if (!con) return;
    con.innerHTML = '';
    
    if(!myCom.length) {
      con.innerHTML = '<p class="text-center text-muted py-4"><i class="fas fa-comment-slash" style="font-size:2rem; margin-bottom:.5rem; display:block; opacity:.4;"></i>এখনো কোনো মন্তব্য পাঠানো হয়নি।</p>';
      return;
    }
    
    myCom.forEach(c => {
      const d = new Date(parseInt(c.time) || Date.now()).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
      const hasReply = c.reply && c.reply.trim().length > 0;
      const rTime = (c.replyTime || c.reply_time) ? new Date(parseInt(c.replyTime || c.reply_time)).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      
      con.innerHTML += `
        <div class="glass-panel" style="padding:1rem; border-color:rgba(79,142,247,0.25); position:relative; margin-bottom:0.75rem;">
          <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="comment-avatar" style="width:32px; height:32px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.85rem;">${cur.name.charAt(0).toUpperCase()}</div>
              <div>
                <strong style="font-size:0.9rem;">${cur.name}</strong>
                <span class="badge badge-blue" style="font-size:0.65rem; margin-left:4px;">You</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span style="font-size:0.75rem; color:var(--text-muted);"><i class="far fa-clock"></i> ${d}</span>
              <button class="btn btn-danger btn-sm btn-del-my-com" data-id="${c.id}" title="মুছে ফেলুন" style="padding:.2rem .45rem; font-size:.75rem;"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div style="font-size:0.92rem; color:var(--text); line-height:1.5; white-space:pre-wrap; margin-bottom:${hasReply ? '.75rem' : '0'};">${c.text}</div>
          ${hasReply ? `
            <div style="background:rgba(34,197,94,0.08); border-left:3px solid #22c55e; border-radius:4px; padding:0.6rem 0.85rem; margin-top:0.5rem;">
              <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <span style="font-size:0.8rem; font-weight:700; color:#22c55e;"><i class="fas fa-reply"></i> ম্যানেজারের উত্তর:</span>
                ${rTime ? `<span style="font-size:0.72rem; color:var(--text-muted);">${rTime}</span>` : ''}
              </div>
              <div style="font-size:0.88rem; color:var(--text); line-height:1.4;">${c.reply}</div>
            </div>
          ` : `
            <div style="margin-top:0.4rem; font-size:0.75rem; color:var(--text-muted);">
              <i class="fas fa-check-circle" style="color:var(--primary);"></i> ম্যানেজারের নিকট পৌঁছেছে
            </div>
          `}
        </div>
      `;
    });

    con.querySelectorAll('.btn-del-my-com').forEach(b => b.addEventListener('click', async e => {
      if (!confirm('এই মন্তব্য মুছে ফেলবেন?')) return;
      const cid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('comments.php', { action: 'delete' }, { id: cid });
          await window.API.syncState();
        } else {
          const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
          localStorage.setItem('meal_comments', JSON.stringify(comments.filter(x => x.id !== cid)));
        }
        showToast('মন্তব্য মুছে ফেলা হয়েছে।');
        loadMyComments();
      } catch (err) {
        showToast(err.message || 'Error deleting comment', 'error');
      }
    }));
  }

  document.getElementById('sendCommentBtn')?.addEventListener('click', async () => {
    const inp = document.getElementById('commentInput');
    const txt = inp.value.trim();
    if(!txt) return showToast('মন্তব্য লিখুন', 'error');
    if(!curProj) return showToast('কোনো প্রজেক্ট সিলেক্ট করা নেই', 'error');

    const btn = document.getElementById('sendCommentBtn');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> পাঠাচ্ছে...';

    try {
      if (window.API) {
        await window.API.post('comments.php', { action: 'create' }, { project_id: curProj.id, user_id: cur.id, text: txt });
        await window.API.syncState();
      } else {
        const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
        const cObj = { id: Date.now().toString(), projectId: curProj.id, userId: cur.id, text: txt, time: Date.now() };
        comments.unshift(cObj);
        localStorage.setItem('meal_comments', JSON.stringify(comments));
      }
      inp.value = '';
      showToast('মন্তব্য সফলভাবে ম্যানেজারের কাছে পাঠানো হয়েছে! ✓');
      loadMyComments();
    } catch (err) {
      showToast(err.message || 'মন্তব্য পাঠাতে সমস্যা হয়েছে', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });

  document.getElementById('commentInput')?.addEventListener('keydown', e => {
    if(e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('sendCommentBtn')?.click();
    }
  });

  // Menu
  function loadMenu() {
    if(!curProj) return;
    const mb = document.getElementById('menuBody');
    mb.innerHTML = '';
    const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    const menuObj = curProj.menu || {};
    days.forEach(d => {
      const m = menuObj[d] || {b:'', l:'', d:''};
      mb.innerHTML += `<tr>
        <td><strong class="text-gradient">${d}</strong></td>
        <td>${m.b || '—'}</td><td>${m.l || '—'}</td><td>${m.d || '—'}</td>
      </tr>`;
    });
  }

  // Profiles
  document.getElementById('uploadPicBtn')?.addEventListener('click', () => document.getElementById('profilePicInput').click());
  document.getElementById('profilePicInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
          if (window.API) {
            await window.API.post('auth.php', { action: 'update_photo' }, { user_id: cur.id, photo: dataUrl });
          }
          const users = JSON.parse(localStorage.getItem('meal_users')) || [];
          const idx = users.findIndex(u => u.id === cur.id);
          if(idx > -1) {
            users[idx].photo = dataUrl;
            localStorage.setItem('meal_users', JSON.stringify(users));
          }
          showToast('Profile picture updated!');
          loadProfiles();
        } catch (err) {
          showToast(err.message || 'Error updating photo', 'error');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function loadProfiles() {
    if(!curProj) return;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const mems = enrolls.filter(e => (e.projectId || e.project_id) === curProj.id && e.status === 'approved');
    
    const pb = document.getElementById('profilesBody');
    if(pb) pb.innerHTML = '';
    
    // Update my profile pic display
    const me = users.find(u => u.id === cur.id);
    const myPic = document.getElementById('myProfilePic');
    if(myPic && me) {
      if(me.photo) myPic.innerHTML = `<img src="${me.photo}" style="width:100%; height:100%; object-fit:cover;">`;
      else myPic.innerHTML = me.name.charAt(0).toUpperCase();
    }

    mems.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      if(!u) return;
      const photoHtml = u.photo ? `<img src="${u.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">${u.name.charAt(0).toUpperCase()}</div>`;
      if(pb) pb.innerHTML += `<tr>
        <td>${photoHtml}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
      </tr>`;
    });
  }

  // ─── Notices & Announcements ───
  function loadUserNotices() {
    const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
    const list = document.getElementById('userNoticesList');
    const badge = document.getElementById('userNoticeBadge');
    if (!list || !curProj) return;
    const projNotifs = notifs.filter(n => (n.projectId || n.project_id) === curProj.id && ((n.to || n.to_user) === 'all' || (n.to || n.to_user) === cur.id));
    if (!projNotifs.length) {
      list.innerHTML = '<p class="text-muted text-center py-3">কোনো নোটিশ নেই।</p>';
      if (badge) badge.style.display = 'none';
      return;
    }
    if (badge) badge.style.display = 'inline-flex';
    list.innerHTML = projNotifs.map(n => {
      const dStr = n.time ? new Date(parseInt(n.time)).toLocaleString('bn-BD', { dateStyle:'medium', timeStyle:'short' }) : '';
      return `<div class="card p-3" style="background:var(--card-bg); border-radius:0.75rem; border:1px solid var(--glass-border);">
        <div class="flex justify-between items-center mb-1">
          <span class="badge badge-blue"><i class="fas fa-bullhorn"></i> ম্যানেজারের নোটিশ</span>
          <span class="text-muted" style="font-size:0.75rem;">${dStr}</span>
        </div>
        <p style="margin:0; font-size:0.95rem; line-height:1.5;">${n.message}</p>
      </div>`;
    }).join('');
  }

  document.getElementById('enableNotifyBtn')?.addEventListener('click', async () => {
    if (!('Notification' in window)) return showToast('আপনার ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই', 'error');
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        triggerDeviceNotification('MealManager', 'নোটিফিকেশন সক্রিয় করা হয়েছে! ✓');
        showToast('নোটিফিকেশন চালু হয়েছে!');
      } else {
        showToast('নোটিফিকেশন পারমিশন পাওয়া যায়নি', 'error');
      }
    } catch(e) { showToast(e.message, 'error'); }
  });

  // ─── Monthly Bills (User View, Per-person Breakdown & PDF) ───
  const userBillDefs = [
    { key: 'houseRent', altKey: 'house_rent', name: 'বাড়ি ভাড়া (House Rent)', icon: 'fa-home' },
    { key: 'cookSalary', altKey: 'cook_salary', name: 'খালা / বাবুর্চি বিল (Cook Salary)', icon: 'fa-utensils' },
    { key: 'wifiBill', altKey: 'wifi_bill', name: 'ওয়াইফাই বিল (WiFi)', icon: 'fa-wifi' },
    { key: 'gasBill', altKey: 'gas_bill', name: 'গ্যাস বিল (Gas)', icon: 'fa-burn' },
    { key: 'electricityBill', altKey: 'electricity_bill', name: 'বিদ্যুৎ বিল (Electricity)', icon: 'fa-bolt' },
    { key: 'garbageBill', altKey: 'garbage_bill', name: 'ময়লা বিল (Garbage)', icon: 'fa-trash-alt' }
  ];

  function getUserBillsMonth() {
    const monthEl = document.getElementById('billsUserMonth');
    if (monthEl && monthEl.value) {
      return monthEl.value;
    }
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const defaultMonth = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 7);
    if (monthEl) monthEl.value = defaultMonth;
    return defaultMonth;
  }

  const userBillsMonthInp = document.getElementById('billsUserMonth');
  if (userBillsMonthInp) {
    if (!userBillsMonthInp.value) {
      userBillsMonthInp.value = getUserBillsMonth();
    }
    userBillsMonthInp.addEventListener('change', () => loadUserBills());
  }

  function loadUserBills() {
    if (!curProj) return;
    const curMonthStr = getUserBillsMonth();
    
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const approvedMems = enrolls.filter(e => (e.projectId || e.project_id) === curProj.id && e.status === 'approved');
    const memCount = Math.max(1, approvedMems.length);

    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const b = bills.find(x => (x.projectId || x.project_id) === curProj.id && (x.monthYear || x.month_year) === curMonthStr);

    let customBills = [];
    if (b) {
      const note = b.otherBillsNote || b.other_bills_note || '';
      if (note && typeof note === 'string' && note.startsWith('[')) {
        try { customBills = JSON.parse(note); } catch(e) { customBills = []; }
      } else if (parseFloat(b.otherBills || b.other_bills || 0) > 0) {
        customBills = [{ id: 'cb_1', name: note || 'অন্যান্য বিল', amount: parseFloat(b.otherBills || b.other_bills || 0) }];
      }
    }

    let grandTotal = 0;
    let tableHtml = '';

    userBillDefs.forEach(def => {
      const val = b ? parseFloat(b[def.key] || b[def.altKey] || 0) : 0;
      grandTotal += val;
      const perHead = val / memCount;
      tableHtml += `<tr>
        <td>
          <div class="flex items-center gap-2">
            <i class="fas ${def.icon}" style="color:var(--primary); width:18px;"></i>
            <span>${def.name}</span>
          </div>
        </td>
        <td class="tc font-bold">${val.toFixed(2)} ৳</td>
        <td class="tc">${memCount} জন</td>
        <td class="tc font-bold text-gradient">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    customBills.forEach(cb => {
      const val = parseFloat(cb.amount) || 0;
      grandTotal += val;
      const perHead = val / memCount;
      const title = cb.name.trim() || 'অন্যান্য বিল';
      tableHtml += `<tr>
        <td>
          <div class="flex items-center gap-2">
            <span class="badge badge-yellow" style="font-size:0.75rem; padding:2px 8px;">অন্যান্য</span>
            <span>📌 ${title}</span>
          </div>
        </td>
        <td class="tc font-bold">${val.toFixed(2)} ৳</td>
        <td class="tc">${memCount} জন</td>
        <td class="tc font-bold text-gradient">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    const myShareGrand = grandTotal / memCount;

    // Grand total row
    tableHtml += `<tr style="background:rgba(79,142,247,0.08); border-top:2px solid var(--primary); font-weight:bold;">
      <td style="font-size:1rem; color:var(--text);">সর্বমোট মেস বিল (Grand Total)</td>
      <td class="tc font-bold" style="font-size:1rem; color:var(--warning);">${grandTotal.toFixed(2)} ৳</td>
      <td class="tc font-bold" style="font-size:0.95rem;">${memCount} জন</td>
      <td class="tc font-bold text-gradient" style="font-size:1.15rem;">${myShareGrand.toFixed(2)} ৳</td>
    </tr>`;

    // Summary cards
    const gEl = document.getElementById('userBillsGrandTotal');
    const mEl = document.getElementById('userBillsMemberCount');
    const sEl = document.getElementById('userBillsMyShare');
    if (gEl) gEl.textContent = grandTotal.toFixed(2) + ' ৳';
    if (mEl) mEl.textContent = memCount + ' জন';
    if (sEl) sEl.textContent = myShareGrand.toFixed(2) + ' ৳';

    const bBody = document.getElementById('userBillsBreakdownBody');
    if (bBody) {
      if (!b && grandTotal === 0) {
        bBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4"><i class="fas fa-info-circle"></i> এই মাসের (${curMonthStr}) জন্য এখনো কোনো মাসিক বিল যুক্ত করা হয়নি।</td></tr>`;
      } else {
        bBody.innerHTML = tableHtml;
      }
    }
  }

  window.loadUserBills = loadUserBills;

  // ─── Download User Bills PDF ───
  document.getElementById('downloadUserBillsPdfBtn')?.addEventListener('click', () => {
    const area = document.getElementById('userBillsPdfArea');
    if (!area || !curProj) return;

    const curMonthStr = getUserBillsMonth();

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const approvedMems = enrolls.filter(e => (e.projectId || e.project_id) === curProj.id && e.status === 'approved');
    const memCount = Math.max(1, approvedMems.length);

    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const b = bills.find(x => (x.projectId || x.project_id) === curProj.id && (x.monthYear || x.month_year) === curMonthStr);

    let customBills = [];
    if (b) {
      const note = b.otherBillsNote || b.other_bills_note || '';
      if (note && note.startsWith('[')) {
        try { customBills = JSON.parse(note); } catch(e) { customBills = []; }
      } else if (parseFloat(b.otherBills || b.other_bills || 0) > 0) {
        customBills = [{ id: 'cb_1', name: note || 'অন্যান্য বিল', amount: parseFloat(b.otherBills || b.other_bills || 0) }];
      }
    }

    let grandTotal = 0;
    let pdfTableHtml = '';

    userBillDefs.forEach(def => {
      const val = b ? parseFloat(b[def.key] || b[def.altKey] || 0) : 0;
      grandTotal += val;
      const perHead = val / memCount;
      pdfTableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px; text-align:left; font-size:0.9rem;">${def.name}</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem; font-weight:600;">${val.toFixed(2)} ৳</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem;">${memCount} জন</td>
        <td style="padding:10px; text-align:right; font-size:0.9rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    customBills.forEach(cb => {
      const val = parseFloat(cb.amount) || 0;
      grandTotal += val;
      const perHead = val / memCount;
      const title = cb.name.trim() || 'অন্যান্য বিল';
      pdfTableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px; text-align:left; font-size:0.9rem;">📌 ${title}</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem; font-weight:600;">${val.toFixed(2)} ৳</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem;">${memCount} জন</td>
        <td style="padding:10px; text-align:right; font-size:0.9rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    const myShareGrand = grandTotal / memCount;
    pdfTableHtml += `<tr style="background:#f8fafc; border-top:2px solid #2563eb; font-weight:bold;">
      <td style="padding:12px 10px; font-size:1rem; color:#1e293b;">সর্বমোট মেস বিল (Grand Total)</td>
      <td style="padding:12px 10px; text-align:center; font-size:1rem; color:#d97706;">${grandTotal.toFixed(2)} ৳</td>
      <td style="padding:12px 10px; text-align:center; font-size:0.95rem;">${memCount} জন</td>
      <td style="padding:12px 10px; text-align:right; font-size:1.1rem; color:#2563eb;">${myShareGrand.toFixed(2)} ৳</td>
    </tr>`;

    const pName = document.getElementById('pdfUserProjName');
    const pMonth = document.getElementById('pdfUserMonth');
    const pTotal = document.getElementById('pdfUserGrandTotal');
    const pMem = document.getElementById('pdfUserMemCount');
    const pShare = document.getElementById('pdfUserMyShare');
    const pDate = document.getElementById('pdfUserPrintDate');
    const pBody = document.getElementById('pdfUserBillsTableBody');

    if (pName) pName.textContent = curProj.name;
    if (pMonth) pMonth.textContent = curMonthStr;
    if (pTotal) pTotal.textContent = grandTotal.toFixed(2) + ' ৳';
    if (pMem) pMem.textContent = memCount + ' জন';
    if (pShare) pShare.textContent = myShareGrand.toFixed(2) + ' ৳';
    if (pDate) pDate.textContent = 'ডাউনলোডের তারিখ: ' + new Date().toLocaleDateString('bn-BD');
    if (pBody) pBody.innerHTML = pdfTableHtml;

    area.style.display = 'block';
    const opt = {
      margin: 0.4,
      filename: `MealManager_Bills_${curMonthStr}_${cur.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(area).save().then(() => {
      area.style.display = 'none';
      showToast('মাসিক বিলের PDF সফলভাবে ডাউনলোড হয়েছে! 📄');
    }).catch(err => {
      area.style.display = 'none';
      showToast('PDF তৈরিতে সমস্যা হয়েছে: ' + err.message, 'error');
    });
  });
}

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUserApp);
} else {
  initUserApp();
}
