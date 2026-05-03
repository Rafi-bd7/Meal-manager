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

document.addEventListener('DOMContentLoaded', () => {
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
  window.addEventListener('storage', e => {
    if(!e.key || ['meal_records','meal_enrollments','meal_projects','meal_comments'].includes(e.key)) refresh();
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
    const sel = document.getElementById('projectSelect');
    sel.innerHTML = '<option value="">— Select Month —</option>';
    
    projects.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
    
    // Auto-select logic
    if (!curProjId && projects.length > 0) {
      curProjId = projects[projects.length - 1].id;
    }
    
    if (curProjId && projects.find(p => p.id === curProjId)) {
      sel.value = curProjId;
    }
  }
  loadProjects();

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
    const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    const menu = {}; days.forEach(d => menu[d] = {b:'', l:'', d:''});
    
    const p = { id: Date.now().toString(), name, adminId: cur.id, menu };
    projects.push(p);
    localStorage.setItem('meal_projects', JSON.stringify(projects));
    
    showToast('Project Created!');
    document.getElementById('newProjectPanel').classList.add('hidden');
    document.getElementById('newProjectName').value = '';
    
    curProjId = p.id;
    localStorage.setItem('meal_adminLastProj', curProjId);
    
    loadProjects();
    document.getElementById('projectSelect').value = p.id;
    document.getElementById('projectSelect').dispatchEvent(new Event('change'));
  });

  // Project Selection Change
  document.getElementById('projectSelect').addEventListener('change', e => {
    curProjId = e.target.value;
    localStorage.setItem('meal_adminLastProj', curProjId);
    
    if (curProjId) {
      document.getElementById('workspace').classList.remove('hidden');
      document.getElementById('exportPdfBtn').classList.remove('hidden');
      document.getElementById('pdfTitle').innerHTML = `<i class="fas fa-file-invoice" style="color:var(--primary);"></i> ${e.target.options[e.target.selectedIndex].text}`;
      loadMenu();
      refresh();
    } else {
      document.getElementById('workspace').classList.add('hidden');
      document.getElementById('exportPdfBtn').classList.add('hidden');
    }
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
  }

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
      if (en.status === 'pending') {
        rBody.innerHTML += `<tr>
          <td>${u.name}</td><td>${u.email}</td>
          <td><span class="badge badge-yellow">Pending</span></td>
          <td><button class="btn btn-success btn-sm btn-approve" data-id="${u.id}"><i class="fas fa-check"></i> Accept</button></td>
        </tr>`;
      } else if (en.status === 'approved') {
        mBody.innerHTML += `<tr>
          <td>${u.name}</td><td>${u.email}</td>
          <td><span class="badge badge-green"><i class="fas fa-check-circle"></i> Active</span></td>
        </tr>`;
      }
    });

    document.querySelectorAll('.btn-approve').forEach(b => b.addEventListener('click', e => {
      const uid = e.currentTarget.dataset.id;
      const idx = enrolls.findIndex(x => x.projectId === curProjId && x.userId === uid);
      if (idx > -1) {
        enrolls[idx].status = 'approved';
        localStorage.setItem('meal_enrollments', JSON.stringify(enrolls));
        showToast('Member Approved!');
        refresh();
      }
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
        <td class="tc">${r.breakfast ? y : n}</td>
        <td class="tc">${r.lunch ? y : n}</td>
        <td class="tc">${r.dinner ? y : n}</td>
        <td class="tc"><span class="meal-count-pill">${tToday}</span></td>
        <td class="tc font-bold text-gradient">${tMonth}</td>
      </tr>`;
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
        showToast('Deposit updated! Stats recalculated.');
        calculateFinances();
      }
    }));
    document.querySelectorAll('.btn-rem-mem').forEach(b => b.addEventListener('click', e => {
      if(!confirm('Remove this member from the project?')) return;
      const uid = e.currentTarget.dataset.id;
      const nf = enrolls.filter(x => !(x.projectId === curProjId && x.userId === uid));
      localStorage.setItem('meal_enrollments', JSON.stringify(nf));
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
          if (data.meal_users) localStorage.setItem('meal_users', JSON.stringify(data.meal_users));
          if (data.meal_projects) localStorage.setItem('meal_projects', JSON.stringify(data.meal_projects));
          if (data.meal_enrollments) localStorage.setItem('meal_enrollments', JSON.stringify(data.meal_enrollments));
          if (data.meal_records) localStorage.setItem('meal_records', JSON.stringify(data.meal_records));
          if (data.meal_comments) localStorage.setItem('meal_comments', JSON.stringify(data.meal_comments));
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
});
