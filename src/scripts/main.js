/**
 * Oriupe — Script principal partagé
 * Chargé sur toutes les pages via <script type="module" src="/src/scripts/main.js">
 * • Gestion auth (localStorage)
 * • Modales support (pied de page)
 * • Conversion devise
 */

/* ─── AUTH ───────────────────────────────────────── */
export function isLoggedIn() {
  try { return !!JSON.parse(localStorage.getItem('oriupe_user')); } catch { return false; }
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem('oriupe_user')); } catch { return null; }
}
export function goWithAuth(dest) {
  window.location.href = isLoggedIn()
    ? dest
    : '/src/pages/auth/index.html?next=' + encodeURIComponent(dest);
}

/* ─── TOAST ──────────────────────────────────────── */
export function showToast(message, type = 'success', duration = 3000) {
  if (!document.getElementById('on-toast-container')) {
    const s = document.createElement('style');
    s.textContent = `#on-toast-container{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.on-toast{background:#fff;border:1px solid rgba(27,58,74,.12);border-radius:12px;padding:13px 16px 13px 13px;display:flex;align-items:center;gap:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;color:#1B3A4A;box-shadow:0 8px 32px rgba(15,37,53,.16);pointer-events:all;max-width:340px;transform:translateX(120%);transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .3s;opacity:0}
.on-toast.on-show{transform:translateX(0);opacity:1}.on-toast.on-hide{transform:translateX(120%);opacity:0}
.on-ti{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.on-toast.success .on-ti{background:#E4F7EE}.on-toast.error .on-ti{background:#FEE2E2}.on-toast.info .on-ti{background:#E2F4FB}.on-toast.warning .on-ti{background:#FEF3C7}
.on-tm{flex:1;line-height:1.4}
.on-tc{width:18px;height:18px;background:none;border:none;cursor:pointer;opacity:.38;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:opacity .15s;flex-shrink:0;padding:0}
.on-tc:hover{opacity:.75}
html.dark .on-toast{background:#1A2B38;color:#E2EBF0;border-color:rgba(255,255,255,.08)}
@media(max-width:480px){#on-toast-container{bottom:16px;right:16px;left:16px}.on-toast{max-width:100%}}`;
    document.head.appendChild(s);
    const c = document.createElement('div'); c.id = 'on-toast-container'; document.body.appendChild(c);
  }
  const ICONS = {
    success:`<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5 9.5L11 3.5" stroke="#3CB878" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:  `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 2.5L10.5 10.5M10.5 2.5L2.5 10.5" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    info:   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="#29ABE2" stroke-width="1.5"/><path d="M6.5 6V9M6.5 4.5V5" stroke="#29ABE2" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    warning:`<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2L12 11H1L6.5 2Z" stroke="#F59E0B" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 5.5V7.5M6.5 9V9.2" stroke="#F59E0B" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  };
  const t = document.createElement('div');
  t.className = `on-toast ${type}`;
  t.innerHTML = `<div class="on-ti">${ICONS[type]||ICONS.success}</div><span class="on-tm">${message}</span><button class="on-tc" onclick="this.closest('.on-toast').classList.add('on-hide');setTimeout(()=>this.closest('.on-toast')?.remove(),350)"><svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 1L8 8M8 1L1 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`;
  document.getElementById('on-toast-container').appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('on-show')));
  setTimeout(()=>{t.classList.remove('on-show');t.classList.add('on-hide');setTimeout(()=>t.remove(),350);}, duration);
}
window.showToast = (m,t,d)=>showToast(m,t,d);

