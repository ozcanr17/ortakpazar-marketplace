INSERT INTO "platform_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1 $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role IN ('MODERATOR','ADMIN','SUPER_ADMIN') AND status = 'ACTIVE') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_logs are immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_limit integer, p_window_seconds integer, p_block_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_record rate_limits%ROWTYPE;
BEGIN
  INSERT INTO rate_limits (key, count, window_started_at) VALUES (p_key, 0, now()) ON CONFLICT (key) DO NOTHING;
  SELECT * INTO v_record FROM rate_limits WHERE key = p_key FOR UPDATE;
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN RETURN false; END IF;
  IF v_record.window_started_at + make_interval(secs => p_window_seconds) <= now() THEN
    UPDATE rate_limits SET count = 1, window_started_at = now(), blocked_until = NULL WHERE key = p_key;
    RETURN true;
  END IF;
  IF v_record.count + 1 > p_limit THEN
    UPDATE rate_limits SET count = count + 1, blocked_until = now() + make_interval(secs => p_block_seconds) WHERE key = p_key;
    RETURN false;
  END IF;
  UPDATE rate_limits SET count = count + 1 WHERE key = p_key;
  RETURN true;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION create_marketplace_order(p_buyer_id uuid, p_product_id uuid, p_legal_document_ids uuid[], p_idempotency_key text, p_request_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_existing idempotency_keys%ROWTYPE; v_product products%ROWTYPE; v_settings platform_settings%ROWTYPE; v_order_id uuid; v_percentage_fee integer; v_fee integer;
BEGIN
  INSERT INTO idempotency_keys (key, operation, request_hash, expires_at) VALUES (p_idempotency_key, 'CREATE_ORDER', p_request_hash, now() + interval '24 hours') ON CONFLICT (key) DO NOTHING;
  SELECT * INTO v_existing FROM idempotency_keys WHERE key = p_idempotency_key FOR UPDATE;
  IF v_existing.request_hash <> p_request_hash THEN RAISE EXCEPTION 'idempotency key conflict'; END IF;
  IF v_existing.completed_at IS NOT NULL THEN RETURN (v_existing.response->>'orderId')::uuid; END IF;
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL OR v_product.status <> 'ACTIVE' THEN RAISE EXCEPTION 'product unavailable'; END IF;
  IF v_product.seller_id = p_buyer_id THEN RAISE EXCEPTION 'seller cannot buy own product'; END IF;
  SELECT * INTO v_settings FROM platform_settings WHERE id = 1 FOR UPDATE;
  v_percentage_fee := round(v_product.price_kurus::numeric * v_settings.percentage_basis_points / 10000)::integer;
  v_fee := CASE v_settings.commission_type WHEN 'PERCENTAGE' THEN v_percentage_fee WHEN 'FIXED' THEN v_settings.fixed_fee_kurus ELSE v_percentage_fee + v_settings.fixed_fee_kurus END;
  v_fee := greatest(v_fee, v_settings.minimum_fee_kurus);
  IF v_settings.maximum_fee_kurus IS NOT NULL THEN v_fee := least(v_fee, v_settings.maximum_fee_kurus); END IF;
  v_fee := least(v_fee, v_product.price_kurus);
  INSERT INTO orders (buyer_id, seller_id, product_id, product_title, product_price_kurus, commission_type, commission_percentage_basis_points, commission_fixed_fee_kurus, platform_fee_kurus, seller_net_amount_kurus, seller_ship_by) VALUES (p_buyer_id, v_product.seller_id, v_product.id, v_product.title, v_product.price_kurus, v_settings.commission_type, v_settings.percentage_basis_points, v_settings.fixed_fee_kurus, v_fee, v_product.price_kurus - v_fee, now() + make_interval(hours => v_settings.seller_shipping_deadline_hours)) RETURNING id INTO v_order_id;
  INSERT INTO order_legal_documents (order_id, document_id) SELECT v_order_id, unnest(p_legal_document_ids);
  UPDATE products SET status = 'RESERVED', updated_at = now() WHERE id = p_product_id;
  UPDATE idempotency_keys SET response = jsonb_build_object('orderId', v_order_id), completed_at = now() WHERE key = p_idempotency_key;
  RETURN v_order_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION transition_order(p_order_id uuid, p_expected order_status, p_next order_status) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_current order_status;
BEGIN
  SELECT order_status INTO v_current FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_current <> p_expected THEN RAISE EXCEPTION 'order state conflict'; END IF;
  UPDATE orders SET order_status = p_next, updated_at = now(), completed_at = CASE WHEN p_next = 'COMPLETED' THEN now() ELSE completed_at END, cancelled_at = CASE WHEN p_next = 'CANCELLED' THEN now() ELSE cancelled_at END WHERE id = p_order_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prepare_seller_payout(p_order_id uuid, p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order orders%ROWTYPE; v_payout_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status IN ('OPEN','UNDER_REVIEW','WAITING_BUYER','WAITING_SELLER')) THEN RAISE EXCEPTION 'open dispute blocks payout'; END IF;
  IF v_order.shipping_status <> 'DELIVERED' THEN RAISE EXCEPTION 'delivery required'; END IF;
  IF v_order.buyer_confirmed_at IS NULL AND (v_order.dispute_deadline IS NULL OR v_order.dispute_deadline > now()) THEN RAISE EXCEPTION 'release condition not met'; END IF;
  INSERT INTO payouts (order_id, seller_id, amount_kurus, status, idempotency_key) VALUES (p_order_id, v_order.seller_id, v_order.seller_net_amount_kurus, 'PENDING', p_idempotency_key) ON CONFLICT (order_id) DO UPDATE SET updated_at = payouts.updated_at RETURNING id INTO v_payout_id;
  RETURN v_payout_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_manual_shipment(p_order_id uuid, p_seller_id uuid, p_company text, p_tracking_number text, p_shipped_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order orders%ROWTYPE; v_shipping_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.seller_id <> p_seller_id OR v_order.order_status <> 'SELLER_PREPARING' THEN RAISE EXCEPTION 'shipment not allowed'; END IF;
  INSERT INTO shipping_records (order_id, shipping_company, tracking_number, shipped_at, status) VALUES (p_order_id, p_company, p_tracking_number, p_shipped_at, 'SHIPPED') RETURNING id INTO v_shipping_id;
  INSERT INTO tracking_events (shipping_record_id, status, description, occurred_at) VALUES (v_shipping_id, 'SHIPPED', 'Satıcı ürünü kargoya verdi', p_shipped_at);
  UPDATE orders SET order_status = 'SHIPPED', shipping_status = 'SHIPPED', updated_at = now() WHERE id = p_order_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION buyer_confirm_delivery(p_order_id uuid, p_buyer_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.buyer_id <> p_buyer_id OR v_order.shipping_status <> 'DELIVERED' OR v_order.order_status NOT IN ('DELIVERED','BUYER_CONFIRMATION_PENDING') THEN RAISE EXCEPTION 'confirmation not allowed'; END IF;
  UPDATE orders SET order_status = 'BUYER_CONFIRMATION_PENDING', buyer_confirmed_at = now(), updated_at = now() WHERE id = p_order_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION open_order_dispute(p_order_id uuid, p_opened_by uuid, p_reason dispute_reason, p_description text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order orders%ROWTYPE; v_dispute_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR p_opened_by NOT IN (v_order.buyer_id, v_order.seller_id) THEN RAISE EXCEPTION 'dispute not allowed'; END IF;
  IF v_order.order_status IN ('REFUNDED','CANCELLED') THEN RAISE EXCEPTION 'dispute not allowed'; END IF;
  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status IN ('OPEN','UNDER_REVIEW','WAITING_BUYER','WAITING_SELLER')) THEN RAISE EXCEPTION 'open dispute exists'; END IF;
  INSERT INTO disputes (order_id, opened_by, reason, description) VALUES (p_order_id, p_opened_by, p_reason, p_description) RETURNING id INTO v_dispute_id;
  UPDATE orders SET order_status = 'DISPUTED', updated_at = now() WHERE id = p_order_id;
  RETURN v_dispute_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION publish_legal_document(p_actor_id uuid, p_type legal_type, p_version text, p_title text, p_content text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_document_id uuid;
BEGIN
  UPDATE legal_documents SET active = false, updated_at = now() WHERE type = p_type AND active = true;
  INSERT INTO legal_documents (type, version, title, content, published_at, active, requires_legal_review) VALUES (p_type, p_version, p_title, p_content, now(), true, true) RETURNING id INTO v_document_id;
  RETURN v_document_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION admin_mark_delivered(p_order_id uuid, p_admin_id uuid, p_delivered_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order orders%ROWTYPE; v_shipping shipping_records%ROWTYPE; v_settings platform_settings%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role IN ('MODERATOR','ADMIN','SUPER_ADMIN') AND status = 'ACTIVE') THEN RAISE EXCEPTION 'admin required'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_shipping FROM shipping_records WHERE order_id = p_order_id FOR UPDATE;
  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  IF v_order.order_status NOT IN ('SHIPPED','DELIVERED') OR v_shipping.id IS NULL THEN RAISE EXCEPTION 'delivery transition not allowed'; END IF;
  UPDATE shipping_records SET status = 'DELIVERED', delivered_at = p_delivered_at, updated_at = now() WHERE id = v_shipping.id;
  INSERT INTO tracking_events (shipping_record_id, status, description, occurred_at) VALUES (v_shipping.id, 'DELIVERED', 'Teslimat yönetici tarafından doğrulandı', p_delivered_at);
  UPDATE orders SET order_status = 'BUYER_CONFIRMATION_PENDING', shipping_status = 'DELIVERED', buyer_confirm_by = p_delivered_at + make_interval(hours => v_settings.buyer_confirmation_period_hours), dispute_deadline = p_delivered_at + make_interval(hours => v_settings.dispute_period_hours), updated_at = now() WHERE id = p_order_id;
END $$;
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY categories_public_read ON categories FOR SELECT USING (active = true);
CREATE POLICY products_public_read ON products FOR SELECT USING (status = 'ACTIVE' OR seller_id = current_app_user_id() OR is_admin());
CREATE POLICY products_owner_insert ON products FOR INSERT WITH CHECK (seller_id = current_app_user_id());
CREATE POLICY products_owner_update ON products FOR UPDATE USING (seller_id = current_app_user_id() OR is_admin()) WITH CHECK (seller_id = current_app_user_id() OR is_admin());
CREATE POLICY product_images_read ON product_images FOR SELECT USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (p.status = 'ACTIVE' OR p.seller_id = current_app_user_id() OR is_admin())));
CREATE POLICY seller_profiles_public_read ON seller_profiles FOR SELECT USING (true);
CREATE POLICY profiles_owner_read ON profiles FOR SELECT USING (user_id = current_app_user_id() OR is_admin());
CREATE POLICY users_owner_read ON users FOR SELECT USING (id = current_app_user_id() OR is_admin());
CREATE POLICY favorites_owner_all ON favorites FOR ALL USING (user_id = current_app_user_id()) WITH CHECK (user_id = current_app_user_id());
CREATE POLICY orders_party_read ON orders FOR SELECT USING (buyer_id = current_app_user_id() OR seller_id = current_app_user_id() OR is_admin());
CREATE POLICY messages_party_read ON messages FOR SELECT USING (sender_id = current_app_user_id() OR receiver_id = current_app_user_id() OR is_admin());
CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (true);
CREATE POLICY legal_documents_public_read ON legal_documents FOR SELECT USING (active = true OR is_admin());
CREATE POLICY legal_acceptances_owner_read ON legal_acceptances FOR SELECT USING (user_id = current_app_user_id() OR is_admin());
CREATE POLICY consent_history_owner_read ON consent_history FOR SELECT USING (user_id = current_app_user_id() OR is_admin());
CREATE POLICY addresses_owner_all ON addresses FOR ALL USING (user_id = current_app_user_id()) WITH CHECK (user_id = current_app_user_id());
