/* ═══════════════════════════════════════════════════════════════════
   oriupe-session.js v2.0 — Session & Système de rôles Oriupe
   ─────────────────────────────────────────────────────────────────
   API publique :
   • getSession()           → objet session complet ou null
   • setSession(data)       → persiste la session (30 jours)
   • updateSession(updates) → merge partiel
   • logout()               → efface + redirige accueil
   • requireAuth(roles?)    → bloque si non connecté / mauvais rôle
   • canSee(feature)        → boolean — contrôle d'accès par feature
   • applyRoleUI()          → applique data-role sur tous les éléments
   • initNav()              → injecte l'UI auth dans la navigation
   • setOnlineStatus(s)     → met à jour le statut de présence freelance
   • switchMode(mode)       → bascule client ↔ freelance (double rôle)
═══════════════════════════════════════════════════════════════════ */

const SESSION_KEY = 'oriupe_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

/* ─────────────────────────────────────────
   STRUCTURE DE SESSION COMPLÈTE
   ─────────────────────────────────────────
  {
    isLoggedIn: true,
    userId: "usr_xxx",
    firstName: "Kofi",
    lastName: "Mensah",
    email: "kofi@example.com",
    avatarUrl: null | "https://...",

    role: "visitor"|"client"|"freelance"|"admin",
    subRole: "particulier"|"entreprise",
    adminRole: "super_admin"|"moderateur"|"support"|"finance"|null,

    accountStatus: "active"|"pending_kyc"|"suspended"|"banned",
    isKycVerified: true|false,
    kycToken: null|"token",          // compat backward
    kycSubmittedAt: timestamp|null,
    suspendedUntil: timestamp|null,
    suspensionReason: null|"...",

    freelanceLevel: "new"|"confirmed"|"expert"|"top_oriupe"|"elite",
    onlineStatus: "available"|"busy"|"offline",

    unreadMessages: 0,
    unreadNotifications: 0,
    activeOrders: 0,

    hasBothRoles: false,
    currentMode: "client"|"freelance",

    expiresAt: timestamp,
    sessionCreatedAt: timestamp
  }
   ───────────────────────────────────────── */

/* ── LECTURE / ÉCRITURE ──────────────────────────────────────────── */

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expiresAt && Date.now() > data.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Valeurs par défaut pour les champs v2 manquants (compat anciens comptes)
    return {
      accountStatus: 'active',
      isKycVerified: !!data.kycToken,
      freelanceLevel: 'new',
      onlineStatus: 'available',
      unreadNotifications: 0,
      unreadMessages: 0,
      activeOrders: 0,
      hasBothRoles: false,
      currentMode: data.role || 'client',
      subRole: 'particulier',
      adminRole: null,
      ...data
    };
  } catch (e) { return null; }
}

function setSession(data) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...data,
      isLoggedIn: true,
      sessionCreatedAt: data.sessionCreatedAt || Date.now(),
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

/* ── PROTECTION PAGES PRIVÉES ────────────────────────────────────── */

function requireAuth(allowedRoles) {
  const s = getSession();
  if (!s || !s.isLoggedIn) {
    const next = encodeURIComponent(window.location.href);
    window.location.href = '/src/pages/auth/index.html?next=' + next;
    return;
  }
  // Compte suspendu/banni → page dédiée
  if (s.accountStatus === 'suspended' || s.accountStatus === 'banned') {
    _showSuspendedOverlay(s);
    return;
  }
  // Rôle non autorisé
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(s.role)) {
    window.location.href = '/src/pages/home/index.html';
  }
}

/* ── GESTION STATUT DE PRÉSENCE ──────────────────────────────────── */

function setOnlineStatus(status) {
  if (!['available','busy','offline'].includes(status)) return;
  updateSession({ onlineStatus: status });
  // Met à jour visuellement le dot dans le dropdown
  const dot = document.getElementById('nd-online-dot');
  const lbl = document.getElementById('nd-online-lbl');
  const colors = { available:'#22C55E', busy:'#F59E0B', offline:'#9CA3AF' };
  const labels = { available:'Disponible', busy:'Occupé', offline:'Invisible' };
  if (dot) dot.style.background = colors[status];
  if (lbl) lbl.textContent = labels[status];
}

/* ── SWITCH CLIENT ↔ FREELANCE ───────────────────────────────────── */

