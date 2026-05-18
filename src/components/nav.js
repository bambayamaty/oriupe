/**
 * Oriupe — Navigation partagée
 * • Remplace le <nav> existant sur toutes les pages
 * • Chameleon : adapte ses couleurs selon la section en dessous
 * • Transparent au sommet de la page, opaque au défilement
 * • Intègre le widget devise (currency.js)
 */

import { initCurrency, buildCurrencyWidget } from './currency.js';

/* ─── DARK MODE CSS ──────────────────────────────── */
const DARK_CSS = `
html.dark body{background:#0F1923!important;color:#E2EBF0!important}
html.dark #oriupe-nav{background:rgba(15,25,35,.97)!important;border-bottom-color:rgba(255,255,255,.07)!important}
html.dark #oriupe-nav[data-theme="light"] .on-logo-t{color:#fff!important}
html.dark #oriupe-nav[data-theme="light"] .on-links a{color:rgba(255,255,255,.65)!important}
html.dark #oriupe-nav[data-theme="light"] .on-links a.on-active{color:#3CB878!important}
html.dark #oriupe-nav[data-theme="light"] .on-ghost{color:rgba(255,255,255,.8)!important}
html.dark .svc-card,html.dark .kpi,html.dark .blog-card,html.dark .ao-card,html.dark .course-card,html.dark .inst-card,html.dark .testi-card,html.dark .how-card,html.dark .cat-card{background:#1A2B38!important;border-color:rgba(255,255,255,.07)!important}
html.dark .sidebar,html.dark .breadcrumb,html.dark .filter-section,html.dark .filter-header,html.dark .search-bar-page,html.dark .topbar{background:#1A2B38!important;border-color:rgba(255,255,255,.07)!important}
html.dark body,html.dark .page-wrap,html.dark .main-content,html.dark main{background:#0F1923!important}
html.dark nav:not(#oriupe-nav){background:rgba(15,25,35,.97)!important;border-color:rgba(255,255,255,.07)!important}
html.dark .breadcrumb{background:#1A2B38!important}
html.dark input,html.dark select,html.dark textarea{background:#243447!important;color:#E2EBF0!important;border-color:rgba(255,255,255,.1)!important}
html.dark input::placeholder,html.dark textarea::placeholder{color:rgba(255,255,255,.22)!important}
html.dark .filter-title,html.dark .fs-title,html.dark .fo-label,html.dark .svc-name,html.dark .svc-title,html.dark .svc-price,html.dark .results-count strong,html.dark .sort-lbl,html.dark .bc-cur,html.dark .tb-title{color:#E2EBF0!important}
html.dark .svc-country,html.dark .svc-reviews,html.dark .results-count,html.dark .count,html.dark .tb-sub,html.dark .muted{color:rgba(255,255,255,.42)!important}
html.dark .af-chip{background:#1A2B38!important;color:#E2EBF0!important;border-color:rgba(255,255,255,.1)!important}
html.dark .pg-btn{background:#1A2B38!important;color:#E2EBF0!important;border-color:rgba(255,255,255,.1)!important}
html.dark .pg-btn.active{background:#3CB878!important;color:#fff!important;border-color:#3CB878!important}
html.dark .sort-sel,html.dark .vt-btn{background:#1A2B38!important;color:#E2EBF0!important;border-color:rgba(255,255,255,.1)!important}
html.dark .vt-btn.active{background:#243447!important}
html.dark footer{background:#080F18!important}
html.dark *{transition:background .22s,color .22s,border-color .22s}
`;

