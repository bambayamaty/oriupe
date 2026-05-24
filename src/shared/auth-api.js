/**
 * auth-api.js — Authentification Oriupe
 * Encapsule Supabase Auth + synchronisation oriupe_session
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

const SESSION_KEY = 'oriupe_session'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000

// ── Helpers session localStorage ────────────────────────────────────

function _writeLocalSession(data) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...data,
      isLoggedIn: true,
      expiresAt: Date.now() + SESSION_TTL,
      sessionCreatedAt: data.sessionCreatedAt || Date.now()
    }))
  } catch (e) {}
}

function _clearLocalSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch (e) {}
}

// ── Construire la session locale depuis un profil Supabase ───────────

function _buildSessionFromProfile(profile, freelanceProfile = null) {
  return {
    userId:           profile.id,
    firstName:        profile.first_name || '',
    lastName:         profile.last_name || '',
    email:            profile.email || '',
    avatarUrl:        profile.avatar_url || null,
    role:             profile.role,
    accountStatus:    profile.account_status,
    isKycVerified:    profile.is_kyc_verified || false,
    kycStatus:        profile.kyc_status,
    countryCode:      profile.country_code,
    city:             profile.city,
    currency:         profile.currency || 'XOF',
    hasBothRoles:     profile.has_both_roles || false,
    currentMode:      profile.role,
    freelanceLevel:   freelanceProfile?.level || 'new',
    onlineStatus:     'available',
    unreadMessages:   0,
    unreadNotifications: 0,
    activeOrders:     0,
    subRole:          profile.account_type === 'business' ? 'entreprise' : 'particulier',
    adminRole:        null
  }
}

// ── signUp ────────────────────────────────────────────────────────────

export async function signUp({ firstName, lastName, email, password, role, countryCode }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name:   firstName,
        last_name:    lastName,
        role:         role || 'client',
        country_code: countryCode || 'CI',
        language:     'fr',
        currency:     'XOF'
      }
    }
  })

  if (error) throw error

  // fn_create_profile_after_signup crée le profil automatiquement via trigger
  return { user: data.user, requiresEmailConfirmation: !data.session }
}

// ── signIn ────────────────────────────────────────────────────────────

export async function signIn({ email, password }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const user = data.user
  if (!user) throw new Error('Connexion échouée.')

  // Charger le profil complet
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (pErr || !profile) {
    // Profil inexistant = compte Supabase orphelin (edge case)
    throw new Error('Profil introuvable. Contactez le support.')
  }

  // Charger le freelance profile si applicable
  let freelanceProfile = null
  if (profile.role === 'freelance') {
    const { data: fp } = await supabase
      .from('freelance_profiles')
      .select('level, slug, avg_rating, pending_payout_cents')
      .eq('profile_id', user.id)
      .single()
    freelanceProfile = fp
  }

  const session = _buildSessionFromProfile(profile, freelanceProfile)
  _writeLocalSession(session)

  return {
    session,
    redirectUrl: _getRedirectUrl(profile.role)
  }
}

// ── signOut ───────────────────────────────────────────────────────────

export async function signOut() {
  _clearLocalSession()
  if (isSupabaseConfigured) {
    await supabase.auth.signOut().catch(() => {})
  }
  window.location.href = '/src/pages/home/index.html'
}

// ── resetPassword ─────────────────────────────────────────────────────

export async function resetPasswordForEmail(email) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const redirectTo = window.location.origin + '/src/pages/auth/index.html'
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

// ── refreshSession ────────────────────────────────────────────────────

export async function refreshSessionFromSupabase() {
  if (!isSupabaseConfigured) return null

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) { _clearLocalSession(); return null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const session = _buildSessionFromProfile(profile)
  _writeLocalSession(session)
  return session
}

// ── getRedirectUrl ────────────────────────────────────────────────────

function _getRedirectUrl(role) {
  const urls = {
    client:    '/src/pages/dashboard/client/index.html',
    freelance: '/src/pages/dashboard/freelance/index.html',
    admin:     '/src/pages/admin/index.html'
  }
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/src/pages/') && !next.includes('//')) return next
  return urls[role] || urls.client
}
