import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const userRole = pgEnum("user_role", ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]);
export const accountStatus = pgEnum("account_status", ["ACTIVE", "SUSPENDED", "BANNED", "DELETION_PENDING"]);
export const identityStatus = pgEnum("identity_status", ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"]);
export const sellerType = pgEnum("seller_type", ["INDIVIDUAL", "BUSINESS"]);
export const productStatus = pgEnum("product_status", ["DRAFT", "PENDING_REVIEW", "ACTIVE", "RESERVED", "SOLD", "REJECTED", "REMOVED"]);
export const productCondition = pgEnum("product_condition", ["NEW", "LIKE_NEW", "GOOD", "FAIR"]);
export const verificationStatus = pgEnum("verification_status", ["NOT_REQUIRED", "REQUESTED", "SUBMITTED", "VERIFIED", "REJECTED"]);
export const orderStatus = pgEnum("order_status", ["PENDING_PAYMENT", "PAID", "SELLER_PREPARING", "SHIPPED", "DELIVERED", "BUYER_CONFIRMATION_PENDING", "COMPLETED", "DISPUTED", "REFUND_PENDING", "REFUNDED", "CANCELLED"]);
export const paymentStatus = pgEnum("payment_status", ["CREATED", "AUTHORIZED", "CAPTURED", "HELD", "RELEASED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED", "FAILED"]);
export const payoutStatus = pgEnum("payout_status", ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"]);
export const shippingStatus = pgEnum("shipping_status", ["NOT_READY", "PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED", "LOST"]);
export const disputeReason = pgEnum("dispute_reason", ["ITEM_NOT_RECEIVED", "ITEM_NOT_AS_DESCRIBED", "DAMAGED", "COUNTERFEIT", "PAYMENT", "RETURN", "OTHER"]);
export const disputeStatus = pgEnum("dispute_status", ["OPEN", "UNDER_REVIEW", "WAITING_BUYER", "WAITING_SELLER", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"]);
export const commissionType = pgEnum("commission_type", ["PERCENTAGE", "FIXED", "HYBRID"]);
export const legalType = pgEnum("legal_type", ["USER_AGREEMENT", "MARKETPLACE_AGREEMENT", "SELLER_AGREEMENT", "PRIVACY_NOTICE", "KVKK_NOTICE", "COOKIE_POLICY", "DISTANCE_SALES_INFORMATION", "DISTANCE_SALES_AGREEMENT_TEMPLATE", "RETURN_REFUND_POLICY", "PROHIBITED_PRODUCTS_POLICY", "DISPUTE_POLICY", "COMMISSION_POLICY"]);
export const consentCategory = pgEnum("consent_category", ["NECESSARY", "ANALYTICS", "MARKETING"]);
export const dataRequestType = pgEnum("data_request_type", ["EXPORT", "DELETION"]);
export const dataRequestStatus = pgEnum("data_request_status", ["REQUESTED", "PROCESSING", "COMPLETED", "REJECTED"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  role: userRole("role").default("USER").notNull(),
  status: accountStatus("status").default("ACTIVE").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  sessionInvalidBefore: timestamp("session_invalid_before", { withTimezone: true }),
  lastReauthenticatedAt: timestamp("last_reauthenticated_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("users_status_idx").on(table.status), index("users_role_idx").on(table.role)]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  profileImagePath: text("profile_image_path"),
  identityVerificationStatus: identityStatus("identity_verification_status").default("NOT_STARTED").notNull(),
  ...timestamps,
});

export const sellerProfiles = pgTable("seller_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  type: sellerType("seller_type").notNull(),
  payoutAccountReference: text("payout_account_reference"),
  ratingBasisPoints: integer("rating_basis_points").default(0).notNull(),
  completedSales: integer("completed_sales").default(0).notNull(),
  verificationStatus: identityStatus("verification_status").default("NOT_STARTED").notNull(),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  prohibited: boolean("prohibited").default(false).notNull(),
  ...timestamps,
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  title: varchar("title", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description").notNull(),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  condition: productCondition("condition").notNull(),
  priceKurus: integer("price_kurus").notNull(),
  status: productStatus("status").default("DRAFT").notNull(),
  location: varchar("location", { length: 120 }).notNull(),
  rejectionReason: text("rejection_reason"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("products_seller_idx").on(table.sellerId), index("products_category_status_idx").on(table.categoryId, table.status), index("products_status_created_idx").on(table.status, table.createdAt)]);

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  mimeType: varchar("mime_type", { length: 80 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("product_images_product_idx").on(table.productId, table.sortOrder)]);

export const productVerifications = pgTable("product_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().unique().references(() => products.id, { onDelete: "cascade" }),
  challengeCode: varchar("challenge_code", { length: 12 }),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  evidenceImagePath: text("evidence_image_path"),
  status: verificationStatus("status").default("NOT_REQUIRED").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  ...timestamps,
}, (table) => [index("product_verifications_status_idx").on(table.status)]);

export const favorites = pgTable("favorites", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.productId] }), index("favorites_user_idx").on(table.userId)]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  productTitle: varchar("product_title", { length: 160 }).notNull(),
  productPriceKurus: integer("product_price_kurus").notNull(),
  commissionType: commissionType("commission_type").notNull(),
  commissionPercentageBasisPoints: integer("commission_percentage_basis_points").notNull(),
  commissionFixedFeeKurus: integer("commission_fixed_fee_kurus").notNull(),
  platformFeeKurus: integer("platform_fee_kurus").notNull(),
  sellerNetAmountKurus: integer("seller_net_amount_kurus").notNull(),
  paymentStatus: paymentStatus("payment_status").default("CREATED").notNull(),
  status: orderStatus("order_status").default("PENDING_PAYMENT").notNull(),
  shippingStatus: shippingStatus("shipping_status").default("NOT_READY").notNull(),
  sellerShipBy: timestamp("seller_ship_by", { withTimezone: true }).notNull(),
  buyerConfirmBy: timestamp("buyer_confirm_by", { withTimezone: true }),
  buyerConfirmedAt: timestamp("buyer_confirmed_at", { withTimezone: true }),
  disputeDeadline: timestamp("dispute_deadline", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("orders_buyer_idx").on(table.buyerId, table.createdAt), index("orders_seller_idx").on(table.sellerId, table.createdAt), index("orders_status_idx").on(table.status), uniqueIndex("orders_active_product_idx").on(table.productId, table.status)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 60 }).notNull(),
  providerPaymentId: text("provider_payment_id").notNull().unique(),
  amountKurus: integer("amount_kurus").notNull(),
  currency: varchar("currency", { length: 3 }).default("TRY").notNull(),
  status: paymentStatus("status").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull().unique(),
  providerMetadata: jsonb("provider_metadata").$type<Record<string, string>>().default({}).notNull(),
  ...timestamps,
}, (table) => [index("payments_order_status_idx").on(table.orderId, table.status)]);

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  providerPayoutId: text("provider_payout_id").unique(),
  amountKurus: integer("amount_kurus").notNull(),
  status: payoutStatus("status").default("PENDING").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull().unique(),
  ...timestamps,
}, (table) => [index("payouts_seller_status_idx").on(table.sellerId, table.status)]);

