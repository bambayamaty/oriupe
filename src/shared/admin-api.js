/**
 * admin-api.js — API admin Oriupe
 * Toutes les fonctions exigent un JWT avec app_metadata.oriupe_role valide.
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

// ── getDashboardStats ─────────────────────────────────────────────────

export async function getDashboardStats() {
  if (!isSupabaseConfigured) return null
  const [users, services, orders, revenue] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('escrow_transactions').select('amount_total_cents').eq('status', 'released')
  ])
  const totalRevenue = (revenue.data || []).reduce((s, r) => s + (r.amount_total_cents || 0), 0)
  return {
    totalUsers:    users.count || 0,
    totalServices: services.count || 0,
    totalOrders:   orders.count || 0,
    totalRevenueCents: totalRevenue
  }
}

// ── listUsers ─────────────────────────────────────────────────────────

export async function listUsers({ role, status, q, page = 1, limit = 25 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, account_status, kyc_status, is_kyc_verified, created_at, country_code', { count: 'exact' })

  if (role)   query = query.eq('role', role)
  if (status) query = query.eq('account_status', status)
  if (q)      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)

  query = query.order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── updateUserStatus ──────────────────────────────────────────────────

export async function updateUserStatus(userId, status, adminId, reason = '') {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data: before } = await supabase.from('profiles').select('*').eq('id', userId).single()
  const { data, error } = await supabase
    .from('profiles')
    .update({ account_status: status })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  await _logAdminAction(adminId, 'update_user_status', 'profile', userId, before, data, reason)
  return data
}

// ── getModerationQueue ────────────────────────────────────────────────

export async function getModerationQueue({ status = 'pending', page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  const { data, error, count } = await supabase
    .from('moderation_queue')
    .select('*, profiles!reported_by(first_name, last_name)', { count: 'exact' })
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── resolveModerationItem ─────────────────────────────────────────────

export async function resolveModerationItem(itemId, adminId, { resolution, notes }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase
    .from('moderation_queue')
    .update({ status: 'resolved', resolved_by: adminId, resolution_notes: notes })
    .eq('id', itemId)
    .select()
    .single()
  if (error) throw error
  await _logAdminAction(adminId, 'resolve_moderation', 'moderation_queue', itemId, null, { resolution, notes })
  return data
}

// ── listDisputes ──────────────────────────────────────────────────────

export async function listDisputes({ status, page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  let query = supabase
    .from('disputes')
    .select(`
      id, status, category, created_at, resolved_at,
      orders ( id, escrow_code, amount_total_cents,
        profiles!client_id ( first_name, last_name ),
        freelance_profiles ( profiles ( first_name, last_name ) )
      )
    `, { count: 'exact' })
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── resolveDispute ────────────────────────────────────────────────────

export async function resolveDispute(disputeId, adminId, { decision, releaseToBuyer, releaseToSeller, notes }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  await supabase.from('dispute_decisions').insert({
    dispute_id:         disputeId,
    decided_by:         adminId,
    decision:           decision,
    release_to_buyer:   releaseToBuyer || false,
    release_to_seller:  releaseToSeller || false,
    notes:              notes
  })
  const { data, error } = await supabase
    .from('disputes')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', disputeId)
    .select()
    .single()
  if (error) throw error
  await _logAdminAction(adminId, 'resolve_dispute', 'dispute', disputeId, null, { decision, notes })
  return data
}

// ── getAdminActionLogs ────────────────────────────────────────────────

export async function getAdminActionLogs({ adminId, targetType, page = 1, limit = 50 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  let query = supabase
    .from('admin_action_logs')
    .select('*, profiles!admin_id(first_name, last_name)', { count: 'exact' })
  if (adminId)    query = query.eq('admin_id', adminId)
  if (targetType) query = query.eq('target_type', targetType)
  query = query.order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── getPlatformSettings ───────────────────────────────────────────────

export async function getPlatformSettings() {
  if (!isSupabaseConfigured) return {}
  const { data, error } = await supabase.from('platform_settings').select('key, value')
  if (error) throw error
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
}

// ── updatePlatformSetting ─────────────────────────────────────────────

export async function updatePlatformSetting(key, value, adminId) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data: before } = await supabase.from('platform_settings').select('value').eq('key', key).single()
  const { data, error } = await supabase
    .from('platform_settings')
    .update({ value })
    .eq('key', key)
    .select()
    .single()
  if (error) throw error
  await _logAdminAction(adminId, 'update_platform_setting', 'platform_settings', key, before?.value, value)
  return data
}

// ── getFinanceOverview ────────────────────────────────────────────────

export async function getFinanceOverview({ from, to } = {}) {
  if (!isSupabaseConfigured) return null
  let query = supabase.from('escrow_transactions').select('status, amount_total_cents, commission_cents, amount_net_cents, created_at')
  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', to)
  const { data, error } = await query
  if (error) throw error
  const rows = data || []
  return {
    totalVolumeCents:    rows.reduce((s, r) => s + r.amount_total_cents, 0),
    totalCommissionCents: rows.filter(r => r.status === 'released').reduce((s, r) => s + r.commission_cents, 0),
    fundedCount:         rows.filter(r => r.status === 'funded').length,
    releasedCount:       rows.filter(r => r.status === 'released').length,
    refundedCount:       rows.filter(r => r.status === 'refunded').length
  }
}

// ── _logAdminAction ───────────────────────────────────────────────────

async function _logAdminAction(adminId, action, targetType, targetId, before, after, notes = '') {
  await supabase.from('admin_action_logs').insert({
    admin_id:    adminId,
    action,
    target_type: targetType,
    target_id:   String(targetId),
    before_state: before ? JSON.stringify(before) : null,
    after_state:  after  ? JSON.stringify(after)  : null,
    notes:        notes || null
  }).catch(() => {}) // Never block main flow on audit failure
}