/* ─── CSS ─────────────────────────────────────────── */
const CSS = `
#oriupe-nav {
  height: 64px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 52px;
  position: sticky; top: 0; z-index: 1000; box-sizing: border-box;
  font-family: 'Plus Jakarta Sans', sans-serif;
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  transition: background .4s, border-color .4s, box-shadow .4s,
              backdrop-filter .4s, -webkit-backdrop-filter .4s;
  background: rgba(255,255,255,.97);
  border-bottom: 1px solid rgba(27,58,74,.1);
  box-shadow: 0 1px 0 rgba(27,58,74,.06);
}
#oriupe-nav.on-top {
  background: transparent !important; border-bottom-color: transparent !important;
  box-shadow: none !important; backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
#oriupe-nav[data-theme="light"]  { background: rgba(255,255,255,.97); border-bottom: 1px solid rgba(27,58,74,.1); box-shadow: 0 1px 0 rgba(27,58,74,.06); }
#oriupe-nav[data-theme="light"].on-scrolled { box-shadow: 0 4px 24px rgba(15,37,53,.11); }
#oriupe-nav[data-theme="dark"]   { background: rgba(10,22,34,.55); border-bottom: 1px solid rgba(255,255,255,.09); box-shadow: 0 1px 0 rgba(0,0,0,.18); }
#oriupe-nav[data-theme="dark"].on-scrolled  { box-shadow: 0 4px 28px rgba(0,0,0,.32); }
#oriupe-nav[data-theme="vivid"]  { background: rgba(255,255,255,.12); border-bottom: 1px solid rgba(255,255,255,.15); box-shadow: none; }
#oriupe-nav[data-theme="vivid"].on-scrolled { background: rgba(255,255,255,.18); box-shadow: 0 4px 24px rgba(0,0,0,.25); }

#oriupe-nav .on-left  { display:flex; align-items:center; gap:36px; }
#oriupe-nav .on-logo  { display:flex; align-items:center; gap:9px; text-decoration:none; flex-shrink:0; outline:none; }
#oriupe-nav .on-logo-t { font-family:'Bricolage Grotesque',sans-serif; font-size:20px; font-weight:800; letter-spacing:-.3px; line-height:1; transition:color .35s; }
#oriupe-nav[data-theme="light"] .on-logo-t { color:#1B3A4A; }
#oriupe-nav[data-theme="dark"]  .on-logo-t, #oriupe-nav[data-theme="vivid"] .on-logo-t, #oriupe-nav.on-top .on-logo-t { color:#ffffff; }

#oriupe-nav .on-links { display:flex; gap:2px; align-items:center; }
#oriupe-nav .on-links a { font-size:13px; font-weight:500; padding:7px 13px; border-radius:8px; text-decoration:none; white-space:nowrap; transition:color .25s, background .25s; }
#oriupe-nav[data-theme="light"] .on-links a           { color:rgba(27,58,74,.52); }
#oriupe-nav[data-theme="light"] .on-links a:hover     { color:#1B3A4A; background:#F4F6F9; }
#oriupe-nav[data-theme="light"] .on-links a.on-active { color:#3CB878; font-weight:700; background:rgba(60,184,120,.08); }
#oriupe-nav[data-theme="dark"]  .on-links a, #oriupe-nav.on-top .on-links a  { color:rgba(255,255,255,.7); }
#oriupe-nav[data-theme="dark"]  .on-links a:hover, #oriupe-nav.on-top .on-links a:hover { color:#fff; background:rgba(255,255,255,.1); }
#oriupe-nav[data-theme="dark"]  .on-links a.on-active { color:#8DC63F; font-weight:700; background:rgba(141,198,63,.12); }
#oriupe-nav[data-theme="vivid"] .on-links a           { color:rgba(255,255,255,.75); }
#oriupe-nav[data-theme="vivid"] .on-links a:hover     { color:#fff; background:rgba(255,255,255,.15); }
#oriupe-nav[data-theme="vivid"] .on-links a.on-active { color:#fff; font-weight:700; background:rgba(255,255,255,.2); }

#oriupe-nav .on-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
#oriupe-nav .on-ghost { font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:600; padding:8px 14px; border:none; border-radius:8px; cursor:pointer; transition:color .35s, background .35s; }
#oriupe-nav[data-theme="light"] .on-ghost       { color:#1B3A4A; background:transparent; }
#oriupe-nav[data-theme="dark"]  .on-ghost, #oriupe-nav.on-top .on-ghost, #oriupe-nav[data-theme="vivid"] .on-ghost { color:#fff; background:transparent; }
#oriupe-nav[data-theme="light"] .on-ghost:hover { background:#F4F6F9; }
#oriupe-nav[data-theme="dark"]  .on-ghost:hover, #oriupe-nav.on-top .on-ghost:hover { background:rgba(255,255,255,.1); }
#oriupe-nav[data-theme="vivid"] .on-ghost:hover { background:rgba(255,255,255,.15); }

#oriupe-nav .on-cta { font-family:'Plus Jakarta Sans',sans-serif; background:#3CB878; color:#fff; font-size:13px; font-weight:700; padding:10px 22px; border-radius:9px; border:none; box-shadow:0 2px 10px rgba(60,184,120,.3); transition:background .2s, transform .18s, box-shadow .18s; cursor:pointer; }
#oriupe-nav .on-cta:hover { background:#27965D; transform:translateY(-1px); box-shadow:0 4px 16px rgba(60,184,120,.42); }
#oriupe-nav .on-dark-btn { padding:8px 10px; display:flex; align-items:center; justify-content:center; border-radius:8px; }
#oriupe-nav .on-dark-btn:hover { background:rgba(255,255,255,.1); }

#oriupe-nav .on-account { display:flex; align-items:center; gap:8px; text-decoration:none; font-size:13px; font-weight:600; background:rgba(255,255,255,.1); border:1.5px solid rgba(255,255,255,.2); padding:6px 14px 6px 8px; border-radius:30px; transition:all .2s; color:rgba(255,255,255,.9); }
#oriupe-nav .on-account:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.35); }
#oriupe-nav[data-theme="light"] .on-account { color:#1B3A4A; background:rgba(27,58,74,.07); border-color:rgba(27,58,74,.15); }
#oriupe-nav[data-theme="light"] .on-account:hover { background:rgba(27,58,74,.12); }
#oriupe-nav .on-account-av { width:26px; height:26px; border-radius:50%; background:#3CB878; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff; flex-shrink:0; }
#oriupe-nav .on-account-name { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media(max-width:1100px){ #oriupe-nav{padding:0 28px;} }
@media(max-width:768px){
  #oriupe-nav{padding:0 16px;}
  #oriupe-nav .on-links, #oriupe-nav .on-ghost { display:none; }
}
`;

