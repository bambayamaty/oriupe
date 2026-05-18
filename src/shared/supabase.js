import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Oriupe] Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquantes dans .env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Escrow helpers ─────────────────────────────────────────────────────────────

export async function getOrderEscrow(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, escrow_code, status,
      amount_total, commission_rate, commission_amount, amount_net,
      payment_method, paid_at, delivered_at, auto_validate_at, deadline,
      disputes(id, status, decision)
    `)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data
}

export async function getOrderMessages(orderId, { limit = 50, before } = {}) {
  let q = supabase
    .from('collaboration_messages')
    .select('*, sender:sender_id(id, raw_user_meta_data)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function sendMessage(orderId, body, attachments = []) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('collaboration_messages')
    .insert({ order_id: orderId, sender_id: user.id, body, attachments })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMessageRead(messageId) {
  const { error } = await supabase
    .from('collaboration_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

export async function openDispute(orderId, { reason, category, evidenceUrls = [] }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('disputes')
    .insert({
      order_id: orderId,
      opened_by: user.id,
      reason,
      category,
      evidence_urls: evidenceUrls
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Écoute en temps réel des messages d'une commande
export function subscribeToMessages(orderId, callback) {
  return supabase
    .channel(`messages:${orderId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'collaboration_messages',
      filter: `order_id=eq.${orderId}`
    }, payload => callback(payload.new))
    .subscribe()
}

// Écoute en temps réel du statut escrow d'une commande
export function subscribeToOrderStatus(orderId, callback) {
  return supabase
    .channel(`order:${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    }, payload => callback(payload.new))
    .subscribe()
}
