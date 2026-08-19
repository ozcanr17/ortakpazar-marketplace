export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','MODERATOR','ADMIN','SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','BANNED','DELETION_PENDING')),
    marketing_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    seller_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK (seller_type IN ('INDIVIDUAL','BUSINESS')),
    rating REAL NOT NULL DEFAULT 0,
    completed_sales INTEGER NOT NULL DEFAULT 0,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    condition TEXT NOT NULL CHECK (condition IN ('NEW','LIKE_NEW','GOOD','FAIR')),
    price_kurus INTEGER NOT NULL CHECK (price_kurus > 0),
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','RESERVED','SOLD','REJECTED','REMOVED')),
    location TEXT NOT NULL,
    image_key TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS product_verifications (
    product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    challenge_code TEXT,
    requested_at TEXT,
    submitted_at TEXT,
    evidence_image_key TEXT,
    status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    reviewed_by TEXT REFERENCES users(id),
    review_note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL REFERENCES users(id),
    seller_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    product_title TEXT NOT NULL,
    product_price_kurus INTEGER NOT NULL,
    platform_fee_kurus INTEGER NOT NULL,
    seller_net_amount_kurus INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'HELD',
    order_status TEXT NOT NULL DEFAULT 'SELLER_PREPARING',
    shipping_status TEXT NOT NULL DEFAULT 'NOT_READY',
    shipping_company TEXT,
    tracking_number TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT REFERENCES products(id),
    order_id TEXT REFERENCES orders(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
    opened_by TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dispute_evidence (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    submitted_by TEXT NOT NULL REFERENCES users(id),
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS data_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('EXPORT','DELETION')),
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    reviewed_user_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(order_id, reviewer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cookie_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    anonymous_id TEXT,
    analytics INTEGER NOT NULL,
    marketing INTEGER NOT NULL,
    policy_version TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    published_at TEXT NOT NULL,
    UNIQUE(type, version)
  )`,
  `CREATE TABLE IF NOT EXISTS legal_acceptances (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES legal_documents(id),
    accepted_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    PRIMARY KEY(user_id, document_id)
  )`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    commission_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
    percentage_basis_points INTEGER NOT NULL DEFAULT 500,
    fixed_fee_kurus INTEGER NOT NULL DEFAULT 0,
    minimum_fee_kurus INTEGER NOT NULL DEFAULT 0,
    maximum_fee_kurus INTEGER,
    maintenance_mode INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS compliance_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    owner TEXT,
    note TEXT,
    evidence_url TEXT,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token_hash, expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_seller_profiles_name ON seller_profiles(display_name)",
  "CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(receiver_id, sender_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON dispute_evidence(dispute_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_consents_user ON cookie_consents(user_id, created_at DESC)",
] as const;