function switchMode(mode) {
  const s = getSession();
  if (!s || !s.hasBothRoles) return;
  updateSession({ currentMode: mode, role: mode });
  window.location.reload();
}

/* ── CONTRÔLE D'ACCÈS ────────────────────────────────────────────── */

function canSee(feature) {
  const s = getSession();
  const role = s?.role || 'visitor';
  const status = s?.accountStatus || 'active';
  const kyc = s?.isKycVerified || false;

  const map = {
    'btn-commander':           ['client'],
    'btn-creer-service':       status === 'active' && kyc ? ['freelance'] : [],
    'btn-publier-projet':      ['client'],
    'btn-soumettre-offre':     ['freelance'],
    'menu-revenus':            ['freelance'],
    'menu-commandes-client':   ['client'],
    'menu-commandes-freelance':['freelance'],
    'menu-mes-services':       ['freelance'],
    'menu-favoris':            ['client'],
    'menu-kyc-status':         ['freelance'],
    'section-admin':           ['admin'],
    'btn-contacter-client':    ['client','visitor'],
    'btn-contacter-freelance': ['freelance'],
    'nav-cta-client':          ['client'],
    'nav-cta-freelance':       status === 'active' && kyc ? ['freelance'] : [],
    'catalogue-commander':     ['client'],
    'catalogue-badge-ao':      ['freelance'],
  };
  return (map[feature] || []).includes(role);
}

/* ── LOGIQUE DATA-ROLE ───────────────────────────────────────────── */

function applyRoleUI() {
  const s = getSession();
  const role = s?.role || 'visitor';
  const status = s?.accountStatus || 'active';
  const kyc = s?.isKycVerified || false;

  document.querySelectorAll('[data-role]').forEach(el => {
    const allowed = el.dataset.role.split(',').map(r => r.trim());
    const requiresKyc = el.dataset.requiresKyc === 'true';
    const requiresActive = el.dataset.requiresActive === 'true';

    let show = allowed.includes(role);
    if (show && requiresKyc && !kyc) show = false;
    if (show && requiresActive && status !== 'active') show = false;

    el.style.display = show ? '' : 'none';
  });

  // Injecter le bandeau KYC en attente pour les freelances
  if (role === 'freelance' && status === 'pending_kyc') {
    _injectKycBanner(s);
  }

  // Bandeau admin sur pages publiques
  if (role === 'admin') {
    _injectAdminBanner(s);
  }

  // Compte suspendu
  if (status === 'suspended' || status === 'banned') {
    _showSuspendedOverlay(s);
  }
}

/* ── BANDEAU KYC EN ATTENTE ──────────────────────────────────────── */

function _injectKycBanner(s) {
  if (document.getElementById('oriupe-kyc-banner')) return;
  const submittedAt = s.kycSubmittedAt || s.sessionCreatedAt || Date.now();
  const hoursAgo = Math.floor((Date.now() - submittedAt) / 3600000);
  const timeStr = hoursAgo < 1 ? 'il y a moins d\'1h' : `il y a ${hoursAgo}h`;

  const banner = document.createElement('div');
  banner.id = 'oriupe-kyc-banner';
  banner.innerHTML = `
    <span class="okb-icon">⏳</span>
    <div class="okb-text">
      <strong>Vérification d'identité en cours</strong>
      <span>Soumise ${timeStr} · Délai estimé : 18h ouvrées · Vous ne pouvez pas encore publier de services</span>
    </div>
    <a class="okb-link" href="/src/pages/profile/index.html">Voir mon dossier →</a>
    <button class="okb-close" onclick="this.closest('#oriupe-kyc-banner').remove()" aria-label="Fermer">✕</button>
  `;

  document.body.insertBefore(banner, document.body.firstChild);

  _injectKycBannerCSS();
}

