// js/chat.js — WhatsApp & Messenger Style Group Chat Widget
// Features: Direct DB Polling, Photo/Image Sharing, Lightbox, Delete/Unsend, Quick Reactions, Audio/Status

(function () {
  // Inject modern Messenger/WhatsApp styling
  if (!document.getElementById('chatStyles')) {
    const s = document.createElement('style');
    s.id = 'chatStyles';
    s.textContent = `
      @keyframes chatPulse {
        0%   { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0.7); }
        70%  { box-shadow: 0 0 0 16px rgba(0, 132, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0); }
      }
      @keyframes chatSlideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes bounceIn {
        0%   { transform: scale(0.8); opacity: 0; }
        60%  { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(1); }
      }

      /* Floating Action Button (Launcher) */
      #chatFab {
        position: fixed; bottom: 26px; right: 26px;
        width: 62px; height: 62px; border-radius: 50%;
        background: linear-gradient(135deg, #0084ff, #00c6ff);
        color: #fff; font-size: 1.75rem;
        display: flex !important; align-items: center; justify-content: center;
        cursor: pointer; z-index: 99998;
        box-shadow: 0 6px 24px rgba(0, 132, 255, 0.45);
        animation: chatPulse 2.2s infinite;
        transition: transform .2s cubic-bezier(.34,1.56,.64,1);
        border: none; outline: none;
      }
      #chatFab:hover { transform: scale(1.1); }
      #chatFab[data-hidden="1"] { display: none !important; }

      .chat-badge {
        position: absolute; top: -3px; right: -3px;
        background: #ef4444; color: #fff;
        font-size: 0.72rem; font-weight: 800;
        min-width: 20px; height: 20px; border-radius: 10px;
        display: none; align-items: center; justify-content: center;
        padding: 0 5px; border: 2px solid #0f172a;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }

      /* Chat Window Box */
      #chatBox {
        position: fixed; bottom: 98px; right: 26px;
        width: 360px; max-width: calc(100vw - 32px); height: 530px; max-height: calc(100vh - 120px);
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 20px;
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: 99999;
        transform-origin: bottom right;
        transition: transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
        font-family: 'Hind Siliguri', 'Inter', -apple-system, sans-serif;
      }
      #chatBox[data-hidden="1"] { display: none !important; }
      #chatBox[data-closed="1"] { transform: scale(0); opacity: 0; pointer-events: none; }

      /* Header */
      #chatBoxHead {
        background: linear-gradient(135deg, #0084ff, #0066ff);
        padding: 12px 16px; display: flex;
        justify-content: space-between; align-items: center;
        color: #fff; user-select: none; flex-shrink: 0;
        cursor: grab;
      }
      #chatBoxHead:active { cursor: grabbing; }
      .chat-head-left { display: flex; align-items: center; gap: 10px; }
      .chat-avatar-group {
        width: 38px; height: 38px; border-radius: 50%;
        background: rgba(255,255,255,0.25); display: flex;
        align-items: center; justify-content: center;
        font-size: 1.1rem; position: relative;
      }
      .chat-online-dot {
        position: absolute; bottom: 0; right: 0;
        width: 10px; height: 10px; border-radius: 50%;
        background: #22c55e; border: 2px solid #0084ff;
      }
      .chat-head-title { font-weight: 700; font-size: 0.95rem; line-height: 1.2; margin: 0; }
      .chat-head-sub { font-size: 0.72rem; opacity: 0.85; margin: 0; }

      .chat-head-actions { display: flex; align-items: center; gap: 6px; }
      .chat-head-btn {
        background: rgba(255,255,255,.18); border: none;
        color: #fff; width: 28px; height: 28px; border-radius: 50%;
        cursor: pointer; font-size: 0.85rem; display: flex;
        align-items: center; justify-content: center;
        transition: background .2s;
      }
      .chat-head-btn:hover { background: rgba(255,255,255,.35); }

      /* Messages Container */
      #chatMessages {
        flex: 1; overflow-y: auto; padding: 14px;
        display: flex; flex-direction: column; gap: 10px;
        background: radial-gradient(circle at top right, rgba(0,132,255,0.04), transparent 40%),
                    linear-gradient(180deg, rgba(15,23,42,0.98), rgba(11,18,32,1));
      }
      #chatMessages::-webkit-scrollbar { width: 5px; }
      #chatMessages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 10px; }

      /* Date Separator Pill */
      .chat-date-pill {
        align-self: center; background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.08);
        color: #94a3b8; font-size: 0.7rem; font-weight: 600;
        padding: 3px 10px; border-radius: 12px; margin: 6px 0;
      }

      /* Message Wrapper */
      .cm-row {
        display: flex; gap: 8px; width: 100%;
        align-items: flex-end; position: relative;
        animation: bounceIn 0.2s ease-out;
      }
      .cm-row.me { justify-content: flex-end; }
      .cm-row.you { justify-content: flex-start; }

      .cm-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        background: #334155; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
        overflow: hidden; border: 1px solid rgba(255,255,255,0.15);
      }
      .cm-avatar img { width: 100%; height: 100%; object-fit: cover; }

      .cm-bubble-wrap {
        max-width: 78%; display: flex; flex-direction: column;
        position: relative;
      }
      .cm-row.me .cm-bubble-wrap { align-items: flex-end; }
      .cm-row.you .cm-bubble-wrap { align-items: flex-start; }

      .cm-bubble {
        padding: 8px 12px; border-radius: 18px;
        font-size: 0.88rem; line-height: 1.4; word-break: break-word;
        position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .cm-row.me .cm-bubble {
        background: linear-gradient(135deg, #0084ff, #0070e0);
        color: #ffffff; border-bottom-right-radius: 4px;
      }
      .cm-row.you .cm-bubble {
        background: rgba(255,255,255,0.09);
        color: #f1f5f9; border-bottom-left-radius: 4px;
        border: 1px solid rgba(255,255,255,0.08);
      }

      .cm-sender-name {
        font-size: 0.72rem; font-weight: 700; color: #60a5fa;
        margin-bottom: 3px; display: block;
      }
      .cm-meta {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 4px; font-size: 0.65rem; opacity: 0.7; margin-top: 4px;
      }
      .cm-row.you .cm-meta { justify-content: flex-start; }

      /* Image in Message */
      .cm-image-wrap {
        margin: 2px 0 4px; border-radius: 12px; overflow: hidden;
        max-width: 220px; max-height: 220px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.15); background: #000;
        transition: transform .15s;
      }
      .cm-image-wrap:hover { transform: scale(1.02); }
      .cm-image-thumb {
        width: 100%; height: auto; max-height: 220px; object-fit: cover; display: block;
      }

      /* Hover Action Menu on Message */
      .cm-actions {
        display: none; position: absolute; top: -12px;
        background: rgba(15,23,42,0.9); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 14px; padding: 2px 5px; gap: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 10;
      }
      .cm-row.me .cm-actions { right: 8px; }
      .cm-row.you .cm-actions { left: 8px; }
      .cm-row:hover .cm-actions { display: flex; }

      .cm-action-btn {
        background: transparent; border: none; color: #cbd5e1;
        width: 22px; height: 22px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 0.72rem; transition: background .15s, color .15s;
      }
      .cm-action-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
      .cm-action-btn.del:hover { background: #ef4444; color: #fff; }

      /* Image Upload Preview Tray */
      #chatImgPreviewTray {
        display: none; padding: 8px 12px;
        background: rgba(0, 132, 255, 0.08);
        border-top: 1px solid rgba(255,255,255,0.1);
        align-items: center; justify-content: space-between;
      }
      .chat-tray-left { display: flex; align-items: center; gap: 8px; }
      #chatImgPreviewThumb {
        width: 44px; height: 44px; border-radius: 8px;
        object-fit: cover; border: 1px solid #0084ff;
      }
      .chat-tray-info { font-size: 0.75rem; color: #93c5fd; }
      #chatCancelImgBtn {
        background: rgba(239,68,68,0.2); color: #ef4444;
        border: 1px solid #ef4444; width: 24px; height: 24px;
        border-radius: 50%; cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 0.75rem;
      }

      /* Quick Emoji Bar */
      #chatEmojiBar {
        display: none; padding: 6px 12px;
        background: rgba(30, 41, 59, 0.95);
        border-top: 1px solid rgba(255,255,255,0.08);
        gap: 8px; overflow-x: auto;
      }
      #chatEmojiBar::-webkit-scrollbar { display: none; }
      .chat-quick-emoji {
        font-size: 1.25rem; cursor: pointer; transition: transform .15s;
        user-select: none; flex-shrink: 0;
      }
      .chat-quick-emoji:hover { transform: scale(1.3); }

      /* Input Row */
      #chatInputRow {
        padding: 10px 12px; display: flex; gap: 8px; align-items: center; flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,.1);
        background: rgba(15,23,42,0.95);
      }
      .chat-tool-btn {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
        color: #94a3b8; display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 1rem; transition: background .15s, color .15s;
        flex-shrink: 0;
      }
      .chat-tool-btn:hover { background: rgba(255,255,255,0.18); color: #0084ff; }

      #chatMsgInput {
        flex: 1; background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.15); border-radius: 20px;
        padding: 8px 14px; color: #fff; font-size: 0.9rem; outline: none;
        transition: border-color .15s;
      }
      #chatMsgInput:focus { border-color: #0084ff; background: rgba(255,255,255,0.12); }
      #chatMsgInput::placeholder { color: rgba(255,255,255,.45); }

      #chatSendBtn {
        width: 38px; height: 38px; border-radius: 50%;
        background: #0084ff; border: none; color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 1rem; transition: transform .2s, background .15s;
        flex-shrink: 0;
      }
      #chatSendBtn:hover { transform: scale(1.1); background: #0070e0; }

      /* Lightbox for Image Zoom */
      #chatLightbox {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
        display: none; align-items: center; justify-content: center;
        z-index: 100000; padding: 20px; box-sizing: border-box;
      }
      #chatLightbox.active { display: flex; }
      #chatLightbox img {
        max-width: 90vw; max-height: 85vh; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8); object-fit: contain;
      }
      #chatLightboxClose {
        position: absolute; top: 20px; right: 24px;
        background: rgba(255,255,255,0.2); border: none; color: #fff;
        width: 36px; height: 36px; border-radius: 50%;
        font-size: 1.2rem; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
      }
    `;
    document.head.appendChild(s);
  }

  // Inject HTML Markup once
  if (!document.getElementById('chatFab')) {
    document.body.insertAdjacentHTML('beforeend', `
      <!-- Floating Action Button -->
      <button id="chatFab" data-hidden="1" title="মেস চ্যাট">
        <i class="fas fa-comment-dots"></i>
        <span id="chatBadge" class="chat-badge">0</span>
      </button>

      <!-- Messenger Chat Window -->
      <div id="chatBox" data-hidden="1" data-closed="1">
        <!-- Header -->
        <div id="chatBoxHead">
          <div class="chat-head-left">
            <div class="chat-avatar-group">
              <i class="fas fa-users" style="font-size:0.95rem;"></i>
              <span class="chat-online-dot"></span>
            </div>
            <div>
              <h4 class="chat-head-title" id="chatProjTitle">মেস গ্রুপ চ্যাট</h4>
              <p class="chat-head-sub">🟢 লাইভ মেসেঞ্জার | সকল সদস্য</p>
            </div>
          </div>
          <div class="chat-head-actions">
            <button id="chatRefreshBtn" class="chat-head-btn" title="রিফ্রেশ করুন"><i class="fas fa-sync-alt"></i></button>
            <button id="chatCloseBtn" class="chat-head-btn" title="বন্ধ করুন"><i class="fas fa-times"></i></button>
          </div>
        </div>

        <!-- Messages Area -->
        <div id="chatMessages"></div>

        <!-- Image Upload Preview Tray -->
        <div id="chatImgPreviewTray">
          <div class="chat-tray-left">
            <img id="chatImgPreviewThumb" src="" alt="preview">
            <div class="chat-tray-info">
              <strong>ছবি যুক্ত হয়েছে</strong><br>
              <span id="chatImgSizeText">প্রস্তুত</span>
            </div>
          </div>
          <button id="chatCancelImgBtn" title="ছবি বাদ দিন"><i class="fas fa-times"></i></button>
        </div>

        <!-- Quick Emoji Bar -->
        <div id="chatEmojiBar">
          <span class="chat-quick-emoji">👍</span>
          <span class="chat-quick-emoji">❤️</span>
          <span class="chat-quick-emoji">😂</span>
          <span class="chat-quick-emoji">😮</span>
          <span class="chat-quick-emoji">😢</span>
          <span class="chat-quick-emoji">🔥</span>
          <span class="chat-quick-emoji">🎉</span>
          <span class="chat-quick-emoji">🍛</span>
          <span class="chat-quick-emoji">🍗</span>
          <span class="chat-quick-emoji">👌</span>
        </div>

        <!-- Input Row -->
        <div id="chatInputRow">
          <input type="file" id="chatFileInput" accept="image/*" style="display:none;">
          <button id="chatAttachBtn" class="chat-tool-btn" title="ছবি পাঠান"><i class="fas fa-image"></i></button>
          <button id="chatEmojiToggleBtn" class="chat-tool-btn" title="ইমোজি"><i class="far fa-smile"></i></button>
          <input id="chatMsgInput" type="text" placeholder="একটি বার্তা লিখুন…" autocomplete="off">
          <button id="chatSendBtn" title="পাঠান"><i class="fas fa-thumbs-up" id="chatSendIcon"></i></button>
        </div>
      </div>

      <!-- Lightbox for Image Zoom -->
      <div id="chatLightbox">
        <button id="chatLightboxClose"><i class="fas fa-times"></i></button>
        <img id="chatLightboxImg" src="" alt="Full View">
      </div>
    `);
  }

  const fab          = document.getElementById('chatFab');
  const badge        = document.getElementById('chatBadge');
  const box          = document.getElementById('chatBox');
  const head         = document.getElementById('chatBoxHead');
  const closeBtn     = document.getElementById('chatCloseBtn');
  const refreshBtn   = document.getElementById('chatRefreshBtn');
  const msgs         = document.getElementById('chatMessages');
  const inp          = document.getElementById('chatMsgInput');
  const sendBtn      = document.getElementById('chatSendBtn');
  const sendIcon     = document.getElementById('chatSendIcon');
  const attachBtn    = document.getElementById('chatAttachBtn');
  const fileInput    = document.getElementById('chatFileInput');
  const emojiToggle  = document.getElementById('chatEmojiToggleBtn');
  const emojiBar     = document.getElementById('chatEmojiBar');
  const imgTray      = document.getElementById('chatImgPreviewTray');
  const imgThumb     = document.getElementById('chatImgPreviewThumb');
  const cancelImgBtn = document.getElementById('chatCancelImgBtn');
  const projTitle    = document.getElementById('chatProjTitle');
  const lightbox     = document.getElementById('chatLightbox');
  const lightboxImg  = document.getElementById('chatLightboxImg');
  const lightboxClose= document.getElementById('chatLightboxClose');

  let pendingImageBase64 = null;
  let activeCurUser = null;
  let activeGetProjId = null;
  let isBoxOpen = false;
  let lastSeenCount = 0;

  // Global helper for opening lightbox
  window.openChatLightbox = function (src) {
    if (lightbox && lightboxImg) {
      lightboxImg.src = src;
      lightbox.classList.add('active');
    }
  };
  lightboxClose?.addEventListener('click', () => lightbox?.classList.remove('active'));
  lightbox?.addEventListener('click', e => {
    if (e.target === lightbox) lightbox.classList.remove('active');
  });

  // Toggle send button icon between Thumbs-up and Send Plane
  function updateSendIcon() {
    const hasText = inp.value.trim().length > 0;
    const hasImg  = !!pendingImageBase64;
    if (hasText || hasImg) {
      sendIcon.className = 'fas fa-paper-plane';
    } else {
      sendIcon.className = 'fas fa-thumbs-up';
    }
  }
  inp.addEventListener('input', updateSendIcon);

  // Toggle quick emoji bar
  emojiToggle.addEventListener('click', () => {
    if (emojiBar.style.display === 'flex') {
      emojiBar.style.display = 'none';
    } else {
      emojiBar.style.display = 'flex';
    }
  });

  // Click on emoji to append
  document.querySelectorAll('.chat-quick-emoji').forEach(em => {
    em.addEventListener('click', () => {
      inp.value += em.textContent;
      updateSendIcon();
      inp.focus();
    });
  });

  // Image Attachment Handling & Client-side Compression
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        // Compress image to max 800px width/height
        const maxDim = 800;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

        pendingImageBase64 = compressedBase64;
        imgThumb.src = compressedBase64;
        imgTray.style.display = 'flex';
        updateSendIcon();
        inp.focus();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  cancelImgBtn.addEventListener('click', () => {
    pendingImageBase64 = null;
    fileInput.value = '';
    imgTray.style.display = 'none';
    updateSendIcon();
  });

  // Dragging support for chat header
  let dragging = false, ox = 0, oy = 0, ix, iy;
  head.addEventListener('mousedown', e => {
    if (e.target.closest('.chat-head-btn')) return;
    dragging = true; ix = e.clientX - ox; iy = e.clientY - oy;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    ox = e.clientX - ix; oy = e.clientY - oy;
    box.style.transform = `translate3d(${ox}px,${oy}px,0) scale(1)`;
  });

  // Open / Close
  fab.addEventListener('click', () => {
    box.removeAttribute('data-closed');
    fab.style.display = 'none';
    isBoxOpen = true;
    if (badge) badge.style.display = 'none';
    msgs.scrollTop = msgs.scrollHeight;
    if (activeCurUser && activeGetProjId) {
      fetchDirectFromDB(activeGetProjId());
    }
  });

  closeBtn.addEventListener('click', () => {
    box.setAttribute('data-closed', '1');
    fab.style.display = 'flex';
    isBoxOpen = false;
  });

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.querySelector('i').classList.add('fa-spin');
    if (activeGetProjId) await fetchDirectFromDB(activeGetProjId());
    setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 600);
  });

  // Render chat messages into the DOM
  function renderChat(curUser, projId) {
    if (!projId) {
      fab.setAttribute('data-hidden', '1');
      box.setAttribute('data-hidden', '1');
      return;
    }

    fab.removeAttribute('data-hidden');
    if (!isBoxOpen) fab.style.display = 'flex';
    box.removeAttribute('data-hidden');

    // Update Project Title in header
    const projects = JSON.parse(localStorage.getItem('meal_projects') || '[]');
    const p = projects.find(x => String(x.id) === String(projId));
    if (projTitle) projTitle.textContent = p ? p.name : 'মেস গ্রুপ চ্যাট';

    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const mine  = chats.filter(c => String(c.projectId || c.project_id) === String(projId))
                       .sort((a, b) => Number(a.time) - Number(b.time));

    // Update unread badge if closed
    if (!isBoxOpen && mine.length > lastSeenCount && lastSeenCount > 0) {
      const unread = mine.length - lastSeenCount;
      if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
      }
    } else if (isBoxOpen) {
      lastSeenCount = mine.length;
      if (badge) badge.style.display = 'none';
    } else if (lastSeenCount === 0) {
      lastSeenCount = mine.length;
    }

    const atBottom = msgs.scrollHeight - msgs.clientHeight <= msgs.scrollTop + 60;
    const users = JSON.parse(localStorage.getItem('meal_users') || '[]');

    let html = '';
    let lastDateStr = '';

    mine.forEach(c => {
      const isMe = String(c.userId || c.user_id) === String(curUser.id);
      const cTime = Number(c.time);
      const dObj = new Date(cTime);
      const dateStr = dObj.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' });
      const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Insert date divider pill when date changes
      if (dateStr !== lastDateStr) {
        html += `<div class="chat-date-pill">${dateStr}</div>`;
        lastDateStr = dateStr;
      }

      // User avatar / photo
      const u = users.find(x => String(x.id) === String(c.userId || c.user_id));
      const uPhoto = c.userPhoto || (u ? u.photo : null);
      const uName  = c.userName || c.user_name || (u ? u.name : 'সদস্য');
      const firstL = uName.charAt(0).toUpperCase();

      const avatarHtml = `<div class="cm-avatar" title="${uName}">
        ${uPhoto ? `<img src="${uPhoto}" alt="${uName}">` : firstL}
      </div>`;

      // Image attachment html
      let imgHtml = '';
      if (c.image) {
        imgHtml = `<div class="cm-image-wrap" onclick="window.openChatLightbox('${c.image}')">
          <img src="${c.image}" class="cm-image-thumb" alt="Photo" loading="lazy">
        </div>`;
      }

      // Action menu (Delete / Unsend button)
      const canDelete = isMe || curUser.role === 'admin';
      const actionMenu = `
        <div class="cm-actions">
          <button class="cm-action-btn copy-msg" data-text="${c.text || ''}" title="কপি করুন"><i class="fas fa-copy"></i></button>
          ${canDelete ? `<button class="cm-action-btn del delete-msg" data-id="${c.id}" title="মুছে ফেলুন"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
      `;

      html += `
        <div class="cm-row ${isMe ? 'me' : 'you'}" data-id="${c.id}">
          ${!isMe ? avatarHtml : ''}
          <div class="cm-bubble-wrap">
            ${actionMenu}
            <div class="cm-bubble">
              ${!isMe ? `<span class="cm-sender-name">${uName}</span>` : ''}
              ${imgHtml}
              ${c.text ? `<div>${c.text}</div>` : ''}
              <div class="cm-meta">
                <span>${timeStr}</span>
                ${isMe ? '<i class="fas fa-check-double" style="font-size:0.65rem; color:#93c5fd;"></i>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    if (!mine.length) {
      html = `<div style="text-align:center; color:#64748b; margin-top:40px; font-size:0.85rem;">
        <i class="fas fa-comments" style="font-size:2.5rem; opacity:0.3; display:block; margin-bottom:10px;"></i>
        এখনো কোনো বার্তা পাঠানো হয়নি।<br>প্রথম বার্তা পাঠিয়ে কথোপকথন শুরু করুন!
      </div>`;
    }

    msgs.innerHTML = html;

    // Attach copy listeners
    msgs.querySelectorAll('.copy-msg').forEach(btn => {
      btn.addEventListener('click', e => {
        const txt = e.currentTarget.dataset.text;
        if (txt && navigator.clipboard) {
          navigator.clipboard.writeText(txt);
          if (window.showToast) window.showToast('মেসেজ কপি হয়েছে!');
        }
      });
    });

    // Attach delete listeners (Deletes directly from server & local)
    msgs.querySelectorAll('.delete-msg').forEach(btn => {
      btn.addEventListener('click', async e => {
        const msgId = e.currentTarget.dataset.id;
        if (!confirm('আপনি কি এই মেসেজটি মুছে ফেলতে চান? এটি সবার জন্যই মুছে যাবে।')) return;
        await deleteMessage(msgId, projId);
      });
    });

    if (atBottom) msgs.scrollTop = msgs.scrollHeight;
  }

  // Delete message directly from server and update local storage immediately
  async function deleteMessage(msgId, projId) {
    try {
      const allChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
      const filtered = allChats.filter(c => String(c.id) !== String(msgId));
      localStorage.setItem('meal_chats', JSON.stringify(filtered));
      renderChat(activeCurUser, projId);

      if (window.API) {
        await window.API.post('chats.php', { action: 'delete' }, { id: msgId, project_id: projId });
        await fetchDirectFromDB(projId);
      }
      if (window.showToast) window.showToast('মেসেজটি মুছে ফেলা হয়েছে।');
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  }

  // Fetch directly from chats.php to catch any phpMyAdmin / external deletions!
  async function fetchDirectFromDB(projId) {
    if (!projId || !window.API) return;
    try {
      const res = await window.API.get('chats.php', { action: 'list', project_id: projId });
      if (res && Array.isArray(res.chats)) {
        const localChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
        // Keep chats of other projects, replace current project's chats with fresh DB rows
        const otherProjChats = localChats.filter(c => String(c.projectId || c.project_id) !== String(projId));
        const updated = otherProjChats.concat(res.chats);
        localStorage.setItem('meal_chats', JSON.stringify(updated));
        if (activeCurUser) renderChat(activeCurUser, projId);
      }
    } catch (e) {
      // offline fallback
    }
  }

  // Send Message (Text and/or Photo)
  async function send(curUser, getProjId) {
    const text = inp.value.trim();
    const pid  = getProjId();
    const imageToSend = pendingImageBase64;

    // If input is completely empty and no image, send Messenger like 👍
    const finalText = (!text && !imageToSend) ? '👍' : text;

    if (!pid) return;

    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const msgId = 'c_' + Date.now() + Math.random().toString(36).slice(2, 6);
    const nowMs = Date.now();

    const msg = {
      id: msgId,
      projectId: pid,
      userId: curUser.id,
      userName: curUser.name,
      userPhoto: curUser.photo || null,
      text: finalText,
      image: imageToSend,
      time: nowMs
    };

    // 1. Immediately render in UI
    chats.push(msg);
    localStorage.setItem('meal_chats', JSON.stringify(chats));
    inp.value = '';
    pendingImageBase64 = null;
    fileInput.value = '';
    imgTray.style.display = 'none';
    emojiBar.style.display = 'none';
    updateSendIcon();
    renderChat(curUser, pid);
    msgs.scrollTop = msgs.scrollHeight;

    // 2. Persist to API and sync with database
    try {
      if (window.API) {
        await window.API.post('chats.php', { action: 'send' }, {
          project_id: pid,
          user_id: curUser.id,
          user_name: curUser.name,
          text: finalText,
          image: imageToSend,
          time: nowMs
        });
        await fetchDirectFromDB(pid);
      }
    } catch (e) {
      console.warn('Chat send error:', e);
    }
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 60);
  }

  // Public Initialization function
  window.initChat = function (curUser, getProjId) {
    activeCurUser = curUser;
    activeGetProjId = getProjId;

    sendBtn.onclick = () => send(curUser, getProjId);
    inp.onkeydown  = e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(curUser, getProjId);
      }
    };

    function refresh() {
      const pid = getProjId();
      if (pid) renderChat(curUser, pid);
    }

    // Direct Database Polling every 2.5 seconds (ensures deleted chats in phpMyAdmin disappear immediately!)
    setInterval(() => {
      const pid = getProjId();
      if (pid && !document.hidden) {
        fetchDirectFromDB(pid);
      }
    }, 2500);

    // Event listeners
    window.addEventListener('refreshChat', refresh);
    window.addEventListener('appDataSynced', refresh);
    window.addEventListener('storage', e => {
      if (!e.key || e.key === 'meal_chats') refresh();
    });

    // Immediate initial renders and sync
    refresh();
    const pid = getProjId();
    if (pid) fetchDirectFromDB(pid);
    setTimeout(refresh, 500);
  };
})();
