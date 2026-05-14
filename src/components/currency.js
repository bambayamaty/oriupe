/**
 * Oriupe — Module Devise
 * • Détecte le pays via IP → choisit XOF/EUR/USD
 * • Taux live via frankfurter.app (cache sessionStorage)
 * • Dispatch 'oriupe:currency' quand la devise change
 */

export const CURRENCIES = [
  { code:'XOF', symbol:'FCFA', name:'Franc CFA',  flag:'🌍' },
  { code:'EUR', symbol:'€',    name:'Euro',        flag:'🇪🇺' },
  { code:'USD', symbol:'$',    name:'Dollar US',   flag:'🇺🇸' },
];

const COUNTRY_MAP = {
  BJ:'XOF',BF:'XOF',CI:'XOF',GW:'XOF',ML:'XOF',NE:'XOF',SN:'XOF',TG:'XOF',GN:'XOF',
  FR:'EUR',DE:'EUR',ES:'EUR',IT:'EUR',BE:'EUR',NL:'EUR',PT:'EUR',AT:'EUR',GR:'EUR',FI:'EUR',IE:'EUR',LU:'EUR',
};

const FALLBACK_RATES = { USD:1, EUR:0.92, GBP:0.79, XOF:605 };

let _rates = null;
let _current = null;
const LS_KEY = 'oriupe_currency';

async function fetchRates() {
  const CACHE_KEY = 'oriupe_fx';
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) { try { _rates = JSON.parse(cached); return; } catch {} }
  try {
    const res  = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,XOF', {cache:'default'});
    const json = await res.json();
    _rates = { USD:1, ...json.rates };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(_rates));
  } catch { _rates = FALLBACK_RATES; }
}

export function convertFromUSD(amountUSD, targetCode) {
  if (!_rates) return amountUSD;
  return amountUSD * (_rates[targetCode] ?? 1);
}

export function formatAmount(amountUSD, currencyCode) {
  const cur    = CURRENCIES.find(c=>c.code===currencyCode) ?? CURRENCIES[0];
  const amount = convertFromUSD(amountUSD, currencyCode);
  const opts   = { minimumFractionDigits:currencyCode==='XOF'?0:2, maximumFractionDigits:currencyCode==='XOF'?0:2 };
  return `${new Intl.NumberFormat('fr-FR', opts).format(amount)} ${cur.symbol}`;
}

export function getCurrentCode()     { return _current; }
export function getCurrencyByCode(c) { return CURRENCIES.find(x=>x.code===c) ?? CURRENCIES[0]; }

function emit(code) {
  window.dispatchEvent(new CustomEvent('oriupe:currency', { detail:{ code, rates:_rates||FALLBACK_RATES } }));
}

export function setCurrency(code) {
  _current = code;
  localStorage.setItem(LS_KEY, code);
  emit(code);
}

async function detectCountry() {
  const cached = sessionStorage.getItem('oriupe_country');
  if (cached) return cached;
  try {
    const res  = await fetch('https://ipapi.co/country/', {cache:'default'});
    const code = (await res.text()).trim().slice(0,2).toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) { sessionStorage.setItem('oriupe_country',code); return code; }
  } catch {}
  return null;
}

export async function initCurrency() {
  await fetchRates();
  const saved = localStorage.getItem(LS_KEY);
  if (saved && CURRENCIES.find(c=>c.code===saved)) { _current=saved; emit(saved); return saved; }
  const country  = await detectCountry();
  const detected = (country && COUNTRY_MAP[country]) ?? 'XOF';
  _current = detected;
  emit(detected);
  return detected;
}

