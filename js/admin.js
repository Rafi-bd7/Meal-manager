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

function initAdminApp() {
  const cur = JSON.parse(localStorage.getItem('meal_currentUser'));
  if (!cur || cur.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('adminNameDisplay').textContent = cur.name;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('meal_currentUser');
    window.location.href = 'login.html';
  });

  // Sync state between tabs and API
  let shownNotifs = new Set((JSON.parse(localStorage.getItem('meal_notifications')) || []).map(n => n.id));

  window.addEventListener('storage', e => {
    if (!e.key || e.key === 'meal_projects') loadProjects();
    if (!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments'].includes(e.key)) refresh();
    
    if (!e.key || e.key === 'meal_notifications') {
      const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
      notifs.forEach(n => {
        if (!shownNotifs.has(n.id)) {
          shownNotifs.add(n.id);
          if (curProjId && n.projectId === curProjId && (n.to === 'admin' || n.to === cur.id)) {
            showToast(n.message, 'info');
          }
        }
      });
    }
  });

  // Tab switching logic
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    refresh();
  }));

  // Projects logic
  let curProjId = localStorage.getItem('meal_adminLastProj') || '';

  function loadProjects() {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    
    const myProjects = projects.filter(p => {
      const pAdmin = p.adminId || p.admin_id;
      if (pAdmin === cur.id || !pAdmin) return true; // Creator or legacy
      const en = enrolls.find(e => (e.projectId || e.project_id) === p.id && (e.userId || e.user_id) === cur.id && e.status === 'approved');
      return !!en; // Approved co-admin
    });
    
    const sel = document.getElementById('projectSelect');
    const currentVal = sel.value;
    
    sel.innerHTML = '<option value="">— Select Month —</option>';
    myProjects.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
    
    // Auto-select logic
    if (currentVal && myProjects.find(p => p.id === currentVal)) {
      sel.value = currentVal;
    } else if (!curProjId && myProjects.length > 0) {
      curProjId = myProjects[myProjects.length - 1].id;
      sel.value = curProjId;
    } else if (curProjId && myProjects.find(p => p.id === curProjId)) {
      sel.value = curProjId;
    } else {
      curProjId = '';
      sel.value = '';
    }
  }
  loadProjects();
  if (window.initChat) window.initChat(cur, () => curProjId);

  // Create Project
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('newProjectPanel').classList.remove('hidden');
  });
  document.getElementById('cancelNewProject').addEventListener('click', () => {
    document.getElementById('newProjectPanel').classList.add('hidden');
    document.getElementById('newProjectName').value = '';
  });
  document.getElementById('confirmNewProject').addEventListener('click', async () => {
    const name = document.getElementById('newProjectName').value.trim();
    if(!name) return showToast('Enter project name', 'error');
    
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return showToast('Project with this name already exists!', 'error');
    }

    try {
      if (window.API) {
        const res = await window.API.post('projects.php', { action: 'create' }, { name, admin_id: cur.id });
        projects.push(res.project);
        localStorage.setItem('meal_projects', JSON.stringify(projects));
        curProjId = res.project.id;
      } else {
        const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
        const menu = {}; days.forEach(d => menu[d] = {b:'', l:'', d:''});
        const p = { id: Date.now().toString(), name, adminId: cur.id, menu };
        projects.push(p);
        localStorage.setItem('meal_projects', JSON.stringify(projects));
        curProjId = p.id;
      }
      
      showToast('Project Created!');
      document.getElementById('newProjectPanel').classList.add('hidden');
      document.getElementById('newProjectName').value = '';
      
      localStorage.setItem('meal_adminLastProj', curProjId);
      loadProjects();
      document.getElementById('projectSelect').value = curProjId;
      document.getElementById('projectSelect').dispatchEvent(new Event('change'));
    } catch (err) {
      showToast(err.message || 'Failed to create project', 'error');
    }
  });

  // Admin Join Project Logic
  document.getElementById('joinAdminProjectBtn')?.addEventListener('click', () => {
    document.getElementById('joinProjectPanel').classList.remove('hidden');
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const sel = document.getElementById('allProjectsSelect');
    sel.innerHTML = '<option value="">— Select Project to Join —</option>';
    
    projects.forEach(p => {
      const pAdmin = p.adminId || p.admin_id;
      if (pAdmin === cur.id) return;
      const en = enrolls.find(e => (e.projectId || e.project_id) === p.id && (e.userId || e.user_id) === cur.id);
      if (en) return;
      sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
  });

  document.getElementById('cancelJoinProject')?.addEventListener('click', () => {
    document.getElementById('joinProjectPanel').classList.add('hidden');
  });

  document.getElementById('confirmJoinProject')?.addEventListener('click', async () => {
    const pid = document.getElementById('allProjectsSelect').value;
    if (!pid) return showToast('Select a project', 'error');
    
    try {
      if (window.API) {
        await window.API.post('enrollments.php', { action: 'request_join' }, { project_id: pid, user_id: cur.id });
      }
      const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
      const newEn = { projectId: pid, userId: cur.id, status: 'pending', moneyGiven: 0 };
      enrolls.push(newEn);
      localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
      
      showToast('Co-Admin Request Sent to Creator!');
      document.getElementById('joinProjectPanel').classList.add('hidden');
    } catch (err) {
      showToast(err.message || 'Request failed', 'error');
    }
  });

  // Delete Project
  document.getElementById('delProjectBtn')?.addEventListener('click', async () => {
    if (!curProjId) return;
    if (!confirm('Are you sure you want to completely delete this project? This will remove all meals, deposits, and members associated with this project. This action CANNOT be undone!')) return;
    
    try {
      if (window.API) {
        await window.API.post('projects.php', { action: 'delete' }, { project_id: curProjId });
      }

      // Delete locally
      let projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
      projects = projects.filter(p => p.id !== curProjId);
      localStorage.setItem('meal_projects', JSON.stringify(projects));
      
      let enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
      enrolls = enrolls.filter(e => (e.projectId || e.project_id) !== curProjId);
      localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));

      let records = JSON.parse(localStorage.getItem('meal_records')) || [];
      records = records.filter(r => (r.projectId || r.project_id) !== curProjId);
      localStorage.setItem('meal_records', JSON.stringify(records));

      let comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
      comments = comments.filter(c => (c.projectId || c.project_id) !== curProjId);
      localStorage.setItem('meal_comments', JSON.stringify(comments));

      showToast('Project deleted permanently.');
      curProjId = '';
      localStorage.removeItem('meal_adminLastProj');
      loadProjects();
      document.getElementById('projectSelect').dispatchEvent(new Event('change'));
    } catch (err) {
      showToast(err.message || 'Failed to delete project', 'error');
    }
  });

  // Project Selection Change
  document.getElementById('projectSelect').addEventListener('change', e => {
    curProjId = e.target.value;
    localStorage.setItem('meal_adminLastProj', curProjId);
    
    if (curProjId) {
      document.getElementById('workspace').classList.remove('hidden');
      document.getElementById('exportPdfBtn').classList.remove('hidden');
      
      const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
      const p = projects.find(x => x.id === curProjId);
      const pAdmin = p ? (p.adminId || p.admin_id) : '';
      if (p && pAdmin === cur.id) {
        document.getElementById('delProjectBtn')?.classList.remove('hidden');
      } else {
        document.getElementById('delProjectBtn')?.classList.add('hidden');
      }
      
      document.getElementById('pdfTitle').innerHTML = `<i class="fas fa-file-invoice" style="color:var(--primary);"></i> ${e.target.options[e.target.selectedIndex].text}`;
      loadMenu();
      refresh();
    } else {
      document.getElementById('workspace').classList.add('hidden');
      document.getElementById('exportPdfBtn').classList.add('hidden');
      document.getElementById('delProjectBtn')?.classList.add('hidden');
    }
    window.dispatchEvent(new Event('refreshChat'));
  });

  // Set default date for tracker
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  const localDate = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  const tDate = document.getElementById('trackerDate');
  if(tDate) { tDate.value = localDate; tDate.addEventListener('change', loadTracker); }

  if (curProjId) {
    document.getElementById('projectSelect').dispatchEvent(new Event('change'));
  }

  function refresh() {
    if (!curProjId) return;
    loadMembers();
    calculateFinances();
    loadTracker();
    loadComments();
    loadProfiles();
    if (typeof loadBazaar === 'function') loadBazaar();
    if (typeof loadBills === 'function') loadBills();
    if (typeof loadNotices === 'function') loadNotices();
  }


  // ─── Add New Member ───
  document.getElementById('addNewMemberBtn')?.addEventListener('click', () => {
    document.getElementById('newMemberPanel').classList.remove('hidden');
  });
  document.getElementById('cancelNewMember')?.addEventListener('click', () => {
    document.getElementById('newMemberPanel').classList.add('hidden');
    document.getElementById('newMemName').value = '';
    document.getElementById('newMemEmail').value = '';
    document.getElementById('newMemPassword').value = '';
  });
  document.getElementById('confirmNewMember')?.addEventListener('click', async () => {
    const name = document.getElementById('newMemName').value.trim();
    const email = document.getElementById('newMemEmail').value.trim().toLowerCase();
    const password = document.getElementById('newMemPassword').value;
    
    if(!name || !email || !password) return showToast('Please fill all fields', 'error');
    if(!curProjId) return showToast('Select a project first', 'error');

    try {
      if (window.API) {
        const res = await window.API.post('auth.php', { action: 'register' }, { name, email, password, role: 'user' });
        const uid = res.user.id;
        await window.API.post('enrollments.php', { action: 'request_join' }, { project_id: curProjId, user_id: uid });
        await window.API.post('enrollments.php', { action: 'approve' }, { project_id: curProjId, user_id: uid });
        await window.API.syncState();
      } else {
        const users = JSON.parse(localStorage.getItem('meal_users')) || [];
        if(users.find(u => u.email === email)) return showToast('Email already registered!', 'error');
        const uid = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newUser = { id: uid, name, email, password, role: 'user' };
        users.push(newUser);
        localStorage.setItem('meal_users', JSON.stringify(users));

        const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
        enrolls.push({ projectId: curProjId, userId: uid, status: 'approved', moneyGiven: 0 });
        localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
      }
      
      showToast('Member added to database & project!');
      document.getElementById('cancelNewMember').click();
      refresh();
    } catch (err) {
      showToast(err.message || 'Failed to add member', 'error');
    }
  });

  // ─── Members & Approvals ───
  function loadMembers() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pEnrolls = enrolls.filter(e => (e.projectId || e.project_id) === curProjId);
    
    const rBody = document.getElementById('requestsBody');
    const mBody = document.getElementById('membersBody');
    rBody.innerHTML = ''; mBody.innerHTML = '';

    pEnrolls.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      if(!u) return;
      const roleBadge = u.role === 'admin' ? `<span class="badge badge-purple" style="margin-left:5px;font-size:0.6rem;">Admin</span>` : '';
      if (en.status === 'pending') {
        rBody.innerHTML += `<tr>
          <td>${u.name} ${roleBadge}</td><td>${u.email}</td>
          <td><span class="badge badge-yellow">Pending</span></td>
          <td><button class="btn btn-success btn-sm btn-approve" data-id="${u.id}"><i class="fas fa-check"></i> Accept</button></td>
        </tr>`;
      } else if (en.status === 'approved') {
        mBody.innerHTML += `<tr>
          <td>${u.name} ${roleBadge}</td><td>${u.email}</td>
          <td><span class="badge badge-green"><i class="fas fa-check-circle"></i> Active</span></td>
          <td class="tc">
            <button class="btn btn-warning btn-sm btn-rem-mem-global" data-id="${u.id}" title="Remove from Project"><i class="fas fa-user-minus"></i></button>
            <button class="btn btn-danger btn-sm btn-del-user" data-id="${u.id}" title="Delete User Completely"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }
    });

    document.querySelectorAll('.btn-approve').forEach(b => b.addEventListener('click', async e => {
      const uid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('enrollments.php', { action: 'approve' }, { project_id: curProjId, user_id: uid });
        }
        const idx = enrolls.findIndex(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid);
        if (idx > -1) {
          enrolls[idx].status = 'approved';
          localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
        }
        showToast('Member Approved!');
        refresh();
      } catch (err) {
        showToast(err.message || 'Error approving member', 'error');
      }
    }));

    document.querySelectorAll('.btn-rem-mem-global').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Remove this member from the project?')) return;
      const uid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('enrollments.php', { action: 'remove' }, { project_id: curProjId, user_id: uid });
        }
        const nf = enrolls.filter(x => !((x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid));
        localStorage.setItem('meal_enrollments', JSON.stringify(nf));
        showToast('Removed from project.');
        refresh();
      } catch (err) {
        showToast(err.message || 'Error removing member', 'error');
      }
    }));

    document.querySelectorAll('.btn-del-user').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Delete this user COMPLETELY from the database? This cannot be undone!')) return;
      const uid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('auth.php', { action: 'delete_user' }, { user_id: uid });
        }
        const nUsers = users.filter(x => x.id !== uid);
        localStorage.setItem('meal_users', JSON.stringify(nUsers));
        const nEnrolls = enrolls.filter(x => (x.userId || x.user_id) !== uid);
        localStorage.setItem('meal_enrollments', JSON.stringify(nEnrolls));
        showToast('User deleted from database.');
        refresh();
      } catch (err) {
        showToast(err.message || 'Error deleting user', 'error');
      }
    }));
  }

  // ─── Daily Tracker ───
  function loadTracker() {
    const dStr = tDate.value;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => (e.projectId || e.project_id) === curProjId && e.status === 'approved');
    const tBody = document.getElementById('trackerBody');
    tBody.innerHTML = '';
    
    if(!mems.length) { tBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No active members.</td></tr>'; return; }

    mems.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      if(!u) return;
      const r = records.find(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid && x.date === dStr) || {breakfast:false, lunch:false, dinner:false};
      
      const allR = records.filter(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid);
      let tMonth = 0;
      allR.forEach(x => { if(x.breakfast) tMonth+=0.5; if(x.lunch) tMonth+=1; if(x.dinner) tMonth+=1; });

      let tToday = 0;
      if(r.breakfast) tToday += 0.5;
      if(r.lunch) tToday += 1;
      if(r.dinner) tToday += 1;

      const y = `<i class="fas fa-check-circle check-icon"></i>`;
      const n = `<i class="fas fa-times-circle cross-icon"></i>`;

      tBody.innerHTML += `<tr>
        <td><strong>${u.name}</strong></td>
        <td class="tc admin-meal-toggle" style="cursor:pointer;" data-uid="${u.id}" data-type="breakfast" title="Click to toggle meal">${r.breakfast ? y : n}</td>
        <td class="tc admin-meal-toggle" style="cursor:pointer;" data-uid="${u.id}" data-type="lunch" title="Click to toggle meal">${r.lunch ? y : n}</td>
        <td class="tc admin-meal-toggle" style="cursor:pointer;" data-uid="${u.id}" data-type="dinner" title="Click to toggle meal">${r.dinner ? y : n}</td>
        <td class="tc"><span class="meal-count-pill">${tToday}</span></td>
        <td class="tc font-bold text-gradient">${tMonth}</td>
      </tr>`;
    });

    document.querySelectorAll('.admin-meal-toggle').forEach(el => {
      el.addEventListener('click', async e => {
        const uid = e.currentTarget.dataset.uid;
        const type = e.currentTarget.dataset.type;
        
        let records = JSON.parse(localStorage.getItem('meal_records')) || [];
        const idx = records.findIndex(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid && x.date === dStr);
        
        let rObj;
        if(idx > -1) {
          rObj = records[idx];
          rObj[type] = !rObj[type];
          records[idx] = rObj;
        } else {
          rObj = { projectId: curProjId, userId: uid, date: dStr, breakfast: false, lunch: false, dinner: false };
          rObj[type] = true;
          records.push(rObj);
        }
        localStorage.setItem('meal_records', JSON.stringify(records));

        try {
          if (window.API) {
            await window.API.post('meals.php', { action: 'toggle' }, { project_id: curProjId, user_id: uid, date: dStr, type });
          }
          const u = users.find(x => x.id === uid);
          showToast(`Meal updated for ${u ? u.name : 'User'}!`);
          refresh();
        } catch (err) {
          showToast(err.message || 'Error updating meal', 'error');
        }
      });
    });
  }

  // ─── Finances ───
  function calculateFinances(force = false) {
    // If admin is currently typing in a deposit input, do not wipe the table unless force=true!
    const activeEl = document.activeElement;
    if (!force && activeEl && activeEl.classList.contains('deposit-input')) {
      return;
    }

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => (e.projectId || e.project_id) === curProjId && e.status === 'approved');
    
    let gMeals = 0, gMoney = 0;
    
    mems.forEach(en => {
      const uid = en.userId || en.user_id;
      gMoney += (parseFloat(en.moneyGiven || en.money_given) || 0);
      const mR = records.filter(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid);
      mR.forEach(x => { if(x.breakfast) gMeals+=0.5; if(x.lunch) gMeals+=1; if(x.dinner) gMeals+=1; });
    });

    const mRate = gMeals > 0 ? (gMoney / gMeals) : 0;
    
    document.getElementById('sTotalMeals').textContent = gMeals;
    document.getElementById('sTotalMoney').textContent = gMoney + ' ৳';
    document.getElementById('sMealRate').textContent = mRate.toFixed(2) + ' ৳';
    document.getElementById('pdfMeals').textContent = gMeals;
    document.getElementById('pdfMoney').textContent = gMoney + ' ৳';
    document.getElementById('pdfRate').textContent = mRate.toFixed(2) + ' ৳';

    const fBody = document.getElementById('financeBody');
    fBody.innerHTML = '';
    
    mems.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      if(!u) return;
      let uM = 0;
      records.filter(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid).forEach(x => {
        if(x.breakfast) uM+=0.5; if(x.lunch) uM+=1; if(x.dinner) uM+=1;
      });
      const cost = uM * mRate;
      const given = parseFloat(en.moneyGiven || en.money_given) || 0;
      const bal = cost - given;
      
      let balStr = bal > 0 ? `<span class="badge badge-yellow">${Math.abs(bal).toFixed(2)} ৳ Due</span>` :
                   bal < 0 ? `<span class="badge badge-green">${Math.abs(bal).toFixed(2)} ৳ Refund</span>` :
                   `<span class="badge badge-blue">0.00 ৳ Settled</span>`;

      fBody.innerHTML += `<tr>
        <td><strong>${u.name}</strong></td>
        <td class="tc">${uM}</td>
        <td class="tc text-gradient font-bold">${cost.toFixed(2)} ৳</td>
        <td>
          <div class="flex gap-2 justify-center items-center">
            <input type="number" step="any" min="0" inputmode="decimal" class="form-control deposit-input" data-id="${u.id}" value="${given}" onfocus="this.select()" style="width:110px; padding:.45rem .6rem; text-align:center; font-weight:600;">
            <button class="btn btn-primary btn-sm btn-save-dep" data-id="${u.id}" title="Save Deposit"><i class="fas fa-save"></i></button>
          </div>
        </td>
        <td class="tc">${balStr}</td>
        <td class="action-col tc"><button class="btn btn-danger btn-sm btn-rem-mem" data-id="${u.id}" title="Remove Member"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    });

    document.querySelectorAll('.btn-save-dep').forEach(b => b.addEventListener('click', async e => {
      const btn = e.currentTarget;
      const uid = btn.dataset.id;
      const inp = document.querySelector(`.deposit-input[data-id="${uid}"]`);
      const val = parseFloat(inp?.value) || 0;
      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      try {
        if (window.API) {
          await window.API.post('enrollments.php', { action: 'update_deposit' }, { project_id: curProjId, user_id: uid, money_given: val });
        }
        let allEnrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
        const idx = allEnrolls.findIndex(x => (x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid);
        if(idx > -1) {
          allEnrolls[idx].moneyGiven = val;
          allEnrolls[idx].money_given = val;
        } else {
          allEnrolls.push({
            id: `${curProjId}_${uid}`,
            projectId: curProjId,
            userId: uid,
            status: 'approved',
            moneyGiven: val,
            money_given: val
          });
        }
        localStorage.setItem('meal_enrollments', JSON.stringify(allEnrolls));

        const u = users.find(x => x.id === uid);
        const memName = u ? u.name : 'Member';
        showToast(`Deposit of ${val} ৳ saved for ${memName}!`);
        btn.innerHTML = '<i class="fas fa-check" style="color:#22c55e;"></i>';
        if (inp) inp.blur();
        calculateFinances(true);
        if (window.API) window.API.syncState().catch(() => {});
        setTimeout(() => {
          btn.innerHTML = origHtml;
          btn.disabled = false;
        }, 1200);
      } catch (err) {
        btn.innerHTML = origHtml;
        btn.disabled = false;
        showToast(err.message || 'Error saving deposit', 'error');
      }
    }));

    // Enter key saves deposit
    document.querySelectorAll('.deposit-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const uid = e.currentTarget.dataset.id;
          document.querySelector(`.btn-save-dep[data-id="${uid}"]`)?.click();
        }
      });
    });

    document.querySelectorAll('.btn-rem-mem').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Remove this member from the project?')) return;
      const uid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('enrollments.php', { action: 'remove' }, { project_id: curProjId, user_id: uid });
        }
        const nf = enrolls.filter(x => !((x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid));
        localStorage.setItem('meal_enrollments', JSON.stringify(nf));
        showToast('Member removed.');
        refresh();
      } catch (err) {
        showToast(err.message || 'Error removing member', 'error');
      }
    }));
  }

  // ─── Comments ───
  function loadComments() {
    const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pCom = comments.filter(c => (c.projectId || c.project_id) === curProjId).sort((a,b) => b.time - a.time);
    
    document.getElementById('commentBadge').textContent = pCom.length || '';
    const con = document.getElementById('commentsContainer');
    con.innerHTML = '';
    
    if(!pCom.length) { con.innerHTML = '<p class="text-center text-muted">No comments yet.</p>'; return; }
    
    pCom.forEach(c => {
      const uid = c.userId || c.user_id;
      const u = users.find(x => x.id === uid);
      const d = new Date(c.time).toLocaleString();
      con.innerHTML += `
        <div class="comment-box">
          <div class="comment-header">
            <div class="comment-avatar">${u ? u.name.charAt(0).toUpperCase() : '?'}</div>
            <div class="comment-author">${u ? u.name : 'Unknown'}</div>
            <div class="comment-time">${d}</div>
            <button class="btn btn-outline btn-sm ms-auto btn-del-com" data-id="${c.id}" style="padding:.2rem .4rem; margin-left:auto;"><i class="fas fa-times"></i></button>
          </div>
          <div class="comment-text">${c.text}</div>
        </div>
      `;
    });

    document.querySelectorAll('.btn-del-com').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Delete this comment?')) return;
      const cid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('comments.php', { action: 'delete' }, { id: cid });
        }
        const nCom = comments.filter(x => x.id !== cid);
        localStorage.setItem('meal_comments', JSON.stringify(nCom));
        loadComments();
      } catch (err) {
        showToast(err.message || 'Error deleting comment', 'error');
      }
    }));
  }

  // ─── Menu ───
  function loadMenu() {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const p = projects.find(x => x.id === curProjId);
    if(!p) return;
    const mb = document.getElementById('menuBody');
    mb.innerHTML = '';
    const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    const menuObj = p.menu || {};
    days.forEach(day => {
      const m = menuObj[day] || {b:'', l:'', d:''};
      mb.innerHTML += `<tr>
        <td><strong class="text-gradient">${day}</strong></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="b" value="${m.b || ''}"></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="l" value="${m.l || ''}"></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="d" value="${m.d || ''}"></td>
      </tr>`;
    });
  }

  document.getElementById('saveMenuBtn').addEventListener('click', async () => {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const pIdx = projects.findIndex(x => x.id === curProjId);
    if(pIdx === -1) return;
    projects[pIdx].menu = projects[pIdx].menu || {};
    document.querySelectorAll('.m-inp').forEach(inp => {
      if(!projects[pIdx].menu[inp.dataset.day]) projects[pIdx].menu[inp.dataset.day] = {};
      projects[pIdx].menu[inp.dataset.day][inp.dataset.type] = inp.value;
    });

    try {
      if (window.API) {
        await window.API.post('projects.php', { action: 'update_menu' }, { project_id: curProjId, menu: projects[pIdx].menu });
      }
      localStorage.setItem('meal_projects', JSON.stringify(projects));
      showToast('Menu saved!');
    } catch (err) {
      showToast(err.message || 'Error saving menu', 'error');
    }
  });

  // ─── PDF Export ───
  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const area = document.getElementById('pdfArea');
    const acts = area.querySelectorAll('.action-col, th:last-child, td:last-child');
    acts.forEach(x => x.style.display = 'none');
    
    // Replace inputs with text for printing
    const inps = area.querySelectorAll('.deposit-input');
    const oldHtml = [];
    inps.forEach((i, idx) => {
      oldHtml[idx] = i.parentNode.innerHTML;
      i.parentNode.innerHTML = i.value + ' ৳';
    });

    const opt = {
      margin: 0.5, filename: 'MealManager_Monthly_Report.pdf',
      image: {type:'jpeg', quality:0.98}, html2canvas: {scale:2, useCORS:true},
      jsPDF: {unit:'in', format:'letter', orientation:'landscape'}
    };
    html2pdf().set(opt).from(area).save().then(() => {
      calculateFinances();
    });
  });

  // ─── Backup & Restore ───
  const backupBtn = document.getElementById('backupBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreFile = document.getElementById('restoreFile');

  if(backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        let data;
        if (window.API) {
          data = await window.API.get('backup.php', { action: 'export' });
        } else {
          data = {
            meal_users: JSON.parse(localStorage.getItem('meal_users')) || [],
            meal_projects: JSON.parse(localStorage.getItem('meal_projects')) || [],
            meal_enrollments: JSON.parse(localStorage.getItem('meal_enrollments')) || [],
            meal_records: JSON.parse(localStorage.getItem('meal_records')) || [],
            meal_comments: JSON.parse(localStorage.getItem('meal_comments')) || [],
            meal_chats: JSON.parse(localStorage.getItem('meal_chats')) || []
          };
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MealManager_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Backup downloaded successfully!');
      } catch (err) {
        showToast('Backup failed: ' + err.message, 'error');
      }
    });
  }

  if(restoreBtn) {
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
            await window.API.syncState();
          }
          if (data.meal_users) localStorage.setItem('meal_users', JSON.stringify(data.meal_users));
          if (data.meal_projects) localStorage.setItem('meal_projects', JSON.stringify(data.meal_projects));
          if (data.meal_enrollments) localStorage.setItem('meal_enrollments', JSON.stringify(data.meal_enrollments));
          if (data.meal_records) localStorage.setItem('meal_records', JSON.stringify(data.meal_records));
          if (data.meal_comments) localStorage.setItem('meal_comments', JSON.stringify(data.meal_comments));
          showToast('Data restored successfully! Reloading...');
          setTimeout(() => window.location.reload(), 1200);
        } catch(err) {
          showToast('Invalid backup file!', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // ─── Profiles ───
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
    if(!curProjId) return;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const mems = enrolls.filter(e => (e.projectId || e.project_id) === curProjId && e.status === 'approved');
    
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
      const roleBadge = u.role === 'admin' ? '<span class="badge badge-purple">Admin</span>' : '<span class="badge badge-blue">Member</span>';
      
      // Plaintext password is safe and hidden; role badge displayed
      if(pb) pb.innerHTML += `<tr>
        <td>${photoHtml}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${roleBadge}</td>
      </tr>`;
    });
  }

  // ─── Bazaar / Daily Market Expenses ─────────────────────────────────────
  const _tzOffsetMs = (new Date()).getTimezoneOffset() * 60000;
  const _todayStr = (new Date(Date.now() - _tzOffsetMs)).toISOString().slice(0, 10);
  const _curMonthStr = _todayStr.slice(0, 7);

  // Init date/month pickers after DOM is ready
  function initExpenseControls() {
    const bm = document.getElementById('bazaarMonth');
    const bim = document.getElementById('billsMonth');
    const ed = document.getElementById('expDate');
    if (bm && !bm._inited) { bm.value = _curMonthStr; bm.addEventListener('change', loadBazaar); bm._inited = true; }
    if (bim && !bim._inited) { bim.value = _curMonthStr; bim.addEventListener('change', loadBills); bim._inited = true; }
    if (ed && !ed.value) ed.value = _todayStr;
  }
  initExpenseControls();

  function loadBazaar() {
    initExpenseControls();
    if (!curProjId) return;
    const bazaarMonthEl = document.getElementById('bazaarMonth');
    const month = bazaarMonthEl ? bazaarMonthEl.value : _curMonthStr;
    const expenses = JSON.parse(localStorage.getItem('meal_expenses')) || [];
    const users    = JSON.parse(localStorage.getItem('meal_users')) || [];

    const filtered = expenses.filter(ex => {
      const epid = ex.projectId || ex.project_id;
      const edate = ex.date || '';
      return epid === curProjId && edate.startsWith(month);
    });

    const today = _todayStr;
    const totalMonth = filtered.reduce((s, ex) => s + parseFloat(ex.amount || 0), 0);
    const totalToday = filtered.filter(ex => ex.date === today).reduce((s, ex) => s + parseFloat(ex.amount || 0), 0);

    const elM = document.getElementById('bazaarTotalMonth');
    const elT = document.getElementById('bazaarTotalToday');
    const elC = document.getElementById('bazaarEntryCount');
    if (elM) elM.textContent = totalMonth.toFixed(2) + ' ৳';
    if (elT) elT.textContent = totalToday.toFixed(2) + ' ৳';
    if (elC) elC.textContent = filtered.length;

    const body = document.getElementById('bazaarBody');
    if (!body) return;
    body.innerHTML = '';
    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">এই মাসে কোনো বাজার খরচের এন্ট্রি নেই।</td></tr>';
    } else {
      // Sort by date desc
      [...filtered].sort((a, b) => b.date.localeCompare(a.date)).forEach(ex => {
        const u = users.find(x => x.id === (ex.userId || ex.user_id));
        const catIcon = ex.category === 'bazaar' ? '🛒' : '📦';
        body.innerHTML += `<tr>
          <td><strong>${ex.date}</strong></td>
          <td>${ex.item}</td>
          <td class="tc"><span class="badge badge-blue">${catIcon} ${ex.category === 'bazaar' ? 'বাজার' : 'অন্য'}</span></td>
          <td class="tc font-bold text-gradient">${parseFloat(ex.amount).toFixed(2)} ৳</td>
          <td style="font-size:.82rem; color:var(--text-muted);">${ex.note || '—'}</td>
          <td class="tc"><button class="btn btn-danger btn-sm btn-del-expense" data-id="${ex.id}" style="padding:.25rem .5rem;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      });
    }

    // Daily group totals bar
    const dailyDiv = document.getElementById('bazaarDailyTotals');
    if (dailyDiv && filtered.length) {
      const byDay = {};
      filtered.forEach(ex => { byDay[ex.date] = (byDay[ex.date] || 0) + parseFloat(ex.amount || 0); });
      const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a)).slice(0, 10);
      dailyDiv.innerHTML = `<h4 style="font-size:.88rem; font-weight:700; margin-bottom:.75rem; color:var(--text-muted);"><i class="fas fa-chart-bar"></i> দৈনিক সারসংক্ষেপ</h4><div class="flex gap-2 flex-wrap">${
        sortedDays.map(d => `<div class="glass-panel" style="padding:.5rem .85rem; font-size:.82rem; border-color:rgba(79,142,247,.3); text-align:center;"><strong style="color:var(--primary);">${d}</strong><br><span class="text-gradient font-bold">${byDay[d].toFixed(0)} ৳</span></div>`).join('')
      }</div>`;
    } else if (dailyDiv) { dailyDiv.innerHTML = ''; }

    // Delete expense event
    body.querySelectorAll('.btn-del-expense').forEach(btn => btn.addEventListener('click', async e => {
      if (!confirm('এই খরচের এন্ট্রি মুছে ফেলবেন?')) return;
      const eid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('expenses.php', { action: 'delete' }, { id: eid, project_id: curProjId });
          await window.API.syncState();
        } else {
          const exps = JSON.parse(localStorage.getItem('meal_expenses')) || [];
          localStorage.setItem('meal_expenses', JSON.stringify(exps.filter(x => x.id !== eid)));
        }
        showToast('খরচ মুছে ফেলা হয়েছে।');
        loadBazaar();
      } catch (err) { showToast(err.message || 'Error deleting expense', 'error'); }
    }));
  }

  // Add expense button
  document.getElementById('addExpenseBtn')?.addEventListener('click', async () => {
    if (!curProjId) return showToast('প্রথমে একটি প্রজেক্ট সিলেক্ট করুন', 'error');
    const date   = document.getElementById('expDate').value || _todayStr;
    const item   = document.getElementById('expItem').value.trim();
    const amount = parseFloat(document.getElementById('expAmount').value) || 0;
    const cat    = document.getElementById('expCategory').value;
    const note   = document.getElementById('expNote').value.trim();

    if (!item) return showToast('পণ্যের নাম লিখুন', 'error');
    if (amount <= 0) return showToast('সঠিক টাকার পরিমাণ দিন', 'error');

    try {
      if (window.API) {
        await window.API.post('expenses.php', { action: 'add' }, {
          project_id: curProjId, user_id: cur.id,
          date, item, amount, category: cat, note
        });
        await window.API.syncState();
      } else {
        const exps = JSON.parse(localStorage.getItem('meal_expenses')) || [];
        exps.push({ id: 'exp_' + Date.now(), projectId: curProjId, userId: cur.id, date, item, amount, category: cat, note });
        localStorage.setItem('meal_expenses', JSON.stringify(exps));
      }
      document.getElementById('expItem').value = '';
      document.getElementById('expAmount').value = '';
      document.getElementById('expNote').value = '';
      showToast('খরচ যোগ করা হয়েছে! 🛒');
      loadBazaar();
    } catch (err) { showToast(err.message || 'Error adding expense', 'error'); }
  });

  // ─── Monthly Bills ─────────────────────────────────────────────────────
  const billFields = [
    { id: 'billHouseRent',   key: 'house_rent',        jsKey: 'houseRent',        name: '🏠 বাড়ি ভাড়া (House Rent)' },
    { id: 'billCookSalary',  key: 'cook_salary',       jsKey: 'cookSalary',       name: '👩‍🍳 রান্নার বুয়া/খালার বেতন (Cook Salary)' },
    { id: 'billWifi',        key: 'wifi_bill',         jsKey: 'wifiBill',         name: '📶 ওয়াই-ফাই বিল (Wi-Fi)' },
    { id: 'billGas',         key: 'gas_bill',          jsKey: 'gasBill',          name: '🔥 গ্যাস বিল (Gas)' },
    { id: 'billElectricity', key: 'electricity_bill',  jsKey: 'electricityBill',  name: '⚡ বিদ্যুৎ বিল (Electricity)' },
    { id: 'billGarbage',     key: 'garbage_bill',      jsKey: 'garbageBill',      name: '🗑️ ময়লার বিল (Garbage)' }
  ];

  let customBills = []; // [{ id, name, amount }]

  function getApprovedMemberCount() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const count = enrolls.filter(e => (e.projectId || e.project_id) === curProjId && e.status === 'approved').length;
    return count > 0 ? count : 1;
  }

  function renderCustomBills() {
    const container = document.getElementById('customBillsContainer');
    if (!container) return;
    const memCount = getApprovedMemberCount();
    container.innerHTML = '';

    if (!customBills.length) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem; margin:0.25rem 0;">কোনো অতিরিক্ত বিল যোগ করা হয়নি। প্রয়োজনে উপরের বাটনে চাপ দিন।</p>';
      return;
    }

    customBills.forEach((cb, idx) => {
      const perHead = (parseFloat(cb.amount) || 0) / memCount;
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-center flex-wrap p-2';
      row.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:0.75rem;';
      row.innerHTML = `
        <div style="flex:2; min-width:180px;">
          <input type="text" class="form-control cb-name" data-idx="${idx}" placeholder="বিলের নাম (যেমন: পানির বিল / সার্ভিস চার্জ)" value="${cb.name || ''}" style="padding:.5rem .75rem;">
        </div>
        <div style="flex:1; min-width:120px;">
          <input type="number" min="0" step="any" class="form-control cb-amount" data-idx="${idx}" placeholder="টাকা" value="${cb.amount !== 0 ? cb.amount : ''}" style="padding:.5rem .75rem;">
        </div>
        <div style="min-width:130px; text-align:center;">
          <span class="badge badge-blue" style="font-size:0.8rem;">মাথাপিছু: ${perHead.toFixed(2)} ৳</span>
        </div>
        <button type="button" class="btn btn-danger btn-sm btn-del-cb" data-idx="${idx}" title="Remove Item"><i class="fas fa-trash"></i></button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.cb-name').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        if (customBills[i]) customBills[i].name = e.target.value;
        renderBreakdownTable();
      });
    });

    container.querySelectorAll('.cb-amount').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        if (customBills[i]) customBills[i].amount = parseFloat(e.target.value) || 0;
        calcBillTotal();
      });
    });

    container.querySelectorAll('.btn-del-cb').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        customBills.splice(i, 1);
        renderCustomBills();
        calcBillTotal();
      });
    });
  }

  document.getElementById('addCustomBillBtn')?.addEventListener('click', () => {
    customBills.push({ id: 'cb_' + Date.now(), name: '', amount: 0 });
    renderCustomBills();
    calcBillTotal();
  });

  function calcBillTotal() {
    let standardTotal = 0;
    const memCount = getApprovedMemberCount();

    billFields.forEach(f => {
      const val = parseFloat(document.getElementById(f.id)?.value || 0);
      standardTotal += val;
      const phEl = document.getElementById('perHead_' + f.id);
      if (phEl) phEl.textContent = `মাথাপিছু: ${(val / memCount).toFixed(2)} ৳ (${memCount} জন)`;
    });

    let customTotal = 0;
    customBills.forEach(cb => { customTotal += (parseFloat(cb.amount) || 0); });

    const grandTotal = standardTotal + customTotal;
    const perHeadGrand = grandTotal / memCount;

    const gtEl = document.getElementById('billsGrandTotal');
    const mcEl = document.getElementById('billsMemberCount');
    const ppEl = document.getElementById('billsPerMember');
    const liveEl = document.getElementById('billsTotalLive');

    if (gtEl) gtEl.textContent = grandTotal.toFixed(2) + ' ৳';
    if (mcEl) mcEl.textContent = memCount + ' জন';
    if (ppEl) ppEl.textContent = perHeadGrand.toFixed(2) + ' ৳';
    if (liveEl) liveEl.textContent = grandTotal.toFixed(2) + ' ৳';

    // Update custom row badges
    const container = document.getElementById('customBillsContainer');
    if (container) {
      container.querySelectorAll('.cb-amount').forEach((inp, idx) => {
        const val = parseFloat(inp.value) || 0;
        const badge = inp.closest('.flex')?.querySelector('.badge');
        if (badge) badge.textContent = `মাথাপিছু: ${(val / memCount).toFixed(2)} ৳`;
      });
    }

    renderBreakdownTable();
    return grandTotal;
  }

  function renderBreakdownTable() {
    const tbody = document.getElementById('billsBreakdownBody');
    if (!tbody) return;
    const memCount = getApprovedMemberCount();
    let rowsHtml = '';
    let grandTotal = 0;

    billFields.forEach(f => {
      const val = parseFloat(document.getElementById(f.id)?.value || 0);
      grandTotal += val;
      const perHead = val / memCount;
      rowsHtml += `<tr>
        <td><strong>${f.name}</strong></td>
        <td class="tc font-bold">${val.toFixed(2)} ৳</td>
        <td class="tc">${memCount} জন</td>
        <td class="tc text-gradient font-bold">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    customBills.forEach(cb => {
      const val = parseFloat(cb.amount) || 0;
      grandTotal += val;
      const perHead = val / memCount;
      const title = cb.name.trim() || 'অন্যান্য নির্দিষ্ট বিল';
      rowsHtml += `<tr>
        <td><strong>📌 ${title}</strong></td>
        <td class="tc font-bold">${val.toFixed(2)} ৳</td>
        <td class="tc">${memCount} জন</td>
        <td class="tc text-gradient font-bold">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    const perHeadGrand = grandTotal / memCount;
    rowsHtml += `<tr style="background:rgba(79,142,247,0.1); border-top:2px solid var(--primary);">
      <td><strong style="color:var(--primary); font-size:1rem;">সর্বমোট হিসাব (Grand Total)</strong></td>
      <td class="tc font-bold" style="font-size:1.05rem; color:var(--warning);">${grandTotal.toFixed(2)} ৳</td>
      <td class="tc font-bold">${memCount} জন</td>
      <td class="tc font-bold text-gradient" style="font-size:1.1rem;">${perHeadGrand.toFixed(2)} ৳</td>
    </tr>`;

    tbody.innerHTML = rowsHtml;
  }

  billFields.forEach(f => document.getElementById(f.id)?.addEventListener('input', calcBillTotal));

  function loadBills() {
    if (!curProjId) return;
    const month = billsMonthEl ? billsMonthEl.value : _curMonthStr;
    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const b = bills.find(x => (x.projectId || x.project_id) === curProjId && (x.monthYear || x.month_year) === month);

    if (b) {
      billFields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el) el.value = parseFloat(b[f.jsKey] || b[f.key] || 0) || '';
      });

      // Parse custom bills
      customBills = [];
      const note = b.otherBillsNote || b.other_bills_note || '';
      if (note && note.startsWith('[')) {
        try { customBills = JSON.parse(note); } catch(e) { customBills = []; }
      } else if (parseFloat(b.otherBills || b.other_bills || 0) > 0) {
        customBills = [{ id: 'cb_1', name: note || 'অন্যান্য বিল', amount: parseFloat(b.otherBills || b.other_bills || 0) }];
      }
    } else {
      billFields.forEach(f => { const el = document.getElementById(f.id); if (el) el.value = ''; });
      customBills = [];
    }

    renderCustomBills();
    calcBillTotal();

    const statusEl = document.getElementById('billsSavedStatus');
    if (statusEl) {
      if (b) { statusEl.textContent = 'সেভ করা আছে ✓'; statusEl.style.color = 'var(--success, #22c55e)'; }
      else   { statusEl.textContent = 'সেভ হয়নি'; statusEl.style.color = 'var(--text-muted)'; }
    }

    // History table
    const histBody = document.getElementById('billsHistoryBody');
    if (!histBody) return;
    const allBills = bills.filter(x => (x.projectId || x.project_id) === curProjId)
                         .sort((a, b) => (b.monthYear || b.month_year || '').localeCompare(a.monthYear || a.month_year || ''));
    histBody.innerHTML = '';
    if (!allBills.length) {
      histBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">এখনো কোনো বিল সেভ হয়নি।</td></tr>';
      return;
    }
    allBills.forEach(bRow => {
      const total = (parseFloat(bRow.houseRent || bRow.house_rent || 0) +
        parseFloat(bRow.cookSalary || bRow.cook_salary || 0) +
        parseFloat(bRow.wifiBill || bRow.wifi_bill || 0) +
        parseFloat(bRow.gasBill || bRow.gas_bill || 0) +
        parseFloat(bRow.electricityBill || bRow.electricity_bill || 0) +
        parseFloat(bRow.garbageBill || bRow.garbage_bill || 0) +
        parseFloat(bRow.otherBills || bRow.other_bills || 0));
      histBody.innerHTML += `<tr>
        <td><strong class="text-gradient">${bRow.monthYear || bRow.month_year}</strong></td>
        <td class="tc">${parseFloat(bRow.houseRent || bRow.house_rent || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.cookSalary || bRow.cook_salary || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.wifiBill || bRow.wifi_bill || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.gasBill || bRow.gas_bill || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.electricityBill || bRow.electricity_bill || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.garbageBill || bRow.garbage_bill || 0).toFixed(0)} ৳</td>
        <td class="tc">${parseFloat(bRow.otherBills || bRow.other_bills || 0).toFixed(0)} ৳</td>
        <td class="tc font-bold text-gradient">${total.toFixed(2)} ৳</td>
      </tr>`;
    });
  }

  document.getElementById('saveBillsBtn')?.addEventListener('click', async () => {
    if (!curProjId) return showToast('প্রথমে একটি প্রজেক্ট সিলেক্ট করুন', 'error');
    const month = billsMonthEl ? billsMonthEl.value : _curMonthStr;

    let customTotal = 0;
    customBills.forEach(cb => { customTotal += (parseFloat(cb.amount) || 0); });

    const payload = {
      project_id: curProjId,
      month_year: month,
      other_bills: customTotal,
      other_bills_note: JSON.stringify(customBills)
    };
    billFields.forEach(f => { payload[f.key] = parseFloat(document.getElementById(f.id)?.value || 0); });

    try {
      if (window.API) {
        await window.API.post('bills.php', { action: 'save' }, payload);
        await window.API.syncState();
      } else {
        const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
        const idx = bills.findIndex(x => (x.projectId || x.project_id) === curProjId && (x.monthYear || x.month_year) === month);
        const newBill = { projectId: curProjId, monthYear: month, ...payload };
        billFields.forEach(f => { newBill[f.jsKey] = payload[f.key]; });
        if (idx > -1) bills[idx] = newBill; else bills.push(newBill);
        localStorage.setItem('meal_bills', JSON.stringify(bills));
      }
      showToast('মাসিক বিল ও সকল খাতের হিসাব সফলভাবে সেভ করা হয়েছে! ✓');
      loadBills();
    } catch (err) { showToast(err.message || 'Error saving bills', 'error'); }
  });

  // ─── Download Bills PDF ───
  document.getElementById('downloadBillsPdfBtn')?.addEventListener('click', () => {
    const area = document.getElementById('billsPdfArea');
    if (!area) return;

    const month = billsMonthEl ? billsMonthEl.value : _curMonthStr;
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const p = projects.find(x => x.id === curProjId);
    const memCount = getApprovedMemberCount();

    document.getElementById('pdfProjNameBills').textContent = p ? p.name : 'Hostel Mess';
    document.getElementById('pdfMonthBills').textContent = month;
    document.getElementById('pdfMemCountBills').textContent = memCount + ' জন';
    document.getElementById('pdfPrintDate').textContent = 'তারিখ: ' + new Date().toLocaleDateString('bn-BD');

    let grandTotal = 0;
    let tableHtml = '';

    billFields.forEach(f => {
      const val = parseFloat(document.getElementById(f.id)?.value || 0);
      grandTotal += val;
      const perHead = val / memCount;
      tableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px; text-align:left; font-size:0.9rem;">${f.name}</td>
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
      tableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px; text-align:left; font-size:0.9rem;">📌 ${title}</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem; font-weight:600;">${val.toFixed(2)} ৳</td>
        <td style="padding:10px; text-align:center; font-size:0.9rem;">${memCount} জন</td>
        <td style="padding:10px; text-align:right; font-size:0.9rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
      </tr>`;
    });

    const perHeadGrand = grandTotal / memCount;
    tableHtml += `<tr style="background:#f8fafc; border-top:2px solid #2563eb; font-weight:bold;">
      <td style="padding:12px 10px; font-size:1rem; color:#1e293b;">সর্বমোট মেস বিল (Grand Total)</td>
      <td style="padding:12px 10px; text-align:center; font-size:1rem; color:#d97706;">${grandTotal.toFixed(2)} ৳</td>
      <td style="padding:12px 10px; text-align:center; font-size:0.95rem;">${memCount} জন</td>
      <td style="padding:12px 10px; text-align:right; font-size:1.1rem; color:#2563eb;">${perHeadGrand.toFixed(2)} ৳</td>
    </tr>`;

    document.getElementById('pdfGrandTotalBills').textContent = grandTotal.toFixed(2) + ' ৳';
    document.getElementById('pdfPerHeadBills').textContent = perHeadGrand.toFixed(2) + ' ৳';
    document.getElementById('pdfBillsTableBody').innerHTML = tableHtml;

    area.style.display = 'block';
    const opt = {
      margin: 0.4,
      filename: `MealManager_Bills_${month}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(area).save().then(() => {
      area.style.display = 'none';
      showToast('বিলের PDF রসিদ সফলভাবে ডাউনলোড হয়েছে! 📄');
    }).catch(err => {
      area.style.display = 'none';
      showToast('PDF তৈরিতে সমস্যা হয়েছে: ' + err.message, 'error');
    });
  });

  // ─── Device Push Notification Helper ───
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

  // ─── Announcements & Notices ───
  function loadNotices() {
    const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
    const list = document.getElementById('noticesHistoryList');
    if (!list) return;
    const projNotifs = notifs.filter(n => (n.projectId || n.project_id) === curProjId && (n.to === 'all' || n.to_user === 'all'));
    if (!projNotifs.length) {
      list.innerHTML = '<p class="text-muted text-center py-3">কোনো নোটিশ পাঠানো হয়নি।</p>';
      return;
    }
    list.innerHTML = projNotifs.map(n => {
      const dStr = n.time ? new Date(parseInt(n.time)).toLocaleString('bn-BD', { dateStyle:'medium', timeStyle:'short' }) : '';
      return `<div class="card p-3" style="background:var(--card-bg); border-radius:0.75rem; border:1px solid var(--glass-border);">
        <div class="flex justify-between items-center mb-1">
          <span class="badge badge-blue"><i class="fas fa-bullhorn"></i> ঘোষণা</span>
          <span class="text-muted" style="font-size:0.75rem;">${dStr}</span>
        </div>
        <p style="margin:0; font-size:0.95rem; line-height:1.5;">${n.message}</p>
      </div>`;
    }).join('');
  }

  document.getElementById('sendNoticeBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('noticeMessageInput');
    const msg = input?.value.trim();
    if (!msg) return showToast('নোটিশের বিবরণ লিখুন!', 'error');
    if (!curProjId) return showToast('প্রথমে একটি প্রজেক্ট সিলেক্ট করুন!', 'error');

    const btn = document.getElementById('sendNoticeBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> পাঠানো হচ্ছে...';

    try {
      if (window.API) {
        await window.API.post('notifications.php', { action: 'create' }, {
          project_id: curProjId,
          to: 'all',
          message: msg
        });
      }
      input.value = '';
      showToast('ঘোষণা ও নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!');
      triggerDeviceNotification('MealManager Announcement', msg);
      if (window.API) await window.API.syncState();
      loadNotices();
    } catch (err) {
      showToast(err.message || 'Error sending notice', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  });

  document.getElementById('testNotifyBtn')?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      return showToast('এই ব্রাউজার নোটিফিকেশন সাপোর্ট করে না', 'error');
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        triggerDeviceNotification('MealManager', 'নোটিফিকেশন সফলভাবে সক্রিয় হয়েছে! ✓');
        showToast('নোটিফিকেশন পারমিশন চালু হয়েছে!');
      } else {
        showToast('নোটিফিকেশন পারমিশন দেওয়া হয়নি!', 'error');
      }
    } catch(e) {
      showToast('Permission error: ' + e.message, 'error');
    }
  });
}

// Start app — prevent double init
let _adminAppInited = false;
function _startAdminApp() {
  if (_adminAppInited) return;
  _adminAppInited = true;
  initAdminApp();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _startAdminApp);
} else {
  _startAdminApp();
}
window.addEventListener('apiDataLoaded', _startAdminApp);