function _injectKycBannerCSS() {
  if (document.getElementById('oriupe-kyc-banner-css')) return;
  const s = document.createElement('style');
  s.id = 'oriupe-kyc-banner-css';
  s.textContent = `
    #oriupe-kyc-banner {
      position:fixed; top:0; left:0; right:0; z-index:2000;
      background:linear-gradient(90deg,#F59E0B,#FBBF24);
      color:#1C1917; display:flex; align-items:center; gap:12px;
      padding:10px 20px; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif;
      box-shadow:0 2px 12px rgba(245,158,11,.35);
    }
    #oriupe-kyc-banner + * { margin-top:44px; }
    #oriupe-nav { top:44px !important; }
    .okb-icon { font-size:18px; flex-shrink:0; }
    .okb-text { flex:1; line-height:1.4; }
    .okb-text strong { font-weight:800; margin-right:8px; }
    .okb-text span { opacity:.8; }
    .okb-link { color:#1C1917; font-weight:700; text-decoration:underline; white-space:nowrap; flex-shrink:0; }
    .okb-close { background:none; border:none; cursor:pointer; font-size:14px; color:#1C1917; opacity:.6; padding:4px 8px; border-radius:4px; flex-shrink:0; }
    .okb-close:hover { opacity:1; background:rgba(0,0,0,.1); }
    @media(max-width:768px){.okb-text span{display:none}}
  `;
  document.head.appendChild(s);
}

/* ── BANDEAU ADMIN ───────────────────────────────────────────────── */

function _injectAdminBanner(s) {
  if (document.getElementById('oriupe-admin-banner')) return;
  // Ne pas afficher sur la page de login admin (le panel admin a son propre header)
  if (window.location.pathname.includes('/admin/login')) return;

  const banner = document.createElement('div');
  banner.id = 'oriupe-admin-banner';
  banner.innerHTML = `
    <span>🔐</span>
    <span><strong>Mode Admin</strong> — Vous naviguez en tant que <strong>${_esc(s.adminRole || 'admin')}</strong></span>
    <a href="/src/pages/admin/index.html">Accéder au panel →</a>
    <button onclick="this.closest('#oriupe-admin-banner').remove()">✕</button>
  `;

  document.body.insertBefore(banner, document.body.firstChild);

  if (!document.getElementById('oriupe-admin-banner-css')) {
    const style = document.createElement('style');
    style.id = 'oriupe-admin-banner-css';
    style.textContent = `
      #oriupe-admin-banner {
        position:fixed; top:0; left:0; right:0; z-index:2000;
        background:#0F2535; color:#fff; display:flex;
        align-items:center; gap:12px; padding:10px 20px;
        font-size:13px; font-family:'Plus Jakarta Sans',sans-serif;
      }
      #oriupe-admin-banner span:first-child { font-size:16px; }
      #oriupe-admin-banner a { color:#3CB878; font-weight:700; margin-left:auto; }
      #oriupe-admin-banner button { background:none; border:none; cursor:pointer; color:rgba(255,255,255,.5); font-size:14px; padding:4px 8px; }
      #oriupe-admin-banner ~ * { margin-top:44px; }
      #oriupe-nav { top:44px !important; }
    `;
    document.head.appendChild(style);
  }
}

/* ── PAGE COMPTE SUSPENDU ────────────────────────────────────────── */

