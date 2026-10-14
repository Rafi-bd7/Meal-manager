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

// ─── Monthly Bill Field Definitions & Helpers (Global) ───────────────────────
const userBillDefs = [
  { key: 'houseRent', altKey: 'house_rent', name: 'বাড়ি ভাড়া (House Rent)', icon: 'fa-home' },
  { key: 'cookSalary', altKey: 'cook_salary', name: 'খালা / বাবুর্চি বিল (Cook Salary)', icon: 'fa-utensils' },
  { key: 'wifiBill', altKey: 'wifi_bill', name: 'ওয়াইফাই বিল (WiFi)', icon: 'fa-wifi' },
  { key: 'gasBill', altKey: 'gas_bill', name: 'গ্যাস বিল (Gas)', icon: 'fa-burn' },
  { key: 'electricityBill', altKey: 'electricity_bill', name: 'বিদ্যুৎ বিল (Electricity)', icon: 'fa-bolt' },
  { key: 'garbageBill', altKey: 'garbage_bill', name: 'ময়লা বিল (Garbage)', icon: 'fa-trash-alt' }
];

function getBillVal(obj, key1, key2) {
  if (!obj) return 0;
  if (obj[key1] !== undefined && obj[key1] !== null && obj[key1] !== '') return parseFloat(obj[key1]) || 0;
  if (obj[key2] !== undefined && obj[key2] !== null && obj[key2] !== '') return parseFloat(obj[key2]) || 0;
  return 0;
}

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
    if (window.MealNotifications?.showDeviceNotification) {
      window.MealNotifications.showDeviceNotification(title, body, { soundType: 'notice' });
    }
  }

  // Check and display new push notifications
  function checkNewNotices() {
    const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
    notifs.forEach(n => {
      if (!shownNotifs.has(n.id)) {
        shownNotifs.add(n.id);
        const toTarget = n.to || n.to_user;
        const projTarget = n.projectId || n.project_id;
        if (curProj && projTarget === curProj.id && (toTarget === cur.id || toTarget === 'all')) {
          showToast(`📢 ${n.message}`, 'info');
          triggerDeviceNotification('📢 MealManager নোটিশ', n.message);
        }
      }
    });
    loadUserNotices();
  }

  function refreshUserData() {
    initUser();
    loadUserBills();
    if (typeof loadBazaar === 'function') loadBazaar();
    checkNewNotices();
  }

  window.addEventListener('storage', e => {
    if (!e.key || ['meal_records','meal_enrollments','meal_projects','meal_bills','meal_expenses','meal_notifications'].includes(e.key)) {
      refreshUserData();
    }
  });

  window.addEventListener('appDataSynced', refreshUserData);
  window.addEventListener('apiDataLoaded', refreshUserData);

  // Auto request notification permission on first user tap/click
  if ('Notification' in window && Notification.permission === 'default') {
    const reqPermOnce = () => {
      try { Notification.requestPermission(); } catch(e){}
      document.removeEventListener('click', reqPermOnce);
      document.removeEventListener('touchstart', reqPermOnce);
    };
    document.addEventListener('click', reqPermOnce, { once: true });
    document.addEventListener('touchstart', reqPermOnce, { once: true });
  }

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
    } else if (btn.dataset.tab === 'bazaar') {
      if (typeof loadBazaar === 'function') loadBazaar();
    } else if (btn.dataset.tab === 'meals') {
      loadMeals();
    } else if (btn.dataset.tab === 'allmeals') {
      loadAllMealsSheet();
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
        loadProfiles();
        loadUserNotices();
        loadUserBills();
        if (typeof loadBazaar === 'function') loadBazaar();
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

  if (window.initChat) window.initChat(cur, () => (curProj && enroll && enroll.status === 'approved') ? curProj.id : null);
  if (window.MealNotifications) window.MealNotifications.startMonitor(cur, () => (curProj && enroll && enroll.status === 'approved') ? curProj.id : null);
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

  // ─── Bazaar / Market Expense Tracker for User ───
  let _bazaarInited = false;

  function populateShopperSelects() {
    const addSel = document.getElementById('expShopperSelect');
    const editSel = document.getElementById('editExpShopperSelect');
    if (!addSel && !editSel) return;
    if (!curProj) return;

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pMems = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProj.id) && e.status === 'approved');

    const memberMap = new Map();
    if (cur && cur.id) memberMap.set(cur.id, { id: cur.id, name: cur.name });

    const adminId = curProj.adminId || curProj.admin_id;
    if (adminId && !memberMap.has(adminId)) {
      const adminUser = users.find(x => x.id === adminId);
      memberMap.set(adminId, { id: adminId, name: (adminUser ? adminUser.name : 'অ্যাডমিন') + ' (Admin)' });
    }

    pMems.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      const name = u ? u.name : (en.name || 'সদস্য');
      if (!memberMap.has(uid)) memberMap.set(uid, { id: uid, name: name });
    });

    if (addSel) {
      const curVal = addSel.value || cur.id;
      let optHtml = '';
      memberMap.forEach(m => {
        const isMe = m.id === cur.id;
        optHtml += `<option value="${m.id}" data-name="${m.name.replace(' (Admin)','')}">${isMe ? '👤 আমি নিজে (' + cur.name + ')' : '👤 ' + m.name}</option>`;
      });
      optHtml += `<option value="__custom__">✍️ অন্য কারো নাম লিখুন...</option>`;
      addSel.innerHTML = optHtml;
      addSel.value = curVal;
      if (!addSel.value) addSel.value = cur.id;

      if (!addSel.dataset.hasListener) {
        addSel.dataset.hasListener = 'true';
        addSel.addEventListener('change', () => {
          const customInp = document.getElementById('expCustomShopper');
          if (addSel.value === '__custom__') {
            customInp?.classList.remove('hidden');
            customInp?.focus();
          } else {
            customInp?.classList.add('hidden');
          }
        });
      }
    }

    if (editSel) {
      let optHtml = '';
      memberMap.forEach(m => {
        const isMe = m.id === cur.id;
        optHtml += `<option value="${m.id}" data-name="${m.name.replace(' (Admin)','')}">${isMe ? '👤 আমি নিজে (' + cur.name + ')' : '👤 ' + m.name}</option>`;
      });
      optHtml += `<option value="__custom__">✍️ অন্য কারো নাম লিখুন...</option>`;
      editSel.innerHTML = optHtml;

      if (!editSel.dataset.hasListener) {
        editSel.dataset.hasListener = 'true';
        editSel.addEventListener('change', () => {
          const customInp = document.getElementById('editExpCustomShopper');
          if (editSel.value === '__custom__') {
            customInp?.classList.remove('hidden');
            customInp?.focus();
          } else {
            customInp?.classList.add('hidden');
          }
        });
      }
    }
  }

  function initBazaarEvents() {
    populateShopperSelects();
    if (_bazaarInited) return;
    _bazaarInited = true;

    const bMonth = document.getElementById('bazaarMonth');
    if (bMonth) {
      if (!bMonth.value) {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        bMonth.value = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 7);
      }
      bMonth.addEventListener('change', () => {
        bMonth.dataset.userChanged = 'true';
        loadBazaar();
      });
    }

    const expDate = document.getElementById('expDate');
    if (expDate && !expDate.value) {
      const tzOffset = (new Date()).getTimezoneOffset() * 60000;
      expDate.value = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }

    // Add expense
    document.getElementById('addExpenseBtn')?.addEventListener('click', async () => {
      if (!curProj) return showToast('প্রজেক্ট সিলেক্ট করা নেই', 'error');
      const dateInp = document.getElementById('expDate');
      const itemInp = document.getElementById('expItem');
      const amountInp = document.getElementById('expAmount');
      const catInp = document.getElementById('expCategory');
      const noteInp = document.getElementById('expNote');

      const shopperSel = document.getElementById('expShopperSelect');
      const customShopperInp = document.getElementById('expCustomShopper');
      let shopperUserId = cur.id;
      let shopperName = cur.name;
      if (shopperSel) {
        if (shopperSel.value === '__custom__') {
          shopperName = customShopperInp?.value.trim() || 'অন্যান্য';
          shopperUserId = cur.id;
        } else if (shopperSel.value) {
          shopperUserId = shopperSel.value;
          const selectedOpt = shopperSel.options[shopperSel.selectedIndex];
          shopperName = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text.replace('👤 ','')) : cur.name;
        }
      }

      const date = dateInp?.value || (new Date()).toISOString().slice(0, 10);
      const item = itemInp?.value.trim() || '';
      const amount = parseFloat(amountInp?.value || 0);
      const category = catInp?.value || 'bazaar';
      const note = noteInp?.value.trim() || '';

      if (!item) return showToast('পণ্যের নাম লিখুন', 'error');
      if (amount <= 0) return showToast('সঠিক টাকার পরিমাণ লিখুন', 'error');

      const btn = document.getElementById('addExpenseBtn');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> যোগ হচ্ছে...';

      try {
        const newExp = {
          id: 'exp_' + Date.now(),
          projectId: curProj.id,
          userId: shopperUserId,
          userName: shopperName,
          shopperName: shopperName,
          createdBy: cur.id,
          createdByName: cur.name,
          date,
          item,
          amount,
          category,
          note
        };

        // 1. Immediately update localStorage for instant UI response
        const expenses = JSON.parse(localStorage.getItem('meal_expenses')) || [];
        expenses.unshift(newExp);
        localStorage.setItem('meal_expenses', JSON.stringify(expenses));

        // 2. Clear inputs & re-render immediately
        if (itemInp) itemInp.value = '';
        if (amountInp) amountInp.value = '';
        if (noteInp) noteInp.value = '';
        if (customShopperInp) customShopperInp.value = '';
        showToast('বাজার খরচ সফলভাবে যোগ করা হয়েছে! ✓');
        loadBazaar();

        // 3. Persist to API
        if (window.API) {
          const res = await window.API.post('expenses.php', { action: 'add' }, {
            project_id: curProj.id,
            user_id: shopperUserId,
            shopper_name: shopperName,
            created_by: cur.id,
            date,
            item,
            amount,
            category,
            note
          });
          if (res && res.expense && res.expense.id) {
            newExp.id = res.expense.id;
            localStorage.setItem('meal_expenses', JSON.stringify(expenses));
          }
          await window.API.syncState();
          loadBazaar();
        }
      } catch (err) {
        showToast(err.message || 'Error adding expense', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });

    // Edit modal close / cancel
    document.getElementById('closeEditExpModalBtn')?.addEventListener('click', () => {
      document.getElementById('editExpModal')?.classList.remove('active');
    });
    document.getElementById('cancelEditExpBtn')?.addEventListener('click', () => {
      document.getElementById('editExpModal')?.classList.remove('active');
    });

    // Edit save
    document.getElementById('saveEditExpBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('editExpId')?.value;
      const date = document.getElementById('editExpDate')?.value;
      const item = document.getElementById('editExpItem')?.value.trim();
      const amount = parseFloat(document.getElementById('editExpAmount')?.value || 0);
      const category = document.getElementById('editExpCategory')?.value || 'bazaar';
      const note = document.getElementById('editExpNote')?.value.trim() || '';

      const editShopperSel = document.getElementById('editExpShopperSelect');
      const editCustomShopperInp = document.getElementById('editExpCustomShopper');
      let editUserId = cur.id;
      let editShopperName = cur.name;
      if (editShopperSel) {
        if (editShopperSel.value === '__custom__') {
          editShopperName = editCustomShopperInp?.value.trim() || 'অন্যান্য';
          editUserId = cur.id;
        } else if (editShopperSel.value) {
          editUserId = editShopperSel.value;
          const opt = editShopperSel.options[editShopperSel.selectedIndex];
          editShopperName = opt ? (opt.dataset.name || opt.text.replace('👤 ','')) : cur.name;
        }
      }

      if (!id) return;
      if (!item) return showToast('পণ্যের নাম লিখুন', 'error');
      if (amount <= 0) return showToast('সঠিক টাকার পরিমাণ লিখুন', 'error');

      const btn = document.getElementById('saveEditExpBtn');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> সেভ হচ্ছে...';

      try {
        // Immediately update localStorage
        const expenses = JSON.parse(localStorage.getItem('meal_expenses')) || [];
        const idx = expenses.findIndex(x => x.id === id);
        if (idx > -1) {
          expenses[idx] = {
            ...expenses[idx],
            date, item, amount, category, note,
            userId: editUserId,
            userName: editShopperName,
            shopperName: editShopperName,
            updatedBy: cur.id,
            updatedByName: cur.name
          };
          localStorage.setItem('meal_expenses', JSON.stringify(expenses));
        }
        document.getElementById('editExpModal')?.classList.remove('active');
        showToast('বাজার খরচের তথ্য সফলভাবে আপডেট হয়েছে! ✓');
        loadBazaar();

        if (window.API) {
          await window.API.post('expenses.php', { action: 'update' }, {
            id,
            project_id: curProj.id,
            user_id: editUserId,
            shopper_name: editShopperName,
            updated_by: cur.id,
            date,
            item,
            amount,
            category,
            note
          });
          await window.API.syncState();
          loadBazaar();
        }
      } catch (err) {
        showToast(err.message || 'Error updating expense', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });
  }

  function loadBazaar() {
    if (!curProj) return;
    initBazaarEvents();

    const bMonth = document.getElementById('bazaarMonth');
    const expenses = JSON.parse(localStorage.getItem('meal_expenses')) || [];
    const projExpenses = expenses.filter(x => String(x.projectId || x.project_id) === String(curProj.id));

    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const todayStr = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    const defaultMonth = todayStr.slice(0, 7);

    let monthStr = bMonth && bMonth.value ? bMonth.value : defaultMonth;
    let monthExpenses = projExpenses.filter(x => (x.date || '').slice(0, 7) === monthStr)
                                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Auto-detect latest month with expenses if selected month has none
    if (bMonth && bMonth.dataset.userChanged !== 'true' && projExpenses.length > 0 && monthExpenses.length === 0) {
      const sortedExps = [...projExpenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (sortedExps[0] && sortedExps[0].date) {
        monthStr = sortedExps[0].date.slice(0, 7);
        bMonth.value = monthStr;
        monthExpenses = projExpenses.filter(x => (x.date || '').slice(0, 7) === monthStr)
                                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }
    }

    // Stats
    const totalMonth = monthExpenses.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);
    const totalToday = projExpenses.filter(x => x.date === todayStr).reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);

    const tmEl = document.getElementById('bazaarTotalMonth');
    const ttEl = document.getElementById('bazaarTotalToday');
    const teEl = document.getElementById('bazaarEntryCount');
    if (tmEl) tmEl.textContent = totalMonth.toFixed(2) + ' ৳';
    if (ttEl) ttEl.textContent = totalToday.toFixed(2) + ' ৳';
    if (teEl) teEl.textContent = monthExpenses.length.toString();

    const tbody = document.getElementById('bazaarBody');
    if (!tbody) return;

    if (!monthExpenses.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fas fa-shopping-basket" style="opacity:.4; font-size:2rem; display:block; margin-bottom:.5rem;"></i>${monthStr} মাসে কোনো বাজার খরচ এন্ট্রি পাওয়া যায়নি।</td></tr>`;
      return;
    }

    const users = JSON.parse(localStorage.getItem('meal_users')) || [];

    tbody.innerHTML = monthExpenses.map(exp => {
      let shopperName = exp.shopperName || exp.shopper_name || exp.userName;
      if (!shopperName) {
        const u = users.find(x => x.id === (exp.userId || exp.user_id));
        shopperName = u ? u.name : 'সদস্য';
      }
      const isMyBazaar = (exp.userId || exp.user_id) === cur.id || shopperName === cur.name;

      let adderName = exp.createdByName || exp.createdBy;
      if (!adderName && exp.createdBy) {
        const uAdd = users.find(x => x.id === exp.createdBy);
        if (uAdd) adderName = uAdd.name;
      }
      if (!adderName) adderName = exp.userName || 'সদস্য';

      let updaterName = exp.updatedByName;
      if (!updaterName && (exp.updatedBy || exp.updated_by)) {
        const u2 = users.find(x => x.id === (exp.updatedBy || exp.updated_by));
        if (u2) updaterName = u2.name;
      }

      const shopperBadge = `<span class="badge badge-purple" style="font-size:0.82rem; font-weight:600;"><i class="fas fa-shopping-bag" style="margin-right:4px;"></i>${shopperName}${isMyBazaar ? ' <span class="badge badge-blue" style="font-size:0.6rem; margin-left:3px;">You</span>' : ''}</span>`;
      const entryInfo = `<div style="font-size:0.85rem; font-weight:600; color:var(--text-muted);"><i class="fas fa-user-edit" style="font-size:0.75rem;"></i> ${adderName}</div>${updaterName ? `<div style="font-size:0.73rem; color:#f59e0b; margin-top:2px;"><i class="fas fa-history" style="font-size:0.7rem;"></i> আপডেট: ${updaterName}</div>` : ''}`;

      const catBadge = exp.category === 'other'
        ? '<span class="badge badge-yellow" style="font-size:0.75rem;">📦 অন্যান্য</span>'
        : '<span class="badge badge-green" style="font-size:0.75rem;">🛒 বাজার</span>';

      return `<tr>
        <td style="white-space:nowrap;"><i class="far fa-calendar-alt text-muted" style="margin-right:4px;"></i>${exp.date}</td>
        <td>${shopperBadge}</td>
        <td><strong>${exp.item}</strong></td>
        <td class="tc">${catBadge}</td>
        <td class="tc font-bold text-gradient">${parseFloat(exp.amount).toFixed(2)} ৳</td>
        <td>${entryInfo}</td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${exp.note || '—'}</td>
        <td class="tc" style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm btn-edit-exp" data-id="${exp.id}" title="সম্পাদনা করুন" style="padding:.25rem .5rem; font-size:.78rem; margin-right:4px;"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm btn-del-exp" data-id="${exp.id}" title="মুছে ফেলুন" style="padding:.25rem .5rem; font-size:.78rem;"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    // Attach Edit and Delete listeners
    tbody.querySelectorAll('.btn-edit-exp').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.dataset.id;
        const exp = projExpenses.find(x => x.id === id);
        if (!exp) return;
        populateShopperSelects();
        document.getElementById('editExpId').value = exp.id;
        document.getElementById('editExpDate').value = exp.date;
        document.getElementById('editExpItem').value = exp.item;
        document.getElementById('editExpAmount').value = exp.amount;
        document.getElementById('editExpCategory').value = exp.category || 'bazaar';
        document.getElementById('editExpNote').value = exp.note || '';

        const shopperUserId = exp.userId || exp.user_id;
        const shopperNameVal = exp.shopperName || exp.shopper_name || exp.userName || '';
        const editShopperSel = document.getElementById('editExpShopperSelect');
        const editCustomShopperInp = document.getElementById('editExpCustomShopper');
        if (editShopperSel) {
          const hasOpt = Array.from(editShopperSel.options).some(o => o.value === shopperUserId && o.value !== '__custom__');
          if (hasOpt) {
            editShopperSel.value = shopperUserId;
            editCustomShopperInp?.classList.add('hidden');
          } else {
            editShopperSel.value = '__custom__';
            if (editCustomShopperInp) {
              editCustomShopperInp.value = shopperNameVal;
              editCustomShopperInp.classList.remove('hidden');
            }
          }
        }

        document.getElementById('editExpModal')?.classList.add('active');
      });
    });

    tbody.querySelectorAll('.btn-del-exp').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('আপনি কি নিশ্চিত যে এই বাজার খরচের এন্ট্রি মুছে ফেলতে চান?')) return;
        try {
          const exps = JSON.parse(localStorage.getItem('meal_expenses')) || [];
          localStorage.setItem('meal_expenses', JSON.stringify(exps.filter(x => x.id !== id)));
          showToast('বাজার খরচের এন্ট্রি মুছে ফেলা হয়েছে।');
          loadBazaar();

          if (window.API) {
            await window.API.post('expenses.php', { action: 'delete' }, { id, project_id: curProj.id });
            await window.API.syncState();
            loadBazaar();
          }
        } catch (err) {
          showToast(err.message || 'Error deleting expense', 'error');
        }
      });
    });
  }

  window.loadBazaar = loadBazaar;

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

    if (file.size > 15 * 1024 * 1024) {
      showToast('ছবির সাইজ অনেক বড় (সর্বোচ্চ ১৫MB)।', 'warning');
      return;
    }

    try {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 180;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = Math.round(img.height * scaleSize);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          
          if (window.API) {
            await window.API.post('auth.php', { action: 'update_photo' }, { user_id: cur.id, photo: dataUrl });
          }
          const users = JSON.parse(localStorage.getItem('meal_users')) || [];
          const idx = users.findIndex(u => u.id === cur.id);
          if(idx > -1) {
            users[idx].photo = dataUrl;
            localStorage.setItem('meal_users', JSON.stringify(users));
          }
          cur.photo = dataUrl;
          localStorage.setItem('currentUser', JSON.stringify(cur));
          showToast('প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে!');
          loadProfiles();
        } catch (err) {
          showToast(err.message || 'ছবি আপডেট করতে সমস্যা হয়েছে', 'error');
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        showToast('ছবিটি পড়া যায়নি, দয়া করে অন্য ছবি নির্বাচন করুন।', 'error');
      };
      img.src = blobUrl;
    } catch (err) {
      showToast('ছবি প্রসেস করতে ব্যর্থ হয়েছে', 'error');
    }
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
          <div class="flex items-center gap-2">
            <span class="text-muted" style="font-size:0.75rem;">${dStr}</span>
            <button class="btn btn-danger btn-sm btn-del-user-notice" data-id="${n.id}" title="নোটিশটি মুছে ফেলুন" style="padding:2px 8px; font-size:0.72rem; line-height:1;"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <p style="margin:0; font-size:0.95rem; line-height:1.5;">${n.message}</p>
      </div>`;
    }).join('');

    // Attach delete notice event listeners
    list.querySelectorAll('.btn-del-user-notice').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        try {
          const allN = JSON.parse(localStorage.getItem('meal_notifications')) || [];
          localStorage.setItem('meal_notifications', JSON.stringify(allN.filter(x => String(x.id) !== String(id))));
          showToast('নোটিশ মুছে ফেলা হয়েছে।');
          loadUserNotices();

          if (window.API) {
            await window.API.post('notifications.php', { action: 'delete' }, { id });
            await window.API.syncState();
            loadUserNotices();
          }
        } catch(err) {
          showToast(err.message || 'Error deleting notice', 'error');
        }
      });
    });
  }

  // Clear all user notices button handler
  document.getElementById('clearAllUserNoticesBtn')?.addEventListener('click', async () => {
    if (!curProj) return;
    if (!confirm('আপনি কি এই নোটিশ বোর্ডের সকল নোটিশ মুছে ফেলতে চান?')) return;
    try {
      const allN = JSON.parse(localStorage.getItem('meal_notifications')) || [];
      const remaining = allN.filter(n => (n.projectId || n.project_id) !== curProj.id);
      localStorage.setItem('meal_notifications', JSON.stringify(remaining));
      showToast('সকল নোটিশ মুছে ফেলা হয়েছে।');
      loadUserNotices();

      if (window.API) {
        await window.API.post('notifications.php', { action: 'clear_all' }, { project_id: curProj.id, user_id: cur.id });
        await window.API.syncState();
        loadUserNotices();
      }
    } catch(err) {
      showToast(err.message || 'Error clearing notices', 'error');
    }
  });

  document.getElementById('enableNotifyBtn')?.addEventListener('click', async () => {
    if (window.MealNotifications?.requestPermission) {
      await window.MealNotifications.requestPermission();
    }
  });

  // ─── Monthly Bills (User View, Per-person Breakdown & PDF) ───
  function getUserBillsMonth() {
    const monthEl = document.getElementById('billsUserMonth');
    if (monthEl && monthEl.dataset.userChanged === 'true' && monthEl.value) {
      return monthEl.value;
    }
    // Auto-detect latest saved bill month for this project
    if (curProj) {
      const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
      const projBills = bills.filter(x => String(x.projectId || x.project_id) === String(curProj.id))
                             .sort((a, b) => (b.monthYear || b.month_year || '').localeCompare(a.monthYear || a.month_year || ''));
      if (projBills.length > 0) {
        const latestSavedMonth = projBills[0].monthYear || projBills[0].month_year;
        if (latestSavedMonth) {
          if (monthEl) monthEl.value = latestSavedMonth;
          return latestSavedMonth;
        }
      }
    }
    if (monthEl && monthEl.value) return monthEl.value;
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const defaultMonth = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 7);
    if (monthEl) monthEl.value = defaultMonth;
    return defaultMonth;
  }

  const userBillsMonthInp = document.getElementById('billsUserMonth');
  if (userBillsMonthInp) {
    userBillsMonthInp.addEventListener('change', () => {
      userBillsMonthInp.dataset.userChanged = 'true';
      loadUserBills();
    });
  }

  function loadUserBills() {
    if (!curProj) return;
    const curMonthStr = getUserBillsMonth();
    
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const approvedMems = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProj.id) && e.status === 'approved');
    const memCount = Math.max(1, approvedMems.length);

    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const b = bills.find(x => String(x.projectId || x.project_id) === String(curProj.id) && String(x.monthYear || x.month_year) === String(curMonthStr));

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
      const val = getBillVal(b, def.key, def.altKey);
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
        bBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4"><i class="fas fa-info-circle"></i> এই মাসের (${curMonthStr}) জন্য এখনো কোনো মাসিক বিল যুক্ত করা হয়নি। নিচে পূর্ববর্তী মাসের রেকর্ড দেখুন।</td></tr>`;
      } else {
        bBody.innerHTML = tableHtml;
      }
    }

    // ─── Render All Months Bills History Table ───
    const histBody = document.getElementById('userBillsHistoryBody');
    if (histBody) {
      const projBills = bills.filter(x => String(x.projectId || x.project_id) === String(curProj.id))
                             .sort((a, b) => (b.monthYear || b.month_year || '').localeCompare(a.monthYear || a.month_year || ''));
      if (!projBills.length) {
        histBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">এখনো কোনো মাসিক বিল সেভ করা হয়নি।</td></tr>';
      } else {
        histBody.innerHTML = projBills.map(bRow => {
          const mTotal = (getBillVal(bRow, 'houseRent', 'house_rent') +
            getBillVal(bRow, 'cookSalary', 'cook_salary') +
            getBillVal(bRow, 'wifiBill', 'wifi_bill') +
            getBillVal(bRow, 'gasBill', 'gas_bill') +
            getBillVal(bRow, 'electricityBill', 'electricity_bill') +
            getBillVal(bRow, 'garbageBill', 'garbage_bill') +
            getBillVal(bRow, 'otherBills', 'other_bills'));
          const mShare = mTotal / memCount;
          const rowMonth = bRow.monthYear || bRow.month_year;
          const isSelected = rowMonth === curMonthStr;

          return `<tr style="${isSelected ? 'background:rgba(79,142,247,0.12); font-weight:bold;' : ''}">
            <td>
              <button type="button" class="btn btn-outline btn-sm btn-select-bill-month" data-month="${rowMonth}" style="padding:.2rem .6rem; font-size:.78rem; cursor:pointer;">
                <i class="far fa-calendar-alt"></i> ${rowMonth} ${isSelected ? '(চলতি)' : ''}
              </button>
            </td>
            <td class="tc">${getBillVal(bRow, 'houseRent', 'house_rent').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'cookSalary', 'cook_salary').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'wifiBill', 'wifi_bill').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'gasBill', 'gas_bill').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'electricityBill', 'electricity_bill').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'garbageBill', 'garbage_bill').toFixed(0)} ৳</td>
            <td class="tc">${getBillVal(bRow, 'otherBills', 'other_bills').toFixed(0)} ৳</td>
            <td class="tc font-bold">${mTotal.toFixed(2)} ৳</td>
            <td class="tc font-bold text-gradient">${mShare.toFixed(2)} ৳</td>
          </tr>`;
        }).join('');

        histBody.querySelectorAll('.btn-select-bill-month').forEach(btn => {
          btn.addEventListener('click', e => {
            const m = e.currentTarget.dataset.month;
            const mInp = document.getElementById('billsUserMonth');
            if (mInp) {
              mInp.dataset.userChanged = 'true';
              mInp.value = m;
              loadUserBills();
            }
          });
        });
      }
    }
  }

  window.loadUserBills = loadUserBills;

  // ─── Download User Bills PDF ───
  document.getElementById('downloadUserBillsPdfBtn')?.addEventListener('click', async () => {
    const area = document.getElementById('userBillsPdfArea');
    if (!area || !curProj) return;

    const btn = document.getElementById('downloadUserBillsPdfBtn');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#ef4444;"></i> PDF তৈরি হচ্ছে...';
    }

    try {
      const curMonthStr = getUserBillsMonth();

      const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
      const approvedMems = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProj.id) && e.status === 'approved');
      const memCount = Math.max(1, approvedMems.length);

      const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
      const b = bills.find(x => String(x.projectId || x.project_id) === String(curProj.id) && String(x.monthYear || x.month_year) === String(curMonthStr));

      const users = JSON.parse(localStorage.getItem('meal_users')) || [];
      const managerUser = users.find(u => u.id === (curProj.adminId || curProj.admin_id));

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
      let pdfTableHtml = '';
      let sl = 1;

      userBillDefs.forEach(def => {
        const val = getBillVal(b, def.key, def.altKey);
        grandTotal += val;
        const perHead = val / memCount;
        pdfTableHtml += `<tr style="border-bottom:1px solid #e2e8f0; background:${sl % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:10px 14px; text-align:left; font-size:0.85rem; color:#64748b;">${sl++}</td>
          <td style="padding:10px 14px; text-align:left; font-size:0.9rem; font-weight:600; color:#0f172a;">${def.name}</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; font-weight:700; color:#0f172a;">${val.toFixed(2)} ৳</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; color:#475569;">${memCount} জন</td>
          <td style="padding:10px 14px; text-align:right; font-size:0.95rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
        </tr>`;
      });

      customBills.forEach(cb => {
        const val = parseFloat(cb.amount) || 0;
        grandTotal += val;
        const perHead = val / memCount;
        const title = cb.name.trim() || 'অন্যান্য বিল';
        pdfTableHtml += `<tr style="border-bottom:1px solid #e2e8f0; background:${sl % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:10px 14px; text-align:left; font-size:0.85rem; color:#64748b;">${sl++}</td>
          <td style="padding:10px 14px; text-align:left; font-size:0.9rem; font-weight:600; color:#0f172a;">📌 ${title}</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; font-weight:700; color:#0f172a;">${val.toFixed(2)} ৳</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; color:#475569;">${memCount} জন</td>
          <td style="padding:10px 14px; text-align:right; font-size:0.95rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
        </tr>`;
      });

      const myShareGrand = grandTotal / memCount;

      // Grand Total Row
      pdfTableHtml += `<tr style="background:#f1f5f9; border-top:2px solid #2563eb; font-weight:bold;">
        <td style="padding:12px 14px; text-align:left; font-size:0.95rem; color:#0f172a;" colspan="2">সর্বমোট মেস বিল (Grand Total)</td>
        <td style="padding:12px 14px; text-align:center; font-size:1.1rem; color:#d97706; font-weight:800;">${grandTotal.toFixed(2)} ৳</td>
        <td style="padding:12px 14px; text-align:center; font-size:0.95rem; color:#0f172a;">${memCount} জন</td>
        <td style="padding:12px 14px; text-align:right; font-size:1.15rem; color:#2563eb; font-weight:800;">${myShareGrand.toFixed(2)} ৳</td>
      </tr>`;

      // Members Breakdown List
      const memsHtml = approvedMems.map((m, idx) => {
        const u = users.find(x => x.id === (m.userId || m.user_id));
        const uName = u ? u.name : 'মেম্বার ' + (idx + 1);
        const isMe = (m.userId || m.user_id) === cur.id;
        return `<div style="padding:7px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:0.82rem; display:flex; justify-content:space-between; align-items:center;">
          <span><strong>${idx + 1}. ${uName}</strong> ${isMe ? '<span style="color:#2563eb; font-weight:700; font-size:0.75rem;">(আপনি)</span>' : ''}</span>
          <span style="font-weight:700; color:#2563eb;">${myShareGrand.toFixed(2)} ৳</span>
        </div>`;
      }).join('');

      // Populate Template
      const invNo = 'INV-' + curMonthStr.replace('-', '') + '-' + String(curProj.id).slice(-4).toUpperCase();
      const pInv = document.getElementById('pdfUserInvoiceNo');
      const pName = document.getElementById('pdfUserProjName');
      const pMgr = document.getElementById('pdfUserManagerName');
      const pMonth = document.getElementById('pdfUserMonth');
      const pMemName = document.getElementById('pdfUserMemberName');
      const pMemEmail = document.getElementById('pdfUserMemberEmail');
      const pTotal = document.getElementById('pdfUserGrandTotal');
      const pMem = document.getElementById('pdfUserMemCount');
      const pShare = document.getElementById('pdfUserMyShare');
      const pDate = document.getElementById('pdfUserPrintDate');
      const pBody = document.getElementById('pdfUserBillsTableBody');
      const pMemsList = document.getElementById('pdfUserMembersList');

      if (pInv) pInv.textContent = invNo;
      if (pName) pName.textContent = curProj.name;
      if (pMgr) pMgr.textContent = managerUser ? managerUser.name : 'মেস ম্যানেজার';
      if (pMonth) pMonth.textContent = curMonthStr;
      if (pMemName) pMemName.textContent = cur.name;
      if (pMemEmail) pMemEmail.textContent = cur.email || '—';
      if (pTotal) pTotal.textContent = grandTotal.toFixed(2) + ' ৳';
      if (pMem) pMem.textContent = memCount + ' জন';
      if (pShare) pShare.textContent = myShareGrand.toFixed(2) + ' ৳';
      if (pDate) pDate.textContent = new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
      if (pBody) pBody.innerHTML = pdfTableHtml;
      if (pMemsList) pMemsList.innerHTML = memsHtml;

      // Small async tick for paint completion
      await new Promise(r => setTimeout(r, 150));

      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `MealManager_Bill_${curMonthStr}_${cur.name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(area).save();
      showToast('মাসিক বিলের PDF সফলভাবে ডাউনলোড হয়েছে! 📄');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('PDF তৈরিতে সমস্যা হয়েছে: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
      }
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // All Members Meals Tracker (Read-Only Monthly Sheet for Members)
  // ═════════════════════════════════════════════════════════════════════════════
  let _sheetMonthUser = new Date().toISOString().slice(0, 7);

  function initSheetControlsUser() {
    const monthInp = document.getElementById('userSheetMonth');
    if (monthInp && !monthInp._bound) {
      monthInp._bound = true;
      monthInp.value = _sheetMonthUser;
      monthInp.addEventListener('change', () => {
        if (monthInp.value) {
          _sheetMonthUser = monthInp.value;
          loadAllMealsSheet();
        }
      });
      document.getElementById('userSheetPrevMonth')?.addEventListener('click', () => {
        const parts = _sheetMonthUser.split('-');
        let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
        if (m < 1) { m = 12; y--; }
        _sheetMonthUser = `${y}-${String(m).padStart(2, '0')}`;
        monthInp.value = _sheetMonthUser;
        loadAllMealsSheet();
      });
      document.getElementById('userSheetNextMonth')?.addEventListener('click', () => {
        const parts = _sheetMonthUser.split('-');
        let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) + 1;
        if (m > 12) { m = 1; y++; }
        _sheetMonthUser = `${y}-${String(m).padStart(2, '0')}`;
        monthInp.value = _sheetMonthUser;
        loadAllMealsSheet();
      });
      document.getElementById('userPrintSheetBtn')?.addEventListener('click', () => {
        window.print();
      });
    }
  }

  window.loadAllMealsSheet = async function() {
    if (!curProj) return;
    initSheetControlsUser();

    // Fetch fresh meals from API if possible
    if (window.API) {
      try {
        const res = await window.API.get('meals.php', { action: 'list', project_id: curProj.id });
        if (res && Array.isArray(res.records)) {
          const localR = JSON.parse(localStorage.getItem('meal_records') || '[]');
          const otherProjR = localR.filter(x => (x.projectId || x.project_id) !== curProj.id);
          localStorage.setItem('meal_records', JSON.stringify([...otherProjR, ...res.records]));
        }
      } catch (e) {}
    }

    renderAllMealsSheetTable(
      curProj.id,
      _sheetMonthUser,
      'userMealSheetHead',
      'userMealSheetBody',
      'userMealSheetFoot',
      'userSheetTotalMembers',
      'userSheetMonthGrandMeals',
      'userSheetTodayGrandMeals'
    );
  };

  function renderAllMealsSheetTable(projId, yearMonth, theadId, tbodyId, tfootId, kpiMemId, kpiMonthId, kpiTodayId) {
    const thead = document.getElementById(theadId);
    const tbody = document.getElementById(tbodyId);
    const tfoot = document.getElementById(tfootId);
    if (!thead || !tbody || !tfoot) return;

    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().slice(0, 10);
    const weekdaysBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments') || '[]');
    const users = JSON.parse(localStorage.getItem('meal_users') || '[]');
    const records = JSON.parse(localStorage.getItem('meal_records') || '[]');

    const approvedEnrolls = enrolls.filter(e => (e.projectId || e.project_id) === projId && e.status === 'approved');
    const members = approvedEnrolls.map(e => {
      const uid = e.userId || e.user_id;
      const u = users.find(x => String(x.id) === String(uid)) || { id: uid, name: 'Member (' + String(uid).slice(0,4) + ')', photo: null };
      return { id: uid, name: u.name, photo: u.photo };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Update member count KPI
    const kpiMem = document.getElementById(kpiMemId);
    if (kpiMem) kpiMem.textContent = members.length + ' জন';

    if (members.length === 0) {
      thead.innerHTML = `<tr><th>তারিখ / দিন</th><th class="sticky-total">মোট মিল</th></tr>`;
      tbody.innerHTML = `<tr><td colspan="2" class="tc text-muted" style="padding:2rem;">এই প্রজেক্টে এখনো কোনো অনুমোদিত সদস্য নেই।</td></tr>`;
      tfoot.innerHTML = '';
      return;
    }

    // 1. Build Header Row (Top: Member Names!)
    let headHtml = `<tr><th class="sticky-col" style="min-width:100px;">তারিখ / দিন</th>`;
    members.forEach(m => {
      const initial = (m.name || 'M').charAt(0).toUpperCase();
      const avatarHtml = m.photo
        ? `<img src="${m.photo}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; border:1px solid var(--glass-border);">`
        : `<div style="width:26px; height:26px; border-radius:50%; background:var(--primary); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">${initial}</div>`;
      
      headHtml += `<th class="tc" style="min-width:105px; padding:10px 8px;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          ${avatarHtml}
          <span style="font-weight:700; font-size:0.85rem; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.name}">${m.name}</span>
        </div>
      </th>`;
    });
    headHtml += `<th class="sticky-total tc" style="min-width:90px;">দৈনিক মোট</th></tr>`;
    thead.innerHTML = headHtml;

    // 2. Build Body Rows (Side: Dates 1 to 31!)
    const memberTotals = new Array(members.length).fill(0);
    let monthGrandTotal = 0;
    let todayGrandTotal = 0;

    let bodyHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, d);
      const dayName = weekdaysBn[dayDate.getDay()];
      const isToday = (dStr === todayStr);

      let dailyTotal = 0;
      let rowHtml = `<tr class="${isToday ? 'today-row' : ''}">`;
      
      // Date Column (Sticky Left)
      const dateLabel = isToday 
        ? `<span class="badge badge-blue" style="font-size:0.75rem; padding:2px 8px; font-weight:700;"><i class="fas fa-calendar-day"></i> ${d} (${dayName})</span>` 
        : `<strong>${d}</strong> <span style="font-size:0.75rem; opacity:0.8;">(${dayName})</span>`;
      rowHtml += `<td class="sticky-col tc">${dateLabel}</td>`;

      // Each Member's Meal Cell for day d
      members.forEach((m, mIdx) => {
        const r = records.find(x => (x.projectId || x.project_id) === projId && (x.userId || x.user_id) === m.id && x.date === dStr);
        let count = 0;
        let details = [];
        if (r) {
          if (r.breakfast) { count += 0.5; details.push('সকাল (0.5)'); }
          if (r.lunch) { count += 1.0; details.push('দুপুর (1.0)'); }
          if (r.dinner) { count += 1.0; details.push('রাত (1.0)'); }
        }

        memberTotals[mIdx] += count;
        dailyTotal += count;

        const tooltip = details.length > 0 ? `${m.name} (${dStr}): ${details.join(', ')} = ${count} মিল` : `${m.name}: কোনো মিল নেই`;
        const chipClass = count >= 2.5 ? 'full' : count >= 1.0 ? 'med' : count > 0 ? 'half' : 'zero';
        const displayVal = count > 0 ? count : '-';

        rowHtml += `<td class="tc">
          <span class="meal-sheet-chip ${chipClass}" title="${tooltip}">${displayVal}</span>
        </td>`;
      });

      monthGrandTotal += dailyTotal;
      if (isToday) todayGrandTotal = dailyTotal;

      // Daily Total Column (Sticky Right)
      rowHtml += `<td class="sticky-total tc">
        <strong style="font-size:0.88rem; color:${dailyTotal > 0 ? 'var(--text)' : 'var(--text-muted)'};">${dailyTotal > 0 ? dailyTotal : '-'}</strong>
      </td></tr>`;

      bodyHtml += rowHtml;
    }
    tbody.innerHTML = bodyHtml;

    // 3. Build Footer Row (Member Monthly Totals)
    let footHtml = `<tr class="footer-row"><td class="sticky-col tc" style="font-weight:800; font-size:0.85rem;">সদস্যদের মোট</td>`;
    members.forEach((m, mIdx) => {
      const tot = memberTotals[mIdx];
      footHtml += `<td class="tc">
        <span class="badge badge-blue" style="font-size:0.85rem; font-weight:800; padding:4px 10px;">${tot}</span>
      </td>`;
    });
    footHtml += `<td class="sticky-total tc" style="font-size:1.05rem; color:var(--primary); font-weight:900;">${monthGrandTotal}</td></tr>`;
    tfoot.innerHTML = footHtml;

    // Update KPI summaries
    const kpiMonth = document.getElementById(kpiMonthId);
    if (kpiMonth) kpiMonth.textContent = monthGrandTotal;
    const kpiToday = document.getElementById(kpiTodayId);
    if (kpiToday) kpiToday.textContent = todayGrandTotal;
  }
}

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUserApp);
} else {
  initUserApp();
}
