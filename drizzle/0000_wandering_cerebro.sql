CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETION_PENDING');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('PERCENTAGE', 'FIXED', 'HYBRID');--> statement-breakpoint
CREATE TYPE "public"."consent_category" AS ENUM('NECESSARY', 'ANALYTICS', 'MARKETING');--> statement-breakpoint
CREATE TYPE "public"."data_request_status" AS ENUM('REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('EXPORT', 'DELETION');--> statement-breakpoint
CREATE TYPE "public"."dispute_reason" AS ENUM('ITEM_NOT_RECEIVED', 'ITEM_NOT_AS_DESCRIBED', 'DAMAGED', 'COUNTERFEIT', 'PAYMENT', 'RETURN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'WAITING_BUYER', 'WAITING_SELLER', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."identity_status" AS ENUM('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."legal_type" AS ENUM('USER_AGREEMENT', 'MARKETPLACE_AGREEMENT', 'SELLER_AGREEMENT', 'PRIVACY_NOTICE', 'KVKK_NOTICE', 'COOKIE_POLICY', 'DISTANCE_SALES_INFORMATION', 'DISTANCE_SALES_AGREEMENT_TEMPLATE', 'RETURN_REFUND_POLICY', 'PROHIBITED_PRODUCTS_POLICY', 'DISPUTE_POLICY', 'COMMISSION_POLICY');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_PAYMENT', 'PAID', 'SELLER_PREPARING', 'SHIPPED', 'DELIVERED', 'BUYER_CONFIRMATION_PENDING', 'COMPLETED', 'DISPUTED', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'AUTHORIZED', 'CAPTURED', 'HELD', 'RELEASED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'RESERVED', 'SOLD', 'REJECTED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('INDIVIDUAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."shipping_status" AS ENUM('NOT_READY', 'PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('NOT_REQUIRED', 'REQUESTED', 'SUBMITTED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"recipient_name" varchar(160) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"city" varchar(80) NOT NULL,
	"district" varchar(80) NOT NULL,
	"postal_code" varchar(16),
	"address_line" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_hash" varchar(64),
	"entry_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"prohibited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(120) NOT NULL,
	"title" varchar(240) NOT NULL,
	"status" varchar(40) DEFAULT 'NOT_REVIEWED' NOT NULL,
	"owner" varchar(120),
	"note" text,
	"evidence_url" text,
	"reviewed_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "consent_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_id" uuid,
	"category" "consent_category" NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "data_request_type" NOT NULL,
	"status" "data_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"processed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"reason" "dispute_reason" NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"assigned_admin" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(160) PRIMARY KEY NOT NULL,
	"operation" varchar(100) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response" jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"user_agent" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "legal_type" NOT NULL,
	"version" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone,
	"active" boolean DEFAULT false NOT NULL,
	"requires_legal_review" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"order_id" uuid,
	"product_id" uuid,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_legal_documents" (
	"order_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "order_legal_documents_order_id_document_id_pk" PRIMARY KEY("order_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_title" varchar(160) NOT NULL,
	"product_price_kurus" integer NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"commission_percentage_basis_points" integer NOT NULL,
	"commission_fixed_fee_kurus" integer NOT NULL,
	"platform_fee_kurus" integer NOT NULL,
	"seller_net_amount_kurus" integer NOT NULL,
	"payment_status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"order_status" "order_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"shipping_status" "shipping_status" DEFAULT 'NOT_READY' NOT NULL,
	"seller_ship_by" timestamp with time zone NOT NULL,
	"buyer_confirm_by" timestamp with time zone,
	"dispute_deadline" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(60) NOT NULL,
	"provider_payment_id" text NOT NULL,
	"amount_kurus" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'TRY' NOT NULL,
	"status" "payment_status" NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payments_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"provider_payout_id" text,
	"amount_kurus" integer NOT NULL,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payouts_provider_payout_id_unique" UNIQUE("provider_payout_id"),
	CONSTRAINT "payouts_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"commission_type" "commission_type" DEFAULT 'PERCENTAGE' NOT NULL,
	"percentage_basis_points" integer DEFAULT 500 NOT NULL,
	"fixed_fee_kurus" integer DEFAULT 0 NOT NULL,
	"minimum_fee_kurus" integer DEFAULT 0 NOT NULL,
	"maximum_fee_kurus" integer,
	"dispute_period_hours" integer DEFAULT 48 NOT NULL,
	"seller_shipping_deadline_hours" integer DEFAULT 72 NOT NULL,
	"buyer_confirmation_period_hours" integer DEFAULT 48 NOT NULL,
	"prohibited_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"challenge_code" varchar(12),
	"requested_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"evidence_image_path" text,
	"status" "verification_status" DEFAULT 'NOT_REQUIRED' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_verifications_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"condition" "product_condition" NOT NULL,
	"price_kurus" integer NOT NULL,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"location" varchar(120) NOT NULL,
	"rejection_reason" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"phone" varchar(32),
	"profile_image_path" text,
	"identity_verification_status" "identity_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewed_user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"seller_type" "seller_type" NOT NULL,
	"payout_account_reference" text,
	"rating_basis_points" integer DEFAULT 0 NOT NULL,
	"completed_sales" integer DEFAULT 0 NOT NULL,
	"verification_status" "identity_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(60) DEFAULT 'MANUAL' NOT NULL,
	"shipping_company" varchar(100) NOT NULL,
	"tracking_number" varchar(120) NOT NULL,
	"status" "shipping_status" DEFAULT 'SHIPPED' NOT NULL,
	"shipped_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_records_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipping_record_id" uuid NOT NULL,
	"status" "shipping_status" NOT NULL,
	"description" varchar(240) NOT NULL,
	"location" varchar(160),
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"session_invalid_before" timestamp with time zone,
	"last_reauthenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_history" ADD CONSTRAINT "consent_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_admin_users_id_fk" FOREIGN KEY ("assigned_admin") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_legal_documents" ADD CONSTRAINT "order_legal_documents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_legal_documents" ADD CONSTRAINT "order_legal_documents_document_id_legal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_verifications" ADD CONSTRAINT "product_verifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_verifications" ADD CONSTRAINT "product_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewed_user_id_users_id_fk" FOREIGN KEY ("reviewed_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_records" ADD CONSTRAINT "shipping_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipping_record_id_shipping_records_id_fk" FOREIGN KEY ("shipping_record_id") REFERENCES "public"."shipping_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "consent_user_idx" ON "consent_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "consent_anonymous_idx" ON "consent_history" USING btree ("anonymous_id","created_at");--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_idx" ON "dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "disputes_order_idx" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptances_user_document_idx" ON "legal_acceptances" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_type_version_idx" ON "legal_documents" USING btree ("type","version");--> statement-breakpoint
CREATE INDEX "legal_documents_active_idx" ON "legal_documents" USING btree ("type","active");--> statement-breakpoint
CREATE INDEX "messages_order_idx" ON "messages" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_receiver_idx" ON "messages" USING btree ("receiver_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_seller_idx" ON "orders" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("order_status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_active_product_idx" ON "orders" USING btree ("product_id","order_status");--> statement-breakpoint
CREATE INDEX "payments_order_status_idx" ON "payments" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "payouts_seller_status_idx" ON "payouts" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_verifications_status_idx" ON "product_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_seller_idx" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_status_created_idx" ON "products" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_reviewer_idx" ON "reviews" USING btree ("order_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewed_user_idx" ON "reviews" USING btree ("reviewed_user_id");--> statement-breakpoint
CREATE INDEX "shipping_tracking_idx" ON "shipping_records" USING btree ("shipping_company","tracking_number");--> statement-breakpoint
CREATE INDEX "tracking_events_record_idx" ON "tracking_events" USING btree ("shipping_record_id","occurred_at");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");