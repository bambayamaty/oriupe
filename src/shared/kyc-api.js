/**
 * kyc-api.js — KYC & vérification d'identité Oriupe
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

// ── getKycStatus ──────────────────────────────────────────────────────

export async function getKycStatus(userId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('kyc_status, is_kyc_verified, account_status')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── getKycCase ────────────────────────────────────────────────────────

export async function getKycCase(userId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('kyc_cases')
    .select(`
      *,
      kyc_documents ( id, doc_type, status, submitted_at, reviewed_at )
    `)
    .eq('profile_id', userId)
    .single()
  if (error) throw error
  return data
}

// ── submitDocument ────────────────────────────────────────────────────

export async function submitKycDocument(userId, { docType, file }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')

  const ext = file.name.split('.').pop()
  const path = `${userId}/${docType}_${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file)
  if (upErr) throw upErr

  const { data: kycCase } = await supabase
    .from('kyc_cases')
    .select('id')
    .eq('profile_id', userId)
    .single()
  if (!kycCase) throw new Error('KYC case introuvable.')

  const { data, error } = await supabase
    .from('kyc_documents')
    .insert({
      kyc_case_id:  kycCase.id,
      doc_type:     docType,
      storage_path: path,
      status:       'pending'
    })
    .select()
    .single()
  if (error) throw error

  // Update kyc_case status to 'submitted'
  await supabase
    .from('kyc_cases')
    .update({ status: 'submitted' })
    .eq('id', kycCase.id)

  // Update profile kyc_status
  await supabase
    .from('profiles')
    .update({ kyc_status: 'submitted' })
    .eq('id', userId)

  return data
}

// ── verifyPhone ───────────────────────────────────────────────────────
// Marquage téléphone vérifié (après OTP validé côté auth)

export async function verifyPhone(userId) {
  if (!isSupabaseConfigured) return
  const { data: kycCase } = await supabase
    .from('kyc_cases')
    .select('id')
    .eq('profile_id', userId)
    .single()
  if (!kycCase) return
  await supabase
    .from('kyc_cases')
    .update({ mobile_verified: true })
    .eq('id', kycCase.id)
}

// ── getKycDocumentUrl ─────────────────────────────────────────────────

export async function getKycDocumentUrl(storagePath) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .createSignedUrl(storagePath, 3600) // 1h expiry
  if (error) throw error
  return data.signedUrl
}

// ── adminReviewKyc ────────────────────────────────────────────────────

export async function adminReviewKyc(kycCaseId, { decision, rejectionReason = null, reviewedBy }) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const approved = decision === 'approved'

  // Append-only review record
  await supabase.from('kyc_reviews').insert({
    kyc_case_id:      kycCaseId,
    reviewed_by:      reviewedBy,
    decision:         decision,
    rejection_reason: rejectionReason
  })

  // Update kyc_case
  await supabase.from('kyc_cases').update({
    status:      approved ? 'approved' : 'rejected',
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy
  }).eq('id', kycCaseId)

  // Sync to profile (trigger fn_sync_kyc_to_profile handles this,
  // but explicitly update in case trigger is not active)
  const { data: kycCase } = await supabase
    .from('kyc_cases')
    .select('profile_id')
    .eq('id', kycCaseId)
    .single()
  if (kycCase) {
    await supabase.from('profiles').update({
      kyc_status:    approved ? 'approved' : 'rejected',
      is_kyc_verified: approved,
      account_status:  approved ? 'active' : 'pending_kyc'
    }).eq('id', kycCase.profile_id)
  }
}

// ── getPendingKycCases ────────────────────────────────────────────────

export async function getPendingKycCases({ page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }
  const { data, error, count } = await supabase
    .from('kyc_cases')
    .select(`
      id, status, submitted_at, risk_score, mobile_verified,
      profiles ( first_name, last_name, email, country_code, role )
    `, { count: 'exact' })
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (error) throw error
  return { data: data || [], count: count || 0 }
}