function _showSuspendedOverlay(s) {
  if (document.getElementById('oriupe-suspended-overlay')) return;

  const until = s.suspendedUntil ? new Date(s.suspendedUntil).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : null;
  const isBanned = s.accountStatus === 'banned';

  const overlay = document.createElement('div');
  overlay.id = 'oriupe-suspended-overlay';
  overlay.innerHTML = `
    <div class="os-card">
      <div class="os-icon">${isBanned ? '🚫' : '⚠️'}</div>
      <h2 class="os-title">${isBanned ? 'Compte banni' : 'Compte suspendu'}</h2>
      <p class="os-sub">${isBanned
        ? 'Votre compte a été définitivement suspendu suite à une violation grave des conditions d\'utilisation.'
        : `Votre accès est temporairement suspendu${until ? ` jusqu\'au <strong>${until}</strong>` : ''}.`
      }</p>
      ${s.suspensionReason ? `<div class="os-reason"><strong>Motif :</strong> ${_esc(s.suspensionReason)}</div>` : ''}
      <a class="os-btn" href="/src/pages/help/index.html">Contacter le support →</a>
      <button class="os-logout" onclick="logout()">Se déconnecter</button>
    </div>
  `;

  if (!document.getElementById('oriupe-suspended-css')) {
    const style = document.createElement('style');
    style.id = 'oriupe-suspended-css';
    style.textContent = `
      #oriupe-suspended-overlay {
        position:fixed; inset:0; z-index:9999; background:rgba(15,37,53,.92);
        backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center;
        font-family:'Plus Jakarta Sans',sans-serif; padding:20px;
      }
      .os-card { background:#fff; border-radius:24px; padding:48px 40px; max-width:460px; width:100%; text-align:center; }
      .os-icon { font-size:48px; margin-bottom:16px; }
      .os-title { font-family:'Bricolage Grotesque',sans-serif; font-size:26px; font-weight:800; color:#1B3A4A; margin-bottom:12px; }
      .os-sub { font-size:15px; color:rgba(27,58,74,.6); line-height:1.7; margin-bottom:20px; }
      .os-reason { background:#FEF3C7; border:1px solid #FDE68A; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400E; margin-bottom:24px; text-align:left; }
      .os-btn { display:inline-block; background:#3CB878; color:#fff; font-size:14px; font-weight:700; padding:14px 32px; border-radius:12px; text-decoration:none; margin-bottom:12px; }
      .os-logout { display:block; width:100%; background:none; border:none; color:rgba(27,58,74,.45); font-size:13px; cursor:pointer; padding:8px; margin-top:4px; font-family:inherit; }
      .os-logout:hover { color:#EF4444; }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
}

/* ── INJECTION NAVIGATION ────────────────────────────────────────── */

function initNav() {
  const navRight = document.getElementById('on-right-slot')
    || document.getElementById('nav-right');
  if (!navRight) return;
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
  container.dataset.sessionReady = 'guest';
}

/* ── RENDU NAV UTILISATEUR CONNECTÉ ──────────────────────────────── */

function _renderUserNav(container, s) {
  const initials = (_esc((s.firstName || '?')[0]) + _esc((s.lastName || '?')[0])).toUpperCase();

  // Couleurs avatar par rôle
  const avatarBg = {
    freelance: 'linear-gradient(135deg,#3CB878,#8DC63F)',
    client:    'linear-gradient(135deg,#29ABE2,#7DD6F0)',
    admin:     'linear-gradient(135deg,#7C3AED,#A855F7)',
  }[s.role] || 'linear-gradient(135deg,#3CB878,#8DC63F)';

  const dashUrl = {
    freelance: '/src/pages/dashboard/freelance/index.html',
    client:    '/src/pages/dashboard/client/index.html',
    admin:     '/src/pages/admin/index.html',
  }[s.role] || '/src/pages/dashboard/client/index.html';

  const safeAvatar = _safeUrl(s.avatarUrl);
  const isPendingKyc = s.accountStatus === 'pending_kyc';
  const isCertified = s.isKycVerified && s.accountStatus === 'active';

  // Supprimer les anciens boutons auth (y compris le CTA injecté par nav.js)
  ['.btn-login', '.btn-ghost:not(.on-dark-btn)', '.btn-cta-nav', '.btn-g',
   '#on-btn-login', '#on-btn-signup', '.on-account', '#on-btn-create']
    .forEach(sel => container.querySelector(sel)?.remove());

  // ── CTA contextuel dans la nav (selon rôle) ──
  let ctaHtml = '';
  if (s.role === 'client') {
    ctaHtml = `<a class="nav-role-cta nav-role-cta--client" href="/src/pages/offers/index.html">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Publier un projet
    </a>`;
  } else if (s.role === 'freelance' && isCertified) {
    ctaHtml = `<a class="nav-role-cta nav-role-cta--freelance" href="/src/pages/profile/index.html">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Créer un service
    </a>`;
  } else if (s.role === 'freelance' && isPendingKyc) {
    ctaHtml = `<span class="nav-kyc-badge">⏳ Vérification en cours</span>`;
  }

  // ── Badge niveau freelance ──
  const levelBadge = s.role === 'freelance' && s.freelanceLevel
    ? { top_oriupe:'⭐ Top Oriupe', elite:'🏆 Elite', expert:'Expert', confirmed:'Confirmé', new:'' }[s.freelanceLevel] || ''
    : '';

  // ── Statut online ──
  const onlineColors = { available:'#22C55E', busy:'#F59E0B', offline:'#9CA3AF' };
  const onlineColor = onlineColors[s.onlineStatus] || '#22C55E';

  // ── Dropdown items selon rôle ──
  let dropdownItems = '';

  if (s.role === 'client') {
    dropdownItems = `
      <a class="nd-item" href="${dashUrl}">
        ${_icon('grid')} Mon tableau de bord
      </a>
      <a class="nd-item" href="/src/pages/catalog/index.html">
        ${_icon('search')} Trouver un freelance
      </a>
      <a class="nd-item" href="/src/pages/offers/index.html">
        ${_icon('plus-circle')} Publier un projet
      </a>
      <a class="nd-item" href="${dashUrl}">
        ${_icon('package')} Mes commandes
        ${s.activeOrders > 0 ? `<span class="nd-count">${s.activeOrders}</span>` : ''}
      </a>
      <a class="nd-item" href="/src/pages/messagerie/index.html">
        ${_icon('message')} Mes messages
        ${s.unreadMessages > 0 ? `<span class="nd-count">${s.unreadMessages}</span>` : ''}
      </a>
      <a class="nd-item" href="${dashUrl}">
        ${_icon('heart')} Mes freelances favoris
      </a>
      <a class="nd-item" href="${dashUrl}">
        ${_icon('file')} Mes contrats
      </a>
    `;
  } else if (s.role === 'freelance') {
    if (isPendingKyc) {
      dropdownItems = `
        <div class="nd-kyc-status">
          <div class="nd-kyc-icon">⏳</div>
          <div>
            <div class="nd-kyc-title">Vérification en cours</div>
            <div class="nd-kyc-sub">Délai estimé : 18h ouvrées</div>
          </div>
          <a class="nd-kyc-link" href="/src/pages/profile/index.html">Voir →</a>
        </div>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('grid')} Mon tableau de bord
        </a>
        <a class="nd-item" href="/src/pages/academy/index.html">
          ${_icon('book')} Academy — Se former
        </a>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('user')} Mon profil
        </a>
      `;
    } else {
      dropdownItems = `
        <a class="nd-item" href="${dashUrl}">
          ${_icon('grid')} Mon tableau de bord
        </a>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('shopping-bag')} Mes services
        </a>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('package')} Mes commandes
          ${s.activeOrders > 0 ? `<span class="nd-count">${s.activeOrders}</span>` : ''}
        </a>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('dollar')} Mes revenus
        </a>
        <a class="nd-item" href="/src/pages/messagerie/index.html">
          ${_icon('message')} Mes messages
          ${s.unreadMessages > 0 ? `<span class="nd-count">${s.unreadMessages}</span>` : ''}
        </a>
        <a class="nd-item" href="/src/pages/profile/index.html">
          ${_icon('user')} Mon profil public
        </a>
        <a class="nd-item" href="/src/pages/offers/index.html">
          ${_icon('clipboard')} Répondre aux AO
        </a>
        <a class="nd-item" href="/src/pages/academy/index.html">
          ${_icon('book')} Academy
        </a>
        <div class="nd-sep"></div>
        <div class="nd-online-toggle">
          <div class="nd-online-dot-wrap">
            <div class="nd-online-dot" id="nd-online-dot" style="background:${onlineColor}"></div>
          </div>
          <span id="nd-online-lbl">${{available:'Disponible',busy:'Occupé',offline:'Invisible'}[s.onlineStatus]||'Disponible'}</span>
          <select class="nd-online-sel" onchange="setOnlineStatus(this.value)">
            <option value="available"${s.onlineStatus==='available'?' selected':''}>🟢 Disponible</option>
            <option value="busy"${s.onlineStatus==='busy'?' selected':''}>🟡 Occupé</option>
            <option value="offline"${s.onlineStatus==='offline'?' selected':''}>⚫ Invisible</option>
          </select>
        </div>
      `;
    }
  } else if (s.role === 'admin') {
    dropdownItems = `
      <a class="nd-item" href="/src/pages/admin/index.html">
        ${_icon('shield')} Panel d'administration
      </a>
      <a class="nd-item nd-item--admin" href="#" onclick="sessionStorage.setItem('oriupe_view_as','visitor');window.location.reload()">
        ${_icon('eye')} Voir comme visiteur
      </a>
    `;
  }

  // ── Toggle double rôle ──
  let dualModeHtml = '';
  if (s.hasBothRoles) {
    dualModeHtml = `
      <div class="nd-sep"></div>
      <div class="nd-dual-toggle">
        <span class="nd-dual-lbl">Mode actuel :</span>
        <button class="nd-dual-btn${s.currentMode==='client'?' active':''}" onclick="switchMode('client')">👤 Client</button>
        <span class="nd-dual-sep">↔</span>
        <button class="nd-dual-btn${s.currentMode==='freelance'?' active':''}" onclick="switchMode('freelance')">💻 Freelance</button>
      </div>
    `;
  }

  // ── Badge KYC dans le header dropdown ──
  let kycBadge = '';
  if (s.role === 'freelance') {
    if (isPendingKyc) {
      kycBadge = '<span class="nd-badge nd-badge--pending">⏳ En vérification</span>';
    } else if (isCertified) {
      const levelLabel = { top_oriupe:'⭐ Top Oriupe', elite:'🏆 Elite', expert:'Expert ✓', confirmed:'Confirmé ✓', new:'Identité vérifiée ✓' }[s.freelanceLevel] || '✓ Certifié';
      kycBadge = `<span class="nd-badge">${levelLabel}</span>`;
    }
  } else if (s.role === 'client') {
    kycBadge = '<span class="nd-badge nd-badge--client">Client vérifié ✓</span>';
  } else if (s.role === 'admin') {
    kycBadge = `<span class="nd-badge nd-badge--admin">${s.adminRole || 'admin'}</span>`;
  }

  // ── HTML complet ──
  const authHtml = `
    <button class="nav-notif-btn" id="notif-btn" onclick="window.location.href='/src/pages/messagerie/index.html'" aria-label="Messages">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      ${(s.unreadMessages || 0) + (s.unreadNotifications || 0) > 0
        ? `<span class="nav-notif-badge">${(s.unreadMessages||0) + (s.unreadNotifications||0)}</span>`
        : ''}
    </button>
    ${ctaHtml}
    <div class="nav-user-wrap">
      <button class="nav-user-btn" id="user-btn" onclick="_toggleUserMenu()" aria-expanded="false" aria-haspopup="true">
        <div class="nav-avatar" style="background:${avatarBg}">
          ${safeAvatar
            ? `<img src="${safeAvatar}" alt="${_esc(s.firstName)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.remove()"/>`
            : initials}
          <div class="nav-online-dot" style="background:${onlineColor}"></div>
        </div>
        <span class="nav-username">${_esc(s.firstName || 'Moi')}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="nav-chevron" id="nav-chevron">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="nav-dropdown" id="nav-dropdown" role="menu">
        <div class="nd-header">
          <div class="nd-avatar" style="background:${avatarBg}">
            ${safeAvatar
              ? `<img src="${safeAvatar}" alt="${_esc(s.firstName)}" style="width:100%;height:100%;object-fit:cover;border-radius:11px" onerror="this.remove()"/>`
              : initials}
          </div>
          <div>
            <div class="nd-name">${_esc(s.firstName || '')} ${_esc(s.lastName || '')}</div>
            <div class="nd-email">${_esc(s.email || '')}</div>
            ${kycBadge}
          </div>
        </div>
        <div class="nd-sep"></div>
        ${dropdownItems}
        ${dualModeHtml}
        <div class="nd-sep"></div>
        <a class="nd-item" href="${dashUrl}">
          ${_icon('settings')} Paramètres
        </a>
        <button class="nd-item nd-logout" onclick="logout()">
          ${_icon('logout')} Se déconnecter
        </button>
      </div>
    </div>
  `;

  const authDiv = document.createElement('div');
  authDiv.className = 'nav-auth-cluster';
  authDiv.innerHTML = authHtml;

  const demoWrap = container.querySelector('#demo-menu-wrap');
  if (demoWrap) container.insertBefore(authDiv, demoWrap);
  else container.appendChild(authDiv);

  _injectSessionCSS();
  container.dataset.sessionReady = 'user';
}

/* ── MICRO-ICÔNES SVG ────────────────────────────────────────────── */

function _icon(name) {
  const icons = {
    grid:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    search:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    'plus-circle':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    package:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    message:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    heart:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    file:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    dollar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    user:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'shopping-bag':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
    clipboard:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>',
    book:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    settings:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    logout:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    shield:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    eye:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  return icons[name] || '';
}

/* ── UTILS ───────────────────────────────────────────────────────── */

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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _toggleUserMenu() {
  const dd = document.getElementById('nav-dropdown');
  const btn = document.getElementById('user-btn');
  const chevron = document.getElementById('nav-chevron');
  if (!dd) return;
  const open = dd.classList.contains('open');
  _closeAllMenus();
  if (!open) {
    dd.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function _closeAllMenus() {
  document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
  const btn = document.getElementById('user-btn');
  const chevron = document.getElementById('nav-chevron');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (chevron) chevron.style.transform = '';
}

function _bindOutsideClick() {
  document.addEventListener('click', e => {
    if (!e.target.closest('#user-btn') && !e.target.closest('#nav-dropdown')) {
      _closeAllMenus();
    }
  });
}

/* ── CSS INJECTION ───────────────────────────────────────────────── */

function _injectSessionCSS() {
  if (document.getElementById('oriupe-session-css')) return;
  const style = document.createElement('style');
  style.id = 'oriupe-session-css';
  style.textContent = `
