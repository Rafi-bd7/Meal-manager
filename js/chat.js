// js/chat.js — Floating Group Chat Widget
// Self-contained with inline CSS + polling for reliability

(function () {
  // Inject CSS once
  if (!document.getElementById('chatStyles')) {
    const s = document.createElement('style');
    s.id = 'chatStyles';
    s.textContent = `
      @keyframes chatPulse {
        0%   { box-shadow: 0 0 0 0   rgba(99,102,241,0.7); }
        70%  { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
        100% { box-shadow: 0 0 0 0   rgba(99,102,241,0); }
      }
      #chatFab {
        position: fixed; bottom: 28px; right: 28px;
        width: 62px; height: 62px; border-radius: 50%;
        background: linear-gradient(135deg,#6366f1,#8b5cf6);
        color: #fff; font-size: 1.8rem;
        display: flex !important; align-items: center; justify-content: center;
        cursor: pointer; z-index: 99998;
        box-shadow: 0 4px 18px rgba(0,0,0,0.35);
        animation: chatPulse 2s infinite;
        transition: transform .2s;
        border: none; outline: none;
      }
      #chatFab:hover { transform: scale(1.1); }
      #chatFab[data-hidden="1"] { display: none !important; }

      #chatBox {
        position: fixed; bottom: 102px; right: 28px;
        width: 310px; height: 430px;
        background: rgba(20,20,40,0.92);
        backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.45);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: 99999;
        transform-origin: bottom right;
        transition: transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
      }
      #chatBox[data-hidden="1"] { display: none !important; }
      #chatBox[data-closed="1"] { transform: scale(0); opacity: 0; pointer-events: none; }

      #chatBoxHead {
        background: linear-gradient(135deg,#6366f1,#8b5cf6);
        padding: 13px 16px; display: flex;
        justify-content: space-between; align-items: center;
        font-weight: 700; font-size: 1rem; color: #fff;
        cursor: grab; user-select: none; flex-shrink: 0;
      }
      #chatBoxHead:active { cursor: grabbing; }
      #chatCloseBtn {
        background: rgba(255,255,255,.2); border: none;
        color: #fff; width: 28px; height: 28px; border-radius: 50%;
        cursor: pointer; font-size: 1rem; display: flex;
        align-items: center; justify-content: center;
        transition: background .2s;
      }
      #chatCloseBtn:hover { background: rgba(255,255,255,.35); }

      #chatMessages {
        flex: 1; overflow-y: auto; padding: 12px;
        display: flex; flex-direction: column; gap: 8px;
      }
      #chatMessages::-webkit-scrollbar { width: 4px; }
      #chatMessages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 4px; }

      .cm { max-width: 82%; padding: 9px 13px; border-radius: 14px;
            font-size: .9rem; line-height: 1.45; word-break: break-word; }
      .cm.me  { align-self: flex-end;  background: #6366f1; color: #fff; border-bottom-right-radius: 4px; }
      .cm.you { align-self: flex-start; background: rgba(255,255,255,.12);
                color: #e2e8f0; border-bottom-left-radius: 4px; }
      .cm .cm-name { font-size: .72rem; color: #a5b4fc; font-weight: 700; margin-bottom: 3px; }
      .cm .cm-time { font-size: .66rem; opacity: .6; margin-top: 4px; text-align: right; }

      #chatInputRow {
        padding: 10px 12px; display: flex; gap: 8px; flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.05);
      }
      #chatMsgInput {
        flex: 1; background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.2); border-radius: 20px;
        padding: 8px 14px; color: #fff; font-size: .9rem; outline: none;
      }
      #chatMsgInput::placeholder { color: rgba(255,255,255,.45); }
      #chatSendBtn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #6366f1; border: none; color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 1rem; transition: transform .2s;
      }
      #chatSendBtn:hover { transform: scale(1.1); }
    `;
    document.head.appendChild(s);
  }

  // Inject HTML once
  if (!document.getElementById('chatFab')) {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="chatFab" data-hidden="1" title="Group Chat">
        <i class="fas fa-comment-dots"></i>
      </button>
      <div id="chatBox" data-hidden="1" data-closed="1">
        <div id="chatBoxHead">
          <span><i class="fas fa-comments"></i>&nbsp; Group Chat</span>
          <button id="chatCloseBtn"><i class="fas fa-times"></i></button>
        </div>
        <div id="chatMessages"></div>
        <div id="chatInputRow">
          <input id="chatMsgInput" type="text" placeholder="Type a message…" autocomplete="off">
          <button id="chatSendBtn"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `);
  }

  const fab     = document.getElementById('chatFab');
  const box     = document.getElementById('chatBox');
  const head    = document.getElementById('chatBoxHead');
  const closeBtn= document.getElementById('chatCloseBtn');
  const msgs    = document.getElementById('chatMessages');
  const inp     = document.getElementById('chatMsgInput');
  const sendBtn = document.getElementById('chatSendBtn');

  // ---------- Drag ----------
  let dragging = false, ox = 0, oy = 0, ix, iy;
  head.addEventListener('mousedown', e => {
    if (e.target === closeBtn || e.target.closest('#chatCloseBtn')) return;
    dragging = true; ix = e.clientX - ox; iy = e.clientY - oy;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    ox = e.clientX - ix; oy = e.clientY - iy;
    box.style.transform = `translate3d(${ox}px,${oy}px,0) scale(1)`;
  });

  // ---------- Open / Close ----------
  fab.addEventListener('click', () => {
    box.removeAttribute('data-closed');
    fab.style.display = 'none';
    msgs.scrollTop = msgs.scrollHeight;
  });
  closeBtn.addEventListener('click', () => {
    box.setAttribute('data-closed', '1');
    fab.style.display = 'flex';
  });

  // ---------- Render ----------
  let lastPid = null;

  function renderChat(curUser, projId) {
    if (!projId) {
      fab.setAttribute('data-hidden', '1');
      box.setAttribute('data-hidden', '1');
      return;
    }

    // Show launcher (but don't force-open the box)
    fab.removeAttribute('data-hidden');
    fab.style.display = '';          // let CSS decide
    box.removeAttribute('data-hidden');

    // Reset drag offset when project changes
    if (projId !== lastPid) {
      ox = 0; oy = 0;
      box.style.transform = '';
      lastPid = projId;
    }

    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const mine  = chats.filter(c => c.projectId === projId)
                       .sort((a, b) => a.time - b.time);

    const atBottom = msgs.scrollHeight - msgs.clientHeight <= msgs.scrollTop + 30;
    msgs.innerHTML = mine.map(c => {
      const self = c.userId === curUser.id;
      const t = new Date(c.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      return `<div class="cm ${self ? 'me' : 'you'}">
        ${!self ? `<div class="cm-name">${c.userName}</div>` : ''}
        <div>${c.text}</div>
        <div class="cm-time">${t}</div>
      </div>`;
    }).join('');
    if (atBottom) msgs.scrollTop = msgs.scrollHeight;
  }

  // ---------- Send ----------
  function send(curUser, getProjId) {
    const text = inp.value.trim();
    const pid  = getProjId();
    if (!text || !pid) return;
    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const msg = {
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      projectId: pid,
      userId: curUser.id,
      userName: curUser.name,
      text, time: Date.now()
    };
    chats.push(msg);
    localStorage.setItem('meal_chats', JSON.stringify(chats));
    if (window.fbCreate) window.fbCreate('meal_chats', msg.id, msg);
    inp.value = '';
    renderChat(curUser, pid);
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
  }

  // ---------- Public init (called by admin.js / user.js) ----------
  window.initChat = function (curUser, getProjId) {

    sendBtn.onclick = () => send(curUser, getProjId);
    inp.onkeydown  = e => { if (e.key === 'Enter') send(curUser, getProjId); };

    function refresh() { renderChat(curUser, getProjId()); }

    // Poll every 1.5 s → catches any timing / caching issue
    setInterval(refresh, 1500);

    // Also react to events
    window.addEventListener('refreshChat', refresh);
    window.addEventListener('storage', e => {
      if (!e.key || e.key === 'meal_chats') refresh();
    });

    // Immediate first render
    refresh();
    // Extra safety: re-render after 500 ms in case data was still loading
    setTimeout(refresh, 500);
    setTimeout(refresh, 1500);
  };
})();
