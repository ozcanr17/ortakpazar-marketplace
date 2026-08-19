import { DomainError } from "./errors";

export function assertRequiredLegalAcceptances(requiredIds: readonly string[], acceptedIds: readonly string[]): void {
  const accepted = new Set(acceptedIds);
  if (!requiredIds.length || requiredIds.some((id) => !accepted.has(id))) throw new DomainError("LEGAL_ACCEPTANCE_REQUIRED", "Güncel sözleşmeler kabul edilmelidir");
}
