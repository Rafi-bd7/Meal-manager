// js/notifications.js — Unified Push Notification & Audio Sound Engine for MealManager
// Handles: Device Push Notifications, Service Worker Notifications, Real Sound Chimes, Vibration, Audio Autoplay Unlocking

(function () {
  'use strict';

  // ── 1. Audio Elements & Web Audio Synthesizer Setup ────────────────────────
  let _audioCtx = null;
  let _audioUnlocked = false;

  // Preload native audio elements for instant playback
  const audioMsg = new Audio('sounds/message.wav');
  audioMsg.preload = 'auto';

  const audioNotice = new Audio('sounds/notification.wav');
  audioNotice.preload = 'auto';

  // Function to unlock audio on user gesture (touch / click / scroll / pointer)
  function unlockAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        if (!_audioCtx) _audioCtx = new AudioContext();
        if (_audioCtx.state === 'suspended') {
          _audioCtx.resume().catch(() => {});
        }
      }
      if (!_audioUnlocked) {
        // Prime audio elements silently on gesture so background triggers succeed
        const p1 = audioMsg.play();
        if (p1) {
          p1.then(() => {
            audioMsg.pause();
            audioMsg.currentTime = 0;
          }).catch(() => {});
        }
        const p2 = audioNotice.play();
        if (p2) {
          p2.then(() => {
            audioNotice.pause();
            audioNotice.currentTime = 0;
          }).catch(() => {});
        }
        _audioUnlocked = true;
      }
    } catch (e) {
      // Audio unlock error ignored
    }
  }

  // Listen for user gestures to unlock audio immediately
  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });

  // Synthesize Web Audio fallback chime (zero latency, works even if wav files fail to load)
  function synthesizeTone(type = 'default') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!_audioCtx) _audioCtx = new AudioContext();
      if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});

      const now = _audioCtx.currentTime;

      if (type === 'message') {
        // Messenger chime: 880Hz + 1320Hz
        const osc1 = _audioCtx.createOscillator();
        const osc2 = _audioCtx.createOscillator();
        const g1 = _audioCtx.createGain();
        const g2 = _audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        g1.gain.setValueAtTime(0.45, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(g1);
        g1.connect(_audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now + 0.08);
        g2.gain.setValueAtTime(0.5, now + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(g2);
        g2.connect(_audioCtx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.45);
      } else {
        // Rich announcement chime: D5 (587Hz), A5 (880Hz), D6 (1175Hz)
        const tones = [
          { f: 587.33, s: 0, d: 0.28, v: 0.4 },
          { f: 880.00, s: 0.1, d: 0.35, v: 0.45 },
          { f: 1174.66, s: 0.2, d: 0.55, v: 0.5 }
        ];
        tones.forEach(t => {
          const osc = _audioCtx.createOscillator();
          const g = _audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(t.f, now + t.s);
          g.gain.setValueAtTime(t.v, now + t.s);
          g.gain.exponentialRampToValueAtTime(0.001, now + t.s + t.d);
          osc.connect(g);
          g.connect(_audioCtx.destination);
          osc.start(now + t.s);
          osc.stop(now + t.s + t.d);
        });
      }
    } catch (e) {
      console.warn('Synthesizer tone error:', e);
    }
  }

  // Play notification sound with HTML5 Audio + Web Audio synthesizer fallback
  function playNotificationSound(type = 'default') {
    unlockAudio();
    const audio = (type === 'message') ? audioMsg : audioNotice;
    try {
      audio.currentTime = 0;
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          synthesizeTone(type);
        });
      }
    } catch (e) {
      synthesizeTone(type);
    }
  }

  // Device vibration
  function vibrateDevice(pattern) {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern || [250, 100, 250, 100, 250]);
      }
    } catch (e) {}
  }

  // ── 2. Device Notification Display ──────────────────────────────────────────
  function showDeviceNotification(title, body, options = {}) {
    const soundType = options.soundType || 'default';
    const tag = options.tag || ('meal-' + Date.now());
    const vibratePattern = options.vibrate || [300, 100, 300, 100, 300];

    // Always play sound & vibrate
    playNotificationSound(soundType);
    vibrateDevice(vibratePattern);

    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const notifOptions = {
        body: body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: vibratePattern,
        sound: (soundType === 'message') ? 'sounds/message.wav' : 'sounds/notification.wav',
        tag: tag,
        renotify: true,
        data: { url: options.url || './' }
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, notifOptions);
        }).catch(() => {
          try { new Notification(title, notifOptions); } catch (e) {}
        });
      } else {
        try { new Notification(title, notifOptions); } catch (e) {}
      }
    }
  }

  // ── 3. Request Permission with Instant Feedback & Audio Test ────────────────
  async function requestNotificationPermissionWithFeedback() {
    unlockAudio();
    if (!('Notification' in window)) {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        if (window.showToast) window.showToast('আইফোনে নোটিফিকেশন পেতে সাফারি ব্রাউজার থেকে "Add to Home Screen" করুন', 'warning');
      } else {
        if (window.showToast) window.showToast('আপনার ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই', 'warning');
      }
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      updateNotifUIIndicators(perm);
      if (perm === 'granted') {
        playNotificationSound('notice');
        vibrateDevice([200, 80, 200]);
        showDeviceNotification('🔔 MealManager নোটিফিকেশন চালু', 'আপনার ফোনে নোটিফিকেশন ও সাউন্ড সফলভাবে সক্রিয় হয়েছে! ✓');
        if (window.showToast) window.showToast('নোটিফিকেশন ও সাউন্ড সক্রিয় হয়েছে! ✓', 'success');
        return true;
      } else if (perm === 'denied') {
        if (window.showToast) window.showToast('নোটিফিকেশন পারমিশন বন্ধ করা আছে। ব্রাউজার সেটিংসে গিয়ে Allow করুন।', 'error');
        return false;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Banner renderer
  function renderNotifBanner() {
    const container = document.getElementById('notifBannerContainer');
    if (!container) return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;

    // Special guidance banner for iPhone users not yet running as PWA
    if (isIOS && !isStandalone) {
      container.innerHTML = `
        <div id="_iosPwaHelperBanner" class="ios-pwa-banner">
          <div class="ios-pwa-icon">🍎</div>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:0.95rem;">iPhone এ নোটিফিকেশন পেতে:</div>
            <div style="font-size:0.82rem; opacity:0.95; margin-top:3px; line-height:1.4;">
              ১. নিচে সাফারি ব্রাউজারের <strong>Share আইকন</strong> <i class="fas fa-share-square"></i> চাপুন।<br>
              ২. মেন্যু থেকে <strong>"Add to Home Screen"</strong> (হোম স্ক্রিনে যোগ করুন) সিলেক্ট করুন।<br>
              ৩. এরপর হোমস্ক্রিনের অ্যাপটি ওপেন করে নোটিফিকেশন অন করুন।
            </div>
          </div>
        </div>
      `;
      return;
    }

    const perm = ('Notification' in window) ? Notification.permission : 'denied';
    if (perm === 'granted') {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div id="_notifBannerBox" style="
        background: linear-gradient(135deg, #1e3a8a 0%, #4338ca 50%, #6d28d9 100%);
        color: #fff; padding: 12px 18px; border-radius: 12px; margin-bottom: 1.25rem;
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
        box-shadow: 0 4px 20px rgba(67, 56, 202, 0.35); border: 1px solid rgba(255,255,255,0.18);
      ">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:240px;">
          <div style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0;">🔔</div>
          <div>
            <div style="font-weight:700; font-size:0.95rem; line-height:1.3;">নোটিফিকেশন ও সাউন্ড চালু করুন</div>
            <div style="font-size:0.8rem; opacity:0.9; margin-top:2px;">গ্রুপের মেসেজ ও ম্যানেজারের নতুন নোটিশের তাৎক্ষণিক রিংটোন পেতে চালু করুন।</div>
          </div>
        </div>
        <button id="_btnEnableNotifBanner" type="button" class="btn" style="
          background: #fff; color: #4338ca; font-weight: 700; font-size: 0.88rem;
          padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2); white-space: nowrap; transition: transform .15s;
        ">
          <i class="fas fa-volume-up"></i> সাউন্ড অন করুন
        </button>
      </div>
    `;

    document.getElementById('_btnEnableNotifBanner')?.addEventListener('click', async () => {
      unlockAudio();
      await requestNotificationPermissionWithFeedback();
      renderNotifBanner();
    });
  }

  function updateNotifUIIndicators(perm = (('Notification' in window) ? Notification.permission : 'default')) {
    const btn = document.getElementById('globalNotifBell');
    if (btn) {
      if (perm === 'granted') {
        btn.innerHTML = '<i class="fas fa-bell text-warning"></i> <span class="notif-text-status" style="font-size:0.75rem; margin-left:4px;">সাউন্ড চালু</span>';
        btn.style.color = '#22c55e';
        btn.title = 'নোটিফিকেশন ও সাউন্ড চালু আছে (ক্লিক করে টেস্ট করুন)';
      } else {
        btn.innerHTML = '<i class="fas fa-bell-slash"></i> <span class="notif-text-status" style="font-size:0.75rem; margin-left:4px;">নোটিফিকেশন চালু করুন</span>';
        btn.style.color = '#f59e0b';
        btn.title = 'নোটিফিকেশন ও সাউন্ড চালু করতে ক্লিক করুন';
      }
    }
    renderNotifBanner();
  }

  // ── 4. Unified Real-Time Monitor ─────────────────────────────────────────────
  let _monitorInited = false;
  let _seenChatIds = new Set();
  let _seenNoticeIds = new Set();
  let _curMonitorUser = null;
  let _curMonitorProjFn = null;
  let _primed = false;

  function startNotificationMonitor(curUser, getProjId) {
    if (!curUser || !getProjId) return;
    _curMonitorUser = curUser;
    _curMonitorProjFn = getProjId;

    // Seed existing chats and notices into seen set on first run so past history doesn't beep
    if (!_primed) {
      const initialChats = JSON.parse(localStorage.getItem('meal_chats') || '[]');
      initialChats.forEach(c => _seenChatIds.add(String(c.id)));

      const initialNotifs = JSON.parse(localStorage.getItem('meal_notifications') || '[]');
      initialNotifs.forEach(n => _seenNoticeIds.add(String(n.id)));
      _primed = true;
    }

    if (_monitorInited) return;
    _monitorInited = true;

    function checkForNewEvents() {
      const pid = _curMonitorProjFn ? _curMonitorProjFn() : null;
      if (!pid || !_curMonitorUser) return;

      // 1. Check for Announcements & Notices
      const notifs = JSON.parse(localStorage.getItem('meal_notifications') || '[]');
      const projNotifs = notifs.filter(n => String(n.projectId || n.project_id) === String(pid));

      projNotifs.forEach(n => {
        const nid = String(n.id);
        if (!_seenNoticeIds.has(nid)) {
          _seenNoticeIds.add(nid);

          const toTarget = n.to || n.to_user;
          const isForMe = (toTarget === 'all' || String(toTarget) === String(_curMonitorUser.id) || (toTarget === 'admin' && _curMonitorUser.role === 'admin'));

          if (isForMe) {
            const notifTitle = n.message.includes('🍽️') ? '🍽️ MealManager মিল আপডেট' : '📢 MealManager নোটিশ';
            showDeviceNotification(notifTitle, n.message, {
              soundType: 'notice',
              tag: 'notice-' + nid,
              vibrate: [300, 100, 300, 100, 300]
            });
            if (window.showToast) {
              window.showToast(n.message, 'info');
            }
          }
        }
      });
    }

    window.addEventListener('appDataSynced', checkForNewEvents);
    window.addEventListener('storage', e => {
      if (!e.key || e.key === 'meal_notifications') {
        checkForNewEvents();
      }
    });

    setInterval(checkForNewEvents, 3000);
  }

  // ── 5. Expose Global Notification API ───────────────────────────────────────
  window.MealNotifications = {
    playNotificationSound,
    vibrateDevice,
    showDeviceNotification,
    requestPermission: requestNotificationPermissionWithFeedback,
    updateUI: updateNotifUIIndicators,
    startMonitor: startNotificationMonitor,
    unlockAudio: unlockAudio
  };

  // Aliases for direct convenience
  window.playNotificationSound = playNotificationSound;
  window.triggerDeviceNotification = showDeviceNotification;

  // Initialize UI indicators and banner on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    updateNotifUIIndicators();
    const btn = document.getElementById('globalNotifBell');
    if (btn) {
      btn.addEventListener('click', () => {
        requestNotificationPermissionWithFeedback();
      });
    }
  });

})();