export const shippingRecords = pgTable("shipping_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 60 }).default("MANUAL").notNull(),
  shippingCompany: varchar("shipping_company", { length: 100 }).notNull(),
  trackingNumber: varchar("tracking_number", { length: 120 }).notNull(),
  status: shippingStatus("status").default("SHIPPED").notNull(),
  shippedAt: timestamp("shipped_at", { withTimezone: true }).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("shipping_tracking_idx").on(table.shippingCompany, table.trackingNumber)]);

export const trackingEvents = pgTable("tracking_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  shippingRecordId: uuid("shipping_record_id").notNull().references(() => shippingRecords.id, { onDelete: "cascade" }),
  status: shippingStatus("status").notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  location: varchar("location", { length: 160 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("tracking_events_record_idx").on(table.shippingRecordId, table.occurredAt)]);

export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  openedBy: uuid("opened_by").notNull().references(() => users.id),
  reason: disputeReason("reason").notNull(),
  description: text("description").notNull(),
  status: disputeStatus("status").default("OPEN").notNull(),
  assignedAdmin: uuid("assigned_admin").references(() => users.id),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("disputes_order_idx").on(table.orderId), index("disputes_status_idx").on(table.status)]);

export const disputeEvidence = pgTable("dispute_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  disputeId: uuid("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id),
  storagePath: text("storage_path").notNull(),
  mimeType: varchar("mime_type", { length: 80 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("dispute_evidence_dispute_idx").on(table.disputeId)]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  receiverId: uuid("receiver_id").notNull().references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("messages_order_idx").on(table.orderId, table.createdAt), index("messages_receiver_idx").on(table.receiverId, table.readAt)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
  reviewedUserId: uuid("reviewed_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: varchar("comment", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("reviews_order_reviewer_idx").on(table.orderId, table.reviewerId), index("reviews_reviewed_user_idx").on(table.reviewedUserId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, string>>().default({}).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("notifications_user_read_idx").on(table.userId, table.readAt)]);

export const platformSettings = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  commissionType: commissionType("commission_type").default("PERCENTAGE").notNull(),
  percentageBasisPoints: integer("percentage_basis_points").default(500).notNull(),
  fixedFeeKurus: integer("fixed_fee_kurus").default(0).notNull(),
  minimumFeeKurus: integer("minimum_fee_kurus").default(0).notNull(),
  maximumFeeKurus: integer("maximum_fee_kurus"),
  disputePeriodHours: integer("dispute_period_hours").default(48).notNull(),
  sellerShippingDeadlineHours: integer("seller_shipping_deadline_hours").default(72).notNull(),
  buyerConfirmationPeriodHours: integer("buyer_confirmation_period_hours").default(48).notNull(),
  prohibitedCategories: jsonb("prohibited_categories").$type<string[]>().default([]).notNull(),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("target_type", { length: 80 }).notNull(),
  targetId: text("target_id").notNull(),
  oldValue: jsonb("old_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  previousHash: varchar("previous_hash", { length: 64 }),
  entryHash: varchar("entry_hash", { length: 64 }).notNull(),
}, (table) => [index("audit_actor_idx").on(table.actorId, table.timestamp), index("audit_target_idx").on(table.targetType, table.targetId)]);

export const legalDocuments = pgTable("legal_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: legalType("type").notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  active: boolean("active").default(false).notNull(),
  requiresLegalReview: boolean("requires_legal_review").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("legal_documents_type_version_idx").on(table.type, table.version), index("legal_documents_active_idx").on(table.type, table.active)]);

