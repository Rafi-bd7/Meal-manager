// js/chat.js — Full Facebook Messenger Style Group Chat
// Features: Typing Indicator, Reactions, Reply, Online Status, Seen/Read, Image, Delete

(function () {
  // ── Inject CSS ──────────────────────────────────────────────────────────────
  if (!document.getElementById('chatStyles')) {
    const s = document.createElement('style');
    s.id = 'chatStyles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      /* ─── FAB Button ─────────────────────────────────────────── */
      #chatFab {
        position: fixed; bottom: 26px; right: 26px;
        width: 58px; height: 58px; border-radius: 50%;
        background: linear-gradient(135deg, #0084ff 0%, #a259ff 100%);
        color: #fff; font-size: 1.5rem;
        display: flex !important; align-items: center; justify-content: center;
        cursor: pointer; z-index: 99998;
        box-shadow: 0 4px 20px rgba(0,132,255,0.5);
        transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
        border: none; outline: none;
        animation: fabPulse 3s ease-in-out infinite;
      }
      @keyframes fabPulse {
        0%,100% { box-shadow: 0 4px 20px rgba(0,132,255,0.5); }
        50% { box-shadow: 0 4px 30px rgba(162,89,255,0.7); }
      }
      #chatFab:hover { transform: scale(1.12); }
      #chatFab[data-hidden="1"] { display: none !important; }

      .chat-badge {
        position: absolute; top: -4px; right: -4px;
        background: #ef4444; color: #fff;
        font-size: 0.68rem; font-weight: 800;
        min-width: 19px; height: 19px; border-radius: 10px;
        display: none; align-items: center; justify-content: center;
        padding: 0 4px; border: 2px solid #0f172a;
        animation: badgeBounce .4s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes badgeBounce {
        0% { transform: scale(0); }
        100% { transform: scale(1); }
      }

      /* ─── Chat Window ────────────────────────────────────────── */
      #chatBox {
        position: fixed; bottom: 96px; right: 26px;
        width: 370px; max-width: calc(100vw - 20px);
        height: 570px; max-height: calc(100vh - 110px);
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: 99999;
        transform-origin: bottom right;
        transition: transform .28s cubic-bezier(.4,0,.2,1), opacity .28s;
        font-family: 'Inter', -apple-system, 'Hind Siliguri', sans-serif;
      }
      #chatBox[data-hidden="1"] { display: none !important; }
      #chatBox[data-closed="1"] { transform: scale(0.85) translateY(20px); opacity: 0; pointer-events: none; }

      /* ─── Header ─────────────────────────────────────────────── */
      #chatBoxHead {
        background: linear-gradient(135deg, #0066ff 0%, #7c3aed 100%);
        padding: 14px 16px; display: flex;
        justify-content: space-between; align-items: center;
        color: #fff; user-select: none; flex-shrink: 0;
        cursor: grab; position: relative;
      }
      #chatBoxHead:active { cursor: grabbing; }
      .chat-head-left { display: flex; align-items: center; gap: 10px; }
      .chat-avatar-group {
        width: 40px; height: 40px; border-radius: 50%;
        background: rgba(255,255,255,0.2); display: flex;
        align-items: center; justify-content: center;
        font-size: 1.1rem; position: relative; flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.35);
      }
      .chat-online-dot {
        position: absolute; bottom: 1px; right: 1px;
        width: 11px; height: 11px; border-radius: 50%;
        background: #22c55e; border: 2px solid #0066ff;
      }
      .chat-head-info .chat-head-title {
        font-weight: 700; font-size: 0.95rem; line-height: 1.2; margin: 0; letter-spacing: -0.01em;
      }
      .chat-head-info .chat-head-sub {
        font-size: 0.71rem; opacity: 0.85; margin: 2px 0 0; display: flex; align-items: center; gap: 4px;
      }

      .chat-head-actions { display: flex; align-items: center; gap: 5px; }
      .chat-head-btn {
        background: rgba(255,255,255,.15); border: none;
        color: #fff; width: 30px; height: 30px; border-radius: 50%;
        cursor: pointer; font-size: 0.82rem; display: flex;
        align-items: center; justify-content: center;
        transition: background .15s, transform .15s;
      }
      .chat-head-btn:hover { background: rgba(255,255,255,.3); transform: scale(1.1); }

      /* ─── Messages Container ─────────────────────────────────── */
      #chatMessages {
        flex: 1; overflow-y: auto; padding: 12px 14px;
        display: flex; flex-direction: column; gap: 3px;
        background: #0f0f1a;
        scroll-behavior: smooth;
      }
      #chatMessages::-webkit-scrollbar { width: 4px; }
      #chatMessages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 10px; }
      #chatMessages::-webkit-scrollbar-track { background: transparent; }

      /* ─── Date Pill ──────────────────────────────────────────── */
      .chat-date-pill {
        align-self: center; background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        color: #6b7280; font-size: 0.68rem; font-weight: 600;
        padding: 3px 10px; border-radius: 12px; margin: 8px 0 5px;
        letter-spacing: 0.02em;
      }

      /* ─── Message Row ────────────────────────────────────────── */
      .cm-row {
        display: flex; gap: 7px; width: 100%;
        align-items: flex-end; position: relative;
        margin-bottom: 1px;
      }
      .cm-row.me { justify-content: flex-end; }
      .cm-row.you { justify-content: flex-start; }

      /* group bottom message rounding */
      .cm-row.me.cm-group-end .cm-bubble { border-bottom-right-radius: 4px; }
      .cm-row.you.cm-group-end .cm-bubble { border-bottom-left-radius: 4px; }
      .cm-row.me.cm-group-mid .cm-bubble { border-radius: 18px 4px 4px 18px; }
      .cm-row.you.cm-group-mid .cm-bubble { border-radius: 4px 18px 18px 4px; }

      .cm-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 0.72rem; font-weight: 700; flex-shrink: 0;
        overflow: hidden; border: 1.5px solid rgba(255,255,255,0.18);
      }
      .cm-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .cm-avatar-spacer { width: 28px; flex-shrink: 0; }

      /* ─── Bubble Wrap ────────────────────────────────────────── */
      .cm-bubble-wrap {
        max-width: 80%; display: flex; flex-direction: column;
        position: relative; gap: 2px;
      }
      .cm-row.me .cm-bubble-wrap { align-items: flex-end; }
      .cm-row.you .cm-bubble-wrap { align-items: flex-start; }

      /* ─── Bubble ─────────────────────────────────────────────── */
      .cm-bubble {
        padding: 9px 13px; border-radius: 18px;
        font-size: 0.875rem; line-height: 1.45; word-break: break-word;
        position: relative;
        transition: filter .15s;
        cursor: default;
      }
      .cm-row.me .cm-bubble {
        background: linear-gradient(135deg, #0084ff 0%, #0063c7 100%);
        color: #ffffff; border-bottom-right-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,132,255,0.35);
      }
      .cm-row.you .cm-bubble {
        background: #252540;
        color: #e8eaf0; border-bottom-left-radius: 4px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      }

      /* ─── Sender name ────────────────────────────────────────── */
      .cm-sender-name {
        font-size: 0.71rem; font-weight: 700; color: #818cf8;
        margin-bottom: 2px; display: block; padding-left: 1px;
      }

      /* ─── Reply Preview Bar ──────────────────────────────────── */
      .cm-reply-bar {
        border-radius: 10px 10px 0 0;
        padding: 5px 9px; font-size: 0.73rem;
        border-left: 3px solid rgba(255,255,255,0.5);
        margin-bottom: -2px;
        opacity: 0.8; max-width: 100%;
      }
      .cm-row.me .cm-reply-bar { background: rgba(0,0,0,0.25); color: #bfdbfe; }
      .cm-row.you .cm-reply-bar { background: rgba(255,255,255,0.07); color: #94a3b8; }
      .cm-reply-bar .cm-reply-name { font-weight: 700; font-size: 0.7rem; margin-bottom: 1px; }
      .cm-reply-bar .cm-reply-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }

      /* ─── Meta (time + tick) ─────────────────────────────────── */
      .cm-meta {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 3px; font-size: 0.63rem; opacity: 0.65; margin-top: 3px;
        color: #94a3b8;
      }
      .cm-row.you .cm-meta { justify-content: flex-start; }
      .cm-tick { font-size: 0.7rem; }
      .cm-tick.seen { color: #60a5fa; }
      .cm-tick.delivered { color: #94a3b8; }

      /* ─── Image in Bubble ────────────────────────────────────── */
      .cm-image-wrap {
        margin: 2px 0 4px; border-radius: 12px; overflow: hidden;
        max-width: 230px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12);
        transition: transform .15s, filter .15s;
      }
      .cm-image-wrap:hover { transform: scale(1.02); filter: brightness(1.05); }
      .cm-image-thumb { width: 100%; height: auto; max-height: 200px; object-fit: cover; display: block; }

      /* ─── Reactions Bubble ───────────────────────────────────── */
      .cm-reactions-row {
        display: flex; gap: 3px; flex-wrap: wrap;
        margin-top: 2px;
      }
      .cm-row.me .cm-reactions-row { justify-content: flex-end; }
      .cm-reaction-chip {
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px; padding: 1px 7px;
        font-size: 0.78rem; cursor: pointer;
        display: flex; align-items: center; gap: 3px;
        transition: background .15s, transform .1s;
        user-select: none;
      }
      .cm-reaction-chip:hover { background: rgba(255,255,255,0.22); transform: scale(1.1); }
      .cm-reaction-chip .rc-count { font-size: 0.65rem; color: #cbd5e1; font-weight: 600; }

      /* ─── Hover Action Menu ──────────────────────────────────── */
      .cm-actions {
        display: none; position: absolute; top: -36px;
        background: #1e2035; border: 1px solid rgba(255,255,255,0.12);
        border-radius: 22px; padding: 3px 6px; gap: 2px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5); z-index: 10;
        align-items: center;
      }
      .cm-row.me .cm-actions { right: 0; }
      .cm-row.you .cm-actions { left: 0; }
      .cm-row:hover .cm-actions { display: flex; }

      .cm-action-btn {
        background: transparent; border: none; color: #94a3b8;
        width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 0.78rem; transition: background .15s, color .15s, transform .1s;
      }
      .cm-action-btn:hover { background: rgba(255,255,255,0.15); color: #fff; transform: scale(1.1); }
      .cm-action-btn.del:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
      .cm-action-btn.reply-btn:hover { background: rgba(99,102,241,0.2); color: #818cf8; }

      /* Quick Reaction popup inside action menu */
      .cm-quick-reactions {
        display: flex; gap: 2px; align-items: center;
      }
      .cm-quick-react {
        font-size: 1.05rem; cursor: pointer; transition: transform .15s;
        user-select: none; padding: 2px;
      }
      .cm-quick-react:hover { transform: scale(1.35); }

      /* ─── Image Upload Preview Tray ──────────────────────────── */
      #chatImgPreviewTray {
        display: none; padding: 8px 14px;
        background: rgba(0,100,255,0.08);
        border-top: 1px solid rgba(255,255,255,0.08);
        align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      .chat-tray-left { display: flex; align-items: center; gap: 9px; }
      #chatImgPreviewThumb {
        width: 46px; height: 46px; border-radius: 10px;
        object-fit: cover; border: 2px solid #0084ff;
      }
      .chat-tray-info { font-size: 0.74rem; color: #93c5fd; line-height: 1.3; }
      #chatCancelImgBtn {
        background: rgba(239,68,68,0.15); color: #ef4444;
        border: 1px solid rgba(239,68,68,0.3);
        width: 26px; height: 26px; border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 0.75rem; transition: background .15s;
      }
      #chatCancelImgBtn:hover { background: rgba(239,68,68,0.35); }

      /* ─── Reply Preview in Input ─────────────────────────────── */
      #chatReplyPreview {
        display: none; padding: 8px 14px;
        background: rgba(99,102,241,0.08);
        border-top: 1px solid rgba(99,102,241,0.2);
        align-items: center; gap: 8px;
        flex-shrink: 0;
      }
      .reply-preview-bar {
        border-left: 3px solid #818cf8;
        padding: 3px 8px; font-size: 0.75rem; flex: 1;
        color: #a5b4fc; line-height: 1.3;
      }
      .reply-preview-bar strong { display: block; color: #818cf8; font-size: 0.72rem; }
      .reply-preview-bar span { color: #94a3b8; }
      #chatCancelReplyBtn {
        background: transparent; border: none; color: #64748b;
        width: 22px; height: 22px; border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 0.8rem; transition: color .15s, background .15s;
        flex-shrink: 0;
      }
      #chatCancelReplyBtn:hover { background: rgba(255,255,255,0.08); color: #94a3b8; }

      /* ─── Typing Indicator ───────────────────────────────────── */
      #chatTypingIndicator {
        display: none; padding: 6px 14px;
        background: transparent; align-items: center; gap: 8px;
        flex-shrink: 0;
      }
      .typing-avatar {
        width: 22px; height: 22px; border-radius: 50%;
        background: #4f46e5; display: flex; align-items: center;
        justify-content: center; font-size: 0.65rem; color: #fff; font-weight: 700;
        flex-shrink: 0;
      }
      .typing-bubble {
        background: #252540; border-radius: 18px;
        padding: 8px 14px; display: flex; gap: 5px; align-items: center;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .typing-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #64748b; display: inline-block;
        animation: typingDot 1.4s ease-in-out infinite;
      }
      .typing-dot:nth-child(1) { animation-delay: 0s; }
      .typing-dot:nth-child(2) { animation-delay: .2s; }
      .typing-dot:nth-child(3) { animation-delay: .4s; }
      @keyframes typingDot {
        0%,80%,100% { transform: scale(0.7); background: #64748b; }
        40% { transform: scale(1.1); background: #94a3b8; }
      }

      /* ─── Quick Emoji Bar ────────────────────────────────────── */
      #chatEmojiBar {
        display: none; padding: 6px 12px;
        background: rgba(30,32,53,0.98);
        border-top: 1px solid rgba(255,255,255,0.07);
        gap: 7px; overflow-x: auto; flex-shrink: 0;
      }
      #chatEmojiBar::-webkit-scrollbar { display: none; }
      .chat-quick-emoji {
        font-size: 1.3rem; cursor: pointer; transition: transform .15s;
        user-select: none; flex-shrink: 0;
      }
      .chat-quick-emoji:hover { transform: scale(1.3); }

      /* ─── Input Row ──────────────────────────────────────────── */
      #chatInputRow {
        padding: 10px 12px; display: flex; gap: 7px; align-items: center;
        flex-shrink: 0; border-top: 1px solid rgba(255,255,255,.07);
        background: #1a1a2e;
      }
      .chat-tool-btn {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
        color: #94a3b8; display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 0.95rem;
        transition: background .15s, color .15s, transform .15s;
        flex-shrink: 0;
      }
      .chat-tool-btn:hover { background: rgba(255,255,255,0.15); color: #0084ff; transform: scale(1.08); }

      #chatMsgInput {
        flex: 1; background: rgba(255,255,255,.07);
        border: 1.5px solid rgba(255,255,255,.1); border-radius: 22px;
        padding: 9px 15px; color: #f1f5f9; font-size: 0.875rem; outline: none;
        transition: border-color .2s, background .2s;
        font-family: inherit; resize: none; min-height: 36px; max-height: 100px;
        line-height: 1.4; overflow-y: auto;
      }
      #chatMsgInput:focus { border-color: #0084ff; background: rgba(255,255,255,0.1); }
      #chatMsgInput::placeholder { color: rgba(255,255,255,.35); }

      #chatSendBtn {
        width: 38px; height: 38px; border-radius: 50%;
        background: linear-gradient(135deg, #0084ff, #7c3aed); border: none; color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 0.95rem;
        transition: transform .2s cubic-bezier(.34,1.56,.64,1), opacity .2s;
        flex-shrink: 0; box-shadow: 0 2px 10px rgba(0,132,255,0.4);
      }
      #chatSendBtn:hover { transform: scale(1.12); }
      #chatSendBtn:active { transform: scale(0.95); }

      /* Empty state */
      .chat-empty-state {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        flex: 1; gap: 12px; padding: 30px;
        color: #374151;
      }
      .chat-empty-state i { font-size: 3rem; opacity: 0.3; }
      .chat-empty-state p { font-size: 0.82rem; color: #4b5563; text-align: center; line-height: 1.5; }

      /* ─── Lightbox ───────────────────────────────────────────── */
      #chatLightbox {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.9); backdrop-filter: blur(12px);
        display: none; align-items: center; justify-content: center;
        z-index: 100000; padding: 20px; box-sizing: border-box;
        animation: lbFadeIn .2s ease;
      }
      @keyframes lbFadeIn { from { opacity: 0 } to { opacity: 1 } }
      #chatLightbox.active { display: flex; }
      #chatLightbox img {
        max-width: 90vw; max-height: 85vh; border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.9); object-fit: contain;
      }
      #chatLightboxClose {
        position: absolute; top: 20px; right: 24px;
        background: rgba(255,255,255,0.15); border: none; color: #fff;
        width: 38px; height: 38px; border-radius: 50%;
        font-size: 1.1rem; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: background .15s;
      }
      #chatLightboxClose:hover { background: rgba(255,255,255,0.3); }

      /* ─── New Message Toast ──────────────────────────────────── */
      #chatNewMsgToast {
        position: absolute; bottom: 68px; left: 50%; transform: translateX(-50%);
        background: rgba(0,132,255,0.9); color: #fff;
        padding: 5px 14px; border-radius: 18px; font-size: 0.75rem; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        display: none; z-index: 10;
        animation: slideUp .25s ease;
        box-shadow: 0 3px 12px rgba(0,132,255,0.5);
      }
      @keyframes slideUp { from { transform: translateX(-50%) translateY(10px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

      /* Online member count */
      .chat-online-count {
        display: inline-flex; align-items: center; gap: 3px;
      }
      .chat-online-dot-sm {
        width: 6px; height: 6px; border-radius: 50%;
        background: #22c55e; display: inline-block;
        animation: onlinePulse 2s ease-in-out infinite;
      }
      @keyframes onlinePulse {
        0%,100% { opacity: 1; } 50% { opacity: 0.4; }
      }

      /* ─── Mobile Responsive Chat ─────────────────────────────── */
      @media (max-width: 600px) {
        #chatFab {
          bottom: 18px !important;
          right: 18px !important;
          width: 52px !important;
          height: 52px !important;
          font-size: 1.3rem !important;
        }
        #chatBox {
          bottom: 82px !important;
          right: 10px !important;
          left: 10px !important;
          width: auto !important;
          max-width: none !important;
          height: 75vh !important;
          max-height: 75vh !important;
          border-radius: 14px !important;
          transform-origin: bottom center !important;
        }
        #chatBox[data-closed="1"] {
          transform: scale(0.9) translateY(20px) !important;
        }
        .cm-bubble-wrap { max-width: 88% !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Inject HTML ─────────────────────────────────────────────────────────────
  if (!document.getElementById('chatFab')) {
    document.body.insertAdjacentHTML('beforeend', `
      <!-- Floating Action Button -->
      <button id="chatFab" data-hidden="1" title="মেস গ্রুপ চ্যাট">
        <i class="fas fa-comment-dots"></i>
        <span id="chatBadge" class="chat-badge">0</span>
      </button>

      <!-- Messenger Chat Window -->
      <div id="chatBox" data-hidden="1" data-closed="1">

        <!-- Header -->
        <div id="chatBoxHead">
          <div class="chat-head-left">
            <div class="chat-avatar-group">
              <i class="fas fa-users" style="font-size:1rem;"></i>
              <span class="chat-online-dot"></span>
            </div>
            <div class="chat-head-info">
              <h4 class="chat-head-title" id="chatProjTitle">মেস গ্রুপ চ্যাট</h4>
              <p class="chat-head-sub">
                <span class="chat-online-dot-sm"></span>
                <span id="chatOnlineText">লাইভ চ্যাট</span>
              </p>
            </div>
          </div>
          <div class="chat-head-actions">
            <button id="chatRefreshBtn" class="chat-head-btn" title="রিফ্রেশ"><i class="fas fa-sync-alt"></i></button>
            <button id="chatCloseBtn" class="chat-head-btn" title="বন্ধ করুন"><i class="fas fa-times"></i></button>
          </div>
        </div>

        <!-- Messages Area -->
        <div id="chatMessages" style="position:relative;"></div>

        <!-- New Message Notification -->
        <div id="chatNewMsgToast">↓ নতুন বার্তা</div>

        <!-- Typing Indicator -->
        <div id="chatTypingIndicator">
          <div class="typing-avatar" id="chatTypingAvatar">?</div>
          <div>
            <div class="typing-bubble">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
            <div style="font-size:0.65rem; color:#64748b; margin-top:2px; padding-left:2px;" id="chatTypingName"></div>
          </div>
        </div>

        <!-- Reply Preview Bar -->
        <div id="chatReplyPreview">
          <div class="reply-preview-bar">
            <strong id="chatReplyName"></strong>
            <span id="chatReplyText"></span>
          </div>
          <button id="chatCancelReplyBtn" title="বাতিল করুন"><i class="fas fa-times"></i></button>
        </div>

        <!-- Image Preview Tray -->
        <div id="chatImgPreviewTray">
          <div class="chat-tray-left">
            <img id="chatImgPreviewThumb" src="" alt="preview">
            <div class="chat-tray-info">
              <strong>ছবি প্রস্তুত</strong><br>
              <span id="chatImgSizeText">পাঠাতে Send চাপুন</span>
            </div>
          </div>
          <button id="chatCancelImgBtn" title="ছবি বাদ দিন"><i class="fas fa-times"></i></button>
        </div>

        <!-- Quick Emoji Bar -->
        <div id="chatEmojiBar">
          <span class="chat-quick-emoji">😀</span>
          <span class="chat-quick-emoji">😂</span>
          <span class="chat-quick-emoji">❤️</span>
          <span class="chat-quick-emoji">👍</span>
          <span class="chat-quick-emoji">🔥</span>
          <span class="chat-quick-emoji">😮</span>
          <span class="chat-quick-emoji">😢</span>
          <span class="chat-quick-emoji">🎉</span>
          <span class="chat-quick-emoji">🍛</span>
          <span class="chat-quick-emoji">🍗</span>
          <span class="chat-quick-emoji">👌</span>
          <span class="chat-quick-emoji">🙏</span>
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

      <!-- Lightbox -->
      <div id="chatLightbox">
        <button id="chatLightboxClose"><i class="fas fa-times"></i></button>
        <img id="chatLightboxImg" src="" alt="Full View">
      </div>
    `);
  }

  // ── DOM References ──────────────────────────────────────────────────────────
  const fab           = document.getElementById('chatFab');
  const badge         = document.getElementById('chatBadge');
  const box           = document.getElementById('chatBox');
  const head          = document.getElementById('chatBoxHead');
  const closeBtn      = document.getElementById('chatCloseBtn');
  const refreshBtn    = document.getElementById('chatRefreshBtn');
  const msgs          = document.getElementById('chatMessages');
  const inp           = document.getElementById('chatMsgInput');
  const sendBtn       = document.getElementById('chatSendBtn');
  const sendIcon      = document.getElementById('chatSendIcon');
  const attachBtn     = document.getElementById('chatAttachBtn');
  const fileInput     = document.getElementById('chatFileInput');
  const emojiToggle   = document.getElementById('chatEmojiToggleBtn');
  const emojiBar      = document.getElementById('chatEmojiBar');
  const imgTray       = document.getElementById('chatImgPreviewTray');
  const imgThumb      = document.getElementById('chatImgPreviewThumb');
  const cancelImgBtn  = document.getElementById('chatCancelImgBtn');
  const replyPreview  = document.getElementById('chatReplyPreview');
  const replyNameEl   = document.getElementById('chatReplyName');
  const replyTextEl   = document.getElementById('chatReplyText');
  const cancelReplyBtn= document.getElementById('chatCancelReplyBtn');
  const typingIndicator = document.getElementById('chatTypingIndicator');
  const typingAvatar  = document.getElementById('chatTypingAvatar');
  const typingNameEl  = document.getElementById('chatTypingName');
  const projTitle     = document.getElementById('chatProjTitle');
  const onlineText    = document.getElementById('chatOnlineText');
  const lightbox      = document.getElementById('chatLightbox');
  const lightboxImg   = document.getElementById('chatLightboxImg');
  const lightboxClose = document.getElementById('chatLightboxClose');
  const newMsgToast   = document.getElementById('chatNewMsgToast');

  // ── State ───────────────────────────────────────────────────────────────────
  let pendingImageBase64 = null;
  let pendingReply = null;   // { id, name, text }
  let activeCurUser = null;
  let activeGetProjId = null;
  let isBoxOpen = false;
  let lastSeenCount = 0;
  let lastRenderedSig = '';
  let typingTimer = null;
  let presenceTimer = null;
  let typingUsers = [];      // [{userId, userName, typingTime}]
  let lastReadTime = 0;

  const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🔥'];

  // ── Lightbox ────────────────────────────────────────────────────────────────
  window.openChatLightbox = function(src) {
    if (lightbox && lightboxImg) {
      lightboxImg.src = src;
      lightbox.classList.add('active');
    }
  };
  lightboxClose?.addEventListener('click', () => lightbox?.classList.remove('active'));
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('active'); });

  // ── Send Icon Toggle ─────────────────────────────────────────────────────────
  function updateSendIcon() {
    const has = inp.value.trim().length > 0 || !!pendingImageBase64;
    sendIcon.className = has ? 'fas fa-paper-plane' : 'fas fa-thumbs-up';
  }
  inp.addEventListener('input', () => {
    updateSendIcon();
    triggerTyping();
  });

  // ── Emoji Bar ────────────────────────────────────────────────────────────────
  emojiToggle.addEventListener('click', () => {
    emojiBar.style.display = emojiBar.style.display === 'flex' ? 'none' : 'flex';
  });
  document.querySelectorAll('.chat-quick-emoji').forEach(em => {
    em.addEventListener('click', () => {
      inp.value += em.textContent;
      updateSendIcon();
      inp.focus();
    });
  });

  // ── Image Attachment ─────────────────────────────────────────────────────────
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        pendingImageBase64 = canvas.toDataURL('image/jpeg', 0.78);
        imgThumb.src = pendingImageBase64;
        imgTray.style.display = 'flex';
        document.getElementById('chatImgSizeText').textContent = `${w}×${h}px`;
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

  // ── Reply ────────────────────────────────────────────────────────────────────
  function setReply(msg) {
    pendingReply = msg;
    replyNameEl.textContent = msg.name;
    replyTextEl.textContent = msg.text ? (msg.text.slice(0, 60) + (msg.text.length > 60 ? '…' : '')) : '📷 ছবি';
    replyPreview.style.display = 'flex';
    inp.focus();
  }
  cancelReplyBtn.addEventListener('click', () => {
    pendingReply = null;
    replyPreview.style.display = 'none';
  });

  // ── Dragging ─────────────────────────────────────────────────────────────────
  let dragging = false, ox = 0, oy = 0, ix, iy;
  head.addEventListener('mousedown', e => {
    if (e.target.closest('.chat-head-btn')) return;
    dragging = true; ix = e.clientX - ox; iy = e.clientY - oy;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    ox = e.clientX - ix; iy = e.clientY - iy;
    box.style.transform = `translate3d(${ox}px,${oy}px,0) scale(1)`;
  });

  // ── Open / Close ─────────────────────────────────────────────────────────────
  fab.addEventListener('click', () => {
    box.removeAttribute('data-closed');
    fab.style.display = 'none';
    isBoxOpen = true;
    if (badge) badge.style.display = 'none';
    newMsgToast.style.display = 'none';
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
    if (activeCurUser && activeGetProjId) {
      const pid = activeGetProjId();
      if (pid) {
        fetchDirectFromDB(pid);
        markSeen(pid);
      }
    }
  });
  closeBtn.addEventListener('click', () => {
    box.setAttribute('data-closed', '1');
    fab.style.display = 'flex';
    isBoxOpen = false;
    emojiBar.style.display = 'none';
    stopTyping();
  });
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.querySelector('i').classList.add('fa-spin');
    lastRenderedSig = '';
    if (activeGetProjId) await fetchDirectFromDB(activeGetProjId());
    setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 700);
  });

  // ── New Message Toast ────────────────────────────────────────────────────────
  newMsgToast.addEventListener('click', () => {
    msgs.scrollTop = msgs.scrollHeight;
    newMsgToast.style.display = 'none';
  });
  msgs.addEventListener('scroll', () => {
    const atBottom = msgs.scrollHeight - msgs.clientHeight <= msgs.scrollTop + 80;
    if (atBottom) newMsgToast.style.display = 'none';
  });

  // ── Typing Indicator ─────────────────────────────────────────────────────────
  function triggerTyping() {
    if (!activeCurUser || !activeGetProjId) return;
    const pid = activeGetProjId();
    if (!pid || !window.API) return;
    window.API.post('chats.php', { action: 'typing' }, { user_id: activeCurUser.id, project_id: pid, is_typing: 1 }).catch(() => {});
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => stopTyping(), 3000);
  }
  function stopTyping() {
    clearTimeout(typingTimer);
    if (!activeCurUser || !activeGetProjId || !window.API) return;
    const pid = activeGetProjId();
    if (!pid) return;
    window.API.post('chats.php', { action: 'typing' }, { user_id: activeCurUser.id, project_id: pid, is_typing: 0 }).catch(() => {});
  }

  // ── Mark Seen ────────────────────────────────────────────────────────────────
  function markSeen(pid) {
    if (!activeCurUser || !window.API) return;
    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const mine = chats.filter(c => String(c.projectId || c.project_id) === String(pid));
    if (!mine.length) return;
    const lastTime = Math.max(...mine.map(c => Number(c.time)));
    if (lastTime <= lastReadTime) return;
    lastReadTime = lastTime;
    window.API.post('chats.php', { action: 'seen' }, { user_id: activeCurUser.id, project_id: pid, last_time: lastTime }).catch(() => {});
  }

  // ── Presence Heartbeat ───────────────────────────────────────────────────────
  function startHeartbeat(pid) {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => {
      if (!pid || !activeCurUser || !window.API || !isBoxOpen) return;
      window.API.post('chats.php', { action: 'heartbeat' }, { user_id: activeCurUser.id, project_id: pid }).catch(() => {});
    }, 15000);
  }

  // ── Update Typing Indicator UI ───────────────────────────────────────────────
  function updateTypingUI() {
    const now = Date.now();
    // Only show typing for users who typed in last 4 seconds
    const active = typingUsers.filter(u =>
      String(u.userId) !== String(activeCurUser?.id) &&
      u.isTyping &&
      (now - Number(u.typingTime)) < 4000
    );
    const users = JSON.parse(localStorage.getItem('meal_users') || '[]');
    if (active.length > 0) {
      const u = active[0];
      const usr = users.find(x => String(x.id) === String(u.userId));
      const name = usr ? usr.name : (u.userName || 'Someone');
      typingAvatar.textContent = name.charAt(0).toUpperCase();
      typingNameEl.textContent = name + ' টাইপ করছে…';
      typingIndicator.style.display = 'flex';
    } else {
      typingIndicator.style.display = 'none';
    }
  }

  // ── React to Message ─────────────────────────────────────────────────────────
  async function reactToMessage(msgId, emoji, projId) {
    if (!window.API) return;
    try {
      const res = await window.API.post('chats.php', { action: 'react' }, {
        id: msgId,
        user_id: activeCurUser.id,
        emoji
      });
      if (res.success) await fetchDirectFromDB(projId);
    } catch (e) {
      console.warn('React error:', e);
    }
  }

  // ── Render Chat ──────────────────────────────────────────────────────────────
  function renderChat(curUser, projId, force = false) {
    if (!projId) {
      fab.setAttribute('data-hidden', '1');
      box.setAttribute('data-hidden', '1');
      return;
    }
    fab.removeAttribute('data-hidden');
    if (!isBoxOpen) fab.style.display = 'flex';
    box.removeAttribute('data-hidden');

    // Update project title
    const projects = JSON.parse(localStorage.getItem('meal_projects') || '[]');
    const p = projects.find(x => String(x.id) === String(projId));
    if (projTitle) projTitle.textContent = p ? p.name : 'মেস গ্রুপ চ্যাট';

    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const mine = chats.filter(c => String(c.projectId || c.project_id) === String(projId))
                      .sort((a, b) => Number(a.time) - Number(b.time));

    // Badge
    if (!isBoxOpen && mine.length > lastSeenCount && lastSeenCount > 0) {
      const unread = mine.length - lastSeenCount;
      if (badge) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = 'flex'; }
    } else if (isBoxOpen) {
      lastSeenCount = mine.length;
      if (badge) badge.style.display = 'none';
    } else if (lastSeenCount === 0) {
      lastSeenCount = mine.length;
    }

    // Prevent unnecessary redraws
    const sig = String(projId) + '::' + (curUser ? curUser.id : '') + '::' +
      mine.map(c => `${c.id}_${c.time}_${c.text||''}_${c.image?'img':''}_${JSON.stringify(c.reactions||{})}`).join('|');
    if (!force && sig === lastRenderedSig) return;
    lastRenderedSig = sig;

    const atBottom = msgs.scrollHeight - msgs.clientHeight <= msgs.scrollTop + 80;
    const users = JSON.parse(localStorage.getItem('meal_users') || '[]');
    let html = '';
    let lastDateStr = '';
    let lastUserId = null;

    mine.forEach((c, idx) => {
      const isMe = String(c.userId || c.user_id) === String(curUser.id);
      const cTime = Number(c.time);
      const dObj = new Date(cTime);
      const dateStr = dObj.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', weekday: 'short' });
      const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (dateStr !== lastDateStr) {
        html += `<div class="chat-date-pill">${dateStr}</div>`;
        lastDateStr = dateStr;
        lastUserId = null;
      }

      const u = users.find(x => String(x.id) === String(c.userId || c.user_id));
      const uPhoto = c.userPhoto || (u ? u.photo : null);
      const uName  = c.userName || c.user_name || (u ? u.name : 'সদস্য');
      const firstL = uName.charAt(0).toUpperCase();

      // Grouping: same sender in sequence
      const nextMsg = mine[idx + 1];
      const isGroupStart = String(c.userId || c.user_id) !== String(lastUserId);
      const isGroupEnd = !nextMsg || String(nextMsg.userId || nextMsg.user_id) !== String(c.userId || c.user_id);

      const avatarHtml = !isMe && isGroupEnd
        ? `<div class="cm-avatar" title="${uName}">${uPhoto ? `<img src="${uPhoto}" alt="${uName}">` : firstL}</div>`
        : !isMe ? `<div class="cm-avatar-spacer"></div>` : '';

      // Reply preview
      let replyHtml = '';
      if (c.replyTo || c.reply_to) {
        const rtxt = c.replyText || c.reply_text || '…';
        const rMsg = mine.find(x => x.id === (c.replyTo || c.reply_to));
        const rName = rMsg ? (rMsg.userName || rMsg.user_name) : 'Unknown';
        replyHtml = `<div class="cm-reply-bar">
          <div class="cm-reply-name">${rName}</div>
          <div class="cm-reply-text">${rtxt.slice(0, 70)}</div>
        </div>`;
      }

      // Image
      let imgHtml = '';
      if (c.image) {
        imgHtml = `<div class="cm-image-wrap" onclick="window.openChatLightbox('${c.image}')">
          <img src="${c.image}" class="cm-image-thumb" alt="Photo" loading="lazy">
        </div>`;
      }

      // Read receipts
      let tickHtml = '';
      if (isMe) {
        tickHtml = `<i class="fas fa-check-double cm-tick delivered" title="Delivered"></i>`;
      }

      // Reactions
      const reactions = c.reactions || {};
      let reactionsHtml = '';
      const reactKeys = Object.keys(reactions).filter(k => reactions[k] && reactions[k].length > 0);
      if (reactKeys.length > 0) {
        reactionsHtml = `<div class="cm-reactions-row">` +
          reactKeys.map(emoji => {
            const count = reactions[emoji].length;
            const iMeReacted = reactions[emoji].includes(String(curUser.id));
            return `<span class="cm-reaction-chip ${iMeReacted ? 'me-reacted' : ''}"
              data-msgid="${c.id}" data-emoji="${emoji}"
              style="${iMeReacted ? 'border-color:rgba(0,132,255,0.5);background:rgba(0,132,255,0.15);' : ''}">
              ${emoji} <span class="rc-count">${count}</span>
            </span>`;
          }).join('') +
        `</div>`;
      }

      // Action menu
      const canDelete = isMe || curUser.role === 'admin';
      const actionMenu = `
        <div class="cm-actions">
          <div class="cm-quick-reactions">
            ${QUICK_REACTIONS.map(em => `<span class="cm-quick-react" data-msgid="${c.id}" data-emoji="${em}" title="${em}">${em}</span>`).join('')}
          </div>
          <button class="cm-action-btn reply-btn" data-id="${c.id}" data-name="${uName}" data-text="${(c.text||'').replace(/"/g,'&quot;')}" title="Reply"><i class="fas fa-reply"></i></button>
          <button class="cm-action-btn copy-msg" data-text="${(c.text||'').replace(/"/g,'&quot;')}" title="Copy"><i class="fas fa-copy"></i></button>
          ${canDelete ? `<button class="cm-action-btn del delete-msg" data-id="${c.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
      `;

      const rowClasses = [
        'cm-row',
        isMe ? 'me' : 'you',
        !isGroupEnd ? 'cm-group-mid' : 'cm-group-end'
      ].join(' ');

      html += `
        <div class="${rowClasses}" data-id="${c.id}">
          ${!isMe ? avatarHtml : ''}
          <div class="cm-bubble-wrap">
            ${actionMenu}
            ${!isMe && isGroupStart ? `<span class="cm-sender-name">${uName}</span>` : ''}
            ${replyHtml}
            <div class="cm-bubble">
              ${imgHtml}
              ${c.text ? `<div>${c.text}</div>` : ''}
              <div class="cm-meta">
                <span>${timeStr}</span>
                ${tickHtml}
              </div>
            </div>
            ${reactionsHtml}
          </div>
          ${isMe ? '' : ''}
        </div>
      `;

      lastUserId = c.userId || c.user_id;
    });

    if (!mine.length) {
      html = `<div class="chat-empty-state">
        <i class="fas fa-comments"></i>
        <p>এখনো কোনো বার্তা নেই।<br>প্রথম বার্তা পাঠিয়ে কথোপকথন শুরু করুন!</p>
      </div>`;
    }

    msgs.innerHTML = html;

    // Attach listeners
    msgs.querySelectorAll('.copy-msg').forEach(btn => {
      btn.addEventListener('click', () => {
        const txt = btn.dataset.text;
        if (txt && navigator.clipboard) navigator.clipboard.writeText(txt);
        if (window.showToast) window.showToast('কপি হয়েছে!');
      });
    });
    msgs.querySelectorAll('.delete-msg').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('এই বার্তাটি সবার জন্য মুছে ফেলা হবে। নিশ্চিত?')) return;
        await deleteMessage(btn.dataset.id, projId);
      });
    });
    msgs.querySelectorAll('.reply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setReply({ id: btn.dataset.id, name: btn.dataset.name, text: btn.dataset.text });
      });
    });
    msgs.querySelectorAll('.cm-quick-react').forEach(btn => {
      btn.addEventListener('click', () => {
        reactToMessage(btn.dataset.msgid, btn.dataset.emoji, projId);
      });
    });
    msgs.querySelectorAll('.cm-reaction-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        reactToMessage(chip.dataset.msgid, chip.dataset.emoji, projId);
      });
    });

    if (atBottom || force) {
      const prevHeight = msgs.scrollHeight;
      requestAnimationFrame(() => {
        if (msgs.scrollTop > prevHeight - 200 || force) {
          msgs.scrollTop = msgs.scrollHeight;
        } else if (!atBottom && mine.length > lastSeenCount - 1) {
          newMsgToast.style.display = 'block';
        }
      });
    }

    if (isBoxOpen) markSeen(projId);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function deleteMessage(msgId, projId) {
    try {
      const allChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
      localStorage.setItem('meal_chats', JSON.stringify(allChats.filter(c => String(c.id) !== String(msgId))));
      renderChat(activeCurUser, projId, true);
      if (window.API) {
        await window.API.post('chats.php', { action: 'delete' }, { id: msgId, project_id: projId });
        await fetchDirectFromDB(projId);
      }
      if (window.showToast) window.showToast('বার্তাটি মুছে ফেলা হয়েছে।');
    } catch (err) { console.error('Delete error:', err); }
  }

  // ── Fetch from DB & Alert on New Messages ────────────────────────────────────
  const _alertedChatMsgIds = new Set();
  let _chatAlertsPrimed = false;

  async function fetchDirectFromDB(projId) {
    if (!projId || !window.API) return;
    try {
      const res = await window.API.get('chats.php', { action: 'list', project_id: projId });
      if (res && Array.isArray(res.chats)) {
        if (!_chatAlertsPrimed) {
          // First fetch - seed existing messages so past history does not chime
          const localChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
          localChats.forEach(c => _alertedChatMsgIds.add(String(c.id)));
          res.chats.forEach(c => _alertedChatMsgIds.add(String(c.id)));
          _chatAlertsPrimed = true;
        } else {
          // Subsequent fetch - check for new incoming messages from other members
          const myId = activeCurUser ? String(activeCurUser.id) : '';
          let hasNewFromOther = false;
          let latestMsg = null;

          res.chats.forEach(c => {
            const cid = String(c.id);
            const senderId = String(c.userId || c.user_id);
            if (!_alertedChatMsgIds.has(cid)) {
              _alertedChatMsgIds.add(cid);
              if (myId && senderId !== myId) {
                hasNewFromOther = true;
                latestMsg = c;
              }
            }
          });

          if (hasNewFromOther && latestMsg) {
            const sName = latestMsg.userName || latestMsg.user_name || 'মেম্বার';
            const sText = latestMsg.text || (latestMsg.image ? '📷 একটি ছবি পাঠিয়েছেন' : 'নতুন বার্তা');

            // 1. Play sound chime
            if (window.MealNotifications?.playNotificationSound) {
              window.MealNotifications.playNotificationSound('message');
            } else if (window.playNotificationSound) {
              window.playNotificationSound('message');
            }

            // 2. Vibrate phone
            if (window.MealNotifications?.vibrateDevice) {
              window.MealNotifications.vibrateDevice([200, 100, 200]);
            }

            // 3. Show system / device notification
            if (window.MealNotifications?.showDeviceNotification) {
              window.MealNotifications.showDeviceNotification(`💬 ${sName}`, sText, {
                soundType: 'message',
                tag: 'chat-' + latestMsg.id,
                vibrate: [200, 100, 200]
              });
            }

            // 4. In-app toast if chat box is closed
            if (!isBoxOpen && window.showToast) {
              window.showToast(`💬 ${sName}: ${sText}`, 'info');
            }
          }
        }

        const localChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
        const otherProjChats = localChats.filter(c => String(c.projectId || c.project_id) !== String(projId));
        localStorage.setItem('meal_chats', JSON.stringify(otherProjChats.concat(res.chats)));
        if (activeCurUser) renderChat(activeCurUser, projId);
      }

      // Update presence (typing/online)
      if (res && Array.isArray(res.presence)) {
        typingUsers = res.presence;
        updateTypingUI();

        // Online count
        const now = Date.now();
        const onlineCount = res.presence.filter(p => (now - Number(p.lastSeen)) < 30000).length;
        if (onlineText) {
          onlineText.innerHTML = onlineCount > 0
            ? `<span class="chat-online-count"><span class="chat-online-dot-sm"></span>${onlineCount} জন অনলাইন</span>`
            : 'লাইভ মেস চ্যাট';
        }
      }
    } catch (e) { /* offline */ }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function send(curUser, getProjId) {
    const text = inp.value.trim();
    const pid  = getProjId();
    const imageToSend = pendingImageBase64;
    const replyData = pendingReply ? { id: pendingReply.id, text: pendingReply.text } : null;
    const finalText = (!text && !imageToSend) ? '👍' : text;
    if (!pid) return;

    const chats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
    const msgId = 'c_' + Date.now() + Math.random().toString(36).slice(2, 6);
    const nowMs = Date.now();

    const msg = {
      id: msgId, projectId: pid,
      userId: curUser.id, userName: curUser.name, userPhoto: curUser.photo || null,
      text: finalText, image: imageToSend, time: nowMs,
      replyTo: replyData ? replyData.id : null,
      replyText: replyData ? replyData.text : null,
      reactions: {}
    };

    chats.push(msg);
    localStorage.setItem('meal_chats', JSON.stringify(chats));
    inp.value = '';
    pendingImageBase64 = null;
    pendingReply = null;
    fileInput.value = '';
    imgTray.style.display = 'none';
    replyPreview.style.display = 'none';
    emojiBar.style.display = 'none';
    updateSendIcon();
    renderChat(curUser, pid, true);
    msgs.scrollTop = msgs.scrollHeight;

    stopTyping();

    try {
      if (window.API) {
        await window.API.post('chats.php', { action: 'send' }, {
          project_id: pid, user_id: curUser.id, user_name: curUser.name,
          text: finalText, image: imageToSend, time: nowMs,
          reply_to: replyData?.id || null,
          reply_text: replyData?.text || null
        });
        await fetchDirectFromDB(pid);
      }
    } catch (e) { console.warn('Chat send error:', e); }
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 80);
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  window.initChat = function(curUser, getProjId) {
    activeCurUser = curUser;
    activeGetProjId = getProjId;

    sendBtn.onclick = () => send(curUser, getProjId);
    inp.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(curUser, getProjId);
      }
    };

    function refresh() {
      const pid = getProjId();
      if (pid) renderChat(curUser, pid);
    }

    // Poll every 3 seconds for fresh messages + presence
    setInterval(() => {
      const pid = getProjId();
      if (pid) fetchDirectFromDB(pid);
    }, 3000);

    // Start heartbeat when chat is open
    const pid = getProjId();
    if (pid) startHeartbeat(pid);

    window.addEventListener('refreshChat', refresh);
    window.addEventListener('appDataSynced', () => { lastRenderedSig = ''; refresh(); });
    window.addEventListener('storage', e => { if (!e.key || e.key === 'meal_chats') refresh(); });

    refresh();
    if (pid) fetchDirectFromDB(pid);
    setTimeout(refresh, 500);
  };
})();
