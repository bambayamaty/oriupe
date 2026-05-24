/**
 * escrow-api.js — Escrow & paiements Oriupe
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

// ── getEscrow ─────────────────────────────────────────────────────────

export async function getEscrow(orderId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('escrow_transactions')
    .select('*')
    .eq('order_id', orderId)
    .single()
  if (error) throw error
  return data
}

// ── getEscrowByCode ───────────────────────────────────────────────────

export async function getEscrowByCode(code) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('escrow_transactions')
    .select(`
      *, orders (
        id, status, client_id, amount_total_cents,
        services ( title ),
        profiles!client_id ( first_name, last_name )
      )
    `)
    .eq('orders.escrow_code', code)
    .single()
  if (error) throw error
  return data
}

// ── markPaid ──────────────────────────────────────────────────────────

export async function markPaid(orderId, { operator, transactionRef }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_mark_order_paid', {
    p_order_id:       orderId,
    p_operator:       operator,
    p_transaction_ref: transactionRef
  })
  if (error) throw error
  return data
}

// ── releaseEscrow ─────────────────────────────────────────────────────
// Appelé automatiquement via fn_validate_delivery_and_release_escrow
// Cette fonction est un accès direct pour les admins/finance uniquement

export async function adminReleaseEscrow(escrowId, adminNote = '') {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase
    .from('escrow_transactions')
    .update({
      status: 'released',
      released_at: new Date().toISOString(),
      notes: adminNote || null
    })
    .eq('id', escrowId)
    .eq('status', 'funded')
    .select()
    .single()
  if (error) throw error
  return data
}

// ── getEscrowEvents ───────────────────────────────────────────────────

export async function getEscrowEvents(escrowId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('escrow_events')
    .select('*')
    .eq('escrow_id', escrowId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ── getPendingPayouts ─────────────────────────────────────────────────

export async function getPendingPayouts(profileId) {
  if (!isSupabaseConfigured) return { pending_payout_cents: 0 }
  const { data, error } = await supabase
    .from('freelance_profiles')
    .select('pending_payout_cents')
    .eq('profile_id', profileId)
    .single()
  if (error) throw error
  return data
}

// ── getCommissionRate ─────────────────────────────────────────────────

export async function getCommissionRate(plan = 'free') {
  if (!isSupabaseConfigured) return { free: 0.15, pro: 0.10, business: 0.07 }[plan] || 0.15

  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'commission_rates')
    .single()

  if (!data?.value) return { free: 0.15, pro: 0.10, business: 0.07 }[plan] || 0.15
  const rates = data.value
  return rates[plan] ?? rates.free ?? 0.15
}

// ── simulatePayment ───────────────────────────────────────────────────
// Simulation de paiement mobile money (sandbox)

export async function simulatePayment(orderId, { operator = 'orange_money', phone }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')

  // Insert a pending payment_transaction
  const { data: order } = await supabase
    .from('orders')
    .select('amount_total_cents, escrow_code')
    .eq('id', orderId)
    .single()
  if (!order) throw new Error('Commande introuvable.')

  const { data, error } = await supabase
    .from('payment_transactions')
    .insert({
      order_id:        orderId,
      provider:        'sandbox',
      operator:        operator,
      amount_cents:    order.amount_total_cents,
      currency:        'XOF',
      status:          'pending',
      phone_number:    phone || null,
      reference:       `SIM-${order.escrow_code}-${Date.now()}`
    })
    .select()
    .single()
  if (error) throw error

  // In prod: call mobile money gateway, get webhook callback
  // For now: auto-confirm after 1s in demo mode
  setTimeout(async () => {
    await supabase
      .from('payment_transactions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', data.id)
    await markPaid(orderId, { operator, transactionRef: data.reference })
  }, 1000)

  return data
}
