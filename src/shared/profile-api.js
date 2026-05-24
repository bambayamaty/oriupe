/**
 * profile-api.js — Gestion des profils Oriupe
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

// ── getMyProfile ──────────────────────────────────────────────────────

export async function getMyProfile(userId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── getFreelanceProfile ───────────────────────────────────────────────

export async function getFreelanceProfile(profileId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('freelance_profiles')
    .select(`
      *,
      freelance_skills ( skill_name, years_experience ),
      freelance_languages ( language_code, level ),
      freelance_portfolio_items ( title, description, image_url, project_url, category ),
      freelance_experiences ( company, role, start_year, end_year, description ),
      freelance_certifications ( name, issuer, year, url )
    `)
    .eq('profile_id', profileId)
    .single()
  if (error) throw error
  return data
}

// ── getFreelanceBySlug ────────────────────────────────────────────────

export async function getFreelanceBySlug(slug) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('freelance_profiles')
    .select(`
      *,
      profiles ( first_name, last_name, avatar_url, country_code, city ),
      freelance_skills ( skill_name, years_experience ),
      freelance_languages ( language_code, level ),
      freelance_portfolio_items ( title, description, image_url, project_url )
    `)
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

// ── updateProfile ─────────────────────────────────────────────────────

export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const allowed = ['first_name','last_name','avatar_url','bio','city','country_code','language','currency']
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabase
    .from('profiles')
    .update(safe)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── updateFreelanceProfile ────────────────────────────────────────────

export async function updateFreelanceProfile(profileId, updates) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const allowed = ['professional_title','bio','hourly_rate_cents','availability','response_time_hours','languages','portfolio_url']
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabase
    .from('freelance_profiles')
    .update(safe)
    .eq('profile_id', profileId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── uploadAvatar ──────────────────────────────────────────────────────

export async function uploadAvatar(userId, file) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (upErr) throw upErr
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  await updateProfile(userId, { avatar_url: data.publicUrl })
  return data.publicUrl
}

// ── syncSkills ────────────────────────────────────────────────────────

export async function syncSkills(profileId, skills) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) throw new Error('Profil freelance introuvable.')

  await supabase.from('freelance_skills').delete().eq('freelance_id', fp.id)
  if (skills.length === 0) return []

  const rows = skills.map(s => ({ freelance_id: fp.id, skill_name: s.name, years_experience: s.years || null }))
  const { data, error } = await supabase.from('freelance_skills').insert(rows).select()
  if (error) throw error
  return data
}

// ── getPublicProfile ──────────────────────────────────────────────────

export async function getPublicProfile(userId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, city, country_code, role')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}
