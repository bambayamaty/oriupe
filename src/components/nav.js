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
  height: 68px!important; display: flex!important; align-items: center!important;
  justify-content: space-between!important; padding: 0 48px!important;
  position: sticky!important; top: 0!important; z-index: 1000!important;
  box-sizing: border-box!important; width: 100%!important; left: 0!important; right: 0!important;
  font-family: 'Plus Jakarta Sans', sans-serif;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
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
#oriupe-nav[data-theme="light"]          { background: rgba(255,255,255,.97); border-bottom: 1px solid rgba(27,58,74,.1); box-shadow: 0 1px 0 rgba(27,58,74,.06); }
#oriupe-nav[data-theme="light"].on-scrolled { box-shadow: 0 4px 24px rgba(15,37,53,.11); }
#oriupe-nav[data-theme="dark"]           { background: rgba(10,22,34,.55); border-bottom: 1px solid rgba(255,255,255,.09); box-shadow: 0 1px 0 rgba(0,0,0,.18); }
#oriupe-nav[data-theme="dark"].on-scrolled  { box-shadow: 0 4px 28px rgba(0,0,0,.32); }
#oriupe-nav[data-theme="vivid"]          { background: rgba(255,255,255,.12); border-bottom: 1px solid rgba(255,255,255,.15); box-shadow: none; }
#oriupe-nav[data-theme="vivid"].on-scrolled { background: rgba(255,255,255,.18); box-shadow: 0 4px 24px rgba(0,0,0,.25); }

/* ── Logo ──────────────────────────────── */
#oriupe-nav .on-left  { display:flex; align-items:center; gap:36px; }
#oriupe-nav .on-logo  {
  display:flex; align-items:center; gap:10px; text-decoration:none;
  flex-shrink:0; cursor:pointer;
  transition: opacity .2s, transform .28s cubic-bezier(.34,1.56,.64,1);
}
#oriupe-nav .on-logo:hover { opacity:.82; transform:scale(1.04); }
#oriupe-nav .on-logo:hover svg { filter:drop-shadow(0 2px 10px rgba(60,184,120,.5)); }
#oriupe-nav .on-logo:focus-visible { outline:2px solid #3CB878; outline-offset:3px; border-radius:6px; }
#oriupe-nav .on-logo-t {
  font-family:'Bricolage Grotesque',sans-serif; font-size:22px; font-weight:800;
  letter-spacing:-.4px; line-height:1; transition:color .35s;
}
#oriupe-nav[data-theme="light"] .on-logo-t { color:#1B3A4A; }
#oriupe-nav[data-theme="dark"]  .on-logo-t,
#oriupe-nav[data-theme="vivid"] .on-logo-t,
#oriupe-nav.on-top .on-logo-t { color:#ffffff; }

/* ── Nav links ────────────────────────── */
#oriupe-nav .on-links { display:flex; gap:2px; align-items:center; position:static!important; top:auto!important; left:auto!important; right:auto!important; height:auto!important; background:none!important; border:none!important; box-shadow:none!important; padding:0!important; }
#oriupe-nav .on-links a { font-size:13px; font-weight:500; padding:7px 13px; border-radius:8px; text-decoration:none; white-space:nowrap; transition:color .25s, background .25s; }
#oriupe-nav[data-theme="light"] .on-links a           { color:rgba(27,58,74,.52); }
#oriupe-nav[data-theme="light"] .on-links a:hover     { color:#1B3A4A; background:#F4F6F9; }
#oriupe-nav[data-theme="light"] .on-links a.on-active { color:#3CB878; font-weight:700; background:rgba(60,184,120,.08); }
#oriupe-nav[data-theme="dark"]  .on-links a,
#oriupe-nav.on-top .on-links a  { color:rgba(255,255,255,.7); }
#oriupe-nav[data-theme="dark"]  .on-links a:hover,
#oriupe-nav.on-top .on-links a:hover { color:#fff; background:rgba(255,255,255,.1); }
#oriupe-nav[data-theme="dark"]  .on-links a.on-active { color:#8DC63F; font-weight:700; background:rgba(141,198,63,.12); }
#oriupe-nav[data-theme="vivid"] .on-links a           { color:rgba(255,255,255,.75); }
#oriupe-nav[data-theme="vivid"] .on-links a:hover     { color:#fff; background:rgba(255,255,255,.15); }
#oriupe-nav[data-theme="vivid"] .on-links a.on-active { color:#fff; font-weight:700; background:rgba(255,255,255,.2); }

