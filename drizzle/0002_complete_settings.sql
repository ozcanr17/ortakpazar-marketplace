ALTER TABLE platform_settings ADD COLUMN dispute_period_hours INTEGER NOT NULL DEFAULT 48;
ALTER TABLE platform_settings ADD COLUMN seller_shipping_deadline_hours INTEGER NOT NULL DEFAULT 72;
ALTER TABLE platform_settings ADD COLUMN buyer_confirmation_period_hours INTEGER NOT NULL DEFAULT 48;
ALTER TABLE platform_settings ADD COLUMN prohibited_categories TEXT NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash,expires_at);
