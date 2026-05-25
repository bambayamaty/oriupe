import { requireSupabaseClient } from './supabase.js'

const ADMIN_LOGIN_URL = '/src/pages/admin/login.html'

// Comptes demo — fallback si Supabase auth échoue ou indisponible
const DEMO_ADMINS = {
  'admin@oriupe.com':       { pwd: 'Admin2025!',      role: 'super_admin', name: 'Super Admin' },
  'moderateur@oriupe.com':  { pwd: 'Moderateur2025!', role: 'moderator',   name: 'Modérateur' },
  'support@oriupe.com':     { pwd: 'Support2025!',    role: 'support',     name: 'Support' },
  'finance@oriupe.com':     { pwd: 'Finance2025!',    role: 'finance',     name: 'Finance' },
}
const DEMO_SESSION_KEY = 'oriupe_admin_demo_session'

function getDemoSession() {
  try {
    const s = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null')
    if (s && s.expiresAt > Date.now()) return s
    if (s) localStorage.removeItem(DEMO_SESSION_KEY)
  } catch {}
  return null
}

function setDemoSession(email, role, name) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({
    email, role, name, isDemo: true,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000 // 8h
  }))
}

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
  if (!next || !next.startsWith('/src/pages/admin/')) return ADMIN_ROUTES[role]
  return next
}

export async function signOutAdmin() {
  try { localStorage.removeItem('oriupe_admin_session') } catch (e) {}
  try { localStorage.removeItem(DEMO_SESSION_KEY) } catch (e) {}
  try { await requireSupabaseClient().auth.signOut() } catch (e) {}
  window.location.href = ADMIN_LOGIN_URL
}

export async function protectAdminPage({ allowedRoles = [] } = {}) {
  try { localStorage.removeItem('oriupe_admin_session') } catch (e) {}

  // 1. Vérifie la session demo en premier
  const demo = getDemoSession()
  if (demo) {
    if (!isRoleAllowed(demo.role, allowedRoles)) {
      localStorage.removeItem(DEMO_SESSION_KEY)
      window.location.replace(buildLoginUrl('role_forbidden'))
      return null
    }
    document.documentElement.classList.remove('admin-guard-pending')
    document.documentElement.dataset.adminRole = demo.role
    window.dispatchEvent(new CustomEvent('oriupe:admin-ready', {
      detail: { user: { email: demo.email, isDemo: true }, role: demo.role, name: demo.name }
    }))
    return { user: { email: demo.email, isDemo: true }, role: demo.role }
  }

  // 2. Fallback Supabase
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

  // 1. Comptes demo
  const demo = DEMO_ADMINS[emailLow]
  if (demo && password === demo.pwd) {
    setDemoSession(emailLow, demo.role, demo.name)
    return {
      user: { email: emailLow, isDemo: true },
      role: demo.role,
      redirectUrl: getSafeNext(demo.role),
    }
  }

  // 2. Authentification Supabase réelle
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
  // Vérifie session demo
  const demo = getDemoSession()
  if (demo?.role) {
    window.location.replace(getSafeNext(demo.role))
    return demo.role
  }

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
