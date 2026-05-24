-- ═══════════════════════════════════════════════════════════════════
-- 003_referentials.sql — Tables de référence statiques
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    NOT NULL UNIQUE,
  name_fr     TEXT    NOT NULL,
  name_en     TEXT,
  icon        TEXT,               -- emoji ou nom SVG
  sort_order  INT     NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subcategories (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug            TEXT    NOT NULL UNIQUE,
  name_fr         TEXT    NOT NULL,
  name_en         TEXT,
  sort_order      INT     NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_subcat_category ON subcategories(category_id);

CREATE TABLE skills (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    NOT NULL UNIQUE,
  name_fr     TEXT    NOT NULL,
  name_en     TEXT,
  category_id UUID    REFERENCES categories(id)
);

CREATE TABLE tags (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug    TEXT    NOT NULL UNIQUE,
  name_fr TEXT    NOT NULL
);

CREATE TABLE countries (
  code        CHAR(2)     PRIMARY KEY,    -- ISO 3166-1
  name_fr     TEXT        NOT NULL,
  name_en     TEXT,
  currency    currency_code,
  dial_code   TEXT,                       -- +225
  flag_emoji  TEXT
);

CREATE TABLE currencies (
  code        currency_code PRIMARY KEY,
  name        TEXT    NOT NULL,
  symbol      TEXT    NOT NULL,
  decimals    INT     NOT NULL DEFAULT 0
);

CREATE TABLE payment_methods (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  operator    payment_operator NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  logo_url    TEXT,
  countries   TEXT[],             -- codes pays supportés
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Seed référentiels ────────────────────────────────────────────────

INSERT INTO categories (slug, name_fr, name_en, icon, sort_order) VALUES
  ('dev-web-mobile',  'Dev. Web & Mobile',      'Web & Mobile Dev',    '💻', 1),
  ('design-ux',       'Design & UX/UI',          'Design & UX/UI',      '🎨', 2),
  ('marketing',       'Marketing Digital',       'Digital Marketing',   '📢', 3),
  ('redaction',       'Rédaction & Contenu',     'Writing & Content',   '✍️', 4),
  ('video-motion',    'Vidéo & Motion',          'Video & Motion',      '🎬', 5),
  ('finance-compta',  'Finance & Comptabilité',  'Finance & Accounting','💰', 6),
  ('formation',       'Formation & Coaching',    'Training & Coaching', '🎓', 7),
  ('audio-musique',   'Audio & Musique',         'Audio & Music',       '🎵', 8);

INSERT INTO countries (code, name_fr, name_en, currency, dial_code, flag_emoji) VALUES
  ('CI', 'Côte d''Ivoire', 'Ivory Coast', 'XOF', '+225', '🇨🇮'),
  ('SN', 'Sénégal',       'Senegal',     'XOF', '+221', '🇸🇳'),
  ('GH', 'Ghana',         'Ghana',       'GHS', '+233', '🇬🇭'),
  ('NG', 'Nigeria',       'Nigeria',     'NGN', '+234', '🇳🇬'),
  ('CM', 'Cameroun',      'Cameroon',    'XAF', '+237', '🇨🇲'),
  ('ML', 'Mali',          'Mali',        'XOF', '+223', '🇲🇱'),
  ('BF', 'Burkina Faso',  'Burkina Faso','XOF', '+226', '🇧🇫'),
  ('TG', 'Togo',          'Togo',        'XOF', '+228', '🇹🇬'),
  ('BJ', 'Bénin',         'Benin',       'XOF', '+229', '🇧🇯'),
  ('KE', 'Kenya',         'Kenya',       'KES', '+254', '🇰🇪'),
  ('MA', 'Maroc',         'Morocco',     'MAD', '+212', '🇲🇦');

INSERT INTO currencies (code, name, symbol, decimals) VALUES
  ('XOF', 'Franc CFA Ouest', 'FCFA', 0),
  ('XAF', 'Franc CFA Centre','FCFA', 0),
  ('GHS', 'Cedi Ghana',      'GH₵',  2),
  ('NGN', 'Naira Nigeria',   '₦',    2),
  ('KES', 'Shilling Kenya',  'KSh',  2),
  ('MAD', 'Dirham Maroc',    'MAD',  2),
  ('EUR', 'Euro',            '€',    2),
  ('USD', 'Dollar US',       '$',    2);

INSERT INTO payment_methods (operator, name, countries) VALUES
  ('orange_money', 'Orange Money', ARRAY['CI','SN','ML','BF','GN','CM']),
  ('mtn_momo',     'MTN MoMo',     ARRAY['CI','GH','NG','CM','RW','BJ']),
  ('wave',         'Wave',         ARRAY['CI','SN','ML','BF']),
  ('moov_money',   'Moov Money',   ARRAY['CI','BJ','TG','BF','ML']),
  ('credit_card',  'Carte bancaire',ARRAY['CI','SN','GH','NG','MA','KE']),
  ('bank_transfer','Virement bancaire',ARRAY['CI','SN','GH','NG','MA','KE']),
  ('sandbox',      'Sandbox Test', ARRAY['CI']);