/* ─── DROPDOWN UI ─── */
const DROPDOWN_CSS = `
#on-currency-wrapper { position:relative; display:inline-flex; }
#on-currency-btn {
  font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; font-weight:700;
  padding:5px 10px 5px 8px; border-radius:8px; cursor:pointer; border:1px solid;
  display:flex; align-items:center; gap:5px; white-space:nowrap;
  transition:color .35s, background .35s, border-color .35s; background:transparent; outline:none;
}
#oriupe-nav[data-theme="light"]  #on-currency-btn { color:rgba(27,58,74,.65);   background:#F4F6F9;              border-color:rgba(27,58,74,.12); }
#oriupe-nav[data-theme="dark"]   #on-currency-btn { color:rgba(255,255,255,.82); background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.18); }
#oriupe-nav[data-theme="vivid"]  #on-currency-btn { color:rgba(255,255,255,.88); background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25); }
#oriupe-nav.on-top               #on-currency-btn { color:rgba(255,255,255,.82); background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.18); }
#on-currency-btn:hover { opacity:.82; }
#on-currency-dropdown {
  position:absolute; top:calc(100% + 8px); right:0; background:#fff;
  border:1px solid rgba(27,58,74,.08); border-radius:16px;
  box-shadow:0 20px 56px rgba(15,37,53,.2),0 2px 8px rgba(15,37,53,.06);
  width:252px; z-index:9999; display:none; overflow:hidden;
  animation:on-drop-in .18s cubic-bezier(.34,1.56,.64,1);
}
#on-currency-dropdown.on-open { display:block; }
@keyframes on-drop-in { from{opacity:0;transform:translateY(-6px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
.on-drop-head { padding:12px 14px 10px; font-size:10px; font-weight:700; color:rgba(27,58,74,.38); letter-spacing:.9px; text-transform:uppercase; border-bottom:1px solid rgba(27,58,74,.06); }
.on-cur-grid  { display:grid; grid-template-columns:repeat(3,1fr); padding:10px; gap:8px; }
.on-cur-card  { display:flex; flex-direction:column; align-items:center; gap:5px; padding:14px 6px 12px; border-radius:10px; border:2px solid rgba(27,58,74,.07); background:#F8FAFB; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:border-color .2s,background .2s,transform .18s cubic-bezier(.34,1.56,.64,1); position:relative; }
.on-cur-card:hover { background:#EEF9F4; border-color:rgba(60,184,120,.3); transform:translateY(-2px); }
.on-cur-card.on-sel { background:#E8F8F1; border-color:#3CB878; }
.on-cur-flag { font-size:22px; line-height:1; }
.on-cur-sym  { font-size:15px; font-weight:800; color:#1B3A4A; line-height:1; }
.on-cur-name { font-size:10px; color:rgba(27,58,74,.48); text-align:center; line-height:1.2; }
.on-cur-tick { position:absolute; top:5px; right:5px; opacity:0; transition:opacity .15s; }
.on-cur-card.on-sel .on-cur-tick { opacity:1; }
.on-rates-bar { border-top:1px solid rgba(27,58,74,.06); padding:8px 14px; display:flex; justify-content:space-between; font-size:10px; color:rgba(27,58,74,.38); font-family:'Plus Jakarta Sans',sans-serif; }
`;

let _dropdownStyle = null;

export function buildCurrencyWidget() {
  if (!_dropdownStyle) {
    _dropdownStyle = document.createElement('style');
    _dropdownStyle.id = 'oriupe-currency-css';
    _dropdownStyle.textContent = DROPDOWN_CSS;
    document.head.appendChild(_dropdownStyle);
  }

  const wrapper  = document.createElement('div');
  wrapper.id     = 'on-currency-wrapper';
  const btn      = document.createElement('button');
  btn.id         = 'on-currency-btn'; btn.type = 'button';
  const dropdown = document.createElement('div');
  dropdown.id    = 'on-currency-dropdown';

  function renderBtn(code) {
    const cur = getCurrencyByCode(code);
    btn.innerHTML = `${cur.flag} <span style="font-weight:800">${cur.symbol}</span> <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  }

  function renderDropdown(activeCode) {
    const r = _rates||FALLBACK_RATES;
    const xofUsd = Math.round(r.XOF??605);
    const xofEur = Math.round((r.XOF??605)/(r.EUR??0.92));
    dropdown.innerHTML =
      `<div class="on-drop-head">Devise d'affichage</div><div class="on-cur-grid">` +
      CURRENCIES.map(c=>`
        <div class="on-cur-card${c.code===activeCode?' on-sel':''}" data-code="${c.code}" role="button" tabindex="0">
          <span class="on-cur-flag">${c.flag}</span>
          <span class="on-cur-sym">${c.symbol}</span>
          <span class="on-cur-name">${c.name}</span>
          <svg class="on-cur-tick" width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="#3CB878" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>`).join('') +
      `</div><div class="on-rates-bar"><span>1 USD = ${xofUsd} FCFA</span><span>1 EUR ≈ ${xofEur} FCFA</span></div>`;
    dropdown.querySelectorAll('.on-cur-card').forEach(el=>{
      el.addEventListener('click',()=>{ setCurrency(el.dataset.code); renderBtn(el.dataset.code); renderDropdown(el.dataset.code); close(); });
    });
  }

  function open()   { dropdown.classList.add('on-open');    btn.setAttribute('aria-expanded','true');  }
  function close()  { dropdown.classList.remove('on-open'); btn.setAttribute('aria-expanded','false'); }
  function toggle() { dropdown.classList.contains('on-open') ? close() : open(); }

  btn.addEventListener('click', e=>{ e.stopPropagation(); toggle(); });
  document.addEventListener('click', e=>{ if(!wrapper.contains(e.target)) close(); });
  window.addEventListener('oriupe:currency', e=>{ renderBtn(e.detail.code); renderDropdown(e.detail.code); });

  const initial = _current??'XOF';
  renderBtn(initial); renderDropdown(initial);
  wrapper.appendChild(btn); wrapper.appendChild(dropdown);
  return wrapper;
}
