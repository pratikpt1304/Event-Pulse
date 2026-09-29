import { askPulseAI } from '../services/ai';
import { getCurrentUser } from '../services/auth';
import { openTeamFinderModal } from './TeamFinderModal';
import { openHelpDeskModal } from './ProfileModals';
import { openComplaintModal } from './ComplaintModal';

export function initPulseAIChatWidget(navigateTo) {
  const existing = document.getElementById('pulse-ai-widget-root');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'pulse-ai-widget-root';
  root.innerHTML = `
    <!-- Floating Trigger Button -->
    <button id="pulse-ai-trigger" style="position: fixed; bottom: 24px; right: 24px; z-index: 999; background: #0f172a; color: #ffffff; border: 1.5px solid rgba(6, 182, 212, 0.4); border-radius: 50px; padding: 0.5rem 1.15rem 0.5rem 0.6rem; display: flex; align-items: center; gap: 0.65rem; font-family: var(--font-heading, sans-serif); font-size: 0.95rem; font-weight: 800; cursor: pointer; box-shadow: 0 8px 30px rgba(6, 182, 212, 0.35); transition: transform 0.2s, box-shadow 0.2s; outline: none; letter-spacing: 0.02em;">
      <img src="/nex-logo.jpg" alt="NEX" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 12px rgba(6, 182, 212, 0.8);" />
      <span>NEX</span>
      <span style="background: linear-gradient(135deg, #7c3aed, #06b6d4); font-size: 0.65rem; padding: 0.2rem 0.55rem; border-radius: 20px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #ffffff;">NEXT-GEN</span>
    </button>

    <!-- Chat Modal Window -->
    <div id="pulse-ai-modal" style="display: none; position: fixed; bottom: 85px; right: 24px; width: 380px; max-width: calc(100vw - 32px); height: 530px; max-height: calc(100vh - 120px); background: #ffffff; border: 1px solid var(--border-strong, #e2e8f0); border-radius: 20px; box-shadow: 0 24px 50px -10px rgba(15, 23, 42, 0.3); z-index: 1000; flex-direction: column; overflow: hidden; font-family: var(--font-body, system-ui, sans-serif);">
      
      <!-- Header with Next-Gen Gradient -->
      <div style="padding: 0.95rem 1.25rem; background: #090d16; border-bottom: 1px solid rgba(6, 182, 212, 0.25); color: #ffffff; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: rgba(6, 182, 212, 0.2); border-radius: 50%; filter: blur(20px);"></div>
        
        <div style="display: flex; align-items: center; gap: 0.75rem; z-index: 1;">
          <img src="/nex-logo.jpg" alt="NEX" style="width: 38px; height: 38px; border-radius: 12px; object-fit: cover; box-shadow: 0 0 16px rgba(6, 182, 212, 0.6); border: 1px solid rgba(6, 182, 212, 0.4);" />
          <div>
            <div style="font-size: 1.15rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.01em; color: #ffffff; display: flex; align-items: center; gap: 0.4rem;">
              NEX <span style="font-size: 0.65rem; background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 0.1rem 0.4rem; border-radius: 4px;">AI</span>
            </div>
            <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 500;">Next-Generation Event Intelligence</div>
          </div>
        </div>
        <button id="btn-close-ai-chat" style="background: none; border: none; color: #ffffff; font-size: 1.2rem; cursor: pointer; opacity: 0.85; padding: 4px; z-index: 1;">
          ✕
        </button>
      </div>

      <!-- Quick Suggestion Chips -->
      <div style="padding: 0.55rem 0.85rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 0.4rem; overflow-x: auto; white-space: nowrap;" id="ai-quick-chips">
        <button class="ai-chip" data-prompt="Events for my department">🎯 My Dept Events</button>
        <button class="ai-chip" data-prompt="Check my pass status">🎫 Pass Status</button>
        <button class="ai-chip" data-prompt="Find open squads for hackathons">🤝 Find Squads</button>
        <button class="ai-chip" data-prompt="Where is the helpdesk office?">🎧 Helpdesk</button>
      </div>

      <!-- Messages Body -->
      <div id="ai-messages-list" style="flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; background: #fdfdfd;">
        <!-- Initial Welcome Message -->
        <div style="align-self: flex-start; max-width: 88%; background: #f1f5f9; padding: 0.8rem 0.95rem; border-radius: 16px; border-top-left-radius: 4px; font-size: 0.825rem; color: #1e293b; line-height: 1.45; border: 1px solid #e2e8f0;">
          ⚡ Hi! I'm <strong>NEX</strong>, your next-generation campus AI. Ask me anything about upcoming hackathons, sports tournaments, your digital passes, or open squads!
        </div>
      </div>

      <!-- Chat Input Area -->
      <form id="ai-input-form" style="padding: 0.65rem 0.85rem; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 0.5rem; align-items: center;">
        <input type="text" id="ai-chat-input" placeholder="Ask NEX anything..." autocomplete="off" style="flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 0.55rem 0.95rem; font-size: 0.85rem; outline: none; background: #f8fafc; transition: border-color 0.2s;" />
        <button type="submit" style="background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #ffffff; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);">
          ➤
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(root);

  const trigger = root.querySelector('#pulse-ai-trigger');
  const modal = root.querySelector('#pulse-ai-modal');
  const closeBtn = root.querySelector('#btn-close-ai-chat');
  const form = root.querySelector('#ai-input-form');
  const input = root.querySelector('#ai-chat-input');
  const messagesList = root.querySelector('#ai-messages-list');

  // Toggle modal
  const toggleModal = () => {
    const isHidden = modal.style.display === 'none' || !modal.style.display;
    modal.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      setTimeout(() => input?.focus(), 150);
    }
  };

  trigger?.addEventListener('click', toggleModal);
  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });

  // Handle Action Button Clicks inside AI Responses
  const handleActionRoute = (route) => {
    if (route === 'teams_modal') {
      openTeamFinderModal();
    } else if (route === 'help') {
      openHelpDeskModal();
    } else if (route === 'complaint_modal') {
      openComplaintModal();
    } else if (navigateTo) {
      navigateTo(route);
    }
    modal.style.display = 'none';
  };

  // Keyframe styles for cursor, dots and action fade-in
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes nexPulseDot {
      0% { opacity: 0.2; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0.2; transform: scale(0.8); }
    }
    @keyframes nexBlinkCursor {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes nexFadeInUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);

  // Markdown Formatter with safe typing tag balancing
  const formatAIMarkdown = (content) => {
    let formatted = content || '';
    // Auto-close open ** if currently typing
    const boldCount = (formatted.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      formatted += '**';
    }
    return formatted
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  // Helper to render action buttons below a message
  const renderActions = (container, actions) => {
    if (!actions || actions.length === 0) return;
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '0.4rem';
    actionsDiv.style.flexWrap = 'wrap';
    actionsDiv.style.marginTop = '0.65rem';
    actionsDiv.style.paddingTop = '0.45rem';
    actionsDiv.style.borderTop = '1px solid rgba(0,0,0,0.08)';
    actionsDiv.style.animation = 'nexFadeInUp 0.3s ease-out';

    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.textContent = act.label;
      btn.style.background = '#ffffff';
      btn.style.color = '#7c3aed';
      btn.style.border = '1px solid #7c3aed';
      btn.style.borderRadius = '20px';
      btn.style.padding = '0.25rem 0.65rem';
      btn.style.fontSize = '0.725rem';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 0.15s ease';
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#7c3aed';
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.color = '#7c3aed';
      });
      btn.addEventListener('click', () => handleActionRoute(act.route));
      actionsDiv.appendChild(btn);
    });
    container.appendChild(actionsDiv);
  };

  // Add a user or static message to chat
  const appendMessage = (sender, content, actions = []) => {
    const isUser = sender === 'user';
    const msgEl = document.createElement('div');
    msgEl.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msgEl.style.maxWidth = '88%';
    msgEl.style.background = isUser ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f8fafc';
    msgEl.style.color = isUser ? '#ffffff' : '#1e293b';
    msgEl.style.padding = '0.75rem 0.9rem';
    msgEl.style.borderRadius = '14px';
    if (isUser) {
      msgEl.style.borderTopRightRadius = '4px';
    } else {
      msgEl.style.borderTopLeftRadius = '4px';
      msgEl.style.border = '1px solid #e2e8f0';
    }
    msgEl.style.fontSize = '0.825rem';
    msgEl.style.lineHeight = '1.45';

    msgEl.innerHTML = formatAIMarkdown(content);
    renderActions(msgEl, actions);

    messagesList.appendChild(msgEl);
    messagesList.scrollTop = messagesList.scrollHeight;
    return msgEl;
  };

  // Typewriter effect for AI responses
  const typeAIMessage = (content, actions = []) => {
    const msgEl = document.createElement('div');
    msgEl.style.alignSelf = 'flex-start';
    msgEl.style.maxWidth = '88%';
    msgEl.style.background = '#f8fafc';
    msgEl.style.color = '#1e293b';
    msgEl.style.padding = '0.75rem 0.9rem';
    msgEl.style.borderRadius = '14px';
    msgEl.style.borderTopLeftRadius = '4px';
    msgEl.style.border = '1px solid #e2e8f0';
    msgEl.style.fontSize = '0.825rem';
    msgEl.style.lineHeight = '1.45';
    msgEl.style.position = 'relative';
    msgEl.style.cursor = 'pointer';
    msgEl.title = 'Click to show full message instantly';

    const textSpan = document.createElement('span');
    const cursor = document.createElement('span');
    cursor.className = 'ai-typing-cursor';
    cursor.innerHTML = '▋';
    cursor.style.cssText = 'display: inline-block; color: #06b6d4; font-size: 0.85rem; margin-left: 2px; vertical-align: baseline; animation: nexBlinkCursor 0.5s infinite; text-shadow: 0 0 8px rgba(6, 182, 212, 0.8);';

    msgEl.appendChild(textSpan);
    msgEl.appendChild(cursor);
    messagesList.appendChild(msgEl);
    messagesList.scrollTop = messagesList.scrollHeight;

    // Unicode safe character array (preserves emojis and complex symbols)
    const chars = Array.from(content || '');
    const totalLen = chars.length;
    let currentIndex = 0;
    let isFinished = false;
    let timeoutId = null;

    const finishTyping = () => {
      if (isFinished) return;
      isFinished = true;
      if (timeoutId) clearTimeout(timeoutId);
      cursor.remove();
      textSpan.innerHTML = formatAIMarkdown(content);
      msgEl.style.cursor = 'default';
      msgEl.title = '';
      renderActions(msgEl, actions);
      messagesList.scrollTop = messagesList.scrollHeight;
    };

    // Fast-forward on click
    msgEl.addEventListener('click', () => finishTyping());

    const typeNextChar = () => {
      if (isFinished) return;
      
      currentIndex++;
      const currentSlice = chars.slice(0, currentIndex).join('');
      textSpan.innerHTML = formatAIMarkdown(currentSlice);
      messagesList.scrollTop = messagesList.scrollHeight;

      if (currentIndex >= totalLen) {
        finishTyping();
        return;
      }

      // Natural, visible typing cadence
      const char = chars[currentIndex - 1];
      let delay = 22; // ~22ms base per letter for clear visible typewriter feel
      if (char === '.' || char === '!' || char === '?') {
        delay = 110; // Pause at end of sentence
      } else if (char === ',' || char === ':' || char === ';') {
        delay = 55; // Pause at comma / colon
      } else if (char === '\n') {
        delay = 75; // Pause at line break
      }

      timeoutId = setTimeout(typeNextChar, delay);
    };

    typeNextChar();
  };

  // Process Query
  const sendQuery = async (queryText) => {
    const text = queryText.trim();
    if (!text) return;

    appendMessage('user', text);
    if (input) input.value = '';

    // Typing/Thinking indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.style.alignSelf = 'flex-start';
    typingIndicator.style.background = '#f1f5f9';
    typingIndicator.style.color = '#06b6d4';
    typingIndicator.style.padding = '0.55rem 0.85rem';
    typingIndicator.style.borderRadius = '14px';
    typingIndicator.style.borderTopLeftRadius = '4px';
    typingIndicator.style.fontSize = '0.775rem';
    typingIndicator.style.fontWeight = '600';
    typingIndicator.style.border = '1px solid #e2e8f0';
    typingIndicator.style.display = 'flex';
    typingIndicator.style.alignItems = 'center';
    typingIndicator.style.gap = '0.5rem';
    typingIndicator.innerHTML = `
      <span style="display: inline-block; width: 8px; height: 8px; background: #06b6d4; border-radius: 50%; box-shadow: 0 0 8px #06b6d4; animation: nexPulseDot 0.8s infinite;"></span>
      <span style="color: #475569;">⚡ NEX is analyzing campus data...</span>
    `;
    messagesList.appendChild(typingIndicator);
    messagesList.scrollTop = messagesList.scrollHeight;

    try {
      const user = getCurrentUser();
      // Realistic 450ms thinking delay so user sees the thinking pulse before typewriter begins
      const [response] = await Promise.all([
        askPulseAI(text, user),
        new Promise(resolve => setTimeout(resolve, 450))
      ]);

      typingIndicator.remove();
      typeAIMessage(response.text, response.actions);
    } catch (err) {
      typingIndicator.remove();
      appendMessage('ai', "⚠️ Sorry, I encountered an issue processing your request. Please try again.");
    }
  };

  // Form Submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input?.value) sendQuery(input.value);
  });

  // Suggestion Chips
  root.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const prompt = e.currentTarget.getAttribute('data-prompt');
      sendQuery(prompt);
    });
  });

  // Dynamic Route Visibility: Hide floating AI on Login & Signup screens for clean auth UI
  const updateVisibility = () => {
    const hash = (window.location.hash || '').toLowerCase();
    const isAuthPage = hash === '#login' || hash.startsWith('#login') || hash === '#signup' || hash.startsWith('#signup');
    if (isAuthPage) {
      trigger.style.display = 'none';
      modal.style.display = 'none';
    } else {
      trigger.style.display = 'flex';
    }
  };

  updateVisibility();
  window.addEventListener('hashchange', updateVisibility);
}