/* ─── SUPPORT MODALS ──────────────────────────────── */
function initSupportModals() {
  if (document.getElementById('on-support-overlay')) return;

  const style = document.createElement('style');
  style.textContent = `
#on-support-overlay{position:fixed;inset:0;z-index:20000;background:rgba(10,20,30,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:flex-end;opacity:0;pointer-events:none;transition:opacity .3s ease}
#on-support-overlay.on-open{opacity:1;pointer-events:all}
#on-support-panel{width:min(560px,100vw);height:100vh;background:#fff;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .38s cubic-bezier(.4,0,.2,1);box-shadow:-20px 0 60px rgba(10,20,30,.18)}
#on-support-overlay.on-open #on-support-panel{transform:translateX(0)}
#on-support-head{display:flex;align-items:center;justify-content:space-between;padding:22px 28px 18px;border-bottom:1px solid #F0F2F5;flex-shrink:0}
#on-support-title{font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:800;color:#1B3A4A;letter-spacing:-.3px}
#on-support-close{width:34px;height:34px;background:#F4F6F9;border:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}
#on-support-close:hover{background:#E5EBF0}
#on-support-body{flex:1;overflow-y:auto;padding:28px}
.sp-intro{font-size:14px;color:rgba(27,58,74,.6);line-height:1.7;margin-bottom:24px}
.sp-section{margin-bottom:28px}
.sp-section-title{font-size:11px;font-weight:700;color:rgba(27,58,74,.35);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:12px}
.sp-faq-item{border:1px solid #EEF1F5;border-radius:12px;overflow:hidden;margin-bottom:8px}
.sp-faq-q{width:100%;background:none;border:none;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;color:#1B3A4A;cursor:pointer;text-align:left;gap:12px}
.sp-faq-q:hover{background:#F8FAFB}
.sp-faq-icon{flex-shrink:0;width:22px;height:22px;background:#F0F7F4;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;color:#3CB878;font-size:16px;font-weight:700}
.sp-faq-item.open .sp-faq-icon{background:#3CB878;color:#fff;transform:rotate(45deg)}
.sp-faq-a{max-height:0;overflow:hidden;transition:max-height .3s ease;font-size:13px;color:rgba(27,58,74,.65);line-height:1.7}
.sp-faq-item.open .sp-faq-a{max-height:400px}
.sp-faq-a-inner{padding:0 16px 14px}
.sp-form .sp-field{margin-bottom:16px}
.sp-form label{display:block;font-size:12px;font-weight:600;color:#1B3A4A;margin-bottom:6px}
.sp-form input,.sp-form select,.sp-form textarea{width:100%;padding:11px 14px;border:1.5px solid #E5EBF0;border-radius:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#1B3A4A;outline:none;transition:border-color .2s;box-sizing:border-box}
.sp-form input:focus,.sp-form select:focus,.sp-form textarea:focus{border-color:#3CB878}
.sp-form textarea{resize:vertical;min-height:110px}
.sp-submit{width:100%;padding:13px;background:#3CB878;color:#fff;border:none;border-radius:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s,transform .2s;margin-top:4px}
.sp-submit:hover{background:#27965D;transform:translateY(-1px)}
.sp-step{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #F0F2F5}
.sp-step:last-child{border-bottom:none}
.sp-step-num{width:32px;height:32px;background:#E8F8F1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#3CB878;flex-shrink:0}
.sp-step-title{font-size:13px;font-weight:700;color:#1B3A4A;margin-bottom:4px}
.sp-step-desc{font-size:13px;color:rgba(27,58,74,.6);line-height:1.6}
.sp-legal-section{margin-bottom:22px}
.sp-legal-h{font-size:14px;font-weight:700;color:#1B3A4A;margin-bottom:8px}
.sp-legal-p{font-size:13px;color:rgba(27,58,74,.65);line-height:1.7}
.sp-success-msg{display:none;text-align:center;padding:32px 20px}
.sp-success-msg.show{display:block}
@media(max-width:640px){#on-support-overlay{align-items:flex-end;justify-content:stretch}#on-support-panel{width:100%;height:88vh;border-radius:20px 20px 0 0;transform:translateY(100%)}#on-support-overlay.on-open #on-support-panel{transform:translateY(0)}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'on-support-overlay';
  overlay.innerHTML = `
    <div id="on-support-panel" role="dialog" aria-modal="true">
      <div id="on-support-head">
        <span id="on-support-title"></span>
        <button id="on-support-close" aria-label="Fermer">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="#1B3A4A" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div id="on-support-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  function faqItem(q, a) {
    return `<div class="sp-faq-item">
      <button class="sp-faq-q" onclick="this.closest('.sp-faq-item').classList.toggle('open')">${q}<span class="sp-faq-icon">+</span></button>
      <div class="sp-faq-a"><div class="sp-faq-a-inner">${a}</div></div>
    </div>`;
  }

  const CONTENT = {
    aide: {
      title: "Centre d'aide",
      html: `<p class="sp-intro">Les réponses aux questions les plus fréquentes.</p>
        <div class="sp-section"><div class="sp-section-title">Compte & Inscription</div>
          ${faqItem("Comment créer un compte ?","Cliquez sur « S'inscrire », choisissez votre rôle (Client ou Freelance), renseignez votre email et créez un mot de passe. Vérification en moins de 2 minutes.")}
          ${faqItem("J'ai oublié mon mot de passe.","Cliquez sur « Se connecter » puis « Mot de passe oublié ». Entrez votre email pour recevoir un lien valable 30 minutes.")}
          ${faqItem("Comment modifier mon profil ?","Tableau de bord → icône profil → « Modifier le profil ».")}
        </div>
        <div class="sp-section"><div class="sp-section-title">Commandes & Paiement</div>
          ${faqItem("Comment passer une commande ?","Trouvez un service, cliquez sur la carte, sélectionnez le pack et confirmez. Le paiement est sécurisé par notre système Escrow.")}
          ${faqItem("Quels modes de paiement ?","Mobile Money (Orange Money, Wave, MTN MoMo), cartes Visa/Mastercard, virement SEPA (Europe).")}
          ${faqItem("Qu'est-ce que le paiement Escrow ?","Oriupe conserve votre paiement jusqu'à validation de la livraison. Le freelance est payé après votre approbation.")}
        </div>
        <div class="sp-section"><div class="sp-section-title">Livraisons & Révisions</div>
          ${faqItem("Que faire si la livraison ne convient pas ?","Vous avez 72h après réception pour demander une révision ou ouvrir un litige.")}
        </div>`
    },
    contacter: {
      title: 'Nous contacter',
      html: `<p class="sp-intro">Notre équipe répond sous <strong>24h ouvrées</strong>.</p>
        <div id="sp-contact-form" class="sp-form">
          <div class="sp-field"><label>Nom complet *</label><input type="text" id="sp-name" placeholder="Votre nom"></div>
          <div class="sp-field"><label>Adresse email *</label><input type="email" id="sp-email" placeholder="votre@email.com"></div>
          <div class="sp-field"><label>Sujet</label>
            <select id="sp-subject">
              <option>-- Sélectionner --</option>
              <option>Problème avec une commande</option>
              <option>Question sur les paiements</option>
              <option>Problème technique</option>
              <option>Signaler un abus</option>
              <option>Partenariat</option>
              <option>Autre</option>
            </select>
          </div>
          <div class="sp-field"><label>Message *</label><textarea id="sp-message" placeholder="Décrivez votre question en détail..."></textarea></div>
          <button class="sp-submit" onclick="window.onSupportFormSubmit()">Envoyer le message</button>
        </div>
        <div id="sp-contact-success" class="sp-success-msg">
          <p style="font-size:16px;font-weight:700;color:#1B3A4A;margin-bottom:8px">Message envoyé !</p>
          <p style="font-size:14px;color:rgba(27,58,74,.6)">Notre équipe vous répond sous 24h ouvrées.</p>
        </div>`
    },
    litiges: {
      title: 'Gestion des litiges',
      html: `<p class="sp-intro">Un problème avec une commande ? Notre processus est rapide et équitable.</p>
        <div class="sp-section">
          ${[
            ['Ouvrir un litige','Rendez-vous dans votre commande → « Ouvrir un litige ». Décrivez le problème et joignez des preuves. Délai : 72h après chaque livraison.'],
            ['Communication entre parties','Les deux parties disposent de 48h pour trouver un accord amiable via la messagerie intégrée.'],
            ['Médiation Oriupe','Si pas d\'accord, notre équipe examine les échanges et livrables. Délai : 3 à 5 jours ouvrés.'],
            ['Décision finale','Oriupe rend une décision : remboursement total, partiel, ou validation de la livraison.'],
          ].map(([t,d],i)=>`<div class="sp-step"><div class="sp-step-num">${i+1}</div><div><div class="sp-step-title">${t}</div><div class="sp-step-desc">${d}</div></div></div>`).join('')}
        </div>`
    },
    cgu: {
      title: 'CGU & CGV',
      html: `<p class="sp-intro">Conditions régissant l'utilisation d'Oriupe et les transactions.</p>
        ${[
          ['1. Objet','Oriupe est une plateforme de mise en relation entre clients et freelances africains. Les présentes conditions s\'appliquent à tout utilisateur inscrit.'],
          ['2. Inscription','L\'inscription est gratuite. L\'utilisateur s\'engage à fournir des informations exactes. Oriupe peut suspendre tout compte frauduleux.'],
          ['3. Paiements','Toute commande est soumise à un paiement Escrow sécurisé. Les fonds sont libérés à validation de la livraison. La commission Oriupe est prélevée au décaissement.'],
          ['4. Propriété intellectuelle','À validation, le client obtient une licence d\'utilisation commerciale complète sur les livrables.'],
          ['5. Responsabilité','Oriupe est intermédiaire et ne peut être tenu responsable de la qualité des livrables au-delà de son processus de médiation.'],
          ['6. Droit applicable','Régi par le droit de la République de Côte d\'Ivoire. Litiges non résolus : tribunaux d\'Abidjan.'],
        ].map(([h,p])=>`<div class="sp-legal-section"><div class="sp-legal-h">${h}</div><p class="sp-legal-p">${p}</p></div>`).join('')}
        <p style="font-size:12px;color:rgba(27,58,74,.4);margin-top:16px">Dernière mise à jour : Janvier 2025</p>`
    },
    confidentialite: {
      title: 'Politique de confidentialité',
      html: `<p class="sp-intro">Oriupe protège vos données conformément au RGPD.</p>
        ${[
          ['Données collectées','Nom, email, téléphone, IP, historique des transactions. Les données de paiement sont traitées par nos partenaires certifiés PCI-DSS.'],
          ['Finalité','Gestion de compte, traitement des commandes, amélioration des services, prévention de la fraude.'],
          ['Conservation','Durée du compte + 3 ans pour obligations légales. Suppression possible à tout moment.'],
          ['Vos droits','Accès, rectification, effacement, portabilité, opposition. Contactez privacy@oriupe.com. Réponse sous 30 jours.'],
          ['Cookies','Cookies essentiels (session, sécurité) et analytiques anonymisés. Aucun cookie publicitaire tiers sans consentement.'],
        ].map(([h,p])=>`<div class="sp-legal-section"><div class="sp-legal-h">${h}</div><p class="sp-legal-p">${p}</p></div>`).join('')}
        <p style="font-size:12px;color:rgba(27,58,74,.4);margin-top:16px">Dernière mise à jour : Mars 2025 — Conforme RGPD</p>`
    },
    cookies: {
      title: 'Politique cookies',
      html: `<p class="sp-intro">Nous utilisons des cookies pour faire fonctionner la plateforme.</p>
        ${[
          ['Cookies essentiels','Session de connexion, panier, préférences devise/langue. Ne peuvent pas être désactivés.'],
          ['Cookies analytiques','Mesure d\'audience anonymisée. Outil sans traçage cross-site.'],
          ['Cookies de préférence','Mémorisent vos choix : filtres, historique de navigation.'],
        ].map(([h,p])=>`<div class="sp-legal-section"><div class="sp-legal-h">${h}</div><p class="sp-legal-p">${p}</p></div>`).join('')}
        <button class="sp-submit" style="background:#E53935;margin-top:8px" onclick="localStorage.clear();sessionStorage.clear();document.getElementById('on-support-overlay').classList.remove('on-open');document.body.style.overflow='';alert('Données locales effacées.')">Effacer mes cookies</button>`
    },
  };

  window.onSupportFormSubmit = function() {
    const name  = document.getElementById('sp-name')?.value.trim();
    const email = document.getElementById('sp-email')?.value.trim();
    const msg   = document.getElementById('sp-message')?.value.trim();
    if (!name||!email||!msg) { alert('Merci de remplir les champs obligatoires.'); return; }
    document.getElementById('sp-contact-form').style.display = 'none';
    document.getElementById('sp-contact-success').classList.add('show');
  };

  function openSupport(key) {
    const c = CONTENT[key]; if (!c) return;
    document.getElementById('on-support-title').textContent = c.title;
    document.getElementById('on-support-body').innerHTML = c.html;
    overlay.classList.add('on-open');
    document.body.style.overflow = 'hidden';
  }
  function closeSupport() { overlay.classList.remove('on-open'); document.body.style.overflow=''; }

  document.getElementById('on-support-close').addEventListener('click', closeSupport);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeSupport(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeSupport(); });

  const MAP = {
    "Centre d'aide":'aide', "Nous contacter":'contacter', "Gestion des litiges":'litiges',
    "CGU & CGV":'cgu', "CGV":'cgu', "Confidentialité":'confidentialite', "Cookies":'cookies',
  };
  document.querySelectorAll('footer a').forEach(a=>{
    const key = MAP[a.textContent.trim()];
    if (key) {
      a.style.cursor='pointer';
      a.removeAttribute('href');
      a.addEventListener('click', e=>{ e.preventDefault(); openSupport(key); });
    }
  });
}

