/**
 * demo-adapter.js — Données de démo quand Supabase n'est pas configuré
 * Permet de tester l'UI sans backend actif.
 * Toutes les fonctions lisent depuis localStorage avec des fallbacks statiques.
 */

const _store = key => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
const _set = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ── Sessions de démo ──────────────────────────────────────────────────

export const DEMO_PROFILES = {
  client: {
    id: 'demo-client-001',
    first_name: 'Amadou',
    last_name: 'Traoré',
    email: 'amadou@demo.oriupe.com',
    role: 'client',
    account_status: 'active',
    kyc_status: 'approved',
    is_kyc_verified: true,
    country_code: 'CI',
    city: 'Abidjan',
    currency: 'XOF',
    avatar_url: null
  },
  freelance: {
    id: 'demo-freelance-001',
    first_name: 'Fatou',
    last_name: 'Diallo',
    email: 'fatou@demo.oriupe.com',
    role: 'freelance',
    account_status: 'active',
    kyc_status: 'approved',
    is_kyc_verified: true,
    country_code: 'SN',
    city: 'Dakar',
    currency: 'XOF',
    avatar_url: null
  }
}

// ── Services de démo ──────────────────────────────────────────────────

export const DEMO_SERVICES = [
  {
    id: 'svc-001', slug: 'creation-logo-professionnel',
    title: 'Création de logo professionnel',
    short_description: 'Logo vectoriel livré en 3 jours, révisions illimitées.',
    price_cents: 2500000, delivery_days: 3, avg_rating: 4.9, review_count: 47,
    orders_completed: 52,
    freelance_profiles: {
      slug: 'fatou-design', professional_title: 'Designer UI/Brand',
      profiles: { first_name: 'Fatou', last_name: 'D.', avatar_url: null, country_code: 'SN' }
    }
  },
  {
    id: 'svc-002', slug: 'site-wordpress-vitrine',
    title: 'Site WordPress vitrine complet',
    short_description: 'Site responsive 5 pages + SEO de base, livré en 7 jours.',
    price_cents: 7500000, delivery_days: 7, avg_rating: 4.7, review_count: 23,
    orders_completed: 28,
    freelance_profiles: {
      slug: 'kofi-dev', professional_title: 'Développeur Web Full-Stack',
      profiles: { first_name: 'Kofi', last_name: 'A.', avatar_url: null, country_code: 'GH' }
    }
  },
  {
    id: 'svc-003', slug: 'traduction-fr-en',
    title: 'Traduction FR→EN professionnelle',
    short_description: '1000 mots/jour, qualité native. CV, docs légaux, marketing.',
    price_cents: 1500000, delivery_days: 2, avg_rating: 5.0, review_count: 31,
    orders_completed: 89,
    freelance_profiles: {
      slug: 'aissatou-trans', professional_title: 'Traductrice bilingue',
      profiles: { first_name: 'Aissatou', last_name: 'B.', avatar_url: null, country_code: 'ML' }
    }
  }
]

// ── Commandes de démo ─────────────────────────────────────────────────

export const DEMO_ORDERS = [
  {
    id: 'ord-001', status: 'in_progress', escrow_code: 'ORP-2024-ABCD',
    amount_total_cents: 2500000, commission_cents: 375000, amount_net_cents: 2125000,
    delivery_days: 3, revisions_included: 2, revisions_used: 0,
    brief: 'Logo minimaliste pour startup fintech.',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    services: { title: 'Création de logo professionnel', slug: 'creation-logo-professionnel' }
  }
]

// ── Conversations de démo ─────────────────────────────────────────────

export const DEMO_CONVERSATIONS = [
  {
    id: 'conv-001', type: 'order', title: null,
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    last_message_preview: 'Bonjour ! J\'ai bien reçu votre brief.',
    unreadCount: 1,
    order_id: 'ord-001',
    conversation_participants: [
      { user_id: 'demo-client-001', profiles: { first_name: 'Amadou', last_name: 'T.', avatar_url: null } },
      { user_id: 'demo-freelance-001', profiles: { first_name: 'Fatou', last_name: 'D.', avatar_url: null } }
    ]
  }
]

// ── Messages de démo ──────────────────────────────────────────────────

export const DEMO_MESSAGES = {
  'conv-001': [
    {
      id: 'msg-001', type: 'text', body: 'Bonjour ! J\'ai passé commande pour un logo.',
      sender_id: 'demo-client-001', created_at: new Date(Date.now() - 7200000).toISOString(),
      profiles: { first_name: 'Amadou', last_name: 'T.', avatar_url: null }
    },
    {
      id: 'msg-002', type: 'text', body: 'Bonjour ! J\'ai bien reçu votre brief. Je vous propose 3 concepts d\'ici demain.',
      sender_id: 'demo-freelance-001', created_at: new Date(Date.now() - 3600000).toISOString(),
      profiles: { first_name: 'Fatou', last_name: 'D.', avatar_url: null }
    }
  ]
}

// ── API façade démo ───────────────────────────────────────────────────

export const demoServices = {
  list: ({ q, page = 1, limit = 20 } = {}) => {
    let data = DEMO_SERVICES
    if (q) data = data.filter(s => s.title.toLowerCase().includes(q.toLowerCase()))
    const from = (page - 1) * limit
    return Promise.resolve({ data: data.slice(from, from + limit), count: data.length })
  },
  get: (slug) => Promise.resolve(DEMO_SERVICES.find(s => s.slug === slug || s.id === slug) || null),
  featured: (n = 3) => Promise.resolve(DEMO_SERVICES.slice(0, n))
}

export const demoOrders = {
  list: () => {
    const saved = _store('oriupe_pending_orders') || []
    return Promise.resolve({ data: [...DEMO_ORDERS, ...saved], count: DEMO_ORDERS.length + saved.length })
  },
  get: (id) => Promise.resolve(DEMO_ORDERS.find(o => o.id === id) || null),
  create: (order) => {
    const saved = _store('oriupe_pending_orders') || []
    const newOrder = { ...order, id: `ord-${Date.now()}`, created_at: new Date().toISOString() }
    _set('oriupe_pending_orders', [...saved, newOrder])
    return Promise.resolve(newOrder)
  }
}

export const demoMessages = {
  getConversations: () => Promise.resolve(DEMO_CONVERSATIONS),
  getMessages: (convId) => Promise.resolve(DEMO_MESSAGES[convId] || []),
  send: (convId, { body }) => {
    const session = _store('oriupe_session')
    const msg = {
      id: `msg-${Date.now()}`, type: 'text', body,
      sender_id: session?.userId || 'demo-client-001',
      created_at: new Date().toISOString(),
      profiles: { first_name: session?.firstName || 'Moi', last_name: '', avatar_url: null }
    }
    const pending = _store('oriupe_pending_msgs') || []
    _set('oriupe_pending_msgs', [...pending, { convId, msg }])
    return Promise.resolve(msg)
  }
}

export const demoProjects = {
  list: () => Promise.resolve({ data: _store('oriupe_pending_projects') || [], count: 0 }),
  create: (project) => {
    const saved = _store('oriupe_pending_projects') || []
    const newProject = { ...project, id: `proj-${Date.now()}`, status: 'open', created_at: new Date().toISOString() }
    _set('oriupe_pending_projects', [...saved, newProject])
    return Promise.resolve(newProject)
  }
}
