/* ═══════════════════════════════════════════════════════
   nav.js — Composant navigation partagé Oriupe
   Usage: <script type="module" src="/src/shared/nav.js"></script>
          + <div id="nav-root"></div> à l'endroit souhaité
═══════════════════════════════════════════════════════ */

const LINKS = [
  { label: 'Explorer',       href: '/src/pages/catalog/index.html' },
  { label: "Appels d'offres", href: '/src/pages/offers/index.html' },
  { label: 'Academy',        href: '/src/pages/academy/index.html' },
  { label: 'Blog',           href: '/src/pages/blog/index.html' },
  { label: 'Tarifs',         href: '/src/pages/pricing/index.html' },
]

function getSession () {
  try { return JSON.parse(localStorage.getItem('oriupe_session') || 'null') } catch { return null }
}

function isActive (href) {
  return window.location.pathname.includes(
    href.replace('/src/pages', '').replace('/index.html', '')
  )
}

function buildNav () {
  const s = getSession()
  const loggedIn = s && s.isLoggedIn
  const dashUrl  = s?.role === 'freelance'
    ? '/src/pages/dashboard/freelance/index.html'
    : '/src/pages/dashboard/client/index.html'

  const navLinks = LINKS.map(l =>
    `<a href="${l.href}"${isActive(l.href) ? ' class="active"' : ''}>${l.label}</a>`
  ).join('')

  const navRight = loggedIn
    ? `<a href="${dashUrl}" class="btn-account">
         <span class="btn-account-av">${(s.firstName || 'U')[0].toUpperCase()}</span>
         <span class="btn-account-name">${s.firstName || 'Mon compte'}</span>
       </a>`
    : `<button class="btn-login"  onclick="location.href='/src/pages/auth/index.html'">Se connecter</button>
       <button class="btn-cta-nav" onclick="location.href='/src/pages/auth/index.html'">S'inscrire</button>`

  const mobileLinks = LINKS.map(l =>
    `<a href="${l.href}">${l.label}</a>`
  ).join('')

  const mobileCta = loggedIn
    ? `<a href="${dashUrl}" style="display:block;width:100%;padding:13px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;text-align:center">Mon espace →</a>`
    : `<button onclick="location.href='/src/pages/auth/index.html'" style="width:100%;padding:13px;border-radius:9px;border:2px solid var(--green);background:#fff;color:var(--green);font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer">Se connecter</button>
       <button onclick="location.href='/src/pages/auth/index.html'" style="width:100%;padding:13px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer">S'inscrire gratuitement</button>`

  return `
<nav id="nav" class="at-top">
  <div class="nav-inner">
    <a href="/src/pages/home/index.html" class="logo">
      <div class="logo-mark">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
          <circle cx="10" cy="10" r="8.5" fill="#8DC63F" opacity=".9"/>
          <circle cx="22" cy="10" r="8.5" fill="#29ABE2" opacity=".9"/>
          <circle cx="10" cy="22" r="8.5" fill="#3CB878" opacity=".9"/>
          <circle cx="22" cy="22" r="8.5" fill="#1B3A4A"/>
          <rect x="9.5" y="9.5" width="13" height="13" rx="1.5" fill="rgba(60,184,120,.45)"/>
        </svg>
      </div>
      <span class="logo-t">Oriupe</span>
    </a>
    <div class="nav-links">${navLinks}</div>
    <div class="nav-right" id="nav-right">${navRight}</div>
    <button class="hamburger" id="ham" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="mob-menu" id="mob" aria-hidden="true">
  ${mobileLinks}
  <div class="mob-btns">${mobileCta}</div>
</div>`
}

