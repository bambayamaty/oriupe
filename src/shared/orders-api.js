/**
 * orders-api.js — Commandes Oriupe
 * Toutes les mutations passent par des RPCs SECURITY DEFINER.
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

const ORDER_SELECT = `
  id, status, escrow_code, source, created_at,
  amount_total_cents, commission_cents, amount_net_cents,
  delivery_days, revisions_included, revisions_used,
  brief, requirements,
  client_id, service_id,
  freelance_profiles ( profile_id, slug, professional_title,
    profiles ( first_name, last_name, avatar_url )
  ),
  services ( id, slug, title, price_cents ),
  profiles!client_id ( first_name, last_name, avatar_url )
`

// ── createOrder ───────────────────────────────────────────────────────

export async function createOrder({ serviceId, packageId, brief, requirements }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_create_order_from_service', {
    p_service_id:  serviceId,
    p_package_id:  packageId || null,
    p_brief:       brief || '',
    p_requirements: requirements || ''
  })
  if (error) throw error
  return data // { order_id, escrow_code, conversation_id, amount_total_cents }
}

// ── getOrder ──────────────────────────────────────────────────────────

export async function getOrder(orderId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data
}

// ── getOrderByEscrowCode ──────────────────────────────────────────────

export async function getOrderByEscrowCode(code) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('escrow_code', code)
    .single()
  if (error) throw error
  return data
}

// ── getClientOrders ───────────────────────────────────────────────────

export async function getClientOrders(clientId, { status, page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  let query = supabase
    .from('orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .eq('client_id', clientId)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── getFreelanceOrders ────────────────────────────────────────────────

export async function getFreelanceOrders(profileId, { status, page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) return { data: [], count: 0 }

  let query = supabase
    .from('orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .eq('freelance_id', fp.id)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── markDelivery ──────────────────────────────────────────────────────

export async function markDelivery(orderId, { message, attachmentUrls = [] }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_mark_delivery_submitted', {
    p_order_id:       orderId,
    p_message:        message,
    p_attachment_urls: attachmentUrls
  })
  if (error) throw error
  return data
}

// ── validateDelivery ──────────────────────────────────────────────────

export async function validateDelivery(orderId) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_validate_delivery_and_release_escrow', {
    p_order_id: orderId
  })
  if (error) throw error
  return data
}

// ── requestRevision ───────────────────────────────────────────────────

export async function requestRevision(orderId, feedback) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_request_revision', {
    p_order_id: orderId,
    p_feedback: feedback
  })
  if (error) throw error
  return data
}

// ── getOrderTimeline ──────────────────────────────────────────────────

export async function getOrderTimeline(orderId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('order_status_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ── getOrderStats ─────────────────────────────────────────────────────

export async function getOrderStats(profileId, role = 'client') {
  if (!isSupabaseConfigured) return null
  const field = role === 'freelance' ? 'freelance_profiles.profile_id' : 'client_id'
  let query = supabase.from('orders').select('status', { count: 'exact' })

  if (role === 'freelance') {
    const { data: fp } = await supabase
      .from('freelance_profiles').select('id').eq('profile_id', profileId).single()
    if (!fp) return null
    query = supabase.from('orders').select('status').eq('freelance_id', fp.id)
  } else {
    query = supabase.from('orders').select('status').eq('client_id', profileId)
  }

  const { data, error } = await query
  if (error) return null

  const stats = { pending: 0, in_progress: 0, delivered: 0, completed: 0, disputed: 0, cancelled: 0 }
  for (const row of (data || [])) stats[row.status] = (stats[row.status] || 0) + 1
  return stats
}