export const legalAcceptances = pgTable("legal_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => legalDocuments.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  userAgent: text("user_agent").notNull(),
}, (table) => [uniqueIndex("legal_acceptances_user_document_idx").on(table.userId, table.documentId)]);

export const orderLegalDocuments = pgTable("order_legal_documents", {
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => legalDocuments.id),
}, (table) => [primaryKey({ columns: [table.orderId, table.documentId] })]);

export const consentHistory = pgTable("consent_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  anonymousId: uuid("anonymous_id"),
  category: consentCategory("category").notNull(),
  granted: boolean("granted").notNull(),
  policyVersion: varchar("policy_version", { length: 32 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("consent_user_idx").on(table.userId, table.createdAt), index("consent_anonymous_idx").on(table.anonymousId, table.createdAt)]);

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 80 }).notNull(),
  recipientName: varchar("recipient_name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  city: varchar("city", { length: 80 }).notNull(),
  district: varchar("district", { length: 80 }).notNull(),
  postalCode: varchar("postal_code", { length: 16 }),
  addressLine: text("address_line").notNull(),
  ...timestamps,
}, (table) => [index("addresses_user_idx").on(table.userId)]);

export const dataRequests = pgTable("data_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: dataRequestType("type").notNull(),
  status: dataRequestStatus("status").default("REQUESTED").notNull(),
  processedBy: uuid("processed_by").references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("data_requests_status_idx").on(table.status, table.createdAt)]);

export const complianceItems = pgTable("compliance_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 240 }).notNull(),
  status: varchar("status", { length: 40 }).default("NOT_REVIEWED").notNull(),
  owner: varchar("owner", { length: 120 }),
  note: text("note"),
  evidenceUrl: text("evidence_url"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  updatedBy: uuid("updated_by").references(() => users.id),
  ...timestamps,
});

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: varchar("key", { length: 160 }).primaryKey(),
  operation: varchar("operation", { length: 100 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  response: jsonb("response").$type<Record<string, unknown>>(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
