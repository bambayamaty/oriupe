/**
 * messages-api.js — Messagerie unifiée Oriupe
 * Remplace les fonctions messages/collaboration_messages de supabase.js
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

// ── getConversations ──────────────────────────────────────────────────

export async function getConversations(userId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id, unread_count, joined_at,
      conversations (
        id, type, title, last_message_at, last_message_preview,
        order_id, dispute_id,
        conversation_participants (
          user_id, left_at,
          profiles ( first_name, last_name, avatar_url )
        )
      )
    `)
    .eq('user_id', userId)
    .is('left_at', null)
    .order('conversations(last_message_at)', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({
    ...row.conversations,
    unreadCount: row.unread_count,
    joinedAt: row.joined_at
  }))
}

// ── getConversation ───────────────────────────────────────────────────

export async function getConversation(conversationId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_participants (
        user_id, unread_count, joined_at, left_at,
        profiles ( first_name, last_name, avatar_url, role )
      )
    `)
    .eq('id', conversationId)
    .single()
  if (error) throw error
  return data
}

// ── getMessages ───────────────────────────────────────────────────────

export async function getMessages(conversationId, { page = 1, limit = 50 } = {}) {
  if (!isSupabaseConfigured) return []
  const from = (page - 1) * limit
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, type, body, created_at, updated_at, deleted_at,
      sender_id, reply_to_id, reactions,
      message_attachments ( url, name, size_bytes, mime_type ),
      profiles!sender_id ( first_name, last_name, avatar_url )
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)
  if (error) throw error
  return (data || []).reverse()
}

// ── sendMessage ───────────────────────────────────────────────────────

export async function sendMessage(conversationId, { body, type = 'text', replyToId = null, attachments = [] }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_send_message', {
    p_conversation_id: conversationId,
    p_body:            body,
    p_type:            type,
    p_reply_to_id:     replyToId
  })
  if (error) throw error

  // Upload attachments if any
  if (attachments.length > 0 && data?.message_id) {
    await _uploadAttachments(data.message_id, conversationId, attachments)
  }
  return data
}

async function _uploadAttachments(messageId, conversationId, files) {
  for (const file of files) {
    const path = `${conversationId}/${messageId}/${file.name}`
    const { error: upErr } = await supabase.storage
      .from('message-attachments')
      .upload(path, file)
    if (upErr) continue
    const { data: url } = supabase.storage.from('message-attachments').getPublicUrl(path)
    await supabase.from('message_attachments').insert({
      message_id: messageId,
      url:        url.publicUrl,
      name:       file.name,
      size_bytes: file.size,
      mime_type:  file.type
    })
  }
}

// ── createConversation ────────────────────────────────────────────────

export async function createConversation(otherUserId, { title = null, orderId = null } = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc('fn_create_conversation', {
    p_other_user_id: otherUserId,
    p_title:         title,
    p_order_id:      orderId
  })
  if (error) throw error
  return data // { conversation_id, created }
}

// ── markRead ──────────────────────────────────────────────────────────

export async function markRead(conversationId, userId) {
  if (!isSupabaseConfigured) return
  await supabase
    .from('conversation_participants')
    .update({ unread_count: 0 })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// ── deleteMessage ─────────────────────────────────────────────────────

export async function deleteMessage(messageId, userId) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId)
  if (error) throw error
}

// ── addReaction ───────────────────────────────────────────────────────

export async function addReaction(messageId, userId, emoji) {
  if (!isSupabaseConfigured) return
  const { data: msg } = await supabase
    .from('messages')
    .select('reactions')
    .eq('id', messageId)
    .single()
  if (!msg) return

  const reactions = msg.reactions || {}
  if (!reactions[emoji]) reactions[emoji] = []
  if (!reactions[emoji].includes(userId)) reactions[emoji].push(userId)

  await supabase.from('messages').update({ reactions }).eq('id', messageId)
}

// ── subscribeToConversation ───────────────────────────────────────────

export function subscribeToConversation(conversationId, onMessage) {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => onMessage(payload.new))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ── subscribeToUserConversations ──────────────────────────────────────

export function subscribeToUserConversations(userId, onUpdate) {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel(`user-convs:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_participants',
      filter: `user_id=eq.${userId}`
    }, onUpdate)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
