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
    if (!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments','meal_bills','meal_expenses'].includes(e.key)) refresh();
    
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

  window.addEventListener('appDataSynced', () => {
    loadProjects();
    refresh();
  });
  window.addEventListener('apiDataLoaded', () => {
    loadProjects();
    refresh();
  });

  // Tab switching logic
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    if (target) target.classList.add('active');
    refresh();
  }));

  // ─── Global State & Field Definitions ─────────────────────────────────────
  const _tzOffsetMs = (new Date()).getTimezoneOffset() * 60000;
  const _todayStr = (new Date(Date.now() - _tzOffsetMs)).toISOString().slice(0, 10);
  const _curMonthStr = _todayStr.slice(0, 7);

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
    const count = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProjId) && e.status === 'approved').length;
    return count > 0 ? count : 1;
  }

  // Projects logic
  let curProjId = localStorage.getItem('meal_adminLastProj') || '';

  function loadProjects() {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    let enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];

    // Retroactive fix: ensure admin is enrolled in their own projects (for old projects)
    let enrollsChanged = false;
    projects.forEach(p => {
      const pAdmin = p.adminId || p.admin_id;
      if (pAdmin && !enrolls.find(e => (e.projectId || e.project_id) === p.id && (e.userId || e.user_id) === pAdmin)) {
        enrolls.push({ id: p.id + '_' + pAdmin, projectId: p.id, userId: pAdmin, status: 'approved', moneyGiven: 0 });
        enrollsChanged = true;
      }
    });
    if (enrollsChanged) localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
    
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
  if (window.MealNotifications) window.MealNotifications.startMonitor(cur, () => curProjId);

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
        // Sync to pull in admin's auto-enrollment
        await window.API.syncState().catch(() => {});
      } else {
        const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
        const menu = {}; days.forEach(d => menu[d] = {b:'', l:'', d:''});
        const p = { id: Date.now().toString(), name, adminId: cur.id, menu };
        projects.push(p);
        localStorage.setItem('meal_projects', JSON.stringify(projects));
        curProjId = p.id;

        // Auto-enroll admin as approved member (offline mode)
        const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
        const adminEnrollId = p.id + '_' + cur.id;
        if (!enrolls.find(e => (e.projectId || e.project_id) === p.id && (e.userId || e.user_id) === cur.id)) {
          enrolls.push({ id: adminEnrollId, projectId: p.id, userId: cur.id, status: 'approved', moneyGiven: 0 });
          localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
        }
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
    loadProfiles();
    if (typeof loadBazaar === 'function') loadBazaar();
    if (typeof loadBills === 'function') loadBills();
    if (typeof loadNotices === 'function') loadNotices();
    if (typeof renderAdminMealSheet === 'function') renderAdminMealSheet();
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
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-success btn-sm btn-approve" data-id="${u.id}"><i class="fas fa-check"></i> Accept</button>
            <button class="btn btn-danger btn-sm btn-reject" data-id="${u.id}"><i class="fas fa-times"></i> Reject</button>
          </td>
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

    document.querySelectorAll('.btn-reject').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Reject this member request?')) return;
      const uid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('enrollments.php', { action: 'reject' }, { project_id: curProjId, user_id: uid });
        }
        const nf = enrolls.filter(x => !((x.projectId || x.project_id) === curProjId && (x.userId || x.user_id) === uid));
        localStorage.setItem('meal_enrollments', JSON.stringify(nf));
        showToast('Request rejected.', 'info');
        refresh();
      } catch (err) {
        showToast(err.message || 'Error rejecting request', 'error');
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

    // Populate Manager Handover Select (preserve user selection across background syncs)
    const handoverSelect = document.getElementById('handoverNewAdminSelect');
    const mgrDisplay = document.getElementById('currentManagerNameDisplay');
    if (mgrDisplay) {
      const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
      const p = projects.find(x => (x.id || x.projectId) === curProjId);
      const adminU = p ? users.find(x => x.id === (p.admin_id || p.adminId)) : cur;
      mgrDisplay.textContent = adminU ? adminU.name : cur.name;
    }
    if (handoverSelect) {
      const currentSelectedVal = handoverSelect.dataset.selectedVal || handoverSelect.value || '';

      // Don't re-render and interrupt if user is actively interacting with the dropdown
      if (document.activeElement !== handoverSelect) {
        const approvedMems = pEnrolls.filter(e => e.status === 'approved');
        let optionsHtml = '<option value="">— মেম্বার বাছাই করুন —</option>';
        approvedMems.forEach(en => {
          const uid = en.userId || en.user_id;
          if (String(uid) === String(cur.id)) return; // Exclude self
          const u = users.find(x => String(x.id) === String(uid));
          if (u) {
            const isCo = (u.role === 'admin');
            optionsHtml += `<option value="${u.id}">${u.name} (${u.email})${isCo ? ' 👑 (Co-Admin)' : ''}</option>`;
          }
        });

        // Only update DOM if options actually changed to avoid flickering and deselecting
        if (handoverSelect.innerHTML !== optionsHtml) {
          handoverSelect.innerHTML = optionsHtml;
        }

        // Restore user's selection stably
        if (currentSelectedVal) {
          handoverSelect.value = currentSelectedVal;
        }
      }

      if (!handoverSelect.dataset.hasChangeListener) {
        handoverSelect.dataset.hasChangeListener = 'true';
        handoverSelect.addEventListener('change', () => {
          handoverSelect.dataset.selectedVal = handoverSelect.value;
        });
      }
    }
  }

  // Handle Manager Handover & Co-Admin Addition
  document.getElementById('confirmHandoverBtn')?.addEventListener('click', async () => {
    const sel = document.getElementById('handoverNewAdminSelect');
    const newAdminId = sel ? sel.value : '';
    const actionType = document.querySelector('input[name="handoverActionType"]:checked')?.value || 'co_admin';
    const demoteSelf = (actionType === 'full_handover');

    if (!newAdminId) {
      showToast('দয়া করে মেম্বার নির্বাচন করুন', 'error');
      return;
    }
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const newAdminUser = users.find(x => String(x.id) === String(newAdminId));
    const newAdminName = newAdminUser ? newAdminUser.name : 'নির্বাচিত সদস্য';

    const confirmMsg = demoteSelf
      ? `আপনি কি নিশ্চিত যে "${newAdminName}" কে প্রধান ম্যানেজার বানিয়ে নিজে সাধারণ মেম্বার হতে চান?`
      : `আপনি কি নিশ্চিত যে "${newAdminName}" কে এই মেসের নতুন সহ-ম্যানেজার (Co-Admin) হিসেবে যুক্ত করতে চান? (উভয়েই অ্যাডমিন থাকবেন)`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      if (window.API) {
        await window.API.post('projects.php', { action: 'handover_manager' }, {
          project_id: curProjId,
          current_admin_id: cur.id,
          new_admin_id: newAdminId,
          demote_self: demoteSelf
        });
      }

      // Update local projects if full handover
      const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
      const pIdx = projects.findIndex(p => (p.id || p.projectId) === curProjId);
      if (pIdx > -1 && demoteSelf) {
        projects[pIdx].admin_id = newAdminId;
        projects[pIdx].adminId = newAdminId;
        localStorage.setItem('meal_projects', JSON.stringify(projects));
      }

      // Update users list locally
      const uIdx = users.findIndex(u => String(u.id) === String(newAdminId));
      if (uIdx > -1) {
        users[uIdx].role = 'admin';
      }

      if (demoteSelf) {
        const myIdx = users.findIndex(u => String(u.id) === String(cur.id));
        if (myIdx > -1) {
          users[myIdx].role = 'user';
        }
        cur.role = 'user';
        localStorage.setItem('meal_currentUser', JSON.stringify(cur));
        localStorage.setItem('currentUser', JSON.stringify(cur));
      }
      localStorage.setItem('meal_users', JSON.stringify(users));

      if (demoteSelf) {
        alert(`ম্যানেজার সম্পূর্ণ হস্তান্তর সফল হয়েছে! নতুন ম্যানেজার: ${newAdminName}\nআপনাকে মেম্বার ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...`);
        window.location.href = 'user-dashboard.html';
      } else {
        showToast(`সহ-ম্যানেজার যোগ সফল হয়েছে! ${newAdminName} এখন সহ-অ্যাডমিন।`, 'success');
        if (sel) {
          sel.value = '';
          sel.dataset.selectedVal = '';
        }
        loadProjects();
        refresh();
      }
    } catch (err) {
      showToast(err.message || 'ম্যানেজার পরিবর্তন/সহ-অ্যাডমিন যোগ করতে সমস্যা হয়েছে', 'error');
    }
  });

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
    if (!curProjId) return;
    const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pCom = comments.filter(c => (c.projectId || c.project_id) === curProjId).sort((a,b) => b.time - a.time);
    
    const badge = document.getElementById('commentBadge');
    if (badge) badge.textContent = pCom.length || '';
    const con = document.getElementById('commentsContainer');
    if (!con) return;
    con.innerHTML = '';
    
    if(!pCom.length) {
      con.innerHTML = '<p class="text-center text-muted py-4"><i class="fas fa-comment-slash" style="font-size:2rem; margin-bottom:.5rem; display:block; opacity:.4;"></i>কোনো মন্তব্য নেই।</p>';
      return;
    }
    
    pCom.forEach(c => {
      const uid = c.userId || c.user_id;
      const u = users.find(x => x.id === uid);
      const name = c.userName || (u ? u.name : 'Unknown Member');
      const d = new Date(parseInt(c.time) || Date.now()).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
      const hasReply = c.reply && c.reply.trim().length > 0;
      const rTime = (c.replyTime || c.reply_time) ? new Date(parseInt(c.replyTime || c.reply_time)).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      
      con.innerHTML += `
        <div class="glass-panel" style="padding:1.15rem; border-color:rgba(79,142,247,0.3); position:relative; margin-bottom:0.75rem;">
          <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="comment-avatar" style="width:34px; height:34px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.9rem;">
                ${name.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style="font-size:0.95rem;">${name}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;"><i class="far fa-clock"></i> ${d}</span>
              </div>
            </div>
            <button class="btn btn-danger btn-sm btn-del-com" data-id="${c.id}" title="মন্তব্য মুছুন" style="padding:.25rem .5rem; font-size:.8rem;"><i class="fas fa-trash"></i></button>
          </div>
          
          <div style="font-size:0.95rem; color:var(--text); line-height:1.5; white-space:pre-wrap; background:rgba(255,255,255,0.03); padding:.5rem .75rem; border-radius:6px; margin-bottom:0.75rem;">
            ${c.text}
          </div>

          <!-- Existing Reply or Reply Box -->
          ${hasReply ? `
            <div style="background:rgba(34,197,94,0.08); border-left:3px solid #22c55e; border-radius:4px; padding:0.6rem 0.85rem; margin-top:0.5rem;">
              <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <span style="font-size:0.8rem; font-weight:700; color:#22c55e;"><i class="fas fa-check-circle"></i> আপনার উত্তর:</span>
                ${rTime ? `<span style="font-size:0.72rem; color:var(--text-muted);">${rTime}</span>` : ''}
              </div>
              <div style="font-size:0.9rem; color:var(--text); line-height:1.4;">${c.reply}</div>
            </div>
          ` : `
            <div class="reply-box mt-2" style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" class="form-control form-control-sm reply-inp" data-id="${c.id}" placeholder="মেম্বারকে উত্তর লিখুন..." style="flex:1;">
              <button class="btn btn-primary btn-sm btn-reply-com" data-id="${c.id}" data-uid="${uid}" style="white-space:nowrap; padding:.4rem .85rem;">
                <i class="fas fa-reply"></i> উত্তর পাঠান
              </button>
            </div>
          `}
        </div>
      `;
    });

    // Delete comment
    con.querySelectorAll('.btn-del-com').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('এই মন্তব্যটি মুছে ফেলতে চান?')) return;
      const cid = e.currentTarget.dataset.id;
      try {
        if (window.API) {
          await window.API.post('comments.php', { action: 'delete' }, { id: cid });
          await window.API.syncState();
        } else {
          const nCom = comments.filter(x => x.id !== cid);
          localStorage.setItem('meal_comments', JSON.stringify(nCom));
        }
        showToast('মন্তব্য মুছে ফেলা হয়েছে।');
        loadComments();
      } catch (err) {
        showToast(err.message || 'Error deleting comment', 'error');
      }
    }));

    // Send reply
    con.querySelectorAll('.btn-reply-com').forEach(btn => btn.addEventListener('click', async e => {
      const cid = e.currentTarget.dataset.id;
      const uid = e.currentTarget.dataset.uid;
      const inp = con.querySelector(`.reply-inp[data-id="${cid}"]`);
      const replyTxt = inp ? inp.value.trim() : '';
      if (!replyTxt) return showToast('উত্তরের লেখা লিখুন', 'error');

      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> পাঠাচ্ছে...';

      try {
        if (window.API) {
          await window.API.post('comments.php', { action: 'reply' }, { id: cid, reply: replyTxt });
          // Also send a notification to the member
          await window.API.post('notifications.php', { action: 'send' }, {
            project_id: curProjId,
            to_user: uid,
            message: 'ম্যানেজার আপনার মন্তব্যের উত্তর দিয়েছেন: "' + (replyTxt.length > 40 ? replyTxt.slice(0, 37) + '...' : replyTxt) + '"'
          }).catch(() => {});
          await window.API.syncState();
        } else {
          const idx = comments.findIndex(x => x.id === cid);
          if (idx > -1) {
            comments[idx].reply = replyTxt;
            comments[idx].replyTime = Date.now();
            localStorage.setItem('meal_comments', JSON.stringify(comments));
          }
        }
        showToast('উত্তর সফলভাবে পাঠানো হয়েছে! ✓');
        loadComments();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        showToast(err.message || 'উত্তর পাঠাতে সমস্যা হয়েছে', 'error');
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
  let _adminBazaarInited = false;
  function initExpenseControls() {
    const bm = document.getElementById('bazaarMonth');
    const bim = document.getElementById('billsMonth');
    const ed = document.getElementById('expDate');
    if (bm && !bm._inited) {
      if (!bm.value) bm.value = _curMonthStr;
      bm.addEventListener('change', () => {
        bm.dataset.userChanged = 'true';
        loadBazaar();
      });
      bm._inited = true;
    }
    if (bim && !bim._inited) {
      if (!bim.value) bim.value = _curMonthStr;
      bim.addEventListener('change', () => {
        bim.dataset.userChanged = 'true';
        loadBills();
      });
      bim._inited = true;
    }
    if (ed && !ed.value) ed.value = _todayStr;

    populateShopperSelects();

    if (!_adminBazaarInited) {
      _adminBazaarInited = true;
      // Close edit modal
      document.getElementById('closeEditExpModalBtn')?.addEventListener('click', () => {
        document.getElementById('editExpModal')?.classList.remove('active');
      });
      document.getElementById('cancelEditExpBtn')?.addEventListener('click', () => {
        document.getElementById('editExpModal')?.classList.remove('active');
      });

      // Save edit
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
              project_id: curProjId,
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
  }

  function populateShopperSelects() {
    const addSel = document.getElementById('expShopperSelect');
    const editSel = document.getElementById('editExpShopperSelect');
    if (!addSel && !editSel) return;

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pMems = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProjId) && e.status === 'approved');

    const memberMap = new Map();
    if (cur && cur.id) memberMap.set(cur.id, { id: cur.id, name: cur.name + ' (Admin)' });

    pMems.forEach(en => {
      const uid = en.userId || en.user_id;
      const u = users.find(x => x.id === uid);
      const name = u ? u.name : (en.name || 'সদস্য');
      if (!memberMap.has(uid)) memberMap.set(uid, { id: uid, name: name });
    });

    // Populate addSel
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

    // Populate editSel
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
  initExpenseControls();

  function loadBazaar() {
    initExpenseControls();
    if (!curProjId) return;
    const bazaarMonthEl = document.getElementById('bazaarMonth');
    const expenses = JSON.parse(localStorage.getItem('meal_expenses')) || [];
    const users    = JSON.parse(localStorage.getItem('meal_users')) || [];

    const projExpenses = expenses.filter(ex => String(ex.projectId || ex.project_id) === String(curProjId));

    let month = bazaarMonthEl && bazaarMonthEl.value ? bazaarMonthEl.value : _curMonthStr;
    let filtered = projExpenses.filter(ex => (ex.date || '').startsWith(month));

    // Auto-detect latest month with expenses if current selected month has none
    if (bazaarMonthEl && bazaarMonthEl.dataset.userChanged !== 'true' && projExpenses.length > 0 && filtered.length === 0) {
      const sorted = [...projExpenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (sorted[0] && sorted[0].date) {
        month = sorted[0].date.slice(0, 7);
        bazaarMonthEl.value = month;
        filtered = projExpenses.filter(ex => (ex.date || '').startsWith(month));
      }
    }

    const today = _todayStr;
    const totalMonth = filtered.reduce((s, ex) => s + parseFloat(ex.amount || 0), 0);
    const totalToday = projExpenses.filter(ex => ex.date === today).reduce((s, ex) => s + parseFloat(ex.amount || 0), 0);

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
      body.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;"><i class="fas fa-shopping-basket" style="opacity:.4; font-size:2rem; display:block; margin-bottom:.5rem;"></i>${month} মাসে কোনো বাজার খরচের এন্ট্রি নেই।</td></tr>`;
    } else {
      // Sort by date desc
      [...filtered].sort((a, b) => b.date.localeCompare(a.date)).forEach(ex => {
        const u = users.find(x => x.id === (ex.userId || ex.user_id));
        let shopperName = ex.shopperName || ex.shopper_name || ex.userName || (u ? u.name : 'মেম্বার');
        const isMyBazaar = (ex.userId || ex.user_id) === cur.id || shopperName === cur.name;

        let adderName = ex.createdByName || ex.createdBy;
        if (!adderName && ex.createdBy) {
          const uAdd = users.find(x => x.id === ex.createdBy);
          if (uAdd) adderName = uAdd.name;
        }
        if (!adderName) adderName = ex.userName || (u ? u.name : 'সদস্য');

        let updaterName = ex.updatedByName;
        if (!updaterName && (ex.updatedBy || ex.updated_by)) {
          const u2 = users.find(x => x.id === (ex.updatedBy || ex.updated_by));
          if (u2) updaterName = u2.name;
        }

        const shopperBadge = `<span class="badge badge-purple" style="font-size:0.82rem; font-weight:600;"><i class="fas fa-shopping-bag" style="margin-right:4px;"></i>${shopperName}${isMyBazaar ? ' <span class="badge badge-blue" style="font-size:0.6rem; margin-left:3px;">You</span>' : ''}</span>`;
        const entryInfo = `<div style="font-size:0.85rem; font-weight:600; color:var(--text-muted);"><i class="fas fa-user-edit" style="font-size:0.75rem;"></i> ${adderName}</div>${updaterName ? `<div style="font-size:0.73rem; color:#f59e0b; margin-top:2px;"><i class="fas fa-history" style="font-size:0.7rem;"></i> আপডেট: ${updaterName}</div>` : ''}`;

        const catIcon = ex.category === 'bazaar' ? '🛒' : '📦';
        body.innerHTML += `<tr>
          <td style="white-space:nowrap;"><i class="far fa-calendar-alt text-muted" style="margin-right:4px;"></i>${ex.date}</td>
          <td>${shopperBadge}</td>
          <td><strong>${ex.item}</strong></td>
          <td class="tc"><span class="badge badge-blue">${catIcon} ${ex.category === 'bazaar' ? 'বাজার' : 'অন্যান্য'}</span></td>
          <td class="tc font-bold text-gradient">${parseFloat(ex.amount).toFixed(2)} ৳</td>
          <td>${entryInfo}</td>
          <td style="font-size:.82rem; color:var(--text-muted);">${ex.note || '—'}</td>
          <td class="tc" style="white-space:nowrap;">
            <button class="btn btn-outline btn-sm btn-edit-exp" data-id="${ex.id}" title="সম্পাদনা করুন" style="padding:.25rem .5rem; font-size:.78rem; margin-right:4px;"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm btn-del-expense" data-id="${ex.id}" title="মুছে ফেলুন" style="padding:.25rem .5rem; font-size:.78rem;"><i class="fas fa-trash"></i></button>
          </td>
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

    // Edit expense event
    body.querySelectorAll('.btn-edit-exp').forEach(btn => btn.addEventListener('click', e => {
      const eid = e.currentTarget.dataset.id;
      const ex = projExpenses.find(x => x.id === eid);
      if (!ex) return;
      populateShopperSelects();
      document.getElementById('editExpId').value = ex.id;
      document.getElementById('editExpDate').value = ex.date;
      document.getElementById('editExpItem').value = ex.item;
      document.getElementById('editExpAmount').value = ex.amount;
      document.getElementById('editExpCategory').value = ex.category || 'bazaar';
      document.getElementById('editExpNote').value = ex.note || '';

      const shopperUserId = ex.userId || ex.user_id;
      const shopperNameVal = ex.shopperName || ex.shopper_name || ex.userName || '';
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
    }));

    // Delete expense event
    body.querySelectorAll('.btn-del-expense').forEach(btn => btn.addEventListener('click', async e => {
      if (!confirm('এই খরচের এন্ট্রি মুছে ফেলবেন?')) return;
      const eid = e.currentTarget.dataset.id;
      try {
        const exps = JSON.parse(localStorage.getItem('meal_expenses')) || [];
        localStorage.setItem('meal_expenses', JSON.stringify(exps.filter(x => x.id !== eid)));
        showToast('খরচ মুছে ফেলা হয়েছে।');
        loadBazaar();

        if (window.API) {
          await window.API.post('expenses.php', { action: 'delete' }, { id: eid, project_id: curProjId });
          await window.API.syncState();
          loadBazaar();
        }
      } catch (err) { showToast(err.message || 'Error deleting expense', 'error'); }
    }));
  }

  window.loadBazaar = loadBazaar;

  // Add expense button
  document.getElementById('addExpenseBtn')?.addEventListener('click', async () => {
    if (!curProjId) return showToast('প্রথমে একটি প্রজেক্ট সিলেক্ট করুন', 'error');
    const date   = document.getElementById('expDate').value || _todayStr;
    const item   = document.getElementById('expItem').value.trim();
    const amount = parseFloat(document.getElementById('expAmount').value) || 0;
    const cat    = document.getElementById('expCategory').value;
    const note   = document.getElementById('expNote').value.trim();

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

    if (!item) return showToast('পণ্যের নাম লিখুন', 'error');
    if (amount <= 0) return showToast('সঠিক টাকার পরিমাণ দিন', 'error');

    const addBtn = document.getElementById('addExpenseBtn');
    const origText = addBtn ? addBtn.innerHTML : '';
    if (addBtn) { addBtn.disabled = true; addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> যোগ হচ্ছে...'; }

    try {
      const newExp = {
        id: 'exp_' + Date.now(),
        projectId: curProjId,
        userId: shopperUserId,
        userName: shopperName,
        shopperName: shopperName,
        createdBy: cur.id,
        createdByName: cur.name,
        date,
        item,
        amount,
        category: cat,
        note
      };

      // 1. Immediately update localStorage
      const exps = JSON.parse(localStorage.getItem('meal_expenses')) || [];
      exps.unshift(newExp);
      localStorage.setItem('meal_expenses', JSON.stringify(exps));

      // 2. Clear inputs & re-render
      document.getElementById('expItem').value = '';
      document.getElementById('expAmount').value = '';
      document.getElementById('expNote').value = '';
      if (customShopperInp) customShopperInp.value = '';
      showToast('খরচ সফলভাবে যোগ করা হয়েছে! 🛒');
      loadBazaar();

      // 3. Persist to API
      if (window.API) {
        const res = await window.API.post('expenses.php', { action: 'add' }, {
          project_id: curProjId,
          user_id: shopperUserId,
          shopper_name: shopperName,
          created_by: cur.id,
          date, item, amount, category: cat, note
        });
        if (res && res.expense && res.expense.id) {
          newExp.id = res.expense.id;
          localStorage.setItem('meal_expenses', JSON.stringify(exps));
        }
        await window.API.syncState();
        loadBazaar();
      }
    } catch (err) { showToast(err.message || 'Error adding expense', 'error'); }
    finally {
      if (addBtn) { addBtn.disabled = false; addBtn.innerHTML = origText; }
    }
  });

  // ─── Monthly Bills (Definitions hoisted to top of initAdminApp) ──────────

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
    const billsMonthEl = document.getElementById('billsMonth');
    const month = billsMonthEl && billsMonthEl.value ? billsMonthEl.value : _curMonthStr;
    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const b = bills.find(x => (x.projectId || x.project_id) === curProjId && (x.monthYear || x.month_year) === month);

    if (b) {
      billFields.forEach(f => {
        const el = document.getElementById(f.id);
        const rawVal = b[f.jsKey] !== undefined ? b[f.jsKey] : b[f.key];
        const val = parseFloat(rawVal || 0);
        if (el) el.value = val > 0 ? val : (rawVal !== undefined && rawVal !== null && rawVal !== '' ? val : '');
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
    const billsMonthEl = document.getElementById('billsMonth');
    const month = billsMonthEl && billsMonthEl.value ? billsMonthEl.value : _curMonthStr;

    let customTotal = 0;
    customBills.forEach(cb => { customTotal += (parseFloat(cb.amount) || 0); });

    const payload = {
      project_id: curProjId,
      month_year: month,
      other_bills: customTotal,
      other_bills_note: JSON.stringify(customBills)
    };
    billFields.forEach(f => { payload[f.key] = parseFloat(document.getElementById(f.id)?.value || 0); });

    // Update local storage immediately
    const bills = JSON.parse(localStorage.getItem('meal_bills')) || [];
    const idx = bills.findIndex(x => (x.projectId || x.project_id) === curProjId && (x.monthYear || x.month_year) === month);
    const newBill = { projectId: curProjId, monthYear: month, ...payload };
    billFields.forEach(f => { newBill[f.jsKey] = payload[f.key]; });
    newBill.otherBills = payload.other_bills;
    newBill.otherBillsNote = payload.other_bills_note;
    if (idx > -1) bills[idx] = newBill; else bills.push(newBill);
    localStorage.setItem('meal_bills', JSON.stringify(bills));

    try {
      if (window.API) {
        await window.API.post('bills.php', { action: 'save' }, payload);
        // Automatically dispatch a notification to all members of this project
        await window.API.post('notifications.php', { action: 'create' }, {
          project_id: curProjId,
          to: 'all',
          message: `${month} মাসের মেস বিলের হিসাব আপডেট করা হয়েছে। আপনার ড্যাশবোর্ডে গিয়ে প্রদেয় অংশ চেক করুন।`
        }).catch(() => {});
        await window.API.syncState();
      }
      showToast('মাসিক বিল ও সকল খাতের হিসাব সফলভাবে সেভ করা হয়েছে! ✓');
      loadBills();
    } catch (err) { 
      console.error('Error saving bills:', err);
      showToast(err.message || 'Error saving bills', 'error'); 
    }
  });

  // ─── Download Bills PDF ───
  document.getElementById('downloadBillsPdfBtn')?.addEventListener('click', async () => {
    const area = document.getElementById('billsPdfArea');
    if (!area) return;

    const btn = document.getElementById('downloadBillsPdfBtn');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#ef4444;"></i> PDF তৈরি হচ্ছে...';
    }

    try {
      const billsMonthEl = document.getElementById('billsMonth');
      const month = billsMonthEl && billsMonthEl.value ? billsMonthEl.value : _curMonthStr;
      const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
      const p = projects.find(x => x.id === curProjId);
      const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
      const approvedMems = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProjId) && e.status === 'approved');
      const memCount = Math.max(1, approvedMems.length);
      const users = JSON.parse(localStorage.getItem('meal_users')) || [];
      const managerUser = cur;

      let grandTotal = 0;
      let tableHtml = '';
      let sl = 1;

      billFields.forEach(f => {
        const val = parseFloat(document.getElementById(f.id)?.value || 0);
        grandTotal += val;
        const perHead = val / memCount;
        tableHtml += `<tr style="border-bottom:1px solid #e2e8f0; background:${sl % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:10px 14px; text-align:left; font-size:0.85rem; color:#64748b;">${sl++}</td>
          <td style="padding:10px 14px; text-align:left; font-size:0.9rem; font-weight:600; color:#0f172a;">${f.name}</td>
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
        tableHtml += `<tr style="border-bottom:1px solid #e2e8f0; background:${sl % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding:10px 14px; text-align:left; font-size:0.85rem; color:#64748b;">${sl++}</td>
          <td style="padding:10px 14px; text-align:left; font-size:0.9rem; font-weight:600; color:#0f172a;">📌 ${title}</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; font-weight:700; color:#0f172a;">${val.toFixed(2)} ৳</td>
          <td style="padding:10px 14px; text-align:center; font-size:0.9rem; color:#475569;">${memCount} জন</td>
          <td style="padding:10px 14px; text-align:right; font-size:0.95rem; font-weight:700; color:#2563eb;">${perHead.toFixed(2)} ৳</td>
        </tr>`;
      });

      const perHeadGrand = grandTotal / memCount;
      tableHtml += `<tr style="background:#f1f5f9; border-top:2px solid #2563eb; font-weight:bold;">
        <td style="padding:12px 14px; text-align:left; font-size:0.95rem; color:#0f172a;" colspan="2">সর্বমোট মেস বিল (Grand Total)</td>
        <td style="padding:12px 14px; text-align:center; font-size:1.1rem; color:#d97706; font-weight:800;">${grandTotal.toFixed(2)} ৳</td>
        <td style="padding:12px 14px; text-align:center; font-size:0.95rem; color:#0f172a;">${memCount} জন</td>
        <td style="padding:12px 14px; text-align:right; font-size:1.15rem; color:#2563eb; font-weight:800;">${perHeadGrand.toFixed(2)} ৳</td>
      </tr>`;

      // Members list
      const memsHtml = approvedMems.map((m, idx) => {
        const u = users.find(x => x.id === (m.userId || m.user_id));
        const uName = u ? u.name : 'মেম্বার ' + (idx + 1);
        return `<div style="padding:7px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:0.82rem; display:flex; justify-content:space-between; align-items:center;">
          <span><strong>${idx + 1}. ${uName}</strong></span>
          <span style="font-weight:700; color:#2563eb;">${perHeadGrand.toFixed(2)} ৳</span>
        </div>`;
      }).join('');

      const invNo = 'INV-' + month.replace('-', '') + '-' + (curProjId ? String(curProjId).slice(-4).toUpperCase() : 'MESS');
      const pInv = document.getElementById('pdfInvoiceNoBills');
      const pName = document.getElementById('pdfProjNameBills');
      const pMgr = document.getElementById('pdfManagerNameBills');
      const pEmail = document.getElementById('pdfManagerEmailBills');
      const pMonth = document.getElementById('pdfMonthBills');
      const pGrand = document.getElementById('pdfGrandTotalBills');
      const pMem = document.getElementById('pdfMemCountBills');
      const pPerHead = document.getElementById('pdfPerHeadBills');
      const pDate = document.getElementById('pdfPrintDate');
      const pBody = document.getElementById('pdfBillsTableBody');
      const pMemsList = document.getElementById('pdfAdminMembersList');

      if (pInv) pInv.textContent = invNo;
      if (pName) pName.textContent = p ? p.name : 'Hostel Mess';
      if (pMgr) pMgr.textContent = managerUser ? managerUser.name : 'মেস ম্যানেজার';
      if (pEmail) pEmail.textContent = managerUser ? (managerUser.email || '—') : '—';
      if (pMonth) pMonth.textContent = month;
      if (pGrand) pGrand.textContent = grandTotal.toFixed(2) + ' ৳';
      if (pMem) pMem.textContent = memCount + ' জন';
      if (pPerHead) pPerHead.textContent = perHeadGrand.toFixed(2) + ' ৳';
      if (pDate) pDate.textContent = new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
      if (pBody) pBody.innerHTML = tableHtml;
      if (pMemsList) pMemsList.innerHTML = memsHtml;

      // Small async tick for paint completion
      await new Promise(r => setTimeout(r, 150));

      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `MealManager_Bills_${month}_Admin.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(area).save();
      showToast('মাসিক বিলের PDF সফলভাবে ডাউনলোড হয়েছে! 📄');
    } catch (err) {
      console.error('Admin bills PDF export error:', err);
      showToast('PDF তৈরিতে সমস্যা হয়েছে: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
      }
    }
  });

  // ─── Device Push Notification Helper ───
  function triggerDeviceNotification(title, body) {
    if (window.MealNotifications?.showDeviceNotification) {
      window.MealNotifications.showDeviceNotification(title, body, { soundType: 'notice' });
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
        <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
          <span class="badge badge-blue"><i class="fas fa-bullhorn"></i> ঘোষণা</span>
          <div class="flex items-center gap-2">
            <span class="text-muted" style="font-size:0.75rem;">${dStr}</span>
            <button type="button" class="btn btn-danger btn-sm btn-del-notice" data-id="${n.id}" title="নোটিশ মুছে ফেলুন" style="padding:.2rem .55rem; font-size:.75rem;">
              <i class="fas fa-trash"></i> মুছুন
            </button>
          </div>
        </div>
        <p style="margin:0; font-size:0.95rem; line-height:1.5;">${n.message}</p>
      </div>`;
    }).join('');

    list.querySelectorAll('.btn-del-notice').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('আপনি কি এই নোটিশটি স্থায়ীভাবে মুছে ফেলতে চান?')) return;
        try {
          if (window.API) {
            await window.API.post('notifications.php', { action: 'delete' }, { id });
            await window.API.syncState();
          } else {
            const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
            localStorage.setItem('meal_notifications', JSON.stringify(notifs.filter(x => x.id !== id)));
          }
          showToast('নোটিশ সফলভাবে মুছে ফেলা হয়েছে।');
          loadNotices();
        } catch (err) {
          showToast(err.message || 'Error deleting notice', 'error');
        }
      });
    });
  }

  // Clear all admin notices button handler
  document.getElementById('clearAllAdminNoticesBtn')?.addEventListener('click', async () => {
    if (!curProjId) return showToast('প্রথমে একটি প্রজেক্ট সিলেক্ট করুন!', 'error');
    if (!confirm('আপনি কি এই প্রজেক্টের সকল নোটিশ মুছে ফেলতে চান?')) return;
    try {
      if (window.API) {
        await window.API.post('notifications.php', { action: 'clear_all' }, { project_id: curProjId });
        await window.API.syncState();
      } else {
        const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
        localStorage.setItem('meal_notifications', JSON.stringify(notifs.filter(x => (x.projectId || x.project_id) !== curProjId)));
      }
      showToast('সকল নোটিশ সফলভাবে মুছে ফেলা হয়েছে।');
      loadNotices();
    } catch (err) {
      showToast(err.message || 'Error clearing notices', 'error');
    }
  });

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
    if (window.MealNotifications?.requestPermission) {
      await window.MealNotifications.requestPermission();
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // All Members Meals Sheet (Monthly Matrix View for Admin)
  // ═════════════════════════════════════════════════════════════════════════════
  let _sheetMonthAdmin = new Date().toISOString().slice(0, 7);

  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  function formatYearMonthBn(yearMonth) {
    if (!yearMonth) return '';
    const parts = yearMonth.split('-');
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const mName = monthNamesBn[m - 1] || parts[1];
    return `${mName} ${y}`;
  }

  function updateMonthDisplayAdmin() {
    const disp = document.getElementById('adminSheetMonthDisplay');
    const monthInp = document.getElementById('adminSheetMonth');
    const txt = formatYearMonthBn(_sheetMonthAdmin);
    if (disp) disp.textContent = txt;
    if (monthInp) monthInp.value = _sheetMonthAdmin;
  }

  function initSheetControlsAdmin() {
    const monthInp = document.getElementById('adminSheetMonth');
    const disp = document.getElementById('adminSheetMonthDisplay');

    if (disp && !disp._bound) {
      disp._bound = true;
      disp.addEventListener('click', () => {
        if (monthInp) {
          if (typeof monthInp.showPicker === 'function') {
            try { monthInp.showPicker(); } catch(e) { monthInp.focus(); }
          } else {
            monthInp.focus();
            monthInp.click();
          }
        }
      });
    }

    if (monthInp && !monthInp._bound) {
      monthInp._bound = true;
      monthInp.value = _sheetMonthAdmin;
      monthInp.addEventListener('change', () => {
        if (monthInp.value) {
          _sheetMonthAdmin = monthInp.value;
          updateMonthDisplayAdmin();
          renderAdminMealSheet();
        }
      });
      document.getElementById('adminSheetPrevMonth')?.addEventListener('click', () => {
        const parts = _sheetMonthAdmin.split('-');
        let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
        if (m < 1) { m = 12; y--; }
        _sheetMonthAdmin = `${y}-${String(m).padStart(2, '0')}`;
        updateMonthDisplayAdmin();
        renderAdminMealSheet();
      });
      document.getElementById('adminSheetNextMonth')?.addEventListener('click', () => {
        const parts = _sheetMonthAdmin.split('-');
        let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) + 1;
        if (m > 12) { m = 1; y++; }
        _sheetMonthAdmin = `${y}-${String(m).padStart(2, '0')}`;
        updateMonthDisplayAdmin();
        renderAdminMealSheet();
      });
      document.getElementById('adminPrintSheetBtn')?.addEventListener('click', () => {
        window.print();
      });
    }
    updateMonthDisplayAdmin();
  }

  window.renderAdminMealSheet = async function() {
    if (!curProjId) return;
    initSheetControlsAdmin();

    const thead = document.getElementById('adminMealSheetHead');
    const tbody = document.getElementById('adminMealSheetBody');
    const tfoot = document.getElementById('adminMealSheetFoot');
    if (!thead || !tbody || !tfoot) return;

    const parts = (_sheetMonthAdmin || '').split('-');
    const yearStr = parts[0] || new Date().getFullYear().toString();
    const monthStr = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().slice(0, 10);
    const weekdaysBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments') || '[]');
    const users = JSON.parse(localStorage.getItem('meal_users') || '[]');
    const records = JSON.parse(localStorage.getItem('meal_records') || '[]');

    const approvedEnrolls = enrolls.filter(e => String(e.projectId || e.project_id) === String(curProjId) && String(e.status) === 'approved');
    const members = approvedEnrolls.map(e => {
      const uid = String(e.userId || e.user_id);
      const u = users.find(x => String(x.id) === uid) || { id: uid, name: 'সদস্য (' + uid.slice(0,4) + ')', photo: null };
      return { id: uid, name: u.name, photo: u.photo };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const kpiMem = document.getElementById('adminSheetTotalMembers');
    if (kpiMem) kpiMem.textContent = members.length + ' জন';

    if (members.length === 0) {
      thead.innerHTML = `<tr><th>তারিখ / দিন</th><th class="sticky-total">মোট মিল</th></tr>`;
      tbody.innerHTML = `<tr><td colspan="2" class="tc text-muted" style="padding:2rem;">এই প্রজেক্টে এখনো কোনো অনুমোদিত সদস্য নেই।</td></tr>`;
      tfoot.innerHTML = '';
      const kpiMonth = document.getElementById('adminSheetMonthGrandMeals');
      if (kpiMonth) kpiMonth.textContent = '0';
      const kpiToday = document.getElementById('adminSheetTodayGrandMeals');
      if (kpiToday) kpiToday.textContent = '0';
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
        const r = records.find(x => String(x.projectId || x.project_id) === String(curProjId) && String(x.userId || x.user_id) === String(m.id) && x.date === dStr);
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

    const kpiMonth = document.getElementById('adminSheetMonthGrandMeals');
    if (kpiMonth) kpiMonth.textContent = monthGrandTotal;
    const kpiToday = document.getElementById('adminSheetTodayGrandMeals');
    if (kpiToday) kpiToday.textContent = todayGrandTotal;
  };
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
