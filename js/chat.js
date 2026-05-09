// js/chat.js
window.initChat = function(curUser, getCurProjId) {
  // UI injection
  if (!document.getElementById('chatWidget')) {
    const html = `
      <div id="chatWidget" class="hidden">
        <div id="chatHeader">
           <span><i class="fas fa-comments"></i> Group Chat</span>
           <button id="chatToggleBtn" style="background:none;border:none;color:white;cursor:pointer;"><i class="fas fa-minus"></i></button>
        </div>
        <div id="chatBody"></div>
        <div id="chatFooter">
           <input type="text" id="chatInput" placeholder="Type a message...">
           <button id="chatSendBtn"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const widget = document.getElementById('chatWidget');
  const header = document.getElementById('chatHeader');
  const toggleBtn = document.getElementById('chatToggleBtn');
  const body = document.getElementById('chatBody');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  // Dragging logic
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);
  
  // Touch support for mobile dragging
  header.addEventListener('touchstart', dragStart, {passive: true});
  document.addEventListener('touchend', dragEnd);
  document.addEventListener('touchmove', drag, {passive: false});

  function dragStart(e) {
    if(e.target === toggleBtn || e.target.closest('#chatToggleBtn')) return;
    if (e.type === 'touchstart') {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
    } else {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }
    if (e.target === header || e.target.closest('#chatHeader')) {
      isDragging = true;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX - initialX;
        currentY = e.touches[0].clientY - initialY;
      } else {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
      }
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, widget);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  // Toggle Minimize
  toggleBtn.addEventListener('click', () => {
    widget.classList.toggle('minimized');
    toggleBtn.innerHTML = widget.classList.contains('minimized') ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
  });

  // Render Chat
  function renderChat() {
    const pid = getCurProjId();
    if (!pid) {
      widget.classList.add('hidden');
      return;
    }
    
    // Check if user is approved member or admin
    const enrolls = JSON.parse(localStorage.getItem('meal_enrollments')) || [];
    const projects = JSON.parse(localStorage.getItem('meal_projects')) || [];
    const isProjAdmin = projects.find(p => p.id === pid && (p.adminId === curUser.id || !p.adminId));
    const isEnrolled = enrolls.find(e => e.projectId === pid && e.userId === curUser.id && e.status === 'approved');
    
    if (!isProjAdmin && !isEnrolled) {
      widget.classList.add('hidden');
      return;
    }
    
    widget.classList.remove('hidden');

    const chats = JSON.parse(localStorage.getItem('meal_chats')) || [];
    const projChats = chats.filter(c => c.projectId === pid).sort((a,b) => a.time - b.time);
    
    let html = '';
    projChats.forEach(c => {
      const isSelf = c.userId === curUser.id;
      const timeStr = new Date(c.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      html += \`
        <div class="chat-msg \${isSelf ? 'self' : 'other'}">
          \${!isSelf ? \`<div class="chat-msg-author">\${c.userName}</div>\` : ''}
          <div>\${c.text}</div>
          <div class="chat-msg-time">\${timeStr}</div>
        </div>
      \`;
    });
    
    const isScrolledToBottom = body.scrollHeight - body.clientHeight <= body.scrollTop + 20;
    body.innerHTML = html;
    
    // Auto scroll down if they were already at the bottom or it's the first load
    if (isScrolledToBottom || html !== window._lastChatHtml) {
      body.scrollTop = body.scrollHeight;
    }
    window._lastChatHtml = html;
  }

  // Send Message
  function sendMessage() {
    const text = input.value.trim();
    const pid = getCurProjId();
    if (!text || !pid) return;
    
    const chats = JSON.parse(localStorage.getItem('meal_chats')) || [];
    const msg = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      projectId: pid,
      userId: curUser.id,
      userName: curUser.name,
      text: text,
      time: Date.now()
    };
    chats.push(msg);
    localStorage.setItem('meal_chats', JSON.stringify(chats));
    if (window.fbCreate) window.fbCreate('meal_chats', msg.id, msg);
    
    input.value = '';
    renderChat();
    // Also scroll to bottom immediately after sending
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });

  // Listen to storage events
  window.addEventListener('storage', e => {
    if (!e.key || e.key === 'meal_chats' || e.key === 'meal_enrollments') {
      renderChat();
    }
  });
  
  // Custom event to force render
  window.addEventListener('refreshChat', renderChat);

  // Initial render
  renderChat();
}