/* Nav auth cluster */
.nav-auth-cluster { display:flex; align-items:center; gap:8px; position:relative; }

/* Notification bell */
.nav-notif-btn {
  position:relative; width:38px; height:38px;
  border:1.5px solid rgba(255,255,255,.2); border-radius:10px;
  background:rgba(255,255,255,.08);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:rgba(255,255,255,.8); transition:all .2s;
  flex-shrink:0;
}
#oriupe-nav[data-theme="light"] .nav-notif-btn {
  background:#F4F6F9; border-color:rgba(27,58,74,.12); color:rgba(27,58,74,.6);
}
.nav-notif-btn:hover { border-color:#3CB878; color:#3CB878; background:rgba(60,184,120,.1); }
.nav-notif-badge {
  position:absolute; top:-5px; right:-5px;
  min-width:17px; height:17px;
  background:#EF4444; color:#fff; border:2px solid #fff;
  border-radius:10px; font-size:9px; font-weight:800;
  display:flex; align-items:center; justify-content:center; padding:0 3px;
}

/* Role CTA button */
.nav-role-cta {
  display:flex; align-items:center; gap:6px;
  font-size:12px; font-weight:700; padding:8px 14px;
  border-radius:10px; text-decoration:none; white-space:nowrap;
  transition:all .2s; cursor:pointer;
}
.nav-role-cta--client {
  background:rgba(41,171,226,.15); color:#29ABE2;
  border:1.5px solid rgba(41,171,226,.3);
}
.nav-role-cta--client:hover { background:rgba(41,171,226,.25); transform:translateY(-1px); }
.nav-role-cta--freelance {
  background:#3CB878; color:#fff;
  border:1.5px solid transparent;
  box-shadow:0 2px 10px rgba(60,184,120,.3);
}
.nav-role-cta--freelance:hover { background:#27965D; transform:translateY(-1px); box-shadow:0 4px 16px rgba(60,184,120,.4); }
.nav-kyc-badge {
  font-size:11px; font-weight:700; color:#F59E0B;
  background:rgba(245,158,11,.1); border:1.5px solid rgba(245,158,11,.3);
  padding:6px 10px; border-radius:8px; white-space:nowrap;
}

/* User button */
.nav-user-wrap { position:relative; }
.nav-user-btn {
  display:flex; align-items:center; gap:7px;
  background:rgba(255,255,255,.1); border:1.5px solid rgba(255,255,255,.2);
  border-radius:10px; padding:5px 10px 5px 5px;
  cursor:pointer; transition:all .2s; flex-shrink:0;
}
#oriupe-nav[data-theme="light"] .nav-user-btn {
  background:#F4F6F9; border-color:rgba(27,58,74,.12);
}
.nav-user-btn:hover { border-color:#3CB878; }
.nav-avatar {
  width:28px; height:28px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:10px; font-weight:800; color:#fff; position:relative; flex-shrink:0;
  overflow:hidden;
}
.nav-online-dot {
  position:absolute; bottom:-2px; right:-2px;
  width:8px; height:8px;
  border-radius:50%; border:2px solid #fff;
}
.nav-username { font-size:13px; font-weight:700; color:#fff; white-space:nowrap; }
#oriupe-nav[data-theme="light"] .nav-username { color:#1B3A4A; }
.nav-chevron { color:rgba(255,255,255,.6); transition:transform .22s; flex-shrink:0; }
#oriupe-nav[data-theme="light"] .nav-chevron { color:rgba(27,58,74,.5); }

/* Dropdown */
.nav-dropdown {
  position:absolute; top:calc(100% + 10px); right:0;
  width:276px; background:#fff;
  border:1px solid rgba(27,58,74,.1); border-radius:16px;
  box-shadow:0 16px 48px rgba(15,37,53,.18);
  display:none; z-index:1001; overflow:hidden;
  animation:ndropIn .22s cubic-bezier(.25,.46,.45,.94) both;
}
.nav-dropdown.open { display:block; }
@keyframes ndropIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }

/* Dropdown header */
.nd-header { display:flex; align-items:center; gap:12px; padding:14px 14px 10px; }
.nd-avatar {
  width:42px; height:42px; border-radius:11px;
  display:flex; align-items:center; justify-content:center;
  font-size:14px; font-weight:800; color:#fff; flex-shrink:0; overflow:hidden;
}
.nd-name { font-size:14px; font-weight:800; color:#1B3A4A; }
.nd-email { font-size:11px; color:rgba(27,58,74,.5); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
.nd-badge {
  display:inline-block; font-size:10px; font-weight:700;
  color:#27965D; background:#E4F7EE;
  padding:2px 8px; border-radius:8px; margin-top:5px;
}
.nd-badge--pending { color:#92400E; background:#FEF3C7; }
.nd-badge--client  { color:#1A8BC0; background:#E2F4FB; }
.nd-badge--admin   { color:#6D28D9; background:#EDE9FE; }

/* Dropdown items */
.nd-sep { height:1px; background:rgba(27,58,74,.07); margin:4px 0; }
.nd-item {
  display:flex; align-items:center; gap:10px;
  padding:9px 14px; font-size:13px; font-weight:600;
  color:rgba(27,58,74,.65); cursor:pointer;
  transition:all .15s; text-decoration:none; width:100%;
  background:none; border:none; font-family:inherit; text-align:left;
}
.nd-item:hover { background:#F4F6F9; color:#1B3A4A; }
.nd-item svg { flex-shrink:0; opacity:.55; }
.nd-item:hover svg { opacity:1; }
.nd-count {
  margin-left:auto; min-width:20px; height:20px;
  background:#3CB878; color:#fff; border-radius:10px;
  font-size:10px; font-weight:800;
  display:flex; align-items:center; justify-content:center; padding:0 5px;
}
.nd-logout { color:#EF4444 !important; }
.nd-logout:hover { background:rgba(239,68,68,.06) !important; }
.nd-logout svg { opacity:1 !important; stroke:#EF4444; }
.nd-item--admin { color:#7C3AED !important; }

/* KYC status in dropdown */
.nd-kyc-status {
  display:flex; align-items:center; gap:10px; padding:10px 14px;
  background:#FFFBEB; border-bottom:1px solid #FDE68A; margin-bottom:4px;
}
.nd-kyc-icon { font-size:20px; }
.nd-kyc-title { font-size:12px; font-weight:800; color:#92400E; }
.nd-kyc-sub { font-size:11px; color:#B45309; }
.nd-kyc-link { margin-left:auto; font-size:11px; font-weight:700; color:#D97706; text-decoration:none; white-space:nowrap; }

/* Online status toggle */
.nd-online-toggle {
  display:flex; align-items:center; gap:8px; padding:8px 14px;
}
.nd-online-dot-wrap { width:20px; display:flex; justify-content:center; }
.nd-online-dot { width:9px; height:9px; border-radius:50%; transition:background .2s; }
.nd-online-toggle span { font-size:13px; font-weight:600; color:rgba(27,58,74,.7); flex:1; }
.nd-online-sel {
  font-size:11px; font-weight:600; color:rgba(27,58,74,.6);
  border:1.5px solid rgba(27,58,74,.12); border-radius:7px;
  background:#fff; padding:4px 8px; cursor:pointer; font-family:inherit;
}

/* Dual role toggle */
.nd-dual-toggle {
  display:flex; align-items:center; gap:6px; padding:10px 14px;
  background:#F4F6F9; flex-wrap:wrap;
}
.nd-dual-lbl { font-size:11px; color:rgba(27,58,74,.5); font-weight:600; width:100%; margin-bottom:4px; }
.nd-dual-btn {
  flex:1; padding:7px 4px; border:1.5px solid rgba(27,58,74,.15);
  border-radius:8px; background:#fff; font-size:12px; font-weight:600;
  color:rgba(27,58,74,.6); cursor:pointer; transition:all .2s; font-family:inherit;
}
.nd-dual-btn.active { background:#3CB878; border-color:#3CB878; color:#fff; }
.nd-dual-sep { color:rgba(27,58,74,.3); font-size:13px; }

/* Mobile responsive */
@media(max-width:768px) {
  .nav-role-cta { display:none; }
  .nav-username { display:none; }
  .nav-user-btn { padding:5px; }
  .nav-dropdown { right:-8px; width:calc(100vw - 32px); max-width:320px; }
}
  `;
  document.head.appendChild(style);
}

/* ── INIT AUTO ───────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  applyRoleUI();
});
