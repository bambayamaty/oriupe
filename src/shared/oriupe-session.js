/* ═══════════════════════════════════════════════════════
   oriupe-session.js — Session persistante Oriupe
   Inclure dans le <head> de chaque page HTML
═══════════════════════════════════════════════════════ */

const SESSION_KEY = 'oriupe_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

/* ── LECTURE / ÉCRITURE ── */
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expiration automatique après 30 jours
    if (data.expiresAt && Date.now() > data.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch (e) { return null; }
}

function setSession(data) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...data,
      isLoggedIn: true,
      expiresAt: Date.now() + SESSION_TTL
    }));
  } catch (e) {}
}

function updateSession(updates) {
  const s = getSession();
  if (s) setSession({ ...s, ...updates });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = '/src/pages/home/index.html';
}

/* ── PROTECTION PAGES PRIVÉES ── */
function requireAuth() {
  const s = getSession();
  if (!s || !s.isLoggedIn) {
    window.location.href = '/src/pages/auth/index.html';
  }
}

/* ── INJECTION NAVIGATION ── */
function initNav() {
  const navRight = document.getElementById('nav-right');
  if (!navRight) return;
  // Mark container as relatively positioned for dropdown
  navRight.style.position = 'relative';

  const s = getSession();
  if (!s || !s.isLoggedIn) {
    _renderGuestNav(navRight);
  } else {
    _renderUserNav(navRight, s);
  }
  _bindOutsideClick();
}

function _renderGuestNav(container) {
  // Preserve existing children (pills, demo dropdown) and only swap auth buttons
  const existing = container.innerHTML;
  // Already rendered correctly on static pages — nothing to do for guests
  // But we inject a small indicator that session is ready
  container.dataset.sessionReady = 'guest';
}

function _safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch (e) {}
  return null;
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _renderUserNav(container, s) {
  const initials = (_esc((s.firstName || '?')[0]) + _esc((s.lastName || '?')[0])).toUpperCase();
  const avatarBg = s.role === 'freelance'
    ? 'linear-gradient(135deg,#3CB878,#8DC63F)'
    : 'linear-gradient(135deg,#29ABE2,#7DD6F0)';
  const dashUrl = s.role === 'freelance'
    ? '/src/pages/dashboard/freelance/index.html'
    : '/src/pages/dashboard/client/index.html';
  const safeAvatar = _safeUrl(s.avatarUrl);

  // Remove static auth buttons; keep pills and demo menu if present
  const pills = container.querySelectorAll('.nav-pill');
  const demoWrap = container.querySelector('#demo-menu-wrap');

  // Build authenticated nav content
  const authHtml = `
    <div class="nav-notif-btn" onclick="_goMessages()" id="notif-btn" title="Messages">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      ${s.unreadMessages > 0 ? `<span class="nav-notif-badge">${s.unreadMessages}</span>` : ''}
    </div>
    <div class="nav-user-btn" onclick="_toggleUserMenu()" id="user-btn">
      <div class="nav-avatar" style="background:${avatarBg}">
        ${safeAvatar ? `<img src="${safeAvatar}" alt="${_esc(s.firstName)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.remove()"/>` : initials}
        <div class="nav-online-dot"></div>
      </div>
      <span class="nav-username">${_esc(s.firstName)}</span>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="nav-chevron" id="nav-chevron">
        <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="nav-dropdown" id="nav-dropdown">
      <div class="nd-header">
        <div class="nd-avatar" style="background:${avatarBg}">${initials}</div>
        <div>
          <div class="nd-name">${_esc(s.firstName)} ${_esc(s.lastName)}</div>
          <div class="nd-email">${_esc(s.email)}</div>
          <div class="nd-badge">${(s.isKycVerified && s.kycToken) ? '✓ Identité vérifiée' : '⏳ Vérification en cours'}</div>
        </div>
      </div>
      <div class="nd-sep"></div>
      <a class="nd-item" href="${dashUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Mon tableau de bord
      </a>
      ${s.role === 'freelance' ? `
      <a class="nd-item" href="/src/pages/profile/index.html">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Mon profil public
      </a>` : ''}
      <a class="nd-item" href="/src/pages/messagerie/index.html">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Mes messages
        ${s.unreadMessages > 0 ? `<span class="nd-count">${s.unreadMessages}</span>` : ''}
      </a>
      <a class="nd-item" href="${dashUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Mes commandes
        ${s.activeOrders > 0 ? `<span class="nd-count">${s.activeOrders}</span>` : ''}
      </a>
      ${s.role === 'client' ? `
      <a class="nd-item" href="${dashUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        Mes favoris
      </a>` : ''}
      <a class="nd-item" href="${dashUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Paramètres
      </a>
      <div class="nd-sep"></div>
      <div class="nd-item nd-logout" onclick="logout()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Se déconnecter
      </div>
    </div>
  `;

  // Replace auth buttons while keeping pills + demo menu
  const btnLogin = container.querySelector('.btn-login, .btn-ghost');
  const btnRegister = container.querySelector('.btn-cta-nav, .btn-g');
  if (btnLogin) btnLogin.remove();
  if (btnRegister) btnRegister.remove();

  // Insert auth elements before demo menu if it exists
  const authDiv = document.createElement('div');
  authDiv.className = 'nav-auth-cluster';
  authDiv.style.cssText = 'display:flex;align-items:center;gap:8px;position:relative';
  authDiv.innerHTML = authHtml;

  if (demoWrap) {
    container.insertBefore(authDiv, demoWrap);
  } else {
    container.appendChild(authDiv);
  }

  _injectSessionCSS();
  container.dataset.sessionReady = 'user';
}

