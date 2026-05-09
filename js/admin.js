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

  // Sync state between tabs (including file:// protocol fallback)
  let shownNotifs = new Set((JSON.parse(localStorage.getItem('meal_notifications')) || []).map(n => n.id));

  window.addEventListener('storage', e => {
    if (!e.key || e.key === 'meal_projects') loadProjects();
    if (!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments'].includes(e.key)) refresh();
    
    if (!e.key || e.key === 'meal_notifications') {
      const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
      notifs.forEach(n => {
        if (!shownNotifs.has(n.id)) {
          shownNotifs.add(n.id);
          if (curProjId && n.projectId === curProjId && n.to === 'admin') {
            showToast(n.message, 'info');
          }
        }
      });
    }
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
      if (p.adminId === cur.id || !p.adminId) return true; // Creator or legacy
      const en = enrolls.find(e => e.projectId === p.id && e.userId === cur.id && e.status === 'approved');
      return !!en; // Approved co-admin
    });
    
    const sel = document.getElementById('projectSelect');
    
    // Remember current selection
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
  document.getElementById('confirmNewProject').addEventListener('click', () => {
    const name = document.getElementById('newProjectName').value.trim();
    if(!name) return showToast('Enter project name', 'error');
    
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return showToast('Project with this name already exists!', 'error');
    }

    const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    const menu = {}; days.forEach(d => menu[d] = {b:'', l:'', d:''});
    
    const p = { id: Date.now().toString(), name, adminId: cur.id, menu };
    projects.push(p);
    localStorage.setItem('meal_projects', JSON.stringify(projects));
    if (window.fbCreate) window.fbCreate('meal_projects', p.id, p);
    
    showToast('Project Created!');
    document.getElementById('newProjectPanel').classList.add('hidden');
    document.getElementById('newProjectName').value = '';
    
    curProjId = p.id;
    localStorage.setItem('meal_adminLastProj', curProjId);
    
    loadProjects();
    document.getElementById('projectSelect').value = p.id;
    document.getElementById('projectSelect').dispatchEvent(new Event('change'));
  });

  // Admin Join Project Logic
  document.getElementById('joinAdminProjectBtn')?.addEventListener('click', () => {
    document.getElementById('joinProjectPanel').classList.remove('hidden');
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const sel = document.getElementById('allProjectsSelect');
    sel.innerHTML = '<option value="">— Select Project to Join —</option>';
    
    projects.forEach(p => {
      if (p.adminId === cur.id) return; // Don't show projects they created
      const en = enrolls.find(e => e.projectId === p.id && e.userId === cur.id);
      if (en) return; // Already requested or approved
      sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
  });

  document.getElementById('cancelJoinProject')?.addEventListener('click', () => {
    document.getElementById('joinProjectPanel').classList.add('hidden');
  });

  document.getElementById('confirmJoinProject')?.addEventListener('click', () => {
    const pid = document.getElementById('allProjectsSelect').value;
    if (!pid) return showToast('Select a project', 'error');
    
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const newEn = { projectId: pid, userId: cur.id, status: 'pending', moneyGiven: 0 };
    enrolls.push(newEn);
    localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
    if (window.fbCreate) window.fbCreate('meal_enrollments', `${pid}_${cur.id}`, newEn);
    
    showToast('Co-Admin Request Sent to Creator!');
    document.getElementById('joinProjectPanel').classList.add('hidden');
  });

  // Delete Project
  document.getElementById('delProjectBtn')?.addEventListener('click', () => {
    if (!curProjId) return;
    if (!confirm('Are you sure you want to completely delete this project? This will remove all meals, deposits, and members associated with this project. This action CANNOT be undone!')) return;
    
    // Delete project
    let projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    projects = projects.filter(p => p.id !== curProjId);
    localStorage.setItem('meal_projects', JSON.stringify(projects));
    if (window.fbDelete) window.fbDelete('meal_projects', curProjId);
    
    // Delete enrollments
    let enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const enrollsToDelete = enrolls.filter(e => e.projectId === curProjId);
    enrolls = enrolls.filter(e => e.projectId !== curProjId);
    localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
    enrollsToDelete.forEach(e => {
        if (window.fbDelete) window.fbDelete('meal_enrollments', `${curProjId}_${e.userId}`);
    });

    // Delete records
    let records = JSON.parse(localStorage.getItem('meal_records')) || [];
    const recordsToDelete = records.filter(r => r.projectId === curProjId);
    records = records.filter(r => r.projectId !== curProjId);
    localStorage.setItem('meal_records', JSON.stringify(records));
    recordsToDelete.forEach(r => {
        if (window.fbDelete) window.fbDelete('meal_records', `${curProjId}_${r.userId}_${r.date}`);
    });

    // Delete comments
    let comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    const commentsToDelete = comments.filter(c => c.projectId === curProjId);
    comments = comments.filter(c => c.projectId !== curProjId);
    localStorage.setItem('meal_comments', JSON.stringify(comments));
    commentsToDelete.forEach(c => {
        if (window.fbDelete) window.fbDelete('meal_comments', c.id);
    });

    showToast('Project deleted permanently.');
    curProjId = '';
    localStorage.removeItem('meal_adminLastProj');
    loadProjects();
    document.getElementById('projectSelect').dispatchEvent(new Event('change'));
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
      if (p && p.adminId === cur.id) {
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

  // Trigger initial load if a project is selected
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
  document.getElementById('confirmNewMember')?.addEventListener('click', () => {
    const name = document.getElementById('newMemName').value.trim();
    const email = document.getElementById('newMemEmail').value.trim().toLowerCase();
    const password = document.getElementById('newMemPassword').value;
    
    if(!name || !email || !password) return showToast('Please fill all fields', 'error');
    if(!curProjId) return showToast('Select a project first', 'error');
    
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    if(users.find(u => u.email === email)) return showToast('Email already registered!', 'error');
    
    const uid = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newUser = { id: uid, name, email, password, role: 'user' };
    users.push(newUser);
    localStorage.setItem('meal_users', JSON.stringify(users));
    if (window.fbCreate) window.fbCreate('meal_users', uid, newUser);
    
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const newEn = { projectId: curProjId, userId: uid, status: 'approved', moneyGiven: 0 };
    enrolls.push(newEn);
    localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
    if (window.fbCreate) window.fbCreate('meal_enrollments', `${curProjId}_${uid}`, newEn);
    
    showToast('Member added to database & project!');
    document.getElementById('cancelNewMember').click();
    refresh();
  });

  // ─── Members & Approvals ───
  function loadMembers() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pEnrolls = enrolls.filter(e => e.projectId === curProjId);
    
    const rBody = document.getElementById('requestsBody');
    const mBody = document.getElementById('membersBody');
    rBody.innerHTML = ''; mBody.innerHTML = '';

    pEnrolls.forEach(en => {
      const u = users.find(x => x.id === en.userId);
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

    document.querySelectorAll('.btn-approve').forEach(b => b.addEventListener('click', e => {
      const uid = e.currentTarget.dataset.id;
      const idx = enrolls.findIndex(x => x.projectId === curProjId && x.userId === uid);
      if (idx > -1) {
        enrolls[idx].status = 'approved';
        localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
        if (window.fbUpdate) window.fbUpdate('meal_enrollments', `${curProjId}_${uid}`, { status: 'approved' });
        showToast('Member Approved!');
        refresh();
      }
    }));

    document.querySelectorAll('.btn-rem-mem-global').forEach(b => b.addEventListener('click', e => {
      if(!confirm('Remove this member from the project?')) return;
      const uid = e.currentTarget.dataset.id;
      const nf = enrolls.filter(x => !(x.projectId === curProjId && x.userId === uid));
      localStorage.setItem('meal_enrollments', JSON.stringify(nf));
      if (window.fbDelete) window.fbDelete('meal_enrollments', `${curProjId}_${uid}`);
      showToast('Removed from project.');
      refresh();
    }));

    document.querySelectorAll('.btn-del-user').forEach(b => b.addEventListener('click', e => {
      if(!confirm('Delete this user COMPLETELY from the database? This cannot be undone!')) return;
      const uid = e.currentTarget.dataset.id;
      const nUsers = users.filter(x => x.id !== uid);
      localStorage.setItem('meal_users', JSON.stringify(nUsers));
      if (window.fbDelete) window.fbDelete('meal_users', uid);
      const nEnrolls = enrolls.filter(x => x.userId !== uid);
      localStorage.setItem('meal_enrollments', JSON.stringify(nEnrolls));
      enrolls.filter(x => x.userId === uid).forEach(en => {
        if (window.fbDelete) window.fbDelete('meal_enrollments', `${en.projectId}_${uid}`);
      });
      showToast('User deleted from database.');
      refresh();
    }));
  }

  // ─── Daily Tracker ───
  function loadTracker() {
    const dStr = tDate.value;
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => e.projectId === curProjId && e.status === 'approved');
    const tBody = document.getElementById('trackerBody');
    tBody.innerHTML = '';
    
    if(!mems.length) { tBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No active members.</td></tr>'; return; }

    mems.forEach(en => {
      const u = users.find(x => x.id === en.userId);
      if(!u) return;
      const r = records.find(x => x.projectId === curProjId && x.userId === en.userId && x.date === dStr) || {breakfast:false, lunch:false, dinner:false};
      
      const allR = records.filter(x => x.projectId === curProjId && x.userId === en.userId);
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
      el.addEventListener('click', e => {
        const uid = e.currentTarget.dataset.uid;
        const type = e.currentTarget.dataset.type;
        
        let records = JSON.parse(localStorage.getItem('meal_records')) || [];
        const idx = records.findIndex(x => x.projectId === curProjId && x.userId === uid && x.date === dStr);
        
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
        if (window.fbCreate) window.fbCreate('meal_records', `${curProjId}_${uid}_${dStr}`, rObj);
        
        // Notify User
        const notifs = JSON.parse(localStorage.getItem('meal_notifications')) || [];
        const nObj = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          projectId: curProjId,
          to: uid,
          message: `Admin updated your meal for ${dStr}.`,
          time: Date.now()
        };
        notifs.push(nObj);
        localStorage.setItem('meal_notifications', JSON.stringify(notifs));
        if (window.fbCreate) window.fbCreate('meal_notifications', nObj.id, nObj);
        
        const u = users.find(x => x.id === uid);
        showToast(`Meal updated for ${u ? u.name : 'User'}!`);
        refresh();
      });
    });
  }

  // ─── Finances ───
  function calculateFinances() {
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const records = JSON.parse(localStorage.getItem('meal_records')) || [];
    
    const mems = enrolls.filter(e => e.projectId === curProjId && e.status === 'approved');
    
    let gMeals = 0, gMoney = 0;
    
    mems.forEach(en => {
      gMoney += (parseFloat(en.moneyGiven) || 0);
      const mR = records.filter(x => x.projectId === curProjId && x.userId === en.userId);
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
      const u = users.find(x => x.id === en.userId);
      if(!u) return;
      let uM = 0;
      records.filter(x => x.projectId === curProjId && x.userId === en.userId).forEach(x => {
        if(x.breakfast) uM+=0.5; if(x.lunch) uM+=1; if(x.dinner) uM+=1;
      });
      const cost = uM * mRate;
      const given = parseFloat(en.moneyGiven) || 0;
      const bal = cost - given;
      
      let balStr = bal > 0 ? `<span class="badge badge-yellow">${Math.abs(bal).toFixed(2)} ৳ Due</span>` :
                   bal < 0 ? `<span class="badge badge-green">${Math.abs(bal).toFixed(2)} ৳ Refund</span>` :
                   `<span class="badge badge-blue">0.00 ৳ Settled</span>`;

      fBody.innerHTML += `<tr>
        <td><strong>${u.name}</strong></td>
        <td class="tc">${uM}</td>
        <td class="tc text-gradient font-bold">${cost.toFixed(2)} ৳</td>
        <td>
          <div class="flex gap-2 justify-center">
            <input type="number" class="form-control deposit-input" data-id="${u.id}" value="${given}" style="width:100px; padding:.4rem .6rem;">
            <button class="btn btn-primary btn-sm btn-save-dep" data-id="${u.id}"><i class="fas fa-save"></i></button>
          </div>
        </td>
        <td class="tc">${balStr}</td>
        <td class="action-col tc"><button class="btn btn-danger btn-sm btn-rem-mem" data-id="${u.id}" title="Remove Member"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    });

    document.querySelectorAll('.btn-save-dep').forEach(b => b.addEventListener('click', e => {
      const uid = e.currentTarget.dataset.id;
      const val = parseFloat(document.querySelector(`.deposit-input[data-id="${uid}"]`).value) || 0;
      const idx = enrolls.findIndex(x => x.projectId === curProjId && x.userId === uid);
      if(idx > -1) {
        enrolls[idx].moneyGiven = val;
        localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
        if (window.fbUpdate) window.fbUpdate('meal_enrollments', `${curProjId}_${uid}`, { moneyGiven: val });
        showToast('Deposit updated! Stats recalculated.');
        calculateFinances();
      }
    }));
    document.querySelectorAll('.btn-rem-mem').forEach(b => b.addEventListener('click', e => {
      if(!confirm('Remove this member from the project?')) return;
      const uid = e.currentTarget.dataset.id;
      const nf = enrolls.filter(x => !(x.projectId === curProjId && x.userId === uid));
      localStorage.setItem('meal_enrollments', JSON.stringify(nf));
      if (window.fbDelete) window.fbDelete('meal_enrollments', `${curProjId}_${uid}`);
      showToast('Member removed.');
      refresh();
    }));
  }

  // ─── Comments ───
  function loadComments() {
    const comments = JSON.parse(localStorage.getItem('meal_comments')) || [];
    const users = JSON.parse(localStorage.getItem('meal_users')) || [];
    const pCom = comments.filter(c => c.projectId === curProjId).sort((a,b) => b.time - a.time);
    
    document.getElementById('commentBadge').textContent = pCom.length || '';
    const con = document.getElementById('commentsContainer');
    con.innerHTML = '';
    
    if(!pCom.length) { con.innerHTML = '<p class="text-center text-muted">No comments yet.</p>'; return; }
    
    pCom.forEach(c => {
      const u = users.find(x => x.id === c.userId);
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

    document.querySelectorAll('.btn-del-com').forEach(b => b.addEventListener('click', e => {
      if(!confirm('Delete this comment?')) return;
      const cid = e.currentTarget.dataset.id;
      const nCom = comments.filter(x => x.id !== cid);
      localStorage.setItem('meal_comments', JSON.stringify(nCom));
      if (window.fbDelete) window.fbDelete('meal_comments', cid);
      loadComments();
    }));
  }

  // ─── Menu ───
  function loadMenu() {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const p = projects.find(x => x.id === curProjId);
    if(!p) return;
    const mb = document.getElementById('menuBody');
    mb.innerHTML = '';
    for(const [day, m] of Object.entries(p.menu)) {
      mb.innerHTML += `<tr>
        <td><strong class="text-gradient">${day}</strong></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="b" value="${m.b}"></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="l" value="${m.l}"></td>
        <td><input type="text" class="form-control m-inp" data-day="${day}" data-type="d" value="${m.d}"></td>
      </tr>`;
    }
  }

  document.getElementById('saveMenuBtn').addEventListener('click', () => {
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const pIdx = projects.findIndex(x => x.id === curProjId);
    if(pIdx === -1) return;
    document.querySelectorAll('.m-inp').forEach(inp => {
      projects[pIdx].menu[inp.dataset.day][inp.dataset.type] = inp.value;
    });
    localStorage.setItem('meal_projects', JSON.stringify(projects));
    if (window.fbUpdate) window.fbUpdate('meal_projects', curProjId, { menu: projects[pIdx].menu });
    showToast('Menu saved!');
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
      calculateFinances(); // rebuilds table bringing inputs and actions back
    });
  });

  // ─── Backup & Restore ───
  const backupBtn = document.getElementById('backupBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreFile = document.getElementById('restoreFile');

  if(backupBtn) {
    backupBtn.addEventListener('click', () => {
      const data = {
        meal_users: JSON.parse(localStorage.getItem('meal_users')) || [],
        meal_projects: JSON.parse(localStorage.getItem('meal_projects')) || [],
        meal_enrollments: JSON.parse(localStorage.getItem('meal_enrollments')) || [],
        meal_records: JSON.parse(localStorage.getItem('meal_records')) || [],
        meal_comments: JSON.parse(localStorage.getItem('meal_comments')) || []
      };
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
    });
  }

  if(restoreBtn) {
    restoreBtn.addEventListener('click', () => restoreFile.click());
    restoreFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.meal_users) { localStorage.setItem('meal_users', JSON.stringify(data.meal_users)); if(window.fbRestore) window.fbRestore('meal_users', data.meal_users); }
          if (data.meal_projects) { localStorage.setItem('meal_projects', JSON.stringify(data.meal_projects)); if(window.fbRestore) window.fbRestore('meal_projects', data.meal_projects); }
          if (data.meal_enrollments) { localStorage.setItem('meal_enrollments', JSON.stringify(data.meal_enrollments)); if(window.fbRestore) window.fbRestore('meal_enrollments', data.meal_enrollments); }
          if (data.meal_records) { localStorage.setItem('meal_records', JSON.stringify(data.meal_records)); if(window.fbRestore) window.fbRestore('meal_records', data.meal_records); }
          if (data.meal_comments) { localStorage.setItem('meal_comments', JSON.stringify(data.meal_comments)); if(window.fbRestore) window.fbRestore('meal_comments', data.meal_comments); }
          showToast('Data restored successfully! Reloading...');
          setTimeout(() => window.location.reload(), 1500);
        } catch(err) {
          showToast('Invalid backup file!', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
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
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const users = JSON.parse(localStorage.getItem('meal_users')) || [];
        const idx = users.findIndex(u => u.id === cur.id);
        if(idx > -1) {
          users[idx].photo = dataUrl;
          localStorage.setItem('meal_users', JSON.stringify(users));
          if(window.fbUpdate) window.fbUpdate('meal_users', cur.id, { photo: dataUrl });
          showToast('Profile picture updated!');
          loadProfiles();
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
    const mems = enrolls.filter(e => e.projectId === curProjId && e.status === 'approved');
    
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
      const u = users.find(x => x.id === en.userId);
      if(!u) return;
      const photoHtml = u.photo ? `<img src="${u.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center;">${u.name.charAt(0).toUpperCase()}</div>`;
      if(pb) pb.innerHTML += `<tr>
        <td>${photoHtml}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.password}</td>
      </tr>`;
    });
  }
}

if (window.firebaseDataLoaded) initAdminApp();
else window.addEventListener('firebaseDataLoaded', initAdminApp);