/* ─── PAGES ──────────────────────────────────────── */
const PAGES = [
  { key:'home',    label:'Accueil',        href:'/src/pages/home/index.html'    },
  { key:'catalog', label:'Explorer',        href:'/src/pages/catalog/index.html' },
  { key:'offers',  label:"Appels d'offres", href:'/src/pages/offers/index.html'  },
  { key:'academy', label:'Academy',         href:'/src/pages/academy/index.html' },
  { key:'blog',    label:'Blog',            href:'/src/pages/blog/index.html'    },
];

const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
  <circle cx="8.5"  cy="8.5"  r="7" fill="#8DC63F" opacity=".9"/>
  <circle cx="19.5" cy="8.5"  r="7" fill="#29ABE2" opacity=".9"/>
  <circle cx="8.5"  cy="19.5" r="7" fill="#3CB878" opacity=".9"/>
  <circle cx="19.5" cy="19.5" r="7" fill="#1B3A4A"/>
  <rect x="8" y="8" width="12" height="12" rx="1.2" fill="rgba(60,184,120,.42)"/>
</svg>`;

/* ─── CHAMELEON ──────────────────────────────────── */
function parseRGB(str) {
  if (!str) return null;
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r:+m[1], g:+m[2], b:+m[3] };
  let hex = str.replace('#','');
  if (hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  if (hex.length>=6) return { r:parseInt(hex.slice(0,2),16), g:parseInt(hex.slice(2,4),16), b:parseInt(hex.slice(4,6),16) };
  return null;
}
function extractFirstColor(val) {
  if (!val||val==='none') return null;
  const m = val.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
  return m ? m[0] : null;
}
function luminance({r,g,b}) {
  return [r,g,b].map(v=>{ const s=v/255; return s<=0.03928?s/12.92:((s+0.055)/1.055)**2.4; })
    .reduce((a,c,i)=>a+c*[0.2126,0.7152,0.0722][i],0);
}
function resolveBackground(el) {
  let node = el;
  while (node && node!==document.documentElement) {
    const style = window.getComputedStyle(node);
    const bgImg = style.backgroundImage;
    if (bgImg && bgImg!=='none') { const col=extractFirstColor(bgImg); if (col){const rgb=parseRGB(col);if(rgb)return rgb;} }
    const bg = style.backgroundColor;
    if (bg && bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent') {
      const rgb = parseRGB(bg);
      if (rgb) { const aM=bg.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)/); if((aM?parseFloat(aM[1]):1)>0.15)return rgb; }
    }
    node = node.parentElement;
  }
  return null;
}
function themeFromRGB(rgb) {
  if (!rgb) return 'light';
  const lum = luminance(rgb);
  const max = Math.max(rgb.r,rgb.g,rgb.b)/255;
  const min = Math.min(rgb.r,rgb.g,rgb.b)/255;
  const sat = max===0 ? 0 : (max-min)/max;
  if (sat>0.45 && lum>0.04 && lum<0.55) return 'vivid';
  if (lum<0.25) return 'dark';
  return 'light';
}
function detectTheme(nav) {
  if (window.scrollY < 2) {
    let node = nav.nextElementSibling;
    while (node) { const rgb=resolveBackground(node); if(rgb)return themeFromRGB(rgb); node=node.nextElementSibling; }
    return 'dark';
  }
  const cx = Math.round(window.innerWidth/2);
  const navH = nav.offsetHeight||64;
  const stack = document.elementsFromPoint(cx, Math.round(navH/2));
  const el = stack.find(e=>!nav.contains(e)&&e!==document.documentElement);
  return themeFromRGB(el ? resolveBackground(el) : null);
}

/* ─── SESSION ───────────────────────────────────── */
function getSession() {
  try { return JSON.parse(localStorage.getItem('oriupe_session') || 'null'); } catch { return null; }
}

/* ─── ACTIVE LINK ────────────────────────────────── */
function detectActive() {
  const path = window.location.pathname;
  for (const p of PAGES) { if (path.includes(`/pages/${p.key}/`)) return p.key; }
  if (path==='/'||path==='/index.html') return 'home';
  return '';
}

/* ─── BUILD ──────────────────────────────────────── */
function buildNavHTML() {
  const active = detectActive();
  const links = PAGES.map(p=>`<a href="${p.href}"${p.key===active?' class="on-active"':''}>${p.label}</a>`).join('');
  const s = getSession();
  const loggedIn = s && s.isLoggedIn;
  const dashUrl = s?.role === 'freelance'
    ? '/src/pages/dashboard/freelance/index.html'
    : '/src/pages/dashboard/client/index.html';
  const authSlot = loggedIn
    ? `<a href="${dashUrl}" class="on-account" aria-label="Mon espace">
         <span class="on-account-av">${(s.firstName||'U')[0].toUpperCase()}</span>
         <span class="on-account-name">${s.firstName||'Mon compte'}</span>
       </a>`
    : `<button class="on-ghost" id="on-btn-login">Se connecter</button>
       <button class="on-cta"   id="on-btn-signup">S'inscrire</button>`;
  return `
    <div class="on-left">
      <a class="on-logo" href="/src/pages/home/index.html" aria-label="Oriupe — Accueil">
        ${LOGO_SVG}<span class="on-logo-t">Oriupe</span>
      </a>
      <div class="on-links">${links}</div>
    </div>
    <div class="on-right" id="on-right-slot">
      <button class="on-ghost on-dark-btn" id="on-dark-toggle" aria-label="Mode sombre" title="Basculer mode sombre">
        <svg class="on-dark-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 10.5A6 6 0 017 4c0-.7.1-1.4.3-2.1A6.5 6.5 0 1014.1 10c-.2.2-.4.3-.6.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg class="on-dark-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
      ${authSlot}
    </div>`;
}

