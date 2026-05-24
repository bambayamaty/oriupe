/**
 * projects-api.js — Projets & appels d'offres Oriupe
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

const PROJECT_SELECT = `
  id, slug, title, description, status, type,
  budget_min_cents, budget_max_cents, deadline, category_id, subcategory_id,
  skills_required, proposal_count, created_at,
  client_id,
  profiles!client_id ( first_name, last_name, avatar_url, city, country_code )
`

// ── getProject ────────────────────────────────────────────────────────

export async function getProject(slugOrId) {
  if (!isSupabaseConfigured) return null
  const isUuid = /^[0-9a-f-]{36}$/.test(slugOrId)
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq(isUuid ? 'id' : 'slug', slugOrId)
    .single()
  if (error) throw error
  return data
}

// ── listProjects ──────────────────────────────────────────────────────

export async function listProjects({ categoryId, type, q, sort = 'recent', page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }

  let query = supabase
    .from('projects')
    .select(PROJECT_SELECT, { count: 'exact' })
    .eq('status', 'open')

  if (categoryId) query = query.eq('category_id', categoryId)
  if (type)       query = query.eq('type', type)
  if (q)          query = query.textSearch('search_vector', q, { type: 'websearch', config: 'french' })

  switch (sort) {
    case 'budget_desc': query = query.order('budget_max_cents', { ascending: false }); break
    case 'deadline':    query = query.order('deadline', { ascending: true }); break
    default:            query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── getMyProjects ─────────────────────────────────────────────────────

export async function getMyProjects(clientId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('projects')
    .select('id, slug, title, status, proposal_count, budget_min_cents, budget_max_cents, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── createProject ─────────────────────────────────────────────────────

export async function createProject(clientId, projectData) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase
    .from('projects')
    .insert({
      client_id:          clientId,
      title:              projectData.title,
      description:        projectData.description,
      category_id:        projectData.categoryId,
      subcategory_id:     projectData.subcategoryId || null,
      type:               projectData.type || 'fixed',
      budget_min_cents:   projectData.budgetMinCents,
      budget_max_cents:   projectData.budgetMaxCents,
      deadline:           projectData.deadline || null,
      skills_required:    projectData.skills || [],
      status:             'open'
    })
    .select('id, slug')
    .single()
  if (error) throw error
  return data
}

// ── updateProject ─────────────────────────────────────────────────────

export async function updateProject(projectId, clientId, updates) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const allowed = ['title','description','budget_min_cents','budget_max_cents','deadline','skills_required','status']
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabase
    .from('projects')
    .update(safe)
    .eq('id', projectId)
    .eq('client_id', clientId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── submitProposal ────────────────────────────────────────────────────

export async function submitProposal(projectId, profileId, proposalData) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) throw new Error('Profil freelance requis.')

  const { data, error } = await supabase
    .from('project_proposals')
    .insert({
      project_id:     projectId,
      freelance_id:   fp.id,
      cover_letter:   proposalData.coverLetter,
      price_cents:    proposalData.priceCents,
      delivery_days:  proposalData.deliveryDays,
      status:         'pending'
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── getProposals ──────────────────────────────────────────────────────

export async function getProposals(projectId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('project_proposals')
    .select(`
      id, status, price_cents, delivery_days, cover_letter, created_at,
      freelance_profiles (
        slug, professional_title, avg_rating, level,
        profiles ( first_name, last_name, avatar_url, country_code )
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── acceptProposal ────────────────────────────────────────────────────

export async function acceptProposal(proposalId, clientId) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase
    .from('project_proposals')
    .update({ status: 'accepted' })
    .eq('id', proposalId)
    .select('*, projects!inner(client_id)')
    .single()
  if (error) throw error
  if (data.projects.client_id !== clientId) throw new Error('Non autorisé.')
  return data
}

// ── getMyProposals ────────────────────────────────────────────────────

export async function getMyProposals(profileId) {
  if (!isSupabaseConfigured) return []
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) return []

  const { data, error } = await supabase
    .from('project_proposals')
    .select(`
      id, status, price_cents, delivery_days, created_at,
      projects ( id, slug, title, status, budget_min_cents, budget_max_cents )
    `)
    .eq('freelance_id', fp.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
