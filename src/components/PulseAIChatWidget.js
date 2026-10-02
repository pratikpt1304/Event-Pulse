import { askPulseAI, isGeminiAIActive, getGeminiApiKey, setGeminiApiKey } from '../services/ai';
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
      <span style="background: linear-gradient(135deg, #7c3aed, #06b6d4); font-size: 0.65rem; padding: 0.2rem 0.55rem; border-radius: 20px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #ffffff;">AI</span>
    </button>

    <!-- Chat Modal Window -->
    <div id="pulse-ai-modal" style="display: none; position: fixed; bottom: 85px; right: 24px; width: 400px; max-width: calc(100vw - 32px); height: 550px; max-height: calc(100vh - 120px); background: #ffffff; border: 1px solid var(--border-strong, #e2e8f0); border-radius: 20px; box-shadow: 0 24px 50px -10px rgba(15, 23, 42, 0.3); z-index: 1000; flex-direction: column; overflow: hidden; font-family: var(--font-body, system-ui, sans-serif);">
      
      <!-- Header with Next-Gen Gradient -->
      <div style="padding: 0.85rem 1.15rem; background: #090d16; border-bottom: 1px solid rgba(6, 182, 212, 0.25); color: #ffffff; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: rgba(6, 182, 212, 0.2); border-radius: 50%; filter: blur(20px);"></div>
        
        <div style="display: flex; align-items: center; gap: 0.75rem; z-index: 1;">
          <img src="/nex-logo.jpg" alt="NEX" style="width: 36px; height: 36px; border-radius: 10px; object-fit: cover; box-shadow: 0 0 16px rgba(6, 182, 212, 0.6); border: 1px solid rgba(6, 182, 212, 0.4);" />
          <div>
            <div style="font-size: 1.1rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.01em; color: #ffffff; display: flex; align-items: center; gap: 0.4rem;">
              NEX <span style="font-size: 0.65rem; background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 0.1rem 0.4rem; border-radius: 4px;">AI</span>
            </div>
            <div id="ai-status-indicator" style="font-size: 0.68rem; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              ● <span id="ai-engine-text">Live Campus Grounded</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.4rem; z-index: 1;">
          <button id="btn-close-ai-chat" style="background: none; border: none; color: #ffffff; font-size: 1.25rem; cursor: pointer; opacity: 0.85; padding: 4px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; transition: background 0.15s;" title="Close Chat">
            ✕
          </button>
        </div>
      </div>

      <!-- Quick Suggestion Chips -->
      <div style="padding: 0.5rem 0.85rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 0.4rem; overflow-x: auto; white-space: nowrap;" id="ai-quick-chips">
        <button class="ai-chip" data-prompt="Upcoming hackathons and fests">🚀 Live Hackathons</button>
        <button class="ai-chip" data-prompt="Check my pass status">🎫 My Pass Status</button>
        <button class="ai-chip" data-prompt="How does attendance OD work?">📋 Attendance (OD)</button>
        <button class="ai-chip" data-prompt="Find teammates for hackathon">🤝 Find Squads</button>
        <button class="ai-chip" data-prompt="Who is the HOD and Dean?">🏛️ HOD & Dean</button>
      </div>

      <!-- Messages Body -->
      <div id="ai-messages-list" style="flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; background: #fdfdfd;">
        <!-- Initial Welcome Message -->
        <div style="align-self: flex-start; max-width: 90%; background: #f1f5f9; padding: 0.85rem 1rem; border-radius: 16px; border-top-left-radius: 4px; font-size: 0.825rem; color: #1e293b; line-height: 1.45; border: 1px solid #e2e8f0;">
          ⚡ <strong>Hi! I'm NEX AI.</strong><br/>
          I'm connected to Sanjivani University's live event registry. Ask me anything about upcoming hackathons, digital QR passes, official On-Duty (OD) attendance, or open squads!
        </div>
      </div>

      <!-- Chat Input Area -->
      <form id="ai-input-form" style="padding: 0.65rem 0.85rem; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 0.5rem; align-items: center;">
        <input type="text" id="ai-chat-input" placeholder="Ask NEX in English, Hindi, or Hinglish..." autocomplete="off" style="flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 0.55rem 0.95rem; font-size: 0.85rem; outline: none; background: #f8fafc; transition: border-color 0.2s;" />
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
  const engineText = root.querySelector('#ai-engine-text');

  // Update Status Display
  const updateEngineIndicator = () => {
    const key = getGeminiApiKey();
    if (key) {
      engineText.textContent = 'Gemini 1.5 Flash Active ⚡';
      engineText.style.color = '#38bdf8';
    } else {
      engineText.textContent = 'Live Campus Grounded Engine';
      engineText.style.color = '#10b981';
    }
  };

  updateEngineIndicator();

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

  // Add a message to chat
  const appendMessage = (sender, content, actions = []) => {
    const isUser = sender === 'user';
    const msgEl = document.createElement('div');
    msgEl.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msgEl.style.maxWidth = '90%';
    msgEl.style.background = isUser ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f8fafc';
    msgEl.style.color = isUser ? '#ffffff' : '#1e293b';
    msgEl.style.padding = '0.75rem 0.95rem';
    msgEl.style.borderRadius = '14px';
    if (isUser) {
      msgEl.style.borderTopRightRadius = '4px';
    } else {
      msgEl.style.borderTopLeftRadius = '4px';
      msgEl.style.border = '1px solid #e2e8f0';
    }
    msgEl.style.fontSize = '0.825rem';
    msgEl.style.lineHeight = '1.48';

    // Format content with simple markdown (bold, bullet points, line breaks, code)
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px; font-family: monospace;">$1</code>')
      .replace(/\n/g, '<br/>');

    msgEl.innerHTML = formatted;

    // Render actions
    if (actions && actions.length > 0) {
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '0.4rem';
      actionsDiv.style.flexWrap = 'wrap';
      actionsDiv.style.marginTop = '0.65rem';
      actionsDiv.style.paddingTop = '0.45rem';
      actionsDiv.style.borderTop = '1px solid rgba(0,0,0,0.08)';

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
      msgEl.appendChild(actionsDiv);
    }

    messagesList.appendChild(msgEl);
    messagesList.scrollTop = messagesList.scrollHeight;
  };

  // Process Query
  const sendQuery = async (queryText) => {
    const text = queryText.trim();
    if (!text) return;

    appendMessage('user', text);
    if (input) input.value = '';

    // Typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.style.alignSelf = 'flex-start';
    typingIndicator.style.background = '#f1f5f9';
    typingIndicator.style.color = '#64748b';
    typingIndicator.style.padding = '0.45rem 0.75rem';
    typingIndicator.style.borderRadius = '14px';
    typingIndicator.style.fontSize = '0.75rem';
    typingIndicator.style.fontStyle = 'italic';
    typingIndicator.innerHTML = '⚡ NEX is analyzing live campus data...';
    messagesList.appendChild(typingIndicator);
    messagesList.scrollTop = messagesList.scrollHeight;

    const user = getCurrentUser();
    const response = await askPulseAI(text, user);

    typingIndicator.remove();
    appendMessage('ai', response.text, response.actions);
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