/* ─── INIT ───────────────────────────────────────── */
async function init() {
  /* Style */
  if (!document.getElementById('oriupe-nav-css')) {
    const s = document.createElement('style');
    s.id = 'oriupe-nav-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* Nav element */
  let nav = document.querySelector('nav');
  if (!nav) { nav = document.createElement('nav'); document.body.prepend(nav); }
  nav.id = 'oriupe-nav';
  nav.innerHTML = buildNavHTML();
  nav.setAttribute('data-theme','light');

  /* Boutons auth (uniquement si non connecté) */
  nav.querySelector('#on-btn-login')?.addEventListener('click',()=>{ window.location.href='/src/pages/auth/index.html'; });
  nav.querySelector('#on-btn-signup')?.addEventListener('click',()=>{ window.location.href='/src/pages/auth/index.html?register=1'; });

  /* Widget devise */
  const rightSlot = nav.querySelector('#on-right-slot');
  if (rightSlot) {
    const widget = buildCurrencyWidget();
    rightSlot.insertBefore(widget, rightSlot.firstChild);
  }

  /* Init devise en arrière-plan */
  initCurrency();

  /* Scroll + chameleon */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const sy = window.scrollY;
      nav.classList.toggle('on-top', sy<8);
      nav.classList.toggle('on-scrolled', sy>6);
      const theme = detectTheme(nav);
      if (nav.dataset.theme!==theme) nav.setAttribute('data-theme',theme);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});

  requestAnimationFrame(()=>{
    nav.setAttribute('data-theme', detectTheme(nav));
    nav.classList.toggle('on-top', window.scrollY<8);
  });

  /* ── Dark mode ── */
  function applyDark(on) {
    document.documentElement.classList.toggle('dark', on);
    const moon = nav.querySelector('.on-dark-moon');
    const sun  = nav.querySelector('.on-dark-sun');
    if (moon) moon.style.display = on ? 'none' : '';
    if (sun)  sun.style.display  = on ? '' : 'none';
    if (on && !document.getElementById('oriupe-dark-css')) {
      const ds = document.createElement('style');
      ds.id = 'oriupe-dark-css';
      ds.textContent = DARK_CSS;
      document.head.appendChild(ds);
    }
  }
  applyDark(localStorage.getItem('oriupe_dark') === '1');
  nav.querySelector('#on-dark-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyDark(!isDark);
    localStorage.setItem('oriupe_dark', isDark ? '0' : '1');
  });
}

init();
