import { requireSupabaseClient } from './supabase.js'

const ADMIN_LOGIN_URL = '/src/pages/admin/login.html'

export const ADMIN_ROUTES = {
  super_admin: '/src/pages/admin/index.html',
  admin: '/src/pages/admin/index.html',
  moderator: '/src/pages/admin/moderateur.html',
  support: '/src/pages/admin/support.html',
  finance: '/src/pages/admin/finance.html',
}

const ADMIN_ROLE_SET = new Set(Object.keys(ADMIN_ROUTES))
const ROLE_ALIASES = {
  'super-admin': 'super_admin',
  superadmin: 'super_admin',
  owner: 'super_admin',
  moderateur: 'moderator',
  moderator: 'moderator',
  support: 'support',
  finance: 'finance',
  admin: 'admin',
  super_admin: 'super_admin',
}

function normalizeRole(role) {
  if (!role) return null
  return ROLE_ALIASES[String(role).trim().toLowerCase()] || null
}

function getAllowedAdminRoles(user) {
  const meta = user?.app_metadata || {}
  const candidates = [
    meta.oriupe_role,
    meta.app_role,
    meta.role,
    ...(Array.isArray(meta.roles) ? meta.roles : []),
  ]
  return candidates.map(normalizeRole).filter(Boolean)
}

export function getAdminRole(user) {
  const roles = getAllowedAdminRoles(user)
  return roles.find(role => ADMIN_ROLE_SET.has(role)) || null
}

export function isRoleAllowed(role, allowedRoles = []) {
  if (!role) return false
  if (!allowedRoles.length) return ADMIN_ROLE_SET.has(role)
  return allowedRoles.includes(role)
}

function buildLoginUrl(reason = 'auth_required') {
  const url = new URL(ADMIN_LOGIN_URL, window.location.origin)
  const current = `${window.location.pathname}${window.location.search}`
  if (current !== ADMIN_LOGIN_URL) url.searchParams.set('next', current)
  url.searchParams.set('reason', reason)
  return url.pathname + url.search
}

function getSafeNext(role) {
  const next = new URLSearchParams(window.location.search).get('next')
  if (!next || !next.startsWith('/src/pages/admin/') || next.includes('login')) return ADMIN_ROUTES[role]
  return next
}

export async function signOutAdmin() {
  try { localStorage.removeItem('oriupe_admin_session') } catch (e) {}
  try { await requireSupabaseClient().auth.signOut() } catch (e) {}
  window.location.href = ADMIN_LOGIN_URL
}

export async function protectAdminPage({ allowedRoles = [] } = {}) {
  try { localStorage.removeItem('oriupe_admin_session') } catch (e) {}

  let client
  try {
    client = requireSupabaseClient()
  } catch (e) {
    window.location.replace(buildLoginUrl('config_missing'))
    return null
  }

  const { data, error } = await client.auth.getSession()
  const user = data?.session?.user

  if (error || !user) {
    window.location.replace(buildLoginUrl('auth_required'))
    return null
  }

  const role = getAdminRole(user)
  if (!isRoleAllowed(role, allowedRoles)) {
    await client.auth.signOut()
    window.location.replace(buildLoginUrl(role ? 'role_forbidden' : 'role_missing'))
    return null
  }

  document.documentElement.classList.remove('admin-guard-pending')
  document.documentElement.dataset.adminRole = role
  window.dispatchEvent(new CustomEvent('oriupe:admin-ready', { detail: { user, role } }))
  return { user, role }
}

export async function loginAdmin({ email, password }) {
  try { localStorage.removeItem('oriupe_admin_session') } catch (e) {}

  const emailLow = (email || '').trim().toLowerCase()

  let client
  try { client = requireSupabaseClient() } catch (e) {
    throw new Error('Configuration Supabase manquante.')
  }

  const { data, error } = await client.auth.signInWithPassword({ email: emailLow, password })
  if (error || !data?.user) {
    throw new Error('Identifiants admin invalides.')
  }

  const role = getAdminRole(data.user)
  if (!role) {
    await client.auth.signOut()
    throw new Error('Compte connecté, mais aucun rôle admin valide n\'est attaché.')
  }

  return {
    user: data.user,
    role,
    redirectUrl: getSafeNext(role),
  }
}

export async function redirectIfAdminSession() {
  let client
  try {
    client = requireSupabaseClient()
  } catch (e) {
    return null
  }

  const { data } = await client.auth.getSession()
  const user = data?.session?.user
  const role = getAdminRole(user)
  if (role) window.location.replace(getSafeNext(role))
  return role
}

window.OriupeAdminAuth = {
  loginAdmin,
  protectAdminPage,
  redirectIfAdminSession,
  signOutAdmin,
}