function _goMessages() {
  window.location.href = '/src/pages/messagerie/index.html';
}

function _toggleUserMenu() {
  const dd = document.getElementById('nav-dropdown');
  const chevron = document.getElementById('nav-chevron');
  if (!dd) return;
  const open = dd.classList.contains('open');
  _closeAllMenus();
  if (!open) {
    dd.classList.add('open');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function _closeAllMenus() {
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
  const chevron = document.getElementById('nav-chevron');
  if (chevron) chevron.style.transform = '';
}

function _bindOutsideClick() {
  document.addEventListener('click', e => {
    if (!e.target.closest('#user-btn') && !e.target.closest('#nav-dropdown')) {
      _closeAllMenus();
    }
  });
}

/* ── CSS INJECTION ── */
function _injectSessionCSS() {
  if (document.getElementById('oriupe-session-css')) return;
  const style = document.createElement('style');
  style.id = 'oriupe-session-css';
  style.textContent = `
  .nav-auth-cluster { display:flex;align-items:center;gap:8px;position:relative }
  .nav-notif-btn {
    position:relative;width:38px;height:38px;
    border:1.5px solid rgba(27,58,74,.12);border-radius:10px;
    background:rgba(255,255,255,.08);
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;color:rgba(255,255,255,.75);transition:all .2s;flex-shrink:0
  }
  nav.scrolled .nav-notif-btn{background:#fff;color:var(--navy2,#1B3A4A);border-color:rgba(27,58,74,.12)}
  .nav-notif-btn:hover{border-color:#3CB878;color:#3CB878;background:rgba(60,184,120,.08)}
  .nav-notif-badge {
    position:absolute;top:-5px;right:-5px;
    min-width:17px;height:17px;
    background:#EF4444;color:#fff;border:2px solid #fff;
    border-radius:10px;font-size:9px;font-weight:800;
    display:flex;align-items:center;justify-content:center;padding:0 3px
  }
  .nav-user-btn {
    display:flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.2);
    border-radius:10px;padding:5px 10px 5px 5px;
    cursor:pointer;transition:all .2s;position:relative;flex-shrink:0
  }
  nav.scrolled .nav-user-btn{background:#fff;border-color:rgba(27,58,74,.12)}
  .nav-user-btn:hover{border-color:#3CB878}
  .nav-avatar {
    width:28px;height:28px;border-radius:8px;
    display:flex;align-items:center;justify-content:center;
    font-size:10px;font-weight:800;color:#fff;position:relative;flex-shrink:0
  }
  .nav-online-dot {
    position:absolute;bottom:-2px;right:-2px;
    width:8px;height:8px;background:#22C55E;
    border-radius:50%;border:2px solid #fff
  }
  .nav-username{font-size:13px;font-weight:700;color:#fff;white-space:nowrap}
  nav.scrolled .nav-username{color:#1B3A4A}
  .nav-chevron{color:rgba(255,255,255,.6);transition:transform .2s}
  nav.scrolled .nav-chevron{color:#1B3A4A}
  .nav-dropdown {
    position:absolute;top:calc(100% + 10px);right:0;
    width:268px;background:#fff;
    border:1px solid rgba(27,58,74,.1);border-radius:16px;
    box-shadow:0 16px 48px rgba(15,37,53,.18);
    display:none;z-index:1000;overflow:hidden;
    animation:ndropIn .2s cubic-bezier(.25,.46,.45,.94) both
  }
  .nav-dropdown.open{display:block}
  @keyframes ndropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  .nd-header{display:flex;align-items:center;gap:12px;padding:14px 14px 10px}
  .nd-avatar{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0}
  .nd-name{font-size:14px;font-weight:800;color:#1B3A4A}
  .nd-email{font-size:11px;color:rgba(27,58,74,.5);margin-top:1px}
  .nd-badge{font-size:10px;font-weight:700;color:#27965D;background:#E4F7EE;padding:2px 7px;border-radius:8px;margin-top:5px;display:inline-block}
  .nd-sep{height:1px;background:rgba(27,58,74,.08);margin:2px 0}
  .nd-item{display:flex;align-items:center;gap:10px;padding:9px 14px;font-size:13px;font-weight:600;color:rgba(27,58,74,.6);cursor:pointer;transition:all .15s;text-decoration:none}
  .nd-item:hover{background:#F4F6F9;color:#1B3A4A}
  .nd-item svg{flex-shrink:0;opacity:.55}
  .nd-item:hover svg{opacity:1}
  .nd-count{margin-left:auto;min-width:20px;height:20px;background:#3CB878;color:#fff;border-radius:10px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px}
  .nd-logout{color:#EF4444!important}
  .nd-logout:hover{background:rgba(239,68,68,.06)!important}
  .nd-logout svg{opacity:1!important;stroke:#EF4444}
  `;
  document.head.appendChild(style);
}

/* ── INIT AUTO ── */
document.addEventListener('DOMContentLoaded', initNav);