/* ─── INIT ───────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initSupportModals();

  /* Back to top */
  if (!document.getElementById('on-btt')) {
    const bs = document.createElement('style');
    bs.textContent = `#on-btt{position:fixed;bottom:88px;left:24px;width:42px;height:42px;background:#3CB878;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(60,184,120,.35);opacity:0;transform:translateY(14px) scale(.85);transition:opacity .3s,transform .3s;pointer-events:none;z-index:8999}#on-btt.on-show{opacity:1;transform:translateY(0) scale(1);pointer-events:all}#on-btt:hover{transform:translateY(-3px) scale(1);box-shadow:0 8px 24px rgba(60,184,120,.45)}@media(max-width:768px){#on-btt{bottom:100px;left:16px}}`;
    document.head.appendChild(bs);
    const btt = document.createElement('button');
    btt.id = 'on-btt'; btt.setAttribute('aria-label','Retour en haut');
    btt.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 10L8 5L13 10" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(btt);
    btt.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
    window.addEventListener('scroll', ()=>btt.classList.toggle('on-show', window.scrollY>400), {passive:true});
  }

  /* Newsletter toast */
  document.querySelectorAll('.btn-nl, .nl-btn, [class*="newsletter"] button').forEach(btn => {
    if (btn.dataset.toastWired) return;
    btn.dataset.toastWired = '1';
    btn.addEventListener('click', () => {
      const inp = btn.closest('section,div,form')?.querySelector('input[type=email],.nl-inp');
      if (inp?.value?.includes('@')) {
        showToast('Inscription confirmée ! Bienvenue dans la communauté Oriupe.', 'success');
        inp.value = '';
      } else {
        showToast('Veuillez entrer une adresse email valide.', 'error', 2500);
      }
    });
  });

  /* Fav toast */
  document.querySelectorAll('.svc-fav, .fav-btn').forEach(btn => {
    if (btn.dataset.toastWired) return;
    btn.dataset.toastWired = '1';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willAdd = !btn.classList.contains('active') && !btn.classList.contains('faved');
      if (willAdd) showToast('Ajouté aux favoris', 'success', 2000);
    });
  });
});
