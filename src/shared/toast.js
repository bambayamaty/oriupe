/**
 * toast.js — Système de notifications visuelles Oriupe
 * Remplace tous les alert() natifs.
 *
 * Usage:
 *   import { toast } from '/src/shared/toast.js'
 *   toast('Commande envoyée !', 'success')
 *   toast('Email invalide', 'error')
 *   toast('Vérifiez votre connexion', 'warning')
 *   toast('3 nouveaux messages', 'info')
 *
 * Ou via window.toast() si le script est chargé en module:
 *   window.toast('Message', 'success')
 */

const ICONS = {
  success: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
  error:   `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
  warning: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
  info:    `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
}

const TITLES = { success: 'Succès', error: 'Erreur', warning: 'Attention', info: 'Info' }

let _container = null

function _getContainer() {
  if (_container) return _container
  _container = document.getElementById('toast-container')
  if (!_container) {
    _container = document.createElement('div')
    _container.id = 'toast-container'
    document.body.appendChild(_container)
  }
  return _container
}

/**
 * @param {string} message   — texte du toast
 * @param {'success'|'error'|'warning'|'info'} type — défaut 'info'
 * @param {number} duration  — ms avant disparition (défaut 4000, 0 = permanent)
 * @param {string} [title]   — titre optionnel (remplace le titre par défaut)
 */
export function toast(message, type = 'info', duration = 4000, title = '') {
  const container = _getContainer()
  const t = type in ICONS ? type : 'info'
  const toastTitle = title || TITLES[t]

  const el = document.createElement('div')
  el.className = `toast toast-${t}`
  el.setAttribute('role', 'alert')
  el.setAttribute('aria-live', 'polite')

  el.innerHTML = `
    <div class="toast-icon">${ICONS[t]}</div>
    <div class="toast-body">
      <div class="toast-title">${toastTitle}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Fermer">×</button>
    ${duration > 0 ? `<div class="toast-progress" style="animation-duration:${duration}ms"></div>` : ''}
  `

  const close = () => {
    if (!el.parentNode) return
    el.classList.add('toast-leaving')
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }

  el.querySelector('.toast-close').addEventListener('click', close)
  if (duration > 0) setTimeout(close, duration)

  container.appendChild(el)
  return { close }
}

// Expose globalement pour les pages non-module
if (typeof window !== 'undefined') window.toast = toast

export default toast
