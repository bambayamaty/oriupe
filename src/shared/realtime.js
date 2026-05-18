/* ═══════════════════════════════════════════════════════
   realtime.js — Mises à jour temps réel pour les dashboards
   Import: <script type="module" src="/src/shared/realtime.js"></script>
═══════════════════════════════════════════════════════ */

import { supabase } from '/src/shared/supabase.js'

// ── Helpers UI ────────────────────────────────────────────────────────────────

function fmtFCFA(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA'
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('oriupe_session') || 'null') } catch { return null }
}

function showToast(msg, type = 'info') {
  const colors = { success: '#27965D', error: '#DC2626', info: '#1B3A4A', warning: '#D97706' }
  const toast = document.createElement('div')
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${colors[type] || colors.info};color:#fff;
    padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;
    box-shadow:0 8px 32px rgba(15,37,53,.2);
    display:flex;align-items:center;gap:10px;max-width:340px;
    font-family:'Plus Jakarta Sans',sans-serif;
    animation:rtToastIn .35s cubic-bezier(.34,1.56,.64,1) both`
  toast.textContent = msg

  if (!document.getElementById('rt-toast-style')) {
    const s = document.createElement('style')
    s.id = 'rt-toast-style'
    s.textContent = `
      @keyframes rtToastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
      @keyframes rtToastOut{to{opacity:0;transform:translateX(30px)}}`
    document.head.appendChild(s)
  }

  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.animation = 'rtToastOut .3s ease forwards'
    setTimeout(() => toast.remove(), 350)
  }, 4000)
}

// ── Badge messagerie (FAB + topbar) ──────────────────────────────────────────

function updateUnreadBadge(count) {
  // FAB chat badge
  const fab = document.querySelector('.chat-fab-badge')
  if (fab) {
    fab.textContent = count > 0 ? (count > 99 ? '99+' : count) : ''
    fab.style.display = count > 0 ? 'flex' : 'none'
  }

  // Topbar notification dots
  document.querySelectorAll('.tb-notif-dot').forEach(dot => {
    dot.style.display = count > 0 ? 'block' : 'none'
  })

  // Met à jour la session locale
  const s = getSession()
  if (s) {
    s.unreadMessages = count
    localStorage.setItem('oriupe_session', JSON.stringify(s))
  }
}

// ── Bannière de notification dashboard ───────────────────────────────────────

function injectNotifBanner(message, type = 'info', panelTarget = null) {
  const overview = document.getElementById('panel-overview')
  if (!overview) return

  const colors = {
    info:    { bg: 'rgba(41,171,226,.08)', border: 'rgba(41,171,226,.25)', ico: '#29ABE2', arrow: '#29ABE2' },
    success: { bg: 'rgba(60,184,120,.08)', border: 'rgba(60,184,120,.25)', ico: '#3CB878', arrow: '#3CB878' },
    warning: { bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)', ico: '#F59E0B', arrow: '#F59E0B' },
    danger:  { bg: 'rgba(239,68,68,.08)',  border: 'rgba(239,68,68,.25)',  ico: '#EF4444', arrow: '#EF4444' },
  }
  const c = colors[type] || colors.info

  const existing = document.getElementById('rt-notif-banner')
  if (existing) existing.remove()

  const banner = document.createElement('div')
  banner.id = 'rt-notif-banner'
  banner.style.cssText = `
    display:flex;align-items:center;gap:12px;
    background:linear-gradient(90deg,${c.bg},#fff);
    border:1px solid ${c.border};border-radius:12px;
    padding:12px 14px;margin-bottom:16px;cursor:pointer;
    animation:rtToastIn .3s ease both`
  banner.innerHTML = `
    <div style="width:36px;height:36px;border-radius:10px;background:${c.ico};display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <div style="flex:1;font-size:12px;color:#1B3A4A">${message}</div>
    <span style="color:${c.arrow};font-size:16px;font-weight:700">›</span>`

  if (panelTarget && typeof window.showPanel === 'function') {
    banner.onclick = () => window.showPanel(panelTarget)
  }

  overview.insertAdjacentElement('afterbegin', banner)
}

// ── Mise à jour statut escrow dans le chat overlay ───────────────────────────

function updateChatEscrow(order) {
  const code   = document.getElementById('co-esc-code')
  const status = document.getElementById('co-esc-status')
  const total  = document.getElementById('co-esc-total')
  const secured = document.getElementById('co-esc-secured')
  const free   = document.getElementById('co-esc-free')

  if (code)    code.textContent = order.escrow_code
  if (total)   total.textContent = fmtFCFA(order.amount_total)
  if (secured) secured.textContent = fmtFCFA(order.amount_total)
  if (free)    free.textContent = fmtFCFA(order.amount_net || 0)

  if (status) {
    const labels = {
      AWAITING_PAYMENT: 'En attente',
      FUNDS_SECURED:    'Fonds sécurisés',
      IN_PROGRESS:      'En cours',
      DELIVERED:        'Livré',
      VALIDATED:        'Validé',
      TRANSFERRING:     'Virement en cours',
      COMPLETED:        'Clôturé',
      DISPUTED:         'Litige',
      CANCELLED:        'Annulé',
      REFUNDED:         'Remboursé',
    }
    const classes = {
      AWAITING_PAYMENT: 'esb-awaiting',
      FUNDS_SECURED:    'esb-secured',
      IN_PROGRESS:      'esb-progress',
      DELIVERED:        'esb-delivered',
      VALIDATED:        'esb-validated',
      TRANSFERRING:     'esb-transferring',
      COMPLETED:        'esb-completed',
    }
    status.textContent = labels[order.status] || order.status
    status.className = 'co-esc-status ' + (classes[order.status] || '')
  }
}

// ── Abonnements Supabase Realtime ─────────────────────────────────────────────

let _channels = []

function destroyChannels() {
  _channels.forEach(ch => supabase.removeChannel(ch))
  _channels = []
}

async function subscribeMessages(userId, role) {
  // Compter les messages non lus au démarrage
  const { count } = await supabase
    .from('collaboration_messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', userId)
    .is('read_at', null)

  if (count > 0) updateUnreadBadge(count)

  // Écouter les nouveaux messages en temps réel
  const ch = supabase.channel('rt-messages-' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'collaboration_messages',
      filter: `sender_id=neq.${userId}`
    }, async (payload) => {
      const msg = payload.new
      if (msg.sender_id === userId) return

      // Compter les non lus
      const { count: newCount } = await supabase
        .from('collaboration_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', userId)
        .is('read_at', null)

      updateUnreadBadge(newCount || 1)
      showToast('💬 Nouveau message reçu', 'info')
    })
    .subscribe()

  _channels.push(ch)
}

async function subscribeOrders(userId, role) {
  // Abonnement aux mises à jour de statut des commandes
  const ch = supabase.channel('rt-orders-' + userId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: role === 'client'
        ? `client_id=eq.${userId}`
        : `freelance_id=eq.${userId}`
    }, (payload) => {
      const order = payload.new
      const old   = payload.old

      if (order.status === old.status) return

      // Mettre à jour le bloc escrow dans le chat overlay si ouvert
      updateChatEscrow(order)

      // Notifications selon le statut et le rôle
      const notifs = {
        client: {
          FUNDS_SECURED:  { msg: '🔐 Paiement confirmé — fonds sécurisés dans l\'escrow', type: 'success', panel: 'escrow' },
          DELIVERED:      { msg: '📦 Livraison disponible — validez pour libérer les fonds', type: 'info', panel: 'orders' },
          COMPLETED:      { msg: '✅ Commande clôturée avec succès !', type: 'success', panel: 'payments' },
          DISPUTED:       { msg: '⚠️ Litige ouvert sur une commande', type: 'warning', panel: 'orders' },
          REFUNDED:       { msg: '💸 Remboursement effectué', type: 'info', panel: 'payments' },
        },
        freelance: {
          FUNDS_SECURED:  { msg: '🔐 Client a payé — fonds sécurisés. Démarrez les travaux !', type: 'success', panel: 'orders' },
          VALIDATED:      { msg: '✓ Livraison validée par le client — virement en cours', type: 'success', panel: 'revenue' },
          COMPLETED:      { msg: `✅ Virement reçu — ${fmtFCFA(order.amount_net)} dans votre compte`, type: 'success', panel: 'revenue' },
          DISPUTED:       { msg: '⚠️ Litige ouvert — un admin va intervenir', type: 'warning', panel: 'orders' },
        }
      }

      const n = notifs[role]?.[order.status]
      if (n) {
        showToast(n.msg, n.type)
        injectNotifBanner(n.msg, n.type, n.panel)
      }
    })
    .subscribe()

  _channels.push(ch)
}

// ── Simulation demo (sans vrai user Supabase) ─────────────────────────────────

function startDemoRealtime(role) {
  const s = getSession()
  if (!s) return

  const unread = s.unreadMessages || 0
  updateUnreadBadge(unread)

  // Simule un message entrant après 8 secondes (démo)
  const demoTimer = setTimeout(() => {
    const newUnread = unread + 1
    updateUnreadBadge(newUnread)
    const names = { client: 'Koffi Asante', freelance: 'Awa Mbaye' }
    showToast(`💬 ${names[role] || 'Contact'} : nouveau message`, 'info')
  }, 8000)

  // Simule une mise à jour escrow après 20 secondes (démo)
  const escrowTimer = setTimeout(() => {
    if (role === 'client') {
      injectNotifBanner(
        '<strong>Livraison disponible</strong> — Kofi a livré votre commande. Validez pour libérer les fonds.',
        'success',
        'orders'
      )
      showToast('📦 Nouvelle livraison reçue !', 'success')
    }
  }, 20000)

  return () => { clearTimeout(demoTimer); clearTimeout(escrowTimer) }
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

async function initRealtime() {
  const s = getSession()
  if (!s || !s.isLoggedIn) return

  const role = s.role || 'client'

  // Tenter de récupérer le vrai user Supabase
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Mode connecté → vrais abonnements Supabase
    await Promise.all([
      subscribeMessages(user.id, role),
      subscribeOrders(user.id, role),
    ])
    console.log('[Oriupe Realtime] Connecté pour', role, user.email)
  } else {
    // Mode démo → simulation
    startDemoRealtime(role)
    console.log('[Oriupe Realtime] Mode démo pour', role)
  }

  // Nettoyage à la fermeture de page
  window.addEventListener('beforeunload', destroyChannels)
}

// Auto-init au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRealtime)
} else {
  initRealtime()
}

export { initRealtime, updateUnreadBadge, showToast, injectNotifBanner, updateChatEscrow }
