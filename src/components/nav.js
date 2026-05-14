/**
 * Oriupe — Navigation partagée
 * • Remplace le <nav> existant sur toutes les pages
 * • Chameleon : adapte ses couleurs selon la section en dessous
 * • Transparent au sommet de la page, opaque au défilement
 * • Intègre le widget devise (currency.js)
 */

import { initCurrency, buildCurrencyWidget } from './currency.js';

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
  return `
    <div class="on-left">
      <a class="on-logo" href="/src/pages/home/index.html" aria-label="Oriupe — Accueil">
        ${LOGO_SVG}<span class="on-logo-t">Oriupe</span>
      </a>
      <div class="on-links">${links}</div>
    </div>
    <div class="on-right" id="on-right-slot">
      <button class="on-ghost" id="on-btn-login">Se connecter</button>
      <button class="on-cta"   id="on-btn-signup">S'inscrire</button>
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

  /* Boutons auth */
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
}

init();
