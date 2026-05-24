/**
 * services-api.js — Services Oriupe
 */
import { supabase, isSupabaseConfigured } from './supabase.js'

const SERVICE_SELECT = `
  id, slug, title, short_description, description, status,
  price_cents, delivery_days, revisions_included, category_id, subcategory_id,
  avg_rating, review_count, orders_completed, view_count,
  freelance_id,
  freelance_profiles (
    slug, professional_title, avg_rating,
    profiles ( first_name, last_name, avatar_url, city, country_code )
  ),
  service_media ( url, type, is_cover, position ),
  service_packages ( id, name, price_cents, delivery_days, revisions_included, description ),
  service_tags ( tag )
`

// ── getService ────────────────────────────────────────────────────────

export async function getService(slugOrId) {
  if (!isSupabaseConfigured) return null
  const isUuid = /^[0-9a-f-]{36}$/.test(slugOrId)
  const field = isUuid ? 'id' : 'slug'
  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_SELECT)
    .eq(field, slugOrId)
    .eq('status', 'published')
    .single()
  if (error) throw error
  // increment view_count asynchronously (fire and forget)
  supabase.rpc('fn_increment_service_view', { service_id: data.id }).catch(() => {})
  return data
}

// ── listServices ──────────────────────────────────────────────────────

export async function listServices({ categoryId, subcategoryId, minPrice, maxPrice, q, sort = 'popular', page = 1, limit = 20 } = {}) {
  if (!isSupabaseConfigured) return { data: [], count: 0 }

  let query = supabase
    .from('services')
    .select(SERVICE_SELECT, { count: 'exact' })
    .eq('status', 'published')

  if (categoryId)    query = query.eq('category_id', categoryId)
  if (subcategoryId) query = query.eq('subcategory_id', subcategoryId)
  if (minPrice)      query = query.gte('price_cents', minPrice)
  if (maxPrice)      query = query.lte('price_cents', maxPrice)
  if (q)             query = query.textSearch('search_vector', q, { type: 'websearch', config: 'french' })

  switch (sort) {
    case 'price_asc':   query = query.order('price_cents', { ascending: true }); break
    case 'price_desc':  query = query.order('price_cents', { ascending: false }); break
    case 'rating':      query = query.order('avg_rating', { ascending: false }); break
    case 'recent':      query = query.order('created_at', { ascending: false }); break
    default:            query = query.order('orders_completed', { ascending: false })
  }

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── getMyServices ─────────────────────────────────────────────────────

export async function getMyServices(profileId) {
  if (!isSupabaseConfigured) return []
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) return []

  const { data, error } = await supabase
    .from('services')
    .select('id, slug, title, status, price_cents, avg_rating, review_count, orders_completed, created_at')
    .eq('freelance_id', fp.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── createService ─────────────────────────────────────────────────────

export async function createService(profileId, serviceData) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) throw new Error('Profil freelance requis.')

  const { data, error } = await supabase
    .from('services')
    .insert({
      freelance_id:        fp.id,
      title:               serviceData.title,
      short_description:   serviceData.shortDescription,
      description:         serviceData.description,
      category_id:         serviceData.categoryId,
      subcategory_id:      serviceData.subcategoryId || null,
      price_cents:         serviceData.priceCents,
      delivery_days:       serviceData.deliveryDays,
      revisions_included:  serviceData.revisionsIncluded || 1,
      status:              'draft'
    })
    .select('id, slug')
    .single()
  if (error) throw error
  return data
}

// ── updateService ─────────────────────────────────────────────────────

export async function updateService(serviceId, profileId, updates) {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.')
  // Verify ownership
  const { data: fp } = await supabase
    .from('freelance_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single()
  if (!fp) throw new Error('Non autorisé.')

  const allowed = ['title','short_description','description','category_id','subcategory_id','price_cents','delivery_days','revisions_included','status']
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase
    .from('services')
    .update(safe)
    .eq('id', serviceId)
    .eq('freelance_id', fp.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── publishService ────────────────────────────────────────────────────

export async function publishService(serviceId, profileId) {
  return updateService(serviceId, profileId, { status: 'published' })
}

// ── getServicePackages ────────────────────────────────────────────────

export async function getServicePackages(serviceId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('service_packages')
    .select('*, service_package_features ( feature, is_included )')
    .eq('service_id', serviceId)
    .order('price_cents', { ascending: true })
  if (error) throw error
  return data || []
}

// ── getFeaturedServices ───────────────────────────────────────────────

export async function getFeaturedServices(limit = 8) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('services')
    .select(`
      id, slug, title, short_description, price_cents, avg_rating, review_count,
      service_media ( url, is_cover ),
      freelance_profiles (
        profiles ( first_name, last_name, avatar_url )
      )
    `)
    .eq('status', 'published')
    .order('orders_completed', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