function injectStyles () {
  if (document.getElementById('oriupe-nav-styles')) return
  const style = document.createElement('style')
  style.id = 'oriupe-nav-styles'
  style.textContent = `
/* ── Nav partagé ── */
nav#nav{position:fixed;top:0;left:0;right:0;z-index:900;transition:background .3s,box-shadow .3s,backdrop-filter .3s}
nav#nav .nav-inner{max-width:1320px;margin:0 auto;padding:0 24px;height:68px;display:flex;align-items:center;gap:24px}
nav#nav .logo{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}
nav#nav .logo-t{font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:800;color:#fff;transition:color .3s}
nav#nav .nav-links{display:flex;gap:2px;align-items:center;margin-right:auto}
nav#nav .nav-links a{font-size:13.5px;color:rgba(255,255,255,.78);font-weight:500;padding:8px 14px;border-radius:8px;text-decoration:none;transition:color .2s,background .2s;white-space:nowrap}
nav#nav .nav-links a:hover{color:#fff;background:rgba(255,255,255,.1)}
nav#nav .nav-links a.active{color:var(--green);font-weight:700}
nav#nav .nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
nav#nav .btn-login{font-size:13px;font-weight:600;color:rgba(255,255,255,.78);background:transparent;border:1.5px solid rgba(255,255,255,.22);padding:7px 16px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap}
nav#nav .btn-login:hover{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.4)}
nav#nav .btn-cta-nav{font-size:13px;font-weight:700;color:#fff;background:var(--green);border:none;padding:8px 18px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap}
nav#nav .btn-cta-nav:hover{background:var(--green-d);transform:translateY(-1px)}
nav#nav .btn-account{display:flex;align-items:center;gap:8px;text-decoration:none;font-size:13px;font-weight:600;color:rgba(255,255,255,.9);background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.2);padding:6px 14px 6px 8px;border-radius:30px;transition:all .2s}
nav#nav .btn-account:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.35)}
nav#nav .btn-account-av{width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
nav#nav .btn-account-name{max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Hamburger */
nav#nav .hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:4px;margin-left:8px}
nav#nav .hamburger span{display:block;width:22px;height:2px;background:rgba(255,255,255,.9);border-radius:2px;transition:all .3s}
/* Scrolled state */
nav#nav.scrolled{background:rgba(255,255,255,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 2px 16px rgba(15,37,53,.1);border-bottom:1px solid rgba(27,58,74,.08)}
nav#nav.scrolled .logo-t{color:var(--navy2)}
nav#nav.scrolled .nav-links a{color:var(--muted)}
nav#nav.scrolled .nav-links a:hover{color:var(--navy2);background:var(--bg)}
nav#nav.scrolled .nav-links a.active{color:var(--green)}
nav#nav.scrolled .btn-login{color:var(--muted);border-color:var(--border)}
nav#nav.scrolled .btn-login:hover{color:var(--navy2);background:var(--bg);border-color:var(--border2)}
nav#nav.scrolled .btn-account{color:var(--navy2);background:var(--bg);border-color:var(--border)}
nav#nav.scrolled .hamburger span{background:var(--navy2)}
/* Mobile menu */
.mob-menu{display:none;position:fixed;top:68px;left:0;right:0;background:#fff;border-bottom:1px solid var(--border);box-shadow:0 8px 32px rgba(15,37,53,.12);z-index:899;padding:16px 24px;flex-direction:column;gap:4px}
.mob-menu.open{display:flex}
.mob-menu a{font-size:15px;font-weight:500;color:var(--navy2);padding:11px 8px;border-radius:8px;text-decoration:none;transition:background .15s}
.mob-menu a:hover{background:var(--bg)}
.mob-menu .mob-btns{display:flex;flex-direction:column;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
/* Push body content below nav */
body:not(.no-nav-offset){padding-top:68px}
/* Responsive */
@media(max-width:900px){
  nav#nav .nav-links a:nth-child(n+4){display:none}
  nav#nav .btn-cta-nav{display:none}
}
@media(max-width:640px){
  nav#nav .nav-links{display:none}
  nav#nav .nav-right .btn-login,nav#nav .nav-right .btn-cta-nav{display:none}
  nav#nav .hamburger{display:flex}
}
`
  document.head.appendChild(style)
}

function initScrollBehavior () {
  const nav = document.getElementById('nav')
  if (!nav) return
  const onScroll = () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled')
      nav.classList.remove('at-top')
    } else {
      nav.classList.add('at-top')
      nav.classList.remove('scrolled')
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function initMobileMenu () {
  const ham = document.getElementById('ham')
  const mob = document.getElementById('mob')
  if (!ham || !mob) return
  ham.addEventListener('click', () => {
    const isOpen = mob.classList.toggle('open')
    ham.setAttribute('aria-expanded', isOpen)
    mob.setAttribute('aria-hidden', !isOpen)
  })
  // Close on link click
  mob.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => {
      mob.classList.remove('open')
      ham.setAttribute('aria-expanded', 'false')
    })
  })
}

function mount () {
  const host = document.getElementById('nav-root')
  if (!host) return
  injectStyles()
  host.outerHTML = buildNav()
  initScrollBehavior()
  initMobileMenu()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}

export { mount as initNav }
