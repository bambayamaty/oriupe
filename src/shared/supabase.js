import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!isSupabaseConfigured) {
  console.error('[Oriupe] Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquantes dans .env')
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Configuration Supabase manquante. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

// ── Escrow helpers ─────────────────────────────────────────────────────────────

export async function getOrderEscrow(orderId) {
  const client = requireSupabaseClient()
  const { data, error } = await client
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
  const client = requireSupabaseClient()
  let q = client
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
  const client = requireSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Connexion requise pour envoyer un message.')
  const { data, error } = await client
    .from('collaboration_messages')
    .insert({ order_id: orderId, sender_id: user.id, body, attachments })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMessageRead(messageId) {
  const client = requireSupabaseClient()
  const { error } = await client
    .from('collaboration_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

export async function openDispute(orderId, { reason, category, evidenceUrls = [] }) {
  const client = requireSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Connexion requise pour ouvrir un litige.')
  const { data, error } = await client
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
  const client = requireSupabaseClient()
  return client
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
  const client = requireSupabaseClient()
  return client
    .channel(`order:${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    }, payload => callback(payload.new))
    .subscribe()
}

// ── Conversations (DMs + order threads) ────────────────────────────────────────

export async function getConversations(userId) {
  const client = requireSupabaseClient()
  const { data, error } = await client
    .from('conversations')
    .select('*')
    .contains('participants', [userId])
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getOrCreateDMConversation(participantA, participantB) {
  const client = requireSupabaseClient()
  const { data: existing } = await client
    .from('conversations')
    .select('id')
    .eq('type', 'direct')
    .contains('participants', [participantA, participantB])
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await client
    .from('conversations')
    .insert({
      type: 'direct',
      participants: [participantA, participantB],
      unread_counts: { [participantA]: 0, [participantB]: 0 }
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function getOrCreateOrderConversation(orderId, clientId, freelanceId) {
  const client = requireSupabaseClient()
  const { data: existing } = await client
    .from('conversations')
    .select('id')
    .eq('type', 'order')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await client
    .from('conversations')
    .insert({
      type: 'order',
      order_id: orderId,
      participants: [clientId, freelanceId],
      unread_counts: { [clientId]: 0, [freelanceId]: 0 }
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function getConversationMessages(conversationId, { limit = 50, before } = {}) {
  const client = requireSupabaseClient()
  let q = client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function sendDirectMessage(conversationId, body, { type = 'text', attachments = [], metadata = {}, replyToId } = {}) {
  const client = requireSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Connexion requise.')
  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      type,
      attachments,
      metadata,
      reply_to_id: replyToId || null,
      read_by: { [user.id]: new Date().toISOString() }
    })
    .select()
    .single()
  if (error) throw error
  await client
    .from('conversations')
    .update({
      last_message_preview: body?.slice(0, 80) || (type !== 'text' ? `[${type}]` : ''),
      last_message_at: data.created_at,
      last_sender_id: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
  return data
}

export async function markConversationRead(conversationId, userId) {
  const client = requireSupabaseClient()
  const { data: conv } = await client
    .from('conversations')
    .select('unread_counts')
    .eq('id', conversationId)
    .single()
  if (!conv) return
  const counts = { ...conv.unread_counts, [userId]: 0 }
  await client
    .from('conversations')
    .update({ unread_counts: counts })
    .eq('id', conversationId)
}

export async function addReaction(messageId, emoji, userId) {
  const client = requireSupabaseClient()
  const { data: msg } = await client
    .from('messages')
    .select('reactions')
    .eq('id', messageId)
    .single()
  if (!msg) return
  const reactions = { ...msg.reactions }
  if (!reactions[emoji]) reactions[emoji] = []
  if (reactions[emoji].includes(userId)) {
    reactions[emoji] = reactions[emoji].filter(id => id !== userId)
    if (!reactions[emoji].length) delete reactions[emoji]
  } else {
    reactions[emoji] = [...reactions[emoji], userId]
  }
  const { error } = await client
    .from('messages')
    .update({ reactions })
    .eq('id', messageId)
  if (error) throw error
  return reactions
}

export async function uploadAttachment(file, conversationId) {
  const client = requireSupabaseClient()
  const ext = file.name.split('.').pop()
  const path = `conversations/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await client.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  const { data } = client.storage.from('attachments').getPublicUrl(path)
  return { url: data.publicUrl, name: file.name, size: file.size, mime: file.type }
}

export function subscribeToConversation(conversationId, callback) {
  const client = requireSupabaseClient()
  return client
    .channel(`conv:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => callback({ type: 'new_message', message: payload.new }))
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => callback({ type: 'message_updated', message: payload.new }))
    .subscribe()
}

export function subscribeToPresence(conversationId, userId, onSync) {
  const client = requireSupabaseClient()
  const channel = client.channel(`presence:${conversationId}`, {
    config: { presence: { key: userId } }
  })
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onSync(state)
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() })
      }
    })
  return channel
}

export function subscribeToConversationList(userId, callback) {
  const client = requireSupabaseClient()
  return client
    .channel(`conv_list:${userId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'conversations'
    }, payload => {
      if (payload.new.participants?.includes(userId)) {
        callback(payload.new)
      }
    })
    .subscribe()
}