/* ── Right slot ───────────────────────── */
#oriupe-nav .on-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
#oriupe-nav .on-ghost {
  font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:600;
  padding:8px 14px; border:none; border-radius:8px; cursor:pointer;
  transition:color .35s, background .35s;
}
#oriupe-nav[data-theme="light"] .on-ghost       { color:#1B3A4A; background:transparent; }
#oriupe-nav[data-theme="dark"]  .on-ghost,
#oriupe-nav.on-top .on-ghost,
#oriupe-nav[data-theme="vivid"] .on-ghost { color:#fff; background:transparent; }
#oriupe-nav[data-theme="light"] .on-ghost:hover { background:#F4F6F9; }
#oriupe-nav[data-theme="dark"]  .on-ghost:hover,
#oriupe-nav.on-top .on-ghost:hover { background:rgba(255,255,255,.1); }
#oriupe-nav[data-theme="vivid"] .on-ghost:hover { background:rgba(255,255,255,.15); }

#oriupe-nav .on-cta {
  font-family:'Plus Jakarta Sans',sans-serif; background:#3CB878; color:#fff;
  font-size:13px; font-weight:700; padding:10px 22px; border-radius:12px;
  border:none; box-shadow:0 2px 10px rgba(60,184,120,.3);
  transition:background .2s, transform .18s, box-shadow .18s; cursor:pointer;
}
#oriupe-nav .on-cta:hover { background:#27965D; transform:translateY(-1px); box-shadow:0 4px 16px rgba(60,184,120,.45); }
#oriupe-nav .on-dark-btn { padding:8px 10px; display:flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; }
#oriupe-nav .on-dark-btn:hover { background:rgba(255,255,255,.1); }

#oriupe-nav .on-account {
  display:flex; align-items:center; gap:8px; text-decoration:none;
  font-size:13px; font-weight:600; background:rgba(255,255,255,.1);
  border:1.5px solid rgba(255,255,255,.2); padding:6px 14px 6px 8px;
  border-radius:30px; transition:all .2s; color:rgba(255,255,255,.9);
}
#oriupe-nav .on-account:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.35); }
#oriupe-nav[data-theme="light"] .on-account { color:#1B3A4A; background:rgba(27,58,74,.07); border-color:rgba(27,58,74,.15); }
#oriupe-nav[data-theme="light"] .on-account:hover { background:rgba(27,58,74,.12); }
#oriupe-nav .on-account-av { width:26px; height:26px; border-radius:50%; background:#3CB878; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff; flex-shrink:0; }
#oriupe-nav .on-account-name { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ── Hamburger ────────────────────────── */
#oriupe-nav .on-hamburger {
  display:none; flex-direction:column; gap:5px; cursor:pointer;
  padding:8px; border:none; background:transparent; border-radius:8px;
  -webkit-tap-highlight-color:transparent; transition:opacity .2s;
}
#oriupe-nav .on-hamburger:hover { opacity:.7; }
#oriupe-nav .on-hamburger span {
  width:20px; height:2px; border-radius:2px; display:block;
  transition:transform .3s, opacity .3s, background .35s;
}
#oriupe-nav[data-theme="light"] .on-hamburger span { background:#1B3A4A; }
#oriupe-nav[data-theme="dark"] .on-hamburger span,
#oriupe-nav.on-top .on-hamburger span,
#oriupe-nav[data-theme="vivid"] .on-hamburger span { background:#ffffff; }
#oriupe-nav .on-hamburger.on-open span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
#oriupe-nav .on-hamburger.on-open span:nth-child(2) { opacity:0; transform:scaleX(0); }
#oriupe-nav .on-hamburger.on-open span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }

/* ── Mobile menu ──────────────────────── */
#oriupe-mob {
  display:none; position:fixed; top:68px; left:0; right:0;
  background:#fff; border-bottom:1px solid rgba(27,58,74,.09);
  padding:8px 20px 24px; z-index:999;
  box-shadow:0 12px 40px rgba(15,37,53,.12);
  flex-direction:column; opacity:0;
  transform:translateY(-10px); transition:opacity .25s, transform .25s;
  pointer-events:none;
}
#oriupe-mob.on-open { opacity:1; transform:none; pointer-events:auto; }
#oriupe-mob a {
  font-size:15px; font-weight:600; color:#1B3A4A;
  padding:13px 4px; border-bottom:1px solid rgba(27,58,74,.06);
  display:block; text-decoration:none; transition:color .2s, padding-left .2s;
}
#oriupe-mob a:last-of-type { border-bottom:none; }
#oriupe-mob a:hover, #oriupe-mob a.on-active { color:#3CB878; padding-left:6px; }
.on-mob-divider { height:1px; background:rgba(27,58,74,.07); margin:8px 0; }
.on-mob-btns { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.on-mob-login {
  width:100%; padding:13px; border:1.5px solid rgba(27,58,74,.18);
  border-radius:12px; background:transparent; font-size:14px; font-weight:600;
  color:#1B3A4A; cursor:pointer; transition:all .2s;
  font-family:'Plus Jakarta Sans',sans-serif;
}
.on-mob-login:hover { background:#F4F6F9; }
.on-mob-signup {
  width:100%; padding:14px; border:none; border-radius:12px;
  background:#3CB878; color:#fff; font-size:14px; font-weight:700;
  cursor:pointer; transition:background .2s, box-shadow .2s;
  font-family:'Plus Jakarta Sans',sans-serif;
  box-shadow:0 2px 12px rgba(60,184,120,.35);
}
.on-mob-signup:hover { background:#27965D; box-shadow:0 4px 16px rgba(60,184,120,.45); }

/* ── Responsive ───────────────────────── */
@media(max-width:1100px) { #oriupe-nav { padding:0 28px; } }
@media(max-width:768px) {
  #oriupe-nav { padding:0 16px; }
  #oriupe-nav .on-links,
  #oriupe-nav .on-ghost,
  #oriupe-nav .on-cta,
  #oriupe-nav .on-dark-btn { display:none; }
  #oriupe-nav .on-hamburger { display:flex; }
  #oriupe-mob { display:flex; }
}

/* ── Logo adaptive — deux versions selon le thème ─── */
#oriupe-nav .on-logo svg .lc1,
#oriupe-nav .on-logo svg .lc2,
#oriupe-nav .on-logo svg .lc3,
#oriupe-nav .on-logo svg .lc4,
#oriupe-nav .on-logo svg .lr  { transition: fill .32s ease, opacity .32s ease; }

/* Thème clair — logo couleurs Oriupe */
#oriupe-nav[data-theme="light"] .on-logo svg .lc1 { fill:#8DC63F; opacity:.9; }
#oriupe-nav[data-theme="light"] .on-logo svg .lc2 { fill:#29ABE2; opacity:.9; }
#oriupe-nav[data-theme="light"] .on-logo svg .lc3 { fill:#3CB878; opacity:.9; }
#oriupe-nav[data-theme="light"] .on-logo svg .lc4 { fill:#1B3A4A; }
#oriupe-nav[data-theme="light"] .on-logo svg .lr  { fill:rgba(60,184,120,.45); }

/* Thème sombre — logo blanc structuré */
#oriupe-nav[data-theme="dark"] .on-logo svg .lc1,
#oriupe-nav.on-top             .on-logo svg .lc1 { fill:rgba(255,255,255,.95); opacity:1; }
#oriupe-nav[data-theme="dark"] .on-logo svg .lc2,
#oriupe-nav.on-top             .on-logo svg .lc2 { fill:rgba(255,255,255,.72); opacity:1; }
#oriupe-nav[data-theme="dark"] .on-logo svg .lc3,
#oriupe-nav.on-top             .on-logo svg .lc3 { fill:rgba(255,255,255,.55); opacity:1; }
#oriupe-nav[data-theme="dark"] .on-logo svg .lc4,
#oriupe-nav.on-top             .on-logo svg .lc4 { fill:rgba(255,255,255,.22); }
#oriupe-nav[data-theme="dark"] .on-logo svg .lr,
#oriupe-nav.on-top             .on-logo svg .lr  { fill:rgba(255,255,255,.08); }

/* Thème vivid (fond vert/bleu saturé) — blanc doux */
#oriupe-nav[data-theme="vivid"] .on-logo svg .lc1 { fill:rgba(255,255,255,.92); opacity:1; }
#oriupe-nav[data-theme="vivid"] .on-logo svg .lc2 { fill:rgba(255,255,255,.68); opacity:1; }
#oriupe-nav[data-theme="vivid"] .on-logo svg .lc3 { fill:rgba(255,255,255,.52); opacity:1; }
#oriupe-nav[data-theme="vivid"] .on-logo svg .lc4 { fill:rgba(255,255,255,.18); }
#oriupe-nav[data-theme="vivid"] .on-logo svg .lr  { fill:rgba(255,255,255,.07); }
`;

/* ─── PAGES ──────────────────────────────────────── */
const PAGES = [
  { key:'home',    label:'Accueil',        href:'/src/pages/home/index.html'    },
  { key:'catalog', label:'Explorer',        href:'/src/pages/catalog/index.html' },
  { key:'offers',  label:"Appels d'offres", href:'/src/pages/offers/index.html'  },
  { key:'academy', label:'Academy',         href:'/src/pages/academy/index.html' },
  { key:'blog',    label:'Blog',            href:'/src/pages/blog/index.html'    },
];

const LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" role="img" aria-label="Logo Oriupe">
  <circle class="lc1" cx="10" cy="10" r="8.5" fill="#8DC63F" opacity=".9"/>
  <circle class="lc2" cx="22" cy="10" r="8.5" fill="#29ABE2" opacity=".9"/>
  <circle class="lc3" cx="10" cy="22" r="8.5" fill="#3CB878" opacity=".9"/>
  <circle class="lc4" cx="22" cy="22" r="8.5" fill="#1B3A4A"/>
  <rect   class="lr"  x="9.5" y="9.5" width="13" height="13" rx="1.5" fill="rgba(60,184,120,.45)"/>
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
    if (bgImg && bgImg!=='none') {
      const col = extractFirstColor(bgImg);
      if (col) {
        const rgb = parseRGB(col);
        if (rgb) {
          // Ignorer les dégradés décoratifs quasi-transparents (mesh, orbs)
          const aM = col.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)/);
          if (!aM || parseFloat(aM[1]) > 0.3) return rgb;
        }
      }
    }
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
  if (!rgb) return 'dark'; // Oriupe est majoritairement dark — fallback sûr
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
    while (node) {
      // Ignorer les éléments du système nav (mobile menu, progress bar)
      if (node.id !== 'oriupe-mob' && node.id !== 'progress') {
        const rgb = resolveBackground(node);
        if (rgb) return themeFromRGB(rgb);
      }
      node = node.nextElementSibling;
    }
    return 'dark';
  }
  const cx = Math.round(window.innerWidth/2);
  const navH = nav.offsetHeight||64;
  const stack = document.elementsFromPoint(cx, Math.round(navH/2));
  const el = stack.find(e=>!nav.contains(e)&&e!==document.documentElement);
  return themeFromRGB(el ? resolveBackground(el) : null);
}

/* ─── EXPLICIT SECTION THEMES ────────────────────── */
/*
 * Système prioritaire : data-nav-theme="dark|light|vivid" sur les <section>
 * prend le dessus sur la détection auto par calcul de luminance.
 * Lecture par position dans le document (offsetTop + offsetHeight).
 */
function getExplicitTheme(nav) {
  const sects = document.querySelectorAll('[data-nav-theme]');
  if (!sects.length) return null;
  const scrollY = window.scrollY;
  const navH    = nav.offsetHeight || 68;
  // Probe au bord bas de la nav — capture les sections qui démarrent
  // exactement à y=navH (cas fréquent : première section sous la nav sticky)
  const probe   = scrollY + navH;
  let best = null, bestTop = -Infinity;
  sects.forEach(s => {
    const rect = s.getBoundingClientRect();
    const top  = rect.top  + scrollY;
    const bot  = rect.bottom + scrollY;
    if (top <= probe && bot > scrollY) {
      if (top > bestTop) { bestTop = top; best = s.dataset.navTheme; }
    }
  });
  return best;
}

/* ─── INTERSECTION OBSERVER — transitions de section ─ */
/*
 * Déclenche un recalcul du thème dès qu'une section à data-nav-theme
 * franchit le bord bas de la nav (rootMargin négatif = zone de déclenchement
 * réduite au bandeau de la nav).
 */
function initSectionObserver(nav, onThemeChange) {
  const sects = document.querySelectorAll('[data-nav-theme]');
  if (!sects.length) return;
  const navH = nav.offsetHeight || 68;
  const io = new IntersectionObserver(
    () => requestAnimationFrame(onThemeChange),
    { rootMargin: `-${navH}px 0px 0px 0px`, threshold: [0, 0.02, 0.5, 1] }
  );
  sects.forEach(s => io.observe(s));
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

  // CTA contextuel selon le rôle (visible uniquement si connecté)
  const ctaSlot = loggedIn
    ? s.role === 'freelance'
      ? `<a href="/src/pages/create-service/index.html" class="on-cta" id="on-btn-create" style="display:flex;align-items:center;gap:7px;text-decoration:none">
           <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke="#fff" stroke-width="1.3"/><path d="M6.5 3.5V9.5M3.5 6.5H9.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>
           Créer un service
         </a>`
      : s.role === 'client'
      ? `<a href="/src/pages/publish-project/index.html" class="on-cta" id="on-btn-create" style="display:flex;align-items:center;gap:7px;text-decoration:none">
           <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2H11V9H7L5 11V9H2V2Z" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>
           Publier un projet
         </a>`
      : ''
    : '';

  return `
    <div class="on-left">
      <a class="on-logo" href="/src/pages/home/index.html" aria-label="Oriupe — Retour à l'accueil">
        ${LOGO_SVG}<span class="on-logo-t">Oriupe</span>
      </a>
      <div class="on-links" role="navigation" aria-label="Navigation principale">${links}</div>
    </div>
    <div class="on-right" id="on-right-slot">
      <button class="on-ghost on-dark-btn" id="on-dark-toggle" aria-label="Basculer mode sombre">
        <svg class="on-dark-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 10.5A6 6 0 017 4c0-.7.1-1.4.3-2.1A6.5 6.5 0 1014.1 10c-.2.2-.4.3-.6.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg class="on-dark-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
      ${ctaSlot}
      ${authSlot}
      <button class="on-hamburger" id="on-hamburger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="oriupe-mob">
        <span></span><span></span><span></span>
      </button>
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

  // Thème initial synchrone — évite le flash blanc au chargement.
  // On lit le premier [data-nav-theme] du document pour savoir si la page
  // commence sur fond sombre ou clair, sans attendre requestAnimationFrame.
  (function setInitialTheme() {
    const firstSect  = document.querySelector('[data-nav-theme]');
    const theme0     = firstSect ? firstSect.dataset.navTheme : 'dark';
    nav.setAttribute('data-theme', theme0);
    if (theme0 !== 'light' && window.scrollY < 8) nav.classList.add('on-top');
  })();

  /* ── Menu mobile ── */
  let mob = document.getElementById('oriupe-mob');
  if (!mob) {
    mob = document.createElement('div');
    mob.id = 'oriupe-mob';
    mob.setAttribute('aria-label', 'Menu mobile');
    document.body.insertBefore(mob, nav.nextSibling);
  }
  function buildMobHTML() {
    const s2 = getSession();
    const loggedIn2 = s2 && s2.isLoggedIn;
    const active2 = detectActive();
    const mobLinks = PAGES.map(p =>
      `<a href="${p.href}"${p.key===active2?' class="on-active"':''}>${p.label}</a>`
    ).join('');
    const mobAuth = loggedIn2
      ? `<a href="${s2.role==='freelance'?'/src/pages/dashboard/freelance/index.html':'/src/pages/dashboard/client/index.html'}" style="color:#3CB878;font-weight:700">
           Mon espace (${s2.firstName||'Compte'})
         </a>`
      : `<div class="on-mob-btns">
           <button class="on-mob-login" id="on-mob-login">Se connecter</button>
           <button class="on-mob-signup" id="on-mob-signup">S'inscrire gratuitement</button>
         </div>`;
    return mobLinks + '<div class="on-mob-divider"></div>' + mobAuth;
  }
  mob.innerHTML = buildMobHTML();

  function closeMob() {
    mob.classList.remove('on-open');
    const btn = nav.querySelector('#on-hamburger');
    if (btn) { btn.classList.remove('on-open'); btn.setAttribute('aria-expanded','false'); }
  }
  function openMob() {
    mob.innerHTML = buildMobHTML();
    mob.classList.add('on-open');
    const btn = nav.querySelector('#on-hamburger');
    if (btn) { btn.classList.add('on-open'); btn.setAttribute('aria-expanded','true'); }
    mob.querySelector('#on-mob-login')?.addEventListener('click', () => { window.location.href='/src/pages/auth/index.html'; });
    mob.querySelector('#on-mob-signup')?.addEventListener('click', () => { window.location.href='/src/pages/auth/index.html?register=1'; });
  }

  nav.querySelector('#on-hamburger')?.addEventListener('click', () => {
    mob.classList.contains('on-open') ? closeMob() : openMob();
  });
  mob.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMob));
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !mob.contains(e.target)) closeMob();
  });

  /* Boutons auth desktop (uniquement si non connecté) */
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

  /* Scroll + chameleon — thème explicite en priorité, auto-detect en fallback */
  function resolveTheme() {
    return getExplicitTheme(nav) || detectTheme(nav);
  }
  function applyThemeState() {
    const sy    = window.scrollY;
    const theme = resolveTheme();
    if (nav.dataset.theme !== theme) nav.setAttribute('data-theme', theme);
    // on-top = transparence totale : uniquement sur fonds sombres/vivid au sommet
    nav.classList.toggle('on-top',      sy < 8 && theme !== 'light');
    nav.classList.toggle('on-scrolled', sy > 6);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { applyThemeState(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, {passive:true});

  /* IntersectionObserver : recalcul instantané aux frontières de section */
  initSectionObserver(nav, applyThemeState);

  /* État initial */
  requestAnimationFrame(applyThemeState);

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
