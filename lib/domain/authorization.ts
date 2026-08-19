import { AuthorizationError } from "./errors";

export type Role = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
export const isAdminRole = (role: Role): boolean => ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role);
export const isSuperAdminRole = (role: Role): boolean => role === "SUPER_ADMIN";
export function assertOwner(ownerId: string, actorId: string): void { if (ownerId !== actorId) throw new AuthorizationError(); }
export function assertOrderParticipant(order: { buyerId: string; sellerId: string }, actorId: string): void { if (order.buyerId !== actorId && order.sellerId !== actorId) throw new AuthorizationError(); }
